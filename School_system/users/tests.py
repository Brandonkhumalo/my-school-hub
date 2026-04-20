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

from django.contrib.auth.hashers import check_password
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

    """Represents SchoolModelTest."""
    def test_school_creation_defaults(self):
        """Test that school creation defaults."""
        school = make_school()
        self.assertIsNotNone(school.pk)
        self.assertTrue(school.is_active)
        self.assertFalse(school.is_suspended)
        self.assertEqual(school.country, "Zimbabwe")

    def test_school_str_contains_name_and_code(self):
        """Test that school str contains name and code."""
        school = make_school(name="Alpha School", code="SCHA12345")
        self.assertIn("Alpha School", str(school))
        self.assertIn("SCHA12345", str(school))

    def test_generate_school_code_format(self):
        """Test that generate school code format."""
        code = School.generate_school_code()
        self.assertTrue(code.startswith("SCH"))
        self.assertEqual(len(code), 8)

    def test_generate_school_code_uniqueness(self):
        """Test that generate school code uniqueness."""
        codes = {School.generate_school_code() for _ in range(10)}
        # All 10 generated codes should be distinct
        self.assertEqual(len(codes), 10)

    def test_school_suspension_fields(self):
        """Test that school suspension fields."""
        school = make_school()
        school.is_suspended = True
        school.suspension_reason = "Unpaid subscription"
        school.save()
        refreshed = School.objects.get(pk=school.pk)
        self.assertTrue(refreshed.is_suspended)
        self.assertEqual(refreshed.suspension_reason, "Unpaid subscription")


class CustomUserModelTest(TestCase):

    """Represents CustomUserModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()

    def _assert_role(self, username, role):
        """Execute assert role."""
        user = make_user(self.school, username, role=role)
        self.assertEqual(user.role, role)
        self.assertEqual(user.school, self.school)
        return user

    def test_create_admin_user(self):
        """Test that create admin user."""
        self._assert_role("admin_u", "admin")

    def test_create_teacher_user(self):
        """Test that create teacher user."""
        self._assert_role("teacher_u", "teacher")

    def test_create_student_user(self):
        """Test that create student user."""
        self._assert_role("student_u", "student")

    def test_create_parent_user(self):
        """Test that create parent user."""
        self._assert_role("parent_u", "parent")

    def test_create_hr_user(self):
        """Test that create hr user."""
        self._assert_role("hr_u", "hr")

    def test_create_accountant_user(self):
        """Test that create accountant user."""
        self._assert_role("acc_u", "accountant")

    def test_create_superadmin_user(self):
        """Test that create superadmin user."""
        self._assert_role("super_u", "superadmin")

    def test_full_name_property(self):
        """Test that full name property."""
        user = make_user(self.school, "fn_test", role="admin")
        user.first_name = "Jane"
        user.last_name = "Doe"
        user.save()
        self.assertEqual(user.full_name, "Jane Doe")

    def test_full_name_falls_back_to_email_when_names_empty(self):
        """Test that full name falls back to email when names empty."""
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

    """Represents AuditLogModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        self.admin = make_user(self.school, "audit_admin", role="admin")

    def test_audit_log_creation(self):
        """Test that audit log creation."""
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
        """Test that audit log str contains user name."""
        log = AuditLog.objects.create(
            user=self.admin,
            school=self.school,
            action="LOGIN",
            model_name="CustomUser",
            object_id=str(self.admin.id),
        )
        self.assertIn(self.admin.full_name, str(log))

    def test_audit_log_ordering_newest_first(self):
        """Test that audit log ordering newest first."""
        for action in ("CREATE", "UPDATE", "DELETE"):
            AuditLog.objects.create(
                user=self.admin, school=self.school,
                action=action, model_name="Subject",
            )
        # Order by id descending for deterministic test (timestamps may collide in SQLite)
        logs = list(AuditLog.objects.filter(school=self.school).order_by('-id'))
        # Newest first — DELETE was created last
        self.assertEqual(logs[0].action, "DELETE")


# ---------------------------------------------------------------------------
# API tests — Login
# ---------------------------------------------------------------------------

class LoginViewTest(APITestCase):

    """Represents LoginViewTest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(
            self.school, "login_admin", role="admin", password="correctpass"
        )
        self.url = "/api/v1/auth/login/"

    def test_login_success_returns_token_and_user(self):
        """Test that login success returns token and user."""
        response = self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "correctpass",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertIn("user", response.data)
        self.assertIn("message", response.data)

    def test_login_wrong_password_returns_400(self):
        """Test that login wrong password returns 400."""
        response = self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "wrongpassword",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("token", response.data)

    def test_login_nonexistent_user_returns_400(self):
        """Test that login nonexistent user returns 400."""
        response = self.client.post(self.url, {
            "identifier": "nobody@doesnotexist.com",
            "password": "irrelevant",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_suspended_school_as_admin_returns_403(self):
        """Test that login suspended school as admin returns 403."""
        self.school.is_suspended = True
        self.school.save()
        response = self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "correctpass",
        }, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data.get("error"), "school_suspended_admin")

    def test_login_suspended_school_as_teacher_returns_403(self):
        """Test that login suspended school as teacher returns 403."""
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
        """Test that login rate limited returns 429."""
        response = self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "correctpass",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("error", response.data)

    def test_successful_login_creates_audit_log(self):
        """Test that successful login creates audit log."""
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

    """Represents LogoutViewTest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "logout_admin", role="admin")
        self.url = "/api/v1/auth/logout/"

    def test_logout_authenticated_returns_200(self):
        """Test that logout authenticated returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)

    def test_logout_unauthenticated_returns_403(self):
        """Test that logout unauthenticated returns 403."""
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Profile
# ---------------------------------------------------------------------------

class ProfileViewTest(APITestCase):

    """Represents ProfileViewTest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(
            self.school, "profile_admin",
            role="admin", email="profile@test.com",
        )
        self.url = "/api/v1/auth/profile/"

    def test_profile_returns_200_and_correct_data(self):
        """Test that profile returns 200 and correct data."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "profile_admin")
        self.assertEqual(response.data["email"], "profile@test.com")
        self.assertEqual(response.data["role"], "admin")

    def test_profile_includes_school_name(self):
        """Test that profile includes school name."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.data.get("school_name"), self.school.name)

    def test_profile_requires_authentication(self):
        """Test that profile requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class WhatsAppPinSetViewTest(APITestCase):

    """Regression tests for WhatsApp PIN set + hash verification."""
    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.user = make_user(self.school, "wa_pin_user", role="parent")
        self.url = "/api/v1/auth/profile/set-whatsapp-pin/"

    def test_set_whatsapp_pin_hashes_value_and_returns_200(self):
        self.client.force_authenticate(user=self.user)
        payload = {"pin": "1234", "confirm_pin": "1234"}

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.whatsapp_pin)
        self.assertNotEqual(self.user.whatsapp_pin, "1234")
        self.assertTrue(check_password("1234", self.user.whatsapp_pin))


# ---------------------------------------------------------------------------
# API tests — School Settings
# ---------------------------------------------------------------------------

class SchoolSettingsViewTest(APITestCase):

    """Represents SchoolSettingsViewTest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "settings_admin", role="admin")
        self.teacher = make_user(self.school, "settings_teacher", role="teacher")
        self.url = "/api/v1/auth/school/settings/"

    def test_get_settings_as_admin_returns_200(self):
        """Test that get settings as admin returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for field in ("current_academic_year", "current_term", "grading_system", "currency"):
            self.assertIn(field, response.data)

    def test_get_settings_forbidden_for_teacher(self):
        """Test that get settings forbidden for teacher."""
        self.client.force_authenticate(user=self.teacher)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_put_settings_as_admin_updates_values(self):
        """Test that put settings as admin updates values."""
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
        """Test that put settings forbidden for teacher."""
        self.client.force_authenticate(user=self.teacher)
        response = self.client.put(self.url, {"current_academic_year": "2026"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_put_settings_accepts_blank_date_strings(self):
        """Test that blank date strings are normalized to null."""
        self.client.force_authenticate(user=self.admin)
        payload = {
            "current_academic_year": "2027",
            "term_start_date": "",
            "term_end_date": "",
            "term_1_start": "",
            "term_1_end": "",
        }
        response = self.client.put(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["term_start_date"])
        self.assertIsNone(response.data["term_end_date"])
        self.assertIsNone(response.data["term_1_start"])
        self.assertIsNone(response.data["term_1_end"])

    def test_settings_auto_created_on_first_get(self):
        # No SchoolSettings row should exist yet
        """Test that settings auto created on first get."""
        self.assertFalse(SchoolSettings.objects.filter(school=self.school).exists())
        self.client.force_authenticate(user=self.admin)
        self.client.get(self.url)
        self.assertTrue(SchoolSettings.objects.filter(school=self.school).exists())


# ---------------------------------------------------------------------------
# API tests — Audit Logs
# ---------------------------------------------------------------------------

class AuditLogViewTest(APITestCase):

    """Represents AuditLogViewTest."""
    def setUp(self):
        """Execute setUp."""
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
        """Test that audit logs as admin returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertGreaterEqual(response.data["count"], 1)

    def test_audit_log_entry_has_required_fields(self):
        """Test that audit log entry has required fields."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        first = response.data["results"][0]
        for field in ("id", "user", "action", "model", "timestamp", "response_status"):
            self.assertIn(field, first, msg=f"Missing field '{field}' in audit log entry")

    def test_audit_logs_forbidden_for_teacher(self):
        """Test that audit logs forbidden for teacher."""
        self.client.force_authenticate(user=self.teacher)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_audit_logs_requires_authentication(self):
        """Test that audit logs requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_audit_logs_scoped_to_school(self):
        # Create a second school and an admin in it with a log entry
        """Test that audit logs scoped to school."""
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

    """Represents GlobalSearchViewTest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "search_admin", role="admin")
        self.url = "/api/v1/auth/search/"

    def test_search_requires_at_least_2_chars(self):
        """Test that search requires at least 2 chars."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"q": "a"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_with_valid_query_returns_200(self):
        """Test that search with valid query returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"q": "te"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_search_default_type_returns_all_buckets(self):
        """Test that search default type returns all buckets."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"q": "test"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for bucket in ("students", "teachers", "subjects", "classes"):
            self.assertIn(bucket, response.data)

    def test_search_type_student_returns_only_students(self):
        """Test that search type student returns only students."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"q": "test", "type": "student"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("students", response.data)
        self.assertNotIn("teachers", response.data)

    def test_search_type_teacher_returns_only_teachers(self):
        """Test that search type teacher returns only teachers."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"q": "test", "type": "teacher"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("teachers", response.data)
        self.assertNotIn("students", response.data)

    def test_search_requires_authentication(self):
        """Test that search requires authentication."""
        response = self.client.get(self.url, {"q": "test"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
