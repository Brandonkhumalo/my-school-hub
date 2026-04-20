"""
Test suite for the staff app.

Covers:
  - Department, Staff model creation
  - HR dashboard stats   GET  /api/v1/staff/dashboard/
  - Department list/create GET/POST /api/v1/staff/departments/
  - Staff list           GET  /api/v1/staff/
  - Create staff         POST /api/v1/staff/create/
  - Leave list/create    GET/POST /api/v1/staff/leaves/
  - Leave review         POST /api/v1/staff/leaves/{id}/review/
  - Payroll              GET  /api/v1/staff/payroll/
"""

import datetime
from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import CustomUser, School, Notification
from staff.models import Attendance, Department, Leave, Payroll, PayrollPaymentRequest, Staff


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_school(name="Staff Test School"):
    """Execute make school."""
    return School.objects.create(
        name=name,
        code=School.generate_school_code(),
        school_type="secondary",
        curriculum="zimsec",
    )


def get_list(response_data):
    """Extract list from paginated or non-paginated DRF response."""
    if isinstance(response_data, dict) and 'results' in response_data:
        return response_data['results']
    return list(response_data)


def make_user(school, username, role="admin", password="testpass123", email=None,
              first_name="Staff", last_name="User"):
    """Execute make user."""
    if email is None:
        email = f"{username}@staffschool.test"
    return CustomUser.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role=role,
        school=school,
    )


def make_department(name="Science Department", head=None):
    """Execute make department."""
    return Department.objects.create(name=name, head=head)


def make_staff(user, department=None, position="teacher",
               salary=1200.00, hire_date=None):
    """Execute make staff."""
    if hire_date is None:
        hire_date = datetime.date(2022, 1, 10)

    # Generate a unique employee_id using a simple counter approach
    import secrets, string as _str
    while True:
        eid = "EMP" + "".join(secrets.choice(_str.digits) for _ in range(5))
        if not Staff.objects.filter(employee_id=eid).exists():
            break

    return Staff.objects.create(
        user=user,
        employee_id=eid,
        department=department,
        position=position,
        hire_date=hire_date,
        salary=Decimal(str(salary)),
    )


def make_leave(staff, leave_type="annual", start=None, end=None, days=5):
    """Execute make leave."""
    if start is None:
        start = datetime.date(2026, 4, 1)
    if end is None:
        end = datetime.date(2026, 4, 5)
    return Leave.objects.create(
        staff=staff,
        leave_type=leave_type,
        start_date=start,
        end_date=end,
        days_requested=days,
        reason="Planned vacation",
        status="pending",
    )


def make_payroll(staff, month="March", year=2026, basic=1200.00,
                 allowances=200.00, deductions=100.00):
    """Execute make payroll."""
    net = Decimal(str(basic)) + Decimal(str(allowances)) - Decimal(str(deductions))
    return Payroll.objects.create(
        staff=staff,
        month=month,
        year=year,
        basic_salary=Decimal(str(basic)),
        allowances=Decimal(str(allowances)),
        deductions=Decimal(str(deductions)),
        net_salary=net,
    )


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

class DepartmentModelTest(TestCase):

    """Represents DepartmentModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        self.head_user = make_user(self.school, "dept_head", role="admin")

    def test_department_creation_without_head(self):
        """Test that department creation without head."""
        dept = make_department("Mathematics Department")
        self.assertIsNotNone(dept.pk)
        self.assertEqual(dept.name, "Mathematics Department")
        self.assertIsNone(dept.head)

    def test_department_creation_with_head(self):
        """Test that department creation with head."""
        dept = make_department("Science Department", head=self.head_user)
        self.assertEqual(dept.head, self.head_user)

    def test_department_str(self):
        """Test that department str."""
        dept = make_department("Languages")
        self.assertIn("Languages", str(dept))


class StaffModelTest(TestCase):

    """Represents StaffModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        self.dept = make_department()

    def test_staff_creation(self):
        """Test that staff creation."""
        user = make_user(self.school, "staff_m1", role="teacher")
        staff = make_staff(user, department=self.dept, position="teacher")
        self.assertIsNotNone(staff.pk)
        self.assertTrue(staff.is_active)
        self.assertEqual(staff.position, "teacher")

    def test_staff_str(self):
        """Test that staff str."""
        user = make_user(self.school, "staff_str", role="hr")
        staff = make_staff(user, position="hr")
        self.assertIn("hr", str(staff))

    def test_staff_employee_id_uniqueness(self):
        """Test that staff employee id uniqueness."""
        user1 = make_user(self.school, "staff_u1", role="teacher")
        user2 = make_user(self.school, "staff_u2", role="teacher")
        staff1 = make_staff(user1, position="teacher")
        staff2 = make_staff(user2, position="teacher")
        self.assertNotEqual(staff1.employee_id, staff2.employee_id)

    def test_staff_salary_stored_correctly(self):
        """Test that staff salary stored correctly."""
        user = make_user(self.school, "staff_sal", role="accountant")
        staff = make_staff(user, salary=2500.50)
        self.assertEqual(staff.salary, Decimal("2500.50"))


class LeaveModelTest(TestCase):

    """Represents LeaveModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        user = make_user(self.school, "leave_staff", role="teacher")
        self.staff = make_staff(user, position="teacher")

    def test_leave_creation(self):
        """Test that leave creation."""
        leave = make_leave(self.staff, leave_type="sick")
        self.assertIsNotNone(leave.pk)
        self.assertEqual(leave.status, "pending")
        self.assertEqual(leave.leave_type, "sick")

    def test_leave_str(self):
        """Test that leave str."""
        leave = make_leave(self.staff)
        self.assertIn("annual", str(leave))
        self.assertIn("pending", str(leave))


class PayrollModelTest(TestCase):

    """Represents PayrollModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        user = make_user(self.school, "payroll_staff", role="teacher")
        self.staff = make_staff(user, position="teacher")

    def test_payroll_creation(self):
        """Test that payroll creation."""
        payroll = make_payroll(self.staff)
        self.assertIsNotNone(payroll.pk)
        self.assertFalse(payroll.is_paid)
        self.assertEqual(payroll.net_salary, Decimal("1300.00"))  # 1200+200-100

    def test_payroll_unique_per_staff_month_year(self):
        """Test that payroll unique per staff month year."""
        make_payroll(self.staff, month="March", year=2026)
        with self.assertRaises(Exception):
            make_payroll(self.staff, month="March", year=2026)

    def test_payroll_str(self):
        """Test that payroll str."""
        payroll = make_payroll(self.staff)
        self.assertIn("March", str(payroll))
        self.assertIn("2026", str(payroll))


# ---------------------------------------------------------------------------
# API tests — HR Dashboard
# ---------------------------------------------------------------------------

class HRDashboardAPITest(APITestCase):

    """Represents HRDashboardAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "hr_dash_admin", role="admin")
        self.hr = make_user(self.school, "hr_dash_hr", role="hr")
        self.teacher_user = make_user(self.school, "hr_dash_teacher", role="teacher")
        self.dept = make_department()

        # Create a staff member so the dashboard has real data
        staff_user = make_user(self.school, "hr_dash_staff", role="teacher")
        make_staff(staff_user, department=self.dept, position="teacher")

        self.url = "/api/v1/staff/dashboard/"

    def test_hr_dashboard_returns_200_for_admin(self):
        """Test that hr dashboard returns 200 for admin."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_hr_dashboard_returns_200_for_hr(self):
        """Test that hr dashboard returns 200 for hr."""
        self.client.force_authenticate(user=self.hr)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_hr_dashboard_contains_expected_keys(self):
        """Test that hr dashboard contains expected keys."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        for key in ("total_staff", "on_leave", "pending_leave_requests",
                    "departments", "upcoming_meetings"):
            self.assertIn(key, response.data, msg=f"Missing key: {key}")

    def test_hr_dashboard_forbidden_for_teacher(self):
        """Test that hr dashboard forbidden for teacher."""
        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_hr_dashboard_requires_authentication(self):
        """Test that hr dashboard requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_hr_dashboard_total_staff_count_is_accurate(self):
        # We created 1 staff above in setUp
        """Test that hr dashboard total staff count is accurate."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertGreaterEqual(response.data["total_staff"], 1)


# ---------------------------------------------------------------------------
# API tests — Departments
# ---------------------------------------------------------------------------

class DepartmentAPITest(APITestCase):

    """Represents DepartmentAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "dept_admin", role="admin")
        self.hr = make_user(self.school, "dept_hr", role="hr")

        # A department must have staff linked to the school for the queryset filter
        self.dept = make_department("Science")
        staff_user = make_user(self.school, "dept_staff", role="teacher")
        make_staff(staff_user, department=self.dept, position="teacher")

        self.url = "/api/v1/staff/departments/"

    def test_list_departments_returns_200(self):
        """Test that list departments returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_department_as_admin_returns_201(self):
        """Test that create department as admin returns 201."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "name": "Mathematics Department",
            "description": "Handles all math subjects",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Mathematics Department")

    def test_create_department_as_hr_returns_201(self):
        """Test that create department as hr returns 201."""
        self.client.force_authenticate(user=self.hr)
        response = self.client.post(self.url, {
            "name": "HR Department",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_departments_requires_authentication(self):
        """Test that list departments requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_department_response_contains_expected_fields(self):
        """Test that department response contains expected fields."""
        self.client.force_authenticate(user=self.admin)
        self.client.post(self.url, {"name": "Field Test Dept"}, format="json")
        response = self.client.get(self.url)
        items = get_list(response.data)
        if items:
            dept = items[0]
            for field in ("id", "name", "staff_count"):
                self.assertIn(field, dept)


# ---------------------------------------------------------------------------
# API tests — Staff list
# ---------------------------------------------------------------------------

class StaffListAPITest(APITestCase):

    """Represents StaffListAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "sl_admin", role="admin")
        self.dept = make_department("Languages")

        staff_user = make_user(self.school, "sl_teacher", role="teacher",
                                first_name="Alice", last_name="Wonder")
        self.staff = make_staff(staff_user, department=self.dept, position="teacher")

        self.url = "/api/v1/staff/"

    def test_list_staff_returns_200(self):
        """Test that list staff returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_staff_scoped_to_school(self):
        """Test that list staff scoped to school."""
        other_school = make_school(name="Other School")
        other_user = make_user(other_school, "other_staff_u", role="teacher")
        make_staff(other_user, position="teacher")

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        items = get_list(response.data)
        usernames = [s["user"]["email"] for s in items
                     if isinstance(s.get("user"), dict)]
        self.assertNotIn("other_staff_u@staffschool.test", usernames)

    def test_filter_staff_by_position(self):
        """Test that filter staff by position."""
        admin_user = make_user(self.school, "sl_admin_staff", role="admin")
        make_staff(admin_user, position="admin")

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"position": "teacher"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for entry in get_list(response.data):
            self.assertEqual(entry["position"], "teacher")

    def test_list_staff_requires_authentication(self):
        """Test that list staff requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Create staff
# ---------------------------------------------------------------------------

class CreateStaffAPITest(APITestCase):

    """Represents CreateStaffAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "cst_admin", role="admin")
        self.hr = make_user(self.school, "cst_hr", role="hr")
        self.teacher_user = make_user(self.school, "cst_teacher_user", role="teacher")
        self.url = "/api/v1/staff/create/"

    def _payload(self, suffix=""):
        """Execute payload."""
        return {
            "first_name": "New",
            "last_name": f"Employee{suffix}",
            "email": f"newemployee{suffix}@school.test",
            "position": "teacher",
            "hire_date": "2026-01-15",
            "salary": "1500.00",
        }

    def test_create_staff_as_admin_returns_201(self):
        """Test that create staff as admin returns 201."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, self._payload("_a"), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("staff", response.data)
        self.assertIn("credentials", response.data)
        self.assertIn("message", response.data)

    def test_create_staff_as_hr_returns_201(self):
        """Test that create staff as hr returns 201."""
        self.client.force_authenticate(user=self.hr)
        response = self.client.post(self.url, self._payload("_h"), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_staff_credentials_contain_password(self):
        """Test that create staff credentials contain password."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, self._payload("_cred"), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # The password should be provided so admin can share it with the new employee
        self.assertIn("password", response.data["credentials"])
        self.assertTrue(len(response.data["credentials"]["password"]) >= 8)

    def test_create_staff_as_teacher_is_forbidden(self):
        """Test that create staff as teacher is forbidden."""
        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.post(self.url, self._payload("_t"), format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_staff_requires_authentication(self):
        """Test that create staff requires authentication."""
        response = self.client.post(self.url, self._payload("_unauth"), format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_staff_duplicate_email_returns_400(self):
        """Test that create staff duplicate email returns 400."""
        self.client.force_authenticate(user=self.admin)
        payload = self._payload("_dup")
        self.client.post(self.url, payload, format="json")
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# API tests — Leaves
# ---------------------------------------------------------------------------

class LeaveAPITest(APITestCase):

    """Represents LeaveAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "leave_admin", role="admin")
        self.hr = make_user(self.school, "leave_hr", role="hr")

        # Staff member who will apply for leave
        staff_user = make_user(self.school, "leave_staff_u", role="teacher")
        self.staff = make_staff(staff_user, position="teacher")
        self.staff_user = staff_user

        self.url = "/api/v1/staff/leaves/"

    def test_list_leaves_as_hr_returns_200(self):
        """Test that list leaves as hr returns 200."""
        make_leave(self.staff)
        self.client.force_authenticate(user=self.hr)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_leaves_as_admin_returns_200(self):
        """Test that list leaves as admin returns 200."""
        make_leave(self.staff)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_staff_can_create_leave_request(self):
        """Test that staff can create leave request."""
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(self.url, {
            "leave_type": "annual",
            "start_date": "2026-05-01",
            "end_date": "2026-05-05",
            "days_requested": 5,
            "reason": "Family trip",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "pending")

    def test_staff_sees_only_own_leaves(self):
        """Test that staff sees only own leaves."""
        other_user = make_user(self.school, "leave_other_u", role="teacher")
        other_staff = make_staff(other_user, position="teacher")
        make_leave(other_staff)
        make_leave(self.staff)

        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Staff role should only see their own leave records
        staff_ids = {entry["staff"] for entry in get_list(response.data)}
        self.assertEqual(staff_ids, {self.staff.pk})

    def test_hr_sees_all_leaves(self):
        """Test that hr sees all leaves."""
        other_user = make_user(self.school, "leave_other2", role="teacher")
        other_staff = make_staff(other_user, position="teacher")
        make_leave(other_staff)
        make_leave(self.staff)

        self.client.force_authenticate(user=self.hr)
        response = self.client.get(self.url)
        self.assertGreaterEqual(len(get_list(response.data)), 2)

    def test_filter_leaves_by_status(self):
        """Test that filter leaves by status."""
        make_leave(self.staff, leave_type="sick")
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"status": "pending"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for entry in get_list(response.data):
            self.assertEqual(entry["status"], "pending")

    def test_list_leaves_requires_authentication(self):
        """Test that list leaves requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Leave review
# ---------------------------------------------------------------------------

class LeaveReviewAPITest(APITestCase):

    """Represents LeaveReviewAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "rev_admin", role="admin")
        self.hr = make_user(self.school, "rev_hr", role="hr")
        self.teacher_user = make_user(self.school, "rev_teacher_u", role="teacher")

        staff_user = make_user(self.school, "rev_staff_u", role="teacher")
        self.staff = make_staff(staff_user, position="teacher")
        self.leave = make_leave(self.staff)

    def _url(self, leave_id):
        """Execute url."""
        return f"/api/v1/staff/leaves/{leave_id}/review/"

    def test_hr_can_approve_leave(self):
        """Test that hr can approve leave."""
        self.client.force_authenticate(user=self.hr)
        response = self.client.post(self._url(self.leave.pk), {"status": "approved"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "approved")

    def test_admin_can_reject_leave(self):
        """Test that admin can reject leave."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._url(self.leave.pk), {"status": "rejected"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "rejected")

    def test_review_sets_approved_by_field(self):
        """Test that review sets approved by field."""
        self.client.force_authenticate(user=self.hr)
        self.client.post(self._url(self.leave.pk), {"status": "approved"}, format="json")
        self.leave.refresh_from_db()
        self.assertEqual(self.leave.approved_by, self.hr)

    def test_review_invalid_status_returns_400(self):
        """Test that review invalid status returns 400."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._url(self.leave.pk), {"status": "cancelled"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_review_forbidden_for_teacher(self):
        """Test that review forbidden for teacher."""
        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.post(self._url(self.leave.pk), {"status": "approved"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_review_nonexistent_leave_returns_404(self):
        """Test that review nonexistent leave returns 404."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._url(99999), {"status": "approved"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_review_requires_authentication(self):
        """Test that review requires authentication."""
        response = self.client.post(self._url(self.leave.pk), {"status": "approved"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Payroll
# ---------------------------------------------------------------------------

class PayrollAPITest(APITestCase):

    """Represents PayrollAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "pay_roll_admin", role="admin")
        self.hr = make_user(self.school, "pay_roll_hr", role="hr")
        self.accountant = make_user(self.school, "pay_roll_accountant", role="accountant")
        self.teacher_user = make_user(self.school, "pay_roll_teacher", role="teacher")

        staff_user = make_user(self.school, "pay_roll_staff", role="teacher")
        self.staff = make_staff(staff_user, position="teacher", salary=1400.00)
        self.payroll = make_payroll(self.staff)

        self.url = "/api/v1/staff/payroll/"

    def test_list_payroll_as_admin_returns_200(self):
        """Test that list payroll as admin returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_payroll_as_hr_returns_200(self):
        """Test that list payroll as hr returns 200."""
        self.client.force_authenticate(user=self.hr)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_payroll_as_accountant_returns_200(self):
        """Test that list payroll as accountant returns 200."""
        self.client.force_authenticate(user=self.accountant)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_payroll_entry_has_expected_fields(self):
        """Test that payroll entry has expected fields."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        items = get_list(response.data)
        self.assertGreater(len(items), 0)
        entry = items[0]
        for field in ("id", "staff", "month", "year", "basic_salary",
                      "net_salary", "is_paid"):
            self.assertIn(field, entry)

    def test_create_payroll_as_admin_returns_201(self):
        """Test that create payroll as admin returns 201."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "staff": self.staff.pk,
            "month": "April",
            "year": 2026,
            "basic_salary": "1400.00",
            "allowances": "150.00",
            "deductions": "50.00",
            "net_salary": "1500.00",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_payroll_as_accountant_forbidden(self):
        """Test that create payroll as accountant returns 403."""
        self.client.force_authenticate(user=self.accountant)
        response = self.client.post(self.url, {
            "staff": self.staff.pk,
            "month": "April",
            "year": 2026,
            "basic_salary": "1400.00",
            "allowances": "0.00",
            "deductions": "0.00",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_payroll_as_accountant_forbidden(self):
        """Test that update payroll as accountant returns 403."""
        self.client.force_authenticate(user=self.accountant)
        response = self.client.patch(f"{self.url}{self.payroll.pk}/", {
            "allowances": "100.00",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_payroll_summary_as_accountant_returns_200(self):
        """Test that payroll summary is visible to accountant."""
        self.client.force_authenticate(user=self.accountant)
        response = self.client.get(f"{self.url}summary/", {"month": "March", "year": 2026})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_net", response.data)
        self.assertIn("total_gross", response.data)

    def test_mark_all_payroll_paid_as_accountant_creates_pending_request(self):
        """Test accountant creates pending sign-off request instead of direct payment."""
        self.client.force_authenticate(user=self.accountant)
        response = self.client.post(f"{self.url}mark-paid/", {
            "month": "March",
            "year": 2026,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.payroll.refresh_from_db()
        self.assertFalse(self.payroll.is_paid)
        req = PayrollPaymentRequest.objects.get(id=response.data["request_id"])
        self.assertEqual(req.status, "pending")
        self.assertEqual(req.target_type, "all")

    def test_mark_selected_payroll_paid_creates_selected_request(self):
        """Test selected payroll request requires admin sign-off."""
        other_staff_user = make_user(self.school, "pay_roll_staff_2", role="teacher")
        other_staff = make_staff(other_staff_user, position="teacher", salary=1200.00)
        other_payroll = make_payroll(other_staff)

        self.client.force_authenticate(user=self.accountant)
        response = self.client.post(f"{self.url}mark-paid/", {
            "month": "March",
            "year": 2026,
            "staff_ids": [self.staff.id],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.payroll.refresh_from_db()
        other_payroll.refresh_from_db()
        self.assertFalse(self.payroll.is_paid)
        self.assertFalse(other_payroll.is_paid)
        req = PayrollPaymentRequest.objects.get(id=response.data["request_id"])
        self.assertEqual(req.target_type, "selected")
        self.assertEqual(req.staff_ids, [self.staff.id])

    def test_admin_can_approve_payroll_payment_request(self):
        """Test admin final sign-off marks salaries as paid."""
        self.client.force_authenticate(user=self.accountant)
        create_res = self.client.post(f"{self.url}mark-paid/", {
            "month": "March",
            "year": 2026,
            "staff_ids": [self.staff.id],
        }, format="json")
        req_id = create_res.data["request_id"]

        self.client.force_authenticate(user=self.admin)
        review_res = self.client.post(f"{self.url}payment-requests/{req_id}/review/", {
            "status": "approved",
        }, format="json")
        self.assertEqual(review_res.status_code, status.HTTP_200_OK)
        self.assertEqual(review_res.data["updated"], 1)
        self.payroll.refresh_from_db()
        self.assertTrue(self.payroll.is_paid)
        self.assertTrue(Notification.objects.filter(user=self.staff.user, title="Salary Paid").exists())

    def test_accountant_cannot_final_signoff_payroll_request(self):
        """Test final payroll sign-off is admin only."""
        req = PayrollPaymentRequest.objects.create(
            school=self.school,
            month="March",
            year=2026,
            target_type="all",
            requested_by=self.accountant,
        )
        self.client.force_authenticate(user=self.accountant)
        response = self.client.post(f"{self.url}payment-requests/{req.id}/review/", {
            "status": "approved",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_filter_payroll_by_month(self):
        """Test that filter payroll by month."""
        make_payroll(self.staff, month="January", year=2026)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"month": "March"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for entry in get_list(response.data):
            self.assertEqual(entry["month"], "March")

    def test_filter_payroll_by_year(self):
        """Test that filter payroll by year."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"year": "2026"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for entry in get_list(response.data):
            self.assertEqual(entry["year"], 2026)

    def test_payroll_scoped_to_school(self):
        """Test that payroll scoped to school."""
        other_school = make_school(name="Other Pay School")
        other_user = make_user(other_school, "other_pay_u", role="teacher")
        other_staff = make_staff(other_user, position="teacher")
        make_payroll(other_staff, month="March", year=2026)

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        # Payroll for other_school's staff must not appear
        staff_ids = {entry["staff"] for entry in get_list(response.data)}
        self.assertNotIn(other_staff.pk, staff_ids)

    def test_list_payroll_requires_authentication(self):
        """Test that list payroll requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
