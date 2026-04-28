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

from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.hashers import check_password
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import (
    AuditLog, CustomUser, School, SchoolSettings,
    HRPermissionProfile, HRPagePermission,
    AccountantPermissionProfile, AccountantPagePermission,
)


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

    @override_settings(LOGIN_LOCKOUT_THRESHOLD=3, LOGIN_LOCKOUT_MINUTES=15)
    @patch("users.views._check_rate_limit", return_value=False)
    def test_login_locks_account_after_threshold_failures(self, _mock):
        for _ in range(3):
            response = self.client.post(self.url, {
                "identifier": "login_admin@testschool.com",
                "password": "wrongpassword",
            }, format="json")

        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)
        self.admin.refresh_from_db()
        self.assertIsNotNone(self.admin.account_locked_until)
        self.assertGreaterEqual(self.admin.failed_login_attempts, 3)

    @override_settings(LOGIN_LOCKOUT_THRESHOLD=2, LOGIN_LOCKOUT_MINUTES=15)
    @patch("users.views._check_rate_limit", return_value=False)
    def test_locked_account_rejects_correct_password(self, _mock):
        self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "wrongpassword",
        }, format="json")
        self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "wrongpassword",
        }, format="json")

        response = self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "correctpass",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)
        self.assertEqual(response.data.get("error"), "account_locked")

    @override_settings(LOGIN_LOCKOUT_THRESHOLD=3, LOGIN_LOCKOUT_MINUTES=15)
    @patch("users.views._check_rate_limit", return_value=False)
    def test_successful_login_clears_failed_attempts(self, _mock):
        self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "wrongpassword",
        }, format="json")
        self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "wrongpassword",
        }, format="json")
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.failed_login_attempts, 2)

        response = self.client.post(self.url, {
            "identifier": "login_admin@testschool.com",
            "password": "correctpass",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.admin.refresh_from_db()
        self.assertEqual(self.admin.failed_login_attempts, 0)
        self.assertIsNone(self.admin.account_locked_until)


class UnlockUserLoginViewTest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "unlock_admin", role="admin")
        self.teacher = make_user(self.school, "unlock_teacher", role="teacher")
        self.other_school = make_school(name="Other", code="SCHLOCK2")
        self.other_admin = make_user(self.other_school, "other_unlock_admin", role="admin")
        self.url = f"/api/v1/auth/users/{self.teacher.id}/unlock-login/"

    def test_admin_unlocks_user_login_lockout(self):
        self.teacher.failed_login_attempts = 6
        from django.utils import timezone
        import datetime
        self.teacher.account_locked_until = timezone.now() + datetime.timedelta(minutes=10)
        self.teacher.save(update_fields=["failed_login_attempts", "account_locked_until"])

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.teacher.refresh_from_db()
        self.assertEqual(self.teacher.failed_login_attempts, 0)
        self.assertIsNone(self.teacher.account_locked_until)

    def test_non_admin_cannot_unlock(self):
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_unlock_user_in_other_school(self):
        self.client.force_authenticate(user=self.other_admin)
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# API tests — Superadmin
# ---------------------------------------------------------------------------

class SuperadminRegisterSecurityTest(APITestCase):
    """Superadmin registration must require configured secret."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/auth/superadmin/register/"
        self.payload = {
            "email": "superadmin@testschool.com",
            "password": "SuperPass123!",
            "full_name": "Root Admin",
            "secret_key": "TOP_SECRET",
        }

    @patch.dict("os.environ", {}, clear=True)
    def test_register_returns_503_when_secret_not_configured(self):
        response = self.client.post(self.url, self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(CustomUser.objects.filter(role="superadmin").count(), 0)

    @patch.dict("os.environ", {"SUPERADMIN_SECRET_KEY": "TOP_SECRET"}, clear=True)
    def test_register_succeeds_with_matching_configured_secret(self):
        response = self.client.post(self.url, self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(CustomUser.objects.filter(email="superadmin@testschool.com", role="superadmin").exists())

    @patch.dict("os.environ", {"SUPERADMIN_SECRET_KEY": "TOP_SECRET"}, clear=True)
    def test_register_forbidden_after_first_superadmin_exists(self):
        CustomUser.objects.create_user(
            username="existing_super",
            email="existing_super@testschool.com",
            password="SuperPass123!",
            first_name="Existing",
            last_name="Root",
            role="superadmin",
        )
        response = self.client.post(self.url, self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SuperadminEndpointsTest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Super School", code="SCHSUP01")
        self.superadmin = CustomUser.objects.create_user(
            username="root_super",
            email="root_super@testschool.com",
            password="RootPass123!",
            first_name="Root",
            last_name="Admin",
            role="superadmin",
        )
        self.superadmin_login_url = "/api/v1/auth/superadmin/login/"
        self.client.force_authenticate(user=self.superadmin)

    def test_superadmin_login_locks_after_repeated_failures(self):
        for _ in range(5):
            response = self.client.post(self.superadmin_login_url, {
                "email": "root_super@testschool.com",
                "password": "wrong-password",
            }, format="json")
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post(self.superadmin_login_url, {
            "email": "root_super@testschool.com",
            "password": "RootPass123!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)

        self.superadmin.refresh_from_db()
        self.assertIsNotNone(self.superadmin.account_locked_until)
        self.assertGreaterEqual(self.superadmin.failed_login_attempts, 5)

    def test_create_school_response_does_not_include_admin_password(self):
        payload = {
            "school_name": "No Password Academy",
            "school_location": "Harare",
            "school_type": "secondary",
            "accommodation_type": "day",
            "curriculum": "zimsec",
            "admin_email": "admin.nopass@example.com",
            "admin_phone": "+263771234500",
            "admin_password": "TempPass123!",
        }
        response = self.client.post("/api/v1/auth/superadmin/create-school/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("admin_password", response.data)

    def test_superadmin_stats_returns_extended_payload(self):
        response = self.client.get("/api/v1/auth/superadmin/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expected_keys = [
            "schools", "admins", "total_students", "total_teachers", "total_parents",
            "schools_active", "schools_suspended", "schools_by_type", "schools_by_curriculum",
            "schools_created_monthly", "platform_revenue_collected", "platform_outstanding_fees",
            "locked_admin_accounts",
        ]
        for key in expected_keys:
            self.assertIn(key, response.data)

    def test_superadmin_audit_logs_and_export_available(self):
        AuditLog.objects.create(
            user=self.superadmin, school=None, action="LOGIN", model_name="CustomUser", object_repr="seed"
        )
        response = self.client.get("/api/v1/auth/superadmin/audit-logs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)

        export_response = self.client.get("/api/v1/auth/superadmin/audit-logs/export/")
        self.assertEqual(export_response.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", export_response["Content-Type"])
        csv_text = export_response.content.decode("utf-8")
        self.assertIn("seed", csv_text)

    def test_superadmin_audit_export_honors_filters(self):
        school_two = make_school(name="Second School", code="SCHSUP02")
        user_two = make_user(self.school, "audit_user_two", role="admin", email="audit.two@example.com")
        other_user = make_user(school_two, "audit_user_other", role="admin", email="audit.other@example.com")

        first_log = AuditLog.objects.create(
            user=user_two,
            school=self.school,
            action="UPDATE",
            model_name="School",
            object_repr="target-log",
        )
        AuditLog.objects.create(
            user=other_user,
            school=school_two,
            action="DELETE",
            model_name="School",
            object_repr="exclude-log",
        )

        from_date = first_log.timestamp.date().isoformat()
        to_date = first_log.timestamp.date().isoformat()
        url = (
            "/api/v1/auth/superadmin/audit-logs/export/"
            f"?action=UPDATE&school_id={self.school.id}&user_id={user_two.id}"
            f"&user_q={user_two.email}&school_q=Super&date_from={from_date}&date_to={to_date}"
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.content.decode("utf-8")
        self.assertIn("target-log", body)
        self.assertNotIn("exclude-log", body)

    def test_superadmin_audit_logs_pagination_and_search(self):
        for idx in range(3):
            AuditLog.objects.create(
                user=self.superadmin,
                school=self.school,
                action="UPDATE",
                model_name="School",
                object_repr=f"Updated School {idx}",
            )
        response = self.client.get("/api/v1/auth/superadmin/audit-logs/?page=1&page_size=2&school_q=Super&user_q=root")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("page_size"), 2)
        self.assertEqual(response.data.get("page"), 1)
        self.assertTrue(response.data.get("total", 0) >= 3)
        self.assertEqual(len(response.data.get("results", [])), 2)

    def test_superadmin_locked_accounts_and_unlock(self):
        locked_user = make_user(self.school, "locked_u", role="admin")
        from django.utils import timezone
        import datetime
        locked_user.failed_login_attempts = 6
        locked_user.account_locked_until = timezone.now() + datetime.timedelta(minutes=5)
        locked_user.save(update_fields=["failed_login_attempts", "account_locked_until"])

        response = self.client.get("/api/v1/auth/superadmin/locked-accounts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data.get("total", 0), 1)

        unlock_response = self.client.post(f"/api/v1/auth/superadmin/locked-accounts/{locked_user.id}/unlock/", {}, format="json")
        self.assertEqual(unlock_response.status_code, status.HTTP_200_OK)
        locked_user.refresh_from_db()
        self.assertEqual(locked_user.failed_login_attempts, 0)
        self.assertIsNone(locked_user.account_locked_until)

    def test_superadmin_locked_accounts_pagination_and_query(self):
        for idx in range(3):
            user = make_user(self.school, f"locked_batch_{idx}", role="teacher", email=f"locked{idx}@example.com")
            from django.utils import timezone
            import datetime
            user.failed_login_attempts = 4
            user.account_locked_until = timezone.now() + datetime.timedelta(minutes=15)
            user.save(update_fields=["failed_login_attempts", "account_locked_until"])
        response = self.client.get("/api/v1/auth/superadmin/locked-accounts/?page=1&page_size=2&q=locked")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("page_size"), 2)
        self.assertEqual(len(response.data.get("results", [])), 2)

    def test_superadmin_system_health_endpoint(self):
        response = self.client.get("/api/v1/auth/superadmin/system-health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("database_ok", response.data)
        self.assertIn("python_version", response.data)
        self.assertIn("django_version", response.data)

    def test_superadmin_school_detail_panel_payload(self):
        from academics.models import Class, Parent, ParentChildLink, Student
        from django.utils import timezone
        import datetime

        teacher = make_user(self.school, "detail_teacher", role="teacher")
        parent_user = make_user(self.school, "detail_parent", role="parent")
        parent = Parent.objects.create(user=parent_user)
        student_user = make_user(self.school, "detail_student", role="student")
        class_obj = Class.objects.create(
            name="Form Detail A",
            grade_level=1,
            academic_year="2026",
            class_teacher=teacher,
            school=self.school,
        )
        student = Student.objects.create(
            user=student_user,
            student_class=class_obj,
            admission_date=date.today(),
        )
        ParentChildLink.objects.create(parent=parent, student=student, is_confirmed=True)
        parent.children.add(student)
        parent.schools.add(self.school)

        self.school.logo = "https://example.com/logo.png"
        self.school.save(update_fields=["logo"])

        locked_user = make_user(self.school, "detail_locked", role="admin")
        locked_user.failed_login_attempts = 5
        locked_user.account_locked_until = timezone.now() + datetime.timedelta(minutes=10)
        locked_user.save(update_fields=["failed_login_attempts", "account_locked_until"])

        AuditLog.objects.create(
            user=self.superadmin,
            school=self.school,
            action="UPDATE",
            model_name="School",
            object_repr="Detail panel activity",
        )

        response = self.client.get(f"/api/v1/auth/superadmin/schools/{self.school.id}/detail/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn("counts", response.data)
        self.assertIn("setup", response.data)
        self.assertIn("locked_accounts", response.data)
        self.assertIn("recent_audit_logs", response.data)

        counts = response.data["counts"]
        self.assertGreaterEqual(counts.get("students", 0), 1)
        self.assertGreaterEqual(counts.get("teachers", 0), 1)
        self.assertGreaterEqual(counts.get("parents", 0), 1)

        setup = response.data["setup"]
        self.assertTrue(setup.get("has_logo"))
        self.assertTrue(setup.get("has_classes"))
        self.assertIn("has_academic_period", setup)
        self.assertIn("two_factor_enforced", setup)

        locked_ids = [u["id"] for u in response.data["locked_accounts"]]
        self.assertIn(locked_user.id, locked_ids)
        self.assertGreaterEqual(len(response.data["recent_audit_logs"]), 1)


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


class RegisterSchoolPasswordStorageTest(APITestCase):
    """School onboarding must persist admin password as a hash on CustomUser."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/auth/schools/register/"

    def test_register_school_stores_hashed_admin_password(self):
        payload = {
            "school_name": "Hash Check Academy",
            "school_type": "secondary",
            "accommodation_type": "day",
            "curriculum": "zimsec",
            "admin_first_name": "Alice",
            "admin_last_name": "Admin",
            "admin_email": "alice.admin@example.com",
            "admin_phone": "+263771000111",
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        generated_password = response.data["admin_credentials"]["password"]
        admin_user = CustomUser.objects.get(email="alice.admin@example.com")

        self.assertNotEqual(admin_user.password, generated_password)
        self.assertTrue(admin_user.check_password(generated_password))


class RolePermissionDefaultAccessTest(APITestCase):
    """New HR/Accountant accounts should start with zero page access."""

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "perm_admin", role="admin")
        self.url = "/api/v1/auth/users/"

    def _payload(self, role, email_suffix):
        return {
            "first_name": "Role",
            "last_name": "Scoped",
            "email": f"{role}_{email_suffix}@testschool.com",
            "password": "StrongPass123!",
            "role": role,
            "salary": "1500.00",
            "hire_date": "2026-01-15",
        }

    def test_new_hr_user_starts_without_permissions(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, self._payload("hr", "new"), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = CustomUser.objects.get(id=response.data["id"])
        profile = HRPermissionProfile.objects.get(user=created)
        self.assertFalse(profile.is_root_boss)
        self.assertEqual(HRPagePermission.objects.filter(profile=profile).count(), 0)

    def test_new_accountant_user_starts_without_permissions(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, self._payload("accountant", "new"), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = CustomUser.objects.get(id=response.data["id"])
        profile = AccountantPermissionProfile.objects.get(user=created)
        self.assertFalse(profile.is_root_head)
        self.assertEqual(AccountantPagePermission.objects.filter(profile=profile).count(), 0)


class DashboardStatsRevenueTest(APITestCase):
    """Dashboard revenue should not be zero when paid invoices exist."""

    def setUp(self):
        from academics.models import Class, Student

        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "dash_admin", role="admin")
        self.url = "/api/v1/auth/dashboard/stats/"

        student_user = make_user(self.school, "dash_student", role="student")
        cls = Class.objects.create(
            name="Form 1A",
            grade_level=1,
            academic_year="2026",
            school=self.school,
        )
        self.student = Student.objects.create(
            user=student_user,
            student_class=cls,
            admission_date=date(2026, 1, 10),
        )

    def test_dashboard_revenue_falls_back_to_paid_invoices(self):
        from finances.models import Invoice

        Invoice.objects.create(
            student=self.student,
            invoice_number="INV-DASH-001",
            total_amount=Decimal("300.00"),
            amount_paid=Decimal("300.00"),
            due_date=date(2026, 3, 31),
            is_paid=True,
            school=self.school,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(float(response.data["total_revenue"]), 300.0)

    def test_dashboard_revenue_prefers_payment_record_total_when_higher(self):
        from finances.models import Invoice, StudentPaymentRecord

        Invoice.objects.create(
            student=self.student,
            invoice_number="INV-DASH-002",
            total_amount=Decimal("300.00"),
            amount_paid=Decimal("300.00"),
            due_date=date(2026, 3, 31),
            is_paid=True,
            school=self.school,
        )
        StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            academic_year="2026",
            academic_term="Term 1",
            total_amount_due=Decimal("500.00"),
            amount_paid=Decimal("450.00"),
            payment_status="partial",
            recorded_by=self.admin,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(float(response.data["total_revenue"]), 450.0)


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


# ---------------------------------------------------------------------------
# API tests — 2FA endpoints
# ---------------------------------------------------------------------------

class TwoFactorSetupTest(APITestCase):
    """Tests for 2FA setup, verify-setup, status, disable, and backup code endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.user = make_user(self.school, "twofa_user", role="admin")
        self.client.force_authenticate(user=self.user)

    def test_status_returns_disabled_when_no_config(self):
        response = self.client.get("/api/v1/auth/2fa/status/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["is_enabled"])

    def test_setup_returns_secret_and_qr_code(self):
        response = self.client.post("/api/v1/auth/2fa/setup/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("secret", response.data)
        self.assertIn("qr_code", response.data)
        self.assertTrue(response.data["qr_code"].startswith("data:image/png;base64,"))

    def test_setup_creates_config_with_secret(self):
        from users.models import TwoFactorAuthConfig

        self.client.post("/api/v1/auth/2fa/setup/")
        config = TwoFactorAuthConfig.objects.get(user=self.user)
        self.assertNotEqual(config.secret_key, "")
        self.assertFalse(config.is_enabled)

    def test_verify_setup_invalid_code_returns_400(self):
        self.client.post("/api/v1/auth/2fa/setup/")
        response = self.client.post("/api/v1/auth/2fa/verify-setup/", {"code": "000000"})
        self.assertEqual(response.status_code, 400)

    def test_verify_setup_with_valid_code_enables_2fa(self):
        import pyotp
        from users.models import TwoFactorAuthConfig

        setup_resp = self.client.post("/api/v1/auth/2fa/setup/")
        secret = setup_resp.data["secret"]
        valid_code = pyotp.TOTP(secret).now()
        response = self.client.post("/api/v1/auth/2fa/verify-setup/", {"code": valid_code})
        self.assertEqual(response.status_code, 200)
        self.assertIn("backup_codes", response.data)
        self.assertEqual(len(response.data["backup_codes"]), 10)
        config = TwoFactorAuthConfig.objects.get(user=self.user)
        self.assertTrue(config.is_enabled)

    def test_status_returns_enabled_after_setup(self):
        import pyotp
        from users.models import TwoFactorAuthConfig

        self.client.post("/api/v1/auth/2fa/setup/")
        config = TwoFactorAuthConfig.objects.get(user=self.user)
        valid_code = pyotp.TOTP(config.secret_key).now()
        self.client.post("/api/v1/auth/2fa/verify-setup/", {"code": valid_code})
        response = self.client.get("/api/v1/auth/2fa/status/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_enabled"])

    def test_disable_requires_correct_password(self):
        import pyotp
        from users.models import TwoFactorAuthConfig

        self.client.post("/api/v1/auth/2fa/setup/")
        config = TwoFactorAuthConfig.objects.get(user=self.user)
        self.client.post("/api/v1/auth/2fa/verify-setup/", {"code": pyotp.TOTP(config.secret_key).now()})
        response = self.client.post("/api/v1/auth/2fa/disable/", {"password": "wrongpassword"})
        self.assertEqual(response.status_code, 400)

    def test_disable_with_correct_password_disables_2fa(self):
        import pyotp
        from users.models import TwoFactorAuthConfig

        self.client.post("/api/v1/auth/2fa/setup/")
        config = TwoFactorAuthConfig.objects.get(user=self.user)
        self.client.post("/api/v1/auth/2fa/verify-setup/", {"code": pyotp.TOTP(config.secret_key).now()})
        response = self.client.post("/api/v1/auth/2fa/disable/", {"password": "testpass123"})
        self.assertEqual(response.status_code, 200)
        config.refresh_from_db()
        self.assertFalse(config.is_enabled)

    def test_regenerate_backup_codes_requires_2fa_enabled(self):
        response = self.client.post("/api/v1/auth/2fa/regenerate-backup-codes/")
        self.assertEqual(response.status_code, 400)

    def test_regenerate_backup_codes_returns_10_codes(self):
        import pyotp
        from users.models import TwoFactorAuthConfig

        self.client.post("/api/v1/auth/2fa/setup/")
        config = TwoFactorAuthConfig.objects.get(user=self.user)
        self.client.post("/api/v1/auth/2fa/verify-setup/", {"code": pyotp.TOTP(config.secret_key).now()})
        response = self.client.post("/api/v1/auth/2fa/regenerate-backup-codes/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["backup_codes"]), 10)

    def test_trusted_devices_list_empty_initially(self):
        response = self.client.get("/api/v1/auth/2fa/trusted-devices/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["devices"], [])

    def test_setup_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/v1/auth/2fa/setup/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TwoFactorLoginTest(APITestCase):
    """Tests for 2FA login flow (verify-otp, verify-backup)."""

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.user = make_user(self.school, "twofa_login_user", role="admin")

        from users.models import TwoFactorAuthConfig
        from users.utils.otp import generate_secret, generate_backup_codes, hash_backup_code

        self.secret = generate_secret()
        plain_codes = generate_backup_codes(10)
        self.plain_backup_code = plain_codes[0]
        hashed = [{"code_hash": hash_backup_code(c), "used": False} for c in plain_codes]
        self.config = TwoFactorAuthConfig.objects.create(
            user=self.user,
            is_enabled=True,
            secret_key=self.secret,
            backup_codes=hashed,
        )

    def _get_otp_session_token(self):
        with patch("users.views._check_rate_limit", return_value=False):
            response = self.client.post("/api/v1/auth/login/", {
                "identifier": "twofa_login_user",
                "password": "testpass123",
            }, format="json")
        self.assertEqual(response.status_code, 202)
        self.assertTrue(response.data.get("requires_2fa"))
        return response.data["otp_session_token"]

    def test_login_returns_202_when_2fa_enabled(self):
        self._get_otp_session_token()

    def test_verify_otp_with_valid_code_returns_token(self):
        import pyotp

        otp_token = self._get_otp_session_token()
        valid_code = pyotp.TOTP(self.secret).now()
        response = self.client.post("/api/v1/auth/2fa/verify-otp/", {
            "otp_session_token": otp_token,
            "code": valid_code,
            "trust_device": False,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        self.assertIn("user", response.data)

    def test_verify_otp_with_invalid_code_returns_400(self):
        otp_token = self._get_otp_session_token()
        response = self.client.post("/api/v1/auth/2fa/verify-otp/", {
            "otp_session_token": otp_token,
            "code": "000000",
            "trust_device": False,
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_verify_backup_with_valid_code_returns_token(self):
        otp_token = self._get_otp_session_token()
        response = self.client.post("/api/v1/auth/2fa/verify-backup/", {
            "otp_session_token": otp_token,
            "backup_code": self.plain_backup_code,
            "trust_device": False,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)

    def test_verify_backup_marks_code_as_used(self):
        otp_token = self._get_otp_session_token()
        self.client.post("/api/v1/auth/2fa/verify-backup/", {
            "otp_session_token": otp_token,
            "backup_code": self.plain_backup_code,
            "trust_device": False,
        }, format="json")
        self.config.refresh_from_db()
        self.assertTrue(self.config.backup_codes[0]["used"])

    def test_verify_backup_invalid_code_returns_400(self):
        otp_token = self._get_otp_session_token()
        response = self.client.post("/api/v1/auth/2fa/verify-backup/", {
            "otp_session_token": otp_token,
            "backup_code": "INVALID1",
            "trust_device": False,
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_verify_otp_with_invalid_session_token_returns_401(self):
        response = self.client.post("/api/v1/auth/2fa/verify-otp/", {
            "otp_session_token": "notavalidtoken",
            "code": "123456",
            "trust_device": False,
        }, format="json")
        self.assertEqual(response.status_code, 401)


class TwoFactorEnforcementTest(APITestCase):
    """Tests for admin 2FA enforcement and compliance endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "enforce_admin", role="admin")
        self.teacher = make_user(self.school, "enforce_teacher", role="teacher")
        SchoolSettings.objects.get_or_create(school=self.school)
        self.client.force_authenticate(user=self.admin)

    def test_enforce_2fa_requires_admin_role(self):
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post("/api/v1/auth/school/enforce-2fa/", {
            "enforce": True, "roles": ["teacher"], "grace_period_days": 7
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_enforce_2fa_activates_enforcement(self):
        response = self.client.post("/api/v1/auth/school/enforce-2fa/", {
            "enforce": True, "roles": ["teacher"], "grace_period_days": 7
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["enforce"])
        settings = SchoolSettings.objects.get(school=self.school)
        self.assertTrue(settings.enforce_2fa)
        self.assertIn("teacher", settings.enforce_2fa_for_roles)

    def test_enforce_2fa_disable_clears_settings(self):
        self.client.post("/api/v1/auth/school/enforce-2fa/", {
            "enforce": True, "roles": ["teacher"], "grace_period_days": 7
        }, format="json")
        response = self.client.post("/api/v1/auth/school/enforce-2fa/", {
            "enforce": False, "roles": [], "grace_period_days": 14
        }, format="json")
        self.assertEqual(response.status_code, 200)
        settings = SchoolSettings.objects.get(school=self.school)
        self.assertFalse(settings.enforce_2fa)

    def test_compliance_view_returns_data(self):
        self.client.post("/api/v1/auth/school/enforce-2fa/", {
            "enforce": True, "roles": ["teacher"], "grace_period_days": 14
        }, format="json")
        response = self.client.get("/api/v1/auth/2fa/compliance/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("compliance_by_role", response.data)
        self.assertIn("enforce_2fa", response.data)

    def test_compliance_view_requires_admin(self):
        self.client.force_authenticate(user=self.teacher)
        response = self.client.get("/api/v1/auth/2fa/compliance/")
        self.assertEqual(response.status_code, 403)

    def test_login_shows_requires_setup_after_deadline(self):
        from django.utils import timezone
        import datetime

        settings = SchoolSettings.objects.get(school=self.school)
        settings.enforce_2fa = True
        settings.enforce_2fa_for_roles = ["teacher"]
        settings.enforce_2fa_grace_period_days = 0
        settings.enforce_2fa_started_at = timezone.now() - datetime.timedelta(days=1)
        settings.save()

        self.client.force_authenticate(user=None)
        with patch("users.views._check_rate_limit", return_value=False):
            response = self.client.post("/api/v1/auth/login/", {
                "identifier": "enforce_teacher",
                "password": "testpass123",
            }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("requires_2fa_setup"))

    def test_login_shows_warning_during_grace_period(self):
        from django.utils import timezone

        settings = SchoolSettings.objects.get(school=self.school)
        settings.enforce_2fa = True
        settings.enforce_2fa_for_roles = ["teacher"]
        settings.enforce_2fa_grace_period_days = 14
        settings.enforce_2fa_started_at = timezone.now()
        settings.save()

        self.client.force_authenticate(user=None)
        with patch("users.views._check_rate_limit", return_value=False):
            response = self.client.post("/api/v1/auth/login/", {
                "identifier": "enforce_teacher",
                "password": "testpass123",
            }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("2fa_warning"))
        self.assertIn("token", response.data)
