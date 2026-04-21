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

from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import CustomUser, School, SchoolSettings
from academics.models import Class, Student, Teacher
from finances.models import (
    AdditionalFee,
    FeeType,
    Invoice,
    Payment,
    PaymentIntent,
    SchoolFees,
    SchoolExpense,
    StudentFee,
    StudentPaymentRecord,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_school(name="Finance Test School"):
    """Execute make school."""
    return School.objects.create(
        name=name,
        code=School.generate_school_code(),
        school_type="secondary",
        curriculum="zimsec",
    )


def make_user(school, username, role="admin", password="testpass123", email=None):
    """Execute make user."""
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
    """Execute make class."""
    return Class.objects.create(
        name=name,
        grade_level=grade_level,
        academic_year="2026",
        school=school,
    )


def make_student(school, cls, username="fin_student1", student_number="FIN001"):
    """Execute make student."""
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
    """Execute make fee type."""
    return FeeType.objects.create(
        name=name,
        amount=Decimal(str(amount)),
        academic_year=year,
    )


def make_student_fee(student, fee_type, amount_due=500.00, due_date=None, term="Term 1", year="2026"):
    """Execute make student fee."""
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
    """Execute make payment."""
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

    """Represents FeeTypeModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()

    def test_fee_type_creation(self):
        """Test that fee type creation."""
        ft = make_fee_type(self.school)
        self.assertIsNotNone(ft.pk)
        self.assertEqual(ft.name, "Tuition Fee")
        self.assertEqual(ft.amount, Decimal("500.00"))

    def test_fee_type_str(self):
        """Test that fee type str."""
        ft = make_fee_type(self.school, name="Development Levy", amount=100)
        self.assertIn("Development Levy", str(ft))
        self.assertIn("100", str(ft))


class StudentFeeModelTest(TestCase):

    """Represents StudentFeeModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls)
        self.fee_type = make_fee_type(self.school)

    def test_student_fee_creation(self):
        """Test that student fee creation."""
        sf = make_student_fee(self.student, self.fee_type)
        self.assertIsNotNone(sf.pk)
        self.assertFalse(sf.is_paid)
        self.assertEqual(sf.academic_term, "Term 1")

    def test_student_fee_balance_property(self):
        """Test that student fee balance property."""
        sf = make_student_fee(self.student, self.fee_type, amount_due=500.00)
        sf.amount_paid = Decimal("200.00")
        sf.save()
        self.assertEqual(sf.balance, Decimal("300.00"))

    def test_student_fee_str(self):
        """Test that student fee str."""
        sf = make_student_fee(self.student, self.fee_type)
        self.assertIn("Tuition Fee", str(sf))


class PaymentModelTest(TestCase):

    """Represents PaymentModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        self.admin = make_user(self.school, "pay_admin", role="admin")
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls, username="pay_student")
        self.fee_type = make_fee_type(self.school)
        self.student_fee = make_student_fee(self.student, self.fee_type)

    def test_payment_creation(self):
        """Test that payment creation."""
        payment = make_payment(self.student_fee, amount=250.00, processed_by=self.admin)
        self.assertIsNotNone(payment.pk)
        self.assertEqual(payment.payment_status, "completed")
        self.assertEqual(payment.payment_method, "cash")

    def test_payment_str(self):
        """Test that payment str."""
        payment = make_payment(self.student_fee, amount=100.00)
        self.assertIn("100", str(payment))
        self.assertIn("completed", str(payment))

    def test_payment_status_choices(self):
        """Test that payment status choices."""
        payment = Payment.objects.create(
            student_fee=self.student_fee,
            amount=Decimal("50.00"),
            payment_method="bank_transfer",
            payment_status="pending",
        )
        self.assertEqual(payment.payment_status, "pending")


class StudentPaymentRecordModelTest(TestCase):

    """Represents StudentPaymentRecordModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        self.admin = make_user(self.school, "spr_admin", role="admin")
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls, username="spr_student", student_number="SPR001")

    def test_student_payment_record_creation(self):
        """Test that student payment record creation."""
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
        """Test that payment record balance property."""
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
        """Test that payment record is fully paid."""
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

    def test_invalid_payment_status_fails_full_clean(self):
        """Guard against invalid DB status writes like 'fully paid'."""
        record = StudentPaymentRecord(
            student=self.student,
            school=self.school,
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=Decimal("300.00"),
            amount_paid=Decimal("300.00"),
            payment_status="fully paid",
            recorded_by=self.admin,
        )
        with self.assertRaises(ValidationError):
            record.full_clean()


# ---------------------------------------------------------------------------
# API tests — Student Fees list
# ---------------------------------------------------------------------------

class StudentFeeAPITest(APITestCase):

    """Represents StudentFeeAPITest."""
    def setUp(self):
        """Execute setUp."""
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
        """Test that list fees as admin returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_fees_as_accountant_returns_200(self):
        """Test that list fees as accountant returns 200."""
        self.client.force_authenticate(user=self.accountant)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_fees_scoped_to_school(self):
        """Test that list fees scoped to school."""
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
        """Test that filter fees by paid status."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"is_paid": "false"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for fee in get_list(response.data):
            self.assertFalse(fee["is_paid"])

    def test_list_fees_requires_authentication(self):
        """Test that list fees requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Payment Records
# ---------------------------------------------------------------------------

class PaymentRecordAPITest(APITestCase):

    """Represents PaymentRecordAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "pr_admin", role="admin")
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls, username="pr_student", student_number="PR001")
        self.url = "/api/v1/finances/payment-records/"

        SchoolFees.objects.create(
            school=self.school,
            grade_level=self.cls.grade_level,
            grade_name=self.cls.name,
            tuition_fee=Decimal("500.00"),
            levy_fee=Decimal("0.00"),
            sports_fee=Decimal("0.00"),
            computer_fee=Decimal("0.00"),
            other_fees=Decimal("0.00"),
            academic_year="2026",
            academic_term="term_1",
            currency="USD",
            created_by=self.admin,
        )
        SchoolFees.objects.create(
            school=self.school,
            grade_level=self.cls.grade_level,
            grade_name=self.cls.name,
            tuition_fee=Decimal("600.00"),
            levy_fee=Decimal("0.00"),
            sports_fee=Decimal("0.00"),
            computer_fee=Decimal("0.00"),
            other_fees=Decimal("0.00"),
            academic_year="2026",
            academic_term="term_2",
            currency="USD",
            created_by=self.admin,
        )
        SchoolFees.objects.create(
            school=self.school,
            grade_level=self.cls.grade_level,
            grade_name=self.cls.name,
            tuition_fee=Decimal("700.00"),
            levy_fee=Decimal("0.00"),
            sports_fee=Decimal("0.00"),
            computer_fee=Decimal("0.00"),
            other_fees=Decimal("0.00"),
            academic_year="2026",
            academic_term="term_3",
            currency="USD",
            created_by=self.admin,
        )

    def test_list_payment_records_returns_200(self):
        """Test that list payment records returns 200."""
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
        """Test that create payment record as admin returns 201."""
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

    def test_two_terms_plan_calculates_due_from_selected_terms(self):
        """Two-term plan should calculate due from selected term + next term."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "student": self.student.pk,
            "payment_type": "school_fees",
            "payment_plan": "two_terms",
            "academic_year": "2026",
            "academic_term": "term_2",
            # Intentionally wrong client value; backend should compute 600 + 700 = 1300
            "total_amount_due": "1.00",
            "amount_paid": "0.00",
            "currency": "USD",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", response.data)
        record = StudentPaymentRecord.objects.get(id=response.data["id"])
        self.assertEqual(record.total_amount_due, Decimal("1300.00"))

    def test_two_terms_plan_rejects_starting_from_term_three(self):
        """Two-term plan cannot start at term_3."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "student": self.student.pk,
            "payment_type": "school_fees",
            "payment_plan": "two_terms",
            "academic_year": "2026",
            "academic_term": "term_3",
            "total_amount_due": "700.00",
            "amount_paid": "0.00",
            "currency": "USD",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("academic_term", response.data)

    def test_specific_terms_plan_calculates_due_from_selected_terms(self):
        """Specific-terms plan should sum exactly the selected terms."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "student": self.student.pk,
            "payment_type": "school_fees",
            "payment_plan": "specific_terms",
            "academic_year": "2026",
            "academic_term": "",
            "covered_terms": ["term_1", "term_3"],
            # Intentionally wrong client value; backend should compute 500 + 700 = 1200
            "total_amount_due": "1.00",
            "amount_paid": "0.00",
            "currency": "USD",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        record = StudentPaymentRecord.objects.get(id=response.data["id"])
        self.assertEqual(record.total_amount_due, Decimal("1200.00"))
        self.assertEqual(record.covered_terms, ["term_1", "term_3"])

    def test_specific_terms_plan_requires_at_least_one_term(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "student": self.student.pk,
            "payment_type": "school_fees",
            "payment_plan": "specific_terms",
            "academic_year": "2026",
            "academic_term": "",
            "covered_terms": [],
            "total_amount_due": "0.00",
            "amount_paid": "0.00",
            "currency": "USD",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("covered_terms", response.data)

    def test_list_payment_records_requires_authentication(self):
        """Test that list payment records requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_payment_record_admin_only_and_recalculates_additional_fees(self):
        """Admin delete should recalculate additional-fee paid flags from remaining records."""
        fee = AdditionalFee.objects.create(
            school=self.school,
            student=self.student,
            fee_name="Trip Fee",
            amount=Decimal("50.00"),
            reason="Trip",
            currency="USD",
            academic_year="2026",
            academic_term="term_1",
            is_paid=True,
            created_by=self.admin,
        )
        keep_record = StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            payment_type="school_fees",
            payment_plan="one_term",
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=Decimal("500.00"),
            amount_paid=Decimal("500.00"),
            currency="USD",
            payment_status="paid",
            recorded_by=self.admin,
        )
        delete_record = StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            payment_type="school_fees",
            payment_plan="one_term",
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=Decimal("200.00"),
            amount_paid=Decimal("300.00"),
            currency="USD",
            payment_status="paid",
            recorded_by=self.admin,
        )
        Invoice.objects.create(
            student=self.student,
            school=self.school,
            invoice_number="INV-DEL-001",
            total_amount=Decimal("200.00"),
            amount_paid=Decimal("300.00"),
            due_date=datetime.date(2026, 3, 31),
            is_paid=True,
            payment_record=delete_record,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f"{self.url}{delete_record.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        fee.refresh_from_db()
        # Remaining records have no extra overpayment, so additional fee should be outstanding.
        self.assertFalse(fee.is_paid)
        self.assertFalse(Invoice.objects.filter(payment_record=delete_record).exists())

        accountant = make_user(self.school, "pr_acc", role="accountant")
        # Create a fresh record for role restriction check.
        restricted_record = StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            payment_type="school_fees",
            payment_plan="one_term",
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=Decimal("100.00"),
            amount_paid=Decimal("0.00"),
            currency="USD",
            payment_status="unpaid",
            recorded_by=self.admin,
        )
        self.client.force_authenticate(user=accountant)
        response_forbidden = self.client.delete(f"{self.url}{restricted_record.id}/")
        self.assertEqual(response_forbidden.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — PayNow initiate (mocked external service)
# ---------------------------------------------------------------------------

class PayNowInitiateAPITest(APITestCase):

    """Represents PayNowInitiateAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(
            self.school, "paynow_admin", role="admin",
            email="admin@paynow.test",
        )
        # Configure PayNow credentials for the school (required by the view)
        SchoolSettings.objects.create(
            school=self.school,
            paynow_integration_id="TEST_ID_12345",
            paynow_integration_key="TEST_KEY_ABCDEF",
        )
        self.cls = make_class(self.school, name="Form 2B", grade_level=2)
        self.student = make_student(self.school, self.cls, username="paynow_student", student_number="PAY001")
        self.payment_record = StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            payment_type="school_fees",
            payment_plan="one_term",
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=Decimal("300.00"),
            amount_paid=Decimal("0.00"),
            currency="USD",
            payment_status="unpaid",
            recorded_by=self.admin,
        )
        self.url = "/api/v1/finances/payments/paynow/initiate/"

    @patch("finances.paynow_service.initiate_web_payment")
    def test_paynow_web_initiate_success(self, mock_web):
        """Test that paynow web initiate success."""
        mock_web.return_value = {
            "success": True,
            "redirect_url": "https://paynow.co.zw/pay/abc123",
            "poll_url": "https://paynow.co.zw/poll/abc123",
            "error": None,
        }
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "payment_record_id": self.payment_record.id,
            "amount": "250.00",
            "description": "School Fees Term 1",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn("redirect_url", response.data)
        self.assertIn("intent_id", response.data)
        self.assertTrue(PaymentIntent.objects.filter(id=response.data["intent_id"]).exists())
        mock_web.assert_called_once()

    @patch("finances.paynow_service.initiate_mobile_payment")
    def test_paynow_ecocash_initiate_success(self, mock_mobile):
        """Test that paynow ecocash initiate success."""
        mock_mobile.return_value = {
            "success": True,
            "redirect_url": None,
            "poll_url": "https://paynow.co.zw/poll/mob123",
            "instructions": "Approve on EcoCash prompt",
            "error": None,
        }
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "payment_record_id": self.payment_record.id,
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
        """Test that paynow mobile requires mobile number."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "payment_record_id": self.payment_record.id,
            "amount": "100.00",
            "method": "ecocash",
            # mobile_number intentionally omitted
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        mock_mobile.assert_not_called()

    @patch("finances.paynow_service.initiate_web_payment")
    def test_paynow_rejects_zero_amount(self, mock_web):
        """Test that paynow rejects zero amount."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "payment_record_id": self.payment_record.id,
            "amount": "0",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_web.assert_not_called()

    @patch("finances.paynow_service.initiate_web_payment")
    def test_paynow_service_failure_returns_502(self, mock_web):
        """Test that paynow service failure returns 502."""
        mock_web.return_value = {
            "success": False,
            "redirect_url": None,
            "poll_url": None,
            "error": "Integration key invalid",
        }
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "payment_record_id": self.payment_record.id,
            "amount": "100.00",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    def test_paynow_forbidden_for_hr_role(self):
        """Test that paynow forbidden for hr role."""
        hr = make_user(self.school, "paynow_hr", role="hr")
        self.client.force_authenticate(user=hr)
        response = self.client.post(self.url, {
            "payment_record_id": self.payment_record.id,
            "amount": "100.00",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_paynow_requires_authentication(self):
        """Test that paynow requires authentication."""
        response = self.client.post(self.url, {
            "payment_record_id": self.payment_record.id,
            "amount": "100.00",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("finances.paynow_service.initiate_web_payment")
    def test_paynow_rejects_overpayment_amount(self, mock_web):
        """Requested amount cannot exceed current payment-record balance."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "payment_record_id": self.payment_record.id,
            "amount": "999.00",
            "method": "web",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_web.assert_not_called()


class PayNowCallbackAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school("Callback School")
        self.admin = make_user(self.school, "callback_admin", role="admin")
        self.cls = make_class(self.school, name="Form 4A", grade_level=4)
        self.student = make_student(self.school, self.cls, username="callback_student", student_number="CB001")
        self.record = StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            payment_type="school_fees",
            payment_plan="one_term",
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=Decimal("400.00"),
            amount_paid=Decimal("0.00"),
            currency="USD",
            payment_status="unpaid",
            recorded_by=self.admin,
        )
        self.intent = PaymentIntent.objects.create(
            school=self.school,
            student=self.student,
            payment_record=self.record,
            expected_amount=Decimal("150.00"),
            currency="USD",
            provider_reference="MSH-CALLBACK-REF-001",
            idempotency_key="idem-callback-1",
            status="pending",
            created_by=self.admin,
        )
        self.url = "/api/v1/finances/payments/paynow/result/"

    def test_callback_marks_intent_paid_and_updates_record_amount(self):
        response = self.client.post(self.url, {
            "reference": self.intent.provider_reference,
            "paynowreference": "PAYNOW-REF-ABC",
            "status": "Paid",
            "amount": "150.00",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.intent.refresh_from_db()
        self.record.refresh_from_db()
        self.assertEqual(self.intent.status, "paid")
        self.assertEqual(self.record.amount_paid, Decimal("150.00"))
        self.assertEqual(self.record.payment_status, "partial")

# ---------------------------------------------------------------------------
# API tests — Bulk fee CSV import
# ---------------------------------------------------------------------------

class BulkFeeImportAPITest(APITestCase):

    """Represents BulkFeeImportAPITest."""
    def setUp(self):
        """Execute setUp."""
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
        """Test that bulk import valid csv returns 200."""
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
        """Test that bulk import as accountant returns 200."""
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
        """Test that bulk import with unknown student number reports error."""
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
        """Test that bulk import without file returns 400."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_import_forbidden_for_teacher(self):
        """Test that bulk import forbidden for teacher."""
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
        """Test that bulk import requires authentication."""
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class FinanceSummaryAndExpensesAPITest(APITestCase):
    """Tests for finance summary and expense approval workflow."""

    def setUp(self):
        self.client = APIClient()
        self.school = make_school("Finance Summary School")
        self.admin = make_user(self.school, "fin_admin", role="admin")
        self.accountant = make_user(self.school, "fin_acc", role="accountant")
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls, username="fin_sum_stu", student_number="FINSUM001")

        SchoolSettings.objects.create(
            school=self.school,
            current_academic_year="2026",
            current_term="Term 1",
            term_1_start=datetime.date(2026, 1, 1),
            term_1_end=datetime.date(2026, 4, 30),
        )
        StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            payment_type="school_fees",
            payment_plan="one_term",
            academic_year="2026",
            academic_term="Term 1",
            total_amount_due=Decimal("1000.00"),
            amount_paid=Decimal("650.00"),
            payment_status="partial",
            recorded_by=self.admin,
        )
        SchoolExpense.objects.create(
            school=self.school,
            title="Internet",
            amount=Decimal("120.00"),
            expense_frequency="monthly",
            start_date=datetime.date(2026, 1, 1),
            status="approved",
            created_by=self.admin,
            approved_by=self.admin,
            approved_at=datetime.datetime.now(),
        )

    def test_finance_summary_as_accountant_returns_200(self):
        self.client.force_authenticate(user=self.accountant)
        response = self.client.get("/api/v1/finances/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("monthly_salary_total", response.data)
        self.assertIn("term_revenue", response.data)
        self.assertIn("term_expected_revenue", response.data)
        self.assertIn("term_collected_revenue", response.data)
        self.assertIn("term_outstanding_revenue", response.data)
        self.assertIn("term_profit", response.data)

    def test_accountant_can_create_expense_pending(self):
        self.client.force_authenticate(user=self.accountant)
        response = self.client.post("/api/v1/finances/expenses/", {
            "title": "Generator Fuel",
            "description": "Backup power",
            "amount": "300.00",
            "expense_frequency": "term",
            "start_date": "2026-02-01",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "pending")

    def test_admin_can_approve_expense(self):
        expense = SchoolExpense.objects.create(
            school=self.school,
            title="Transport Contract",
            amount=Decimal("450.00"),
            expense_frequency="term",
            start_date=datetime.date(2026, 2, 1),
            status="pending",
            created_by=self.accountant,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f"/api/v1/finances/expenses/{expense.id}/approve/", {
            "status": "approved",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expense.refresh_from_db()
        self.assertEqual(expense.status, "approved")

    def test_finance_summary_falls_back_to_current_year_when_term_dates_missing(self):
        today = datetime.date.today()

        StudentPaymentRecord.objects.filter(school=self.school).delete()
        settings = self.school.settings
        settings.current_academic_year = str(today.year - 1)
        settings.current_term = "Term 1"
        settings.term_1_start = None
        settings.term_1_end = None
        settings.save(update_fields=["current_academic_year", "current_term", "term_1_start", "term_1_end"])

        StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            payment_type="school_fees",
            payment_plan="one_term",
            academic_year=str(today.year),
            academic_term="term_1",
            total_amount_due=Decimal("600.00"),
            amount_paid=Decimal("275.00"),
            payment_status="partial",
            recorded_by=self.admin,
        )

        self.client.force_authenticate(user=self.accountant)
        response = self.client.get("/api/v1/finances/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(str(response.data["current_year"]), str(today.year))
        self.assertEqual(float(response.data["term_revenue"]), 275.0)

    def test_finance_summary_ignores_stale_term_window_over_one_year_old(self):
        today = datetime.date.today()
        stale_year = today.year - 2

        StudentPaymentRecord.objects.filter(school=self.school).delete()
        settings = self.school.settings
        settings.current_academic_year = str(stale_year)
        settings.current_term = "Term 1"
        settings.term_1_start = datetime.date(stale_year, 1, 1)
        settings.term_1_end = datetime.date(stale_year, 4, 30)
        settings.save(update_fields=["current_academic_year", "current_term", "term_1_start", "term_1_end"])

        StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            payment_type="school_fees",
            payment_plan="one_term",
            academic_year=str(today.year),
            academic_term="Term 1",
            total_amount_due=Decimal("900.00"),
            amount_paid=Decimal("410.00"),
            payment_status="partial",
            recorded_by=self.admin,
        )

        self.client.force_authenticate(user=self.accountant)
        response = self.client.get("/api/v1/finances/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(str(response.data["current_year"]), str(today.year))
        self.assertEqual(float(response.data["term_revenue"]), 410.0)
