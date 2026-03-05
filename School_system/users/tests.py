"""
Test suite for the users app.

Covers:
  - School and CustomUser model creation / validation
  - Login endpoint (success, wrong password, suspended school, rate-limit mock)
  - Logout endpoint
  - Profile endpoint GET
  - School settings GET / PUT
  - Audit log GET
  - Global search GET
"""

from unittest.mock import patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import AuditLog, CustomUser, School, SchoolSettings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_school(name="Test High School", code=None):
    """Create and return a School with a unique code."""
    if code is None:
        code = School.generate_school_code()
    return School.objects.create(
        name=name,
        code=code,
        school_type="secondary",
        curriculum="zimsec",
    )


def make_user(school, username, role="admin", email=None, password="testpass123"):
    """Create and return a CustomUser."""
    if email is None:
        email = f"{username}@testschool.com"
    return CustomUser.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name="Test",
        last_name="User",
        role=role,
        school=school,
    )


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

class SchoolModelTest(TestCase):

    def test_school_creation_defaults(self):
        school = make_school()
        self.assertIsNotNone(school.pk)
        self.assertTrue(school.is_active)
        self.assertFalse(school.is_suspended)
        self.assertEqual(school.country, "Zimbabwe")

    def test_school_str_contains_name_and_code(self):
        school = make_school(name="Alpha School", code="SCHA12345")
        self.assertIn("Alpha School", str(school))
        self.assertIn("SCHA12345", str(school))

    def test_generate_school_code_format(self):
        code = School.generate_school_code()
        self.assertTrue(code.startswith("SCH"))
        self.assertEqual(len(code), 8)

    def test_generate_school_code_uniqueness(self):
        codes = {School.generate_school_code() for _ in range(10)}
        # All 10 generated codes should be distinct
        self.assertEqual(len(codes), 10)

    def test_school_suspension_fields(self):
        school = make_school()
        school.is_suspended = True
        school.suspension_reason = "Unpaid subscription"
        school.save()
        refreshed = School.objects.get(pk=school.pk)
        self.assertTrue(refreshed.is_suspended)
        self.assertEqual(refreshed.suspension_reason, "Unpaid subscription")


class CustomUserModelTest(TestCase):

    def setUp(self):
        self.school = make_school()

    def _assert_role(self, username, role):
        user = make_user(self.school, username, role=role)
        self.assertEqual(user.role, role)
        self.assertEqual(user.school, self.school)
        return user

    def test_create_admin_user(self):
        self._assert_role("admin_u", "admin")

    def test_create_teacher_user(self):
        self._assert_role("teacher_u", "teacher")

    def test_create_student_user(self):
        self._assert_role("student_u", "student")

    def test_create_parent_user(self):
        self._assert_role("parent_u", "parent")

    def test_create_hr_user(self):
        self._assert_role("hr_u", "hr")

    def test_create_accountant_user(self):
        self._assert_role("acc_u", "accountant")

    def test_create_superadmin_user(self):
        self._assert_role("super_u", "superadmin")

    def test_full_name_property(self):
        user = make_user(self.school, "fn_test", role="admin")
        user.first_name = "Jane"
        user.last_name = "Doe"
        user.save()
        self.assertEqual(user.full_name, "Jane Doe")

    def test_full_name_falls_back_to_email_when_names_empty(self):
        user = CustomUser.objects.create_user(
            username="noname",
            email="noname@example.com",
            password="pass",
            role="admin",
            school=self.school,
            first_name="",
            last_name="",
        )
        self.assertEqual(user.full_name, "noname@example.com")


class AuditLogModelTest(TestCase):

    def setUp(self):
        self.school = make_school()
        self.admin = make_user(self.school, "audit_admin", role="admin")

    def test_audit_log_creation(self):
        log = AuditLog.objects.create(
            user=self.admin,
            school=self.school,
            action="CREATE",
            model_name="Student",
            object_id="42",
            object_repr="Student 042",
            response_status=201,
        )
        self.assertIsNotNone(log.pk)
        self.assertEqual(log.action, "CREATE")
        self.assertEqual(log.model_name, "Student")

    def test_audit_log_str_contains_user_name(self):
        log = AuditLog.objects.create(
            user=self.admin,
            school=self.school,
            action="LOGIN",
            model_name="CustomUser",
            object_id=str(self.admin.id),
        )
        self.assertIn(self.admin.full_name, str(log))

    def test_audit_log_ordering_newest_first(self):
        for action in ("CREATE", "UPDATE", "DELETE"):
            AuditLog.objects.create(
                user=self.admin, school=self.school,
                action=action, model_name="Subject",
            )
        logs = list(AuditLog.objects.filter(school=self.school))
        # Newest first — DELETE was created last
        self.assertEqual(logs[0].action, "DELETE")


# ---------------------------------------------------------------------------
# API tests — Login
# ---------------------------------------------------------------------------

class LoginViewTest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(
            self.school, "login_admin", role="admin", password="correctpass"
        )
        self.url = "/api/v1/auth/login/"

    def test_login_success_returns_token_and_user(self):
        response = self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "correctpass",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertIn("user", response.data)
        self.assertIn("message", response.data)

    def test_login_wrong_password_returns_400(self):
        response = self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "wrongpassword",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("token", response.data)

    def test_login_nonexistent_user_returns_400(self):
        response = self.client.post(self.url, {
            "identifier": "nobody@doesnotexist.com",
            "password": "irrelevant",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_suspended_school_as_admin_returns_403(self):
        self.school.is_suspended = True
        self.school.save()
        response = self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "correctpass",
        }, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data.get("error"), "school_suspended_admin")

    def test_login_suspended_school_as_teacher_returns_403(self):
        teacher = make_user(
            self.school, "susp_teacher", role="teacher", password="pass123"
        )
        self.school.is_suspended = True
        self.school.save()
        response = self.client.post(self.url, {
            "identifier": "susp_teacher@testschool.com",
            "password": "pass123",
        }, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data.get("error"), "school_suspended")

    @patch("users.views._check_rate_limit", return_value=True)
    def test_login_rate_limited_returns_429(self, _mock):
        response = self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "correctpass",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("error", response.data)

    def test_successful_login_creates_audit_log(self):
        before_count = AuditLog.objects.filter(action="LOGIN").count()
        self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "correctpass",
        }, format="json")
        self.assertGreater(
            AuditLog.objects.filter(action="LOGIN").count(), before_count
        )


# ---------------------------------------------------------------------------
# API tests — Logout
# ---------------------------------------------------------------------------

class LogoutViewTest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "logout_admin", role="admin")
        self.url = "/api/v1/auth/logout/"

    def test_logout_authenticated_returns_200(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)

    def test_logout_unauthenticated_returns_403(self):
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Profile
# ---------------------------------------------------------------------------

class ProfileViewTest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(
            self.school, "profile_admin",
            role="admin", email="profile@test.com",
        )
        self.url = "/api/v1/auth/profile/"

    def test_profile_returns_200_and_correct_data(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "profile_admin")
        self.assertEqual(response.data["email"], "profile@test.com")
        self.assertEqual(response.data["role"], "admin")

    def test_profile_includes_school_name(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.data.get("school_name"), self.school.name)

    def test_profile_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — School Settings
# ---------------------------------------------------------------------------

class SchoolSettingsViewTest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "settings_admin", role="admin")
        self.teacher = make_user(self.school, "settings_teacher", role="teacher")
        self.url = "/api/v1/auth/school/settings/"

    def test_get_settings_as_admin_returns_200(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for field in ("current_academic_year", "current_term", "grading_system", "currency"):
            self.assertIn(field, response.data)

    def test_get_settings_forbidden_for_teacher(self):
        self.client.force_authenticate(user=self.teacher)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_put_settings_as_admin_updates_values(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "current_academic_year": "2026",
            "current_term": "Term 2",
            "grading_system": "percentage",
            "currency": "ZWL",
            "max_students_per_class": 45,
        }
        response = self.client.put(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_academic_year"], "2026")
        self.assertEqual(response.data["current_term"], "Term 2")
        self.assertEqual(response.data["currency"], "ZWL")

    def test_put_settings_forbidden_for_teacher(self):
        self.client.force_authenticate(user=self.teacher)
        response = self.client.put(self.url, {"current_academic_year": "2026"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_settings_auto_created_on_first_get(self):
        # No SchoolSettings row should exist yet
        self.assertFalse(SchoolSettings.objects.filter(school=self.school).exists())
        self.client.force_authenticate(user=self.admin)
        self.client.get(self.url)
        self.assertTrue(SchoolSettings.objects.filter(school=self.school).exists())


# ---------------------------------------------------------------------------
# API tests — Audit Logs
# ---------------------------------------------------------------------------

class AuditLogViewTest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "auditlog_admin", role="admin")
        self.teacher = make_user(self.school, "auditlog_teacher", role="teacher")
        self.url = "/api/v1/auth/audit-logs/"

        AuditLog.objects.create(
            user=self.admin,
            school=self.school,
            action="LOGIN",
            model_name="CustomUser",
            object_id=str(self.admin.id),
            response_status=200,
        )

    def test_audit_logs_as_admin_returns_200(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertGreaterEqual(response.data["count"], 1)

    def test_audit_log_entry_has_required_fields(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        first = response.data["results"][0]
        for field in ("id", "user", "action", "model", "timestamp", "response_status"):
            self.assertIn(field, first, msg=f"Missing field '{field}' in audit log entry")

    def test_audit_logs_forbidden_for_teacher(self):
        self.client.force_authenticate(user=self.teacher)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_audit_logs_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_audit_logs_scoped_to_school(self):
        # Create a second school and an admin in it with a log entry
        other_school = make_school(name="Other School")
        other_admin = make_user(other_school, "other_admin", role="admin")
        AuditLog.objects.create(
            user=other_admin, school=other_school,
            action="CREATE", model_name="Student",
        )
        # First school admin should not see the other school's log
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        schools = {entry.get("school_id") for entry in response.data["results"]}
        self.assertNotIn(other_school.id, schools)


# ---------------------------------------------------------------------------
# API tests — Global Search
# ---------------------------------------------------------------------------

class GlobalSearchViewTest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "search_admin", role="admin")
        self.url = "/api/v1/auth/search/"

    def test_search_requires_at_least_2_chars(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"q": "a"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_with_valid_query_returns_200(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"q": "te"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_search_default_type_returns_all_buckets(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"q": "test"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for bucket in ("students", "teachers", "subjects", "classes"):
            self.assertIn(bucket, response.data)

    def test_search_type_student_returns_only_students(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"q": "test", "type": "student"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("students", response.data)
        self.assertNotIn("teachers", response.data)

    def test_search_type_teacher_returns_only_teachers(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"q": "test", "type": "teacher"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("teachers", response.data)
        self.assertNotIn("students", response.data)

    def test_search_requires_authentication(self):
        response = self.client.get(self.url, {"q": "test"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
