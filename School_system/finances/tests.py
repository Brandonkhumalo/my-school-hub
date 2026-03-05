"""
Test suite for the finances app.

Covers:
  - FeeType, StudentFee, Payment model creation
  - Fee list             GET  /api/v1/finances/student-fees/
  - Student payment record list/create
  - PayNow initiate      POST /api/v1/finances/payments/paynow/initiate/ (mocked)
  - Bulk fee CSV import  POST /api/v1/finances/fees/bulk-import/
"""

import datetime
import io
import csv
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import CustomUser, School
from academics.models import Class, Student, Teacher
from finances.models import (
    FeeType,
    Invoice,
    Payment,
    StudentFee,
    StudentPaymentRecord,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_school(name="Finance Test School"):
    return School.objects.create(
        name=name,
        code=School.generate_school_code(),
        school_type="secondary",
        curriculum="zimsec",
    )


def make_user(school, username, role="admin", password="testpass123", email=None):
    if email is None:
        email = f"{username}@finschool.test"
    return CustomUser.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name="Finance",
        last_name="User",
        role=role,
        school=school,
    )


def make_class(school, name="Form 3A", grade_level=3):
    return Class.objects.create(
        name=name,
        grade_level=grade_level,
        academic_year="2026",
        school=school,
    )


def make_student(school, cls, username="fin_student1", student_number="FIN001"):
    user = make_user(school, username, role="student")
    user.student_number = student_number
    user.save()
    return Student.objects.create(
        user=user,
        student_class=cls,
        admission_date=datetime.date(2024, 1, 10),
    )


def get_list(response_data):
    """Extract list from paginated or non-paginated DRF response."""
    if isinstance(response_data, dict) and 'results' in response_data:
        return response_data['results']
    return list(response_data)


def make_fee_type(school, name="Tuition Fee", amount=500.00, year="2026"):
    return FeeType.objects.create(
        name=name,
        amount=Decimal(str(amount)),
        academic_year=year,
    )


def make_student_fee(student, fee_type, amount_due=500.00, due_date=None, term="Term 1", year="2026"):
    if due_date is None:
        due_date = datetime.date(2026, 3, 31)
    return StudentFee.objects.create(
        student=student,
        fee_type=fee_type,
        amount_due=Decimal(str(amount_due)),
        due_date=due_date,
        academic_term=term,
        academic_year=year,
    )


def make_payment(student_fee, amount=200.00, method="cash", processed_by=None):
    return Payment.objects.create(
        student_fee=student_fee,
        amount=Decimal(str(amount)),
        payment_method=method,
        payment_status="completed",
        processed_by=processed_by,
    )


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

class FeeTypeModelTest(TestCase):

    def setUp(self):
        self.school = make_school()

    def test_fee_type_creation(self):
        ft = make_fee_type(self.school)
        self.assertIsNotNone(ft.pk)
        self.assertEqual(ft.name, "Tuition Fee")
        self.assertEqual(ft.amount, Decimal("500.00"))

    def test_fee_type_str(self):
        ft = make_fee_type(self.school, name="Development Levy", amount=100)
        self.assertIn("Development Levy", str(ft))
        self.assertIn("100", str(ft))


class StudentFeeModelTest(TestCase):

    def setUp(self):
        self.school = make_school()
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls)
        self.fee_type = make_fee_type(self.school)

    def test_student_fee_creation(self):
        sf = make_student_fee(self.student, self.fee_type)
        self.assertIsNotNone(sf.pk)
        self.assertFalse(sf.is_paid)
        self.assertEqual(sf.academic_term, "Term 1")

    def test_student_fee_balance_property(self):
        sf = make_student_fee(self.student, self.fee_type, amount_due=500.00)
        sf.amount_paid = Decimal("200.00")
        sf.save()
        self.assertEqual(sf.balance, Decimal("300.00"))

    def test_student_fee_str(self):
        sf = make_student_fee(self.student, self.fee_type)
        self.assertIn("Tuition Fee", str(sf))


class PaymentModelTest(TestCase):

    def setUp(self):
        self.school = make_school()
        self.admin = make_user(self.school, "pay_admin", role="admin")
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls, username="pay_student")
        self.fee_type = make_fee_type(self.school)
        self.student_fee = make_student_fee(self.student, self.fee_type)

    def test_payment_creation(self):
        payment = make_payment(self.student_fee, amount=250.00, processed_by=self.admin)
        self.assertIsNotNone(payment.pk)
        self.assertEqual(payment.payment_status, "completed")
        self.assertEqual(payment.payment_method, "cash")

    def test_payment_str(self):
        payment = make_payment(self.student_fee, amount=100.00)
        self.assertIn("100", str(payment))
        self.assertIn("completed", str(payment))

    def test_payment_status_choices(self):
        payment = Payment.objects.create(
            student_fee=self.student_fee,
            amount=Decimal("50.00"),
            payment_method="bank_transfer",
            payment_status="pending",
        )
        self.assertEqual(payment.payment_status, "pending")


class StudentPaymentRecordModelTest(TestCase):

    def setUp(self):
        self.school = make_school()
        self.admin = make_user(self.school, "spr_admin", role="admin")
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls, username="spr_student", student_number="SPR001")

    def test_student_payment_record_creation(self):
        record = StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            payment_type="school_fees",
            payment_plan="one_term",
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=Decimal("500.00"),
            amount_paid=Decimal("0.00"),
            payment_status="unpaid",
            recorded_by=self.admin,
        )
        self.assertIsNotNone(record.pk)
        self.assertFalse(record.is_fully_paid)

    def test_payment_record_balance_property(self):
        record = StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=Decimal("300.00"),
            amount_paid=Decimal("100.00"),
            payment_status="partial",
            recorded_by=self.admin,
        )
        self.assertEqual(record.balance, Decimal("200.00"))

    def test_payment_record_is_fully_paid(self):
        record = StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=Decimal("300.00"),
            amount_paid=Decimal("300.00"),
            payment_status="paid",
            recorded_by=self.admin,
        )
        self.assertTrue(record.is_fully_paid)


# ---------------------------------------------------------------------------
# API tests — Student Fees list
# ---------------------------------------------------------------------------

class StudentFeeAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "sfee_admin", role="admin")
        self.accountant = make_user(self.school, "sfee_acc", role="accountant")
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls, username="sfee_stu", student_number="SF001")
        self.fee_type = make_fee_type(self.school)
        make_student_fee(self.student, self.fee_type)
        self.url = "/api/v1/finances/student-fees/"

    def test_list_fees_as_admin_returns_200(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_fees_as_accountant_returns_200(self):
        self.client.force_authenticate(user=self.accountant)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_fees_scoped_to_school(self):
        other_school = make_school(name="Other School")
        other_cls = make_class(other_school, name="OtherCls")
        other_student = make_student(other_school, other_cls, username="other_stu", student_number="O999")
        other_ft = make_fee_type(other_school, name="Other Tuition")
        make_student_fee(other_student, other_ft)

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        student_ids = [f["student"] for f in get_list(response.data)]
        self.assertNotIn(other_student.pk, student_ids)

    def test_filter_fees_by_paid_status(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"is_paid": "false"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for fee in get_list(response.data):
            self.assertFalse(fee["is_paid"])

    def test_list_fees_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Payment Records
# ---------------------------------------------------------------------------

class PaymentRecordAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "pr_admin", role="admin")
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls, username="pr_student", student_number="PR001")
        self.url = "/api/v1/finances/payment-records/"

    def test_list_payment_records_returns_200(self):
        StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=Decimal("400.00"),
            amount_paid=Decimal("0.00"),
            payment_status="unpaid",
            recorded_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_payment_record_as_admin_returns_201(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "student": self.student.pk,
            "payment_type": "school_fees",
            "payment_plan": "one_term",
            "academic_year": "2026",
            "academic_term": "term_1",
            "total_amount_due": "500.00",
            "amount_paid": "0.00",
            "currency": "USD",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_payment_records_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — PayNow initiate (mocked external service)
# ---------------------------------------------------------------------------

class PayNowInitiateAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(
            self.school, "paynow_admin", role="admin",
            email="admin@paynow.test",
        )
        self.url = "/api/v1/finances/payments/paynow/initiate/"

    @patch("finances.paynow_service.initiate_web_payment")
    def test_paynow_web_initiate_success(self, mock_web):
        mock_web.return_value = {
            "success": True,
            "redirect_url": "https://paynow.co.zw/pay/abc123",
            "poll_url": "https://paynow.co.zw/poll/abc123",
            "error": None,
        }
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "amount": "250.00",
            "description": "School Fees Term 1",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn("redirect_url", response.data)
        mock_web.assert_called_once()

    @patch("finances.paynow_service.initiate_mobile_payment")
    def test_paynow_ecocash_initiate_success(self, mock_mobile):
        mock_mobile.return_value = {
            "success": True,
            "redirect_url": None,
            "poll_url": "https://paynow.co.zw/poll/mob123",
            "instructions": "Approve on EcoCash prompt",
            "error": None,
        }
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "amount": "150.00",
            "description": "Term 1 Fees",
            "method": "ecocash",
            "mobile_number": "0771234567",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        mock_mobile.assert_called_once()

    @patch("finances.paynow_service.initiate_mobile_payment")
    def test_paynow_mobile_requires_mobile_number(self, mock_mobile):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "amount": "100.00",
            "method": "ecocash",
            # mobile_number intentionally omitted
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        mock_mobile.assert_not_called()

    @patch("finances.paynow_service.initiate_web_payment")
    def test_paynow_rejects_zero_amount(self, mock_web):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "amount": "0",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_web.assert_not_called()

    @patch("finances.paynow_service.initiate_web_payment")
    def test_paynow_service_failure_returns_502(self, mock_web):
        mock_web.return_value = {
            "success": False,
            "redirect_url": None,
            "poll_url": None,
            "error": "Integration key invalid",
        }
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "amount": "100.00",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    def test_paynow_forbidden_for_hr_role(self):
        hr = make_user(self.school, "paynow_hr", role="hr")
        self.client.force_authenticate(user=hr)
        response = self.client.post(self.url, {
            "amount": "100.00",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_paynow_requires_authentication(self):
        response = self.client.post(self.url, {
            "amount": "100.00",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Bulk fee CSV import
# ---------------------------------------------------------------------------

class BulkFeeImportAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "bulk_admin", role="admin")
        self.accountant = make_user(self.school, "bulk_acc", role="accountant")
        self.cls = make_class(self.school)
        self.student = make_student(
            self.school, self.cls,
            username="bulk_student", student_number="BLK001",
        )
        self.url = "/api/v1/finances/fees/bulk-import/"

    def _make_csv(self, rows):
        """Build an in-memory CSV file from a list of row dicts."""
        buf = io.StringIO()
        if rows:
            writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        buf.seek(0)
        return io.BytesIO(buf.read().encode("utf-8"))

    def test_bulk_import_valid_csv_returns_200(self):
        csv_file = self._make_csv([{
            "student_number": "BLK001",
            "fee_type_name": "Tuition",
            "amount": "450.00",
            "academic_year": "2026",
            "academic_term": "Term 1",
        }])
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            self.url,
            {"file": csv_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data["created"], 0)
        self.assertEqual(len(response.data["errors"]), 0)

    def test_bulk_import_as_accountant_returns_200(self):
        csv_file = self._make_csv([{
            "student_number": "BLK001",
            "fee_type_name": "Development Levy",
            "amount": "50.00",
            "academic_year": "2026",
            "academic_term": "Term 1",
        }])
        self.client.force_authenticate(user=self.accountant)
        response = self.client.post(
            self.url,
            {"file": csv_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_bulk_import_with_unknown_student_number_reports_error(self):
        csv_file = self._make_csv([{
            "student_number": "XXXXXXX",
            "fee_type_name": "Tuition",
            "amount": "300.00",
            "academic_year": "2026",
            "academic_term": "Term 1",
        }])
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            self.url,
            {"file": csv_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created"], 0)
        self.assertGreater(len(response.data["errors"]), 0)

    def test_bulk_import_without_file_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_import_forbidden_for_teacher(self):
        teacher_user = make_user(self.school, "bulk_teacher", role="teacher")
        self.client.force_authenticate(user=teacher_user)
        csv_file = self._make_csv([])
        response = self.client.post(
            self.url,
            {"file": csv_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_bulk_import_requires_authentication(self):
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
