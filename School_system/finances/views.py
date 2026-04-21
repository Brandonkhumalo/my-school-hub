import logging
import uuid
from decimal import Decimal, InvalidOperation
from datetime import date, timedelta
from collections import defaultdict

from django.db import transaction
from django.db.models import Sum, Q, Count
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)

from email_service import (
    send_payment_received_email,
    send_fee_assigned_to_student_email,
    send_grade_fee_notice_email,
    get_parents_of_student,
)
from .models import (
    FeeType,
    StudentFee,
    Payment,
    Invoice,
    FinancialReport,
    SchoolFees,
    StudentPaymentRecord,
    PaymentTransaction,
    PaymentIntent,
    AdditionalFee,
    TransportFeePreference,
    SchoolExpense,
)
from staff.models import Payroll
from users.models import Notification, CustomUser, HRPermissionProfile
from academics.models import Student, Class, ParentChildLink
from .fee_calculator import (
    build_school_fee_breakdown,
    get_additional_fees_for_student,
    get_unpaid_additional_fees_for_record,
    get_transport_opt_in,
)
from .billing_service import (
    to_decimal,
    compute_record_totals,
    settle_additional_fees_for_record,
    recalculate_student_additional_fees,
    ensure_three_term_invoices_for_school,
)
from .term_finance import (
    TERM_SEQUENCE,
    normalize_term_key,
    normalize_terms,
    resolve_terms_for_plan,
    allocate_paid_across_terms,
)
from .paynow_security import verify_paynow_callback_signature
from .serializers import (
    FeeTypeSerializer, StudentFeeSerializer, PaymentSerializer,
    InvoiceSerializer, FinancialReportSerializer, CreatePaymentSerializer,
    StudentFinancialSummarySerializer, SchoolFeesSerializer,
    StudentPaymentRecordSerializer, CreatePaymentRecordSerializer,
    AddPaymentSerializer, InvoiceDetailSerializer, PaymentTransactionSerializer,
    AdditionalFeeSerializer, SchoolExpenseSerializer
)


def _normalize_term(term_value):
    key = normalize_term_key(term_value)
    return key or 'term_1'


def _current_term_window(user):
    school = getattr(user, 'school', None)
    settings = getattr(school, 'settings', None) if school else None
    today = timezone.localdate()

    term_raw = getattr(settings, 'current_term', '') if settings else ''
    term_key = _normalize_term(term_raw)
    configured_year = str(getattr(settings, 'current_academic_year', '')).strip() if settings else ''
    year = configured_year or str(today.year)

    start = end = None
    if settings:
        if term_key == 'term_1':
            start = settings.term_1_start or settings.term_start_date
            end = settings.term_1_end or settings.term_end_date
        elif term_key == 'term_2':
            start = settings.term_2_start or settings.term_start_date
            end = settings.term_2_end or settings.term_end_date
        else:
            start = settings.term_3_start or settings.term_start_date
            end = settings.term_3_end or settings.term_end_date

    # Fallback to sensible calendar term windows when dates are not configured.
    # Use today's year so that transactions made in the current calendar year
    # are never excluded by a stale current_academic_year setting.
    fallback_year = today.year
    if term_key == 'term_1':
        default_start = date(fallback_year, 1, 1)
        default_end = date(fallback_year, 4, 30)
    elif term_key == 'term_2':
        default_start = date(fallback_year, 5, 1)
        default_end = date(fallback_year, 8, 31)
    else:
        default_start = date(fallback_year, 9, 1)
        default_end = date(fallback_year, 12, 31)

    use_calendar_fallback = False
    if not start or not end:
        use_calendar_fallback = True
    elif start > end:
        use_calendar_fallback = True
    elif today > end and (today - end).days > 366:
        # Configured window is over a year behind current date.
        use_calendar_fallback = True
    elif today < start and (start - today).days > 366:
        # Configured window is over a year ahead of current date.
        use_calendar_fallback = True

    if use_calendar_fallback:
        start = default_start
        end = default_end
        year = str(fallback_year)

    term_labels = {term_key, term_key.replace('_', ' ').title()}
    if term_key == 'term_1':
        term_labels.add('Term 1')
    elif term_key == 'term_2':
        term_labels.add('Term 2')
    elif term_key == 'term_3':
        term_labels.add('Term 3')

    return start, end, year, term_labels, term_key


def _months_inclusive(start_date, end_date):
    start_month = date(start_date.year, start_date.month, 1)
    end_month = date(end_date.year, end_date.month, 1)
    months = 0
    cursor = start_month
    while cursor <= end_month:
        months += 1
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)
    return months


def _expense_value_in_window(expense, window_start, window_end):
    if not expense.is_active or expense.status != 'approved':
        return Decimal('0')
    if expense.start_date > window_end:
        return Decimal('0')

    effective_start = max(expense.start_date, window_start)
    if effective_start > window_end:
        return Decimal('0')

    if expense.expense_frequency == 'monthly':
        return expense.amount * _months_inclusive(effective_start, window_end)

    # term frequency: once per term if active in the period.
    return expense.amount


def _school_fee_total_for_student(fee_row, student, school, transport_opt_in_cache=None):
    if not fee_row or not student:
        return Decimal('0')

    total = (
        fee_row.tuition_fee +
        fee_row.levy_fee +
        fee_row.sports_fee +
        fee_row.computer_fee +
        fee_row.other_fees
    )

    school_supports_boarding = bool(
        school and getattr(school, 'accommodation_type', 'day') in ('boarding', 'both')
    )
    if school_supports_boarding and student.residence_type == 'boarding':
        total += fee_row.boarding_fee

    transport_opted_in = False
    if fee_row.transport_fee and fee_row.transport_fee > 0:
        if transport_opt_in_cache is None:
            transport_opted_in = get_transport_opt_in(student)
        else:
            if student.id not in transport_opt_in_cache:
                transport_opt_in_cache[student.id] = get_transport_opt_in(student)
            transport_opted_in = transport_opt_in_cache[student.id]
        if transport_opted_in:
            total += fee_row.transport_fee

    return total


def _build_school_fees_map(school, academic_year, terms, grade_levels=None):
    fees = SchoolFees.objects.filter(
        school=school,
        academic_year=academic_year,
        academic_term__in=terms,
    )
    if grade_levels:
        fees = fees.filter(grade_level__in=grade_levels)
    return {(fee.grade_level, fee.academic_term): fee for fee in fees}


def _record_included_terms(record):
    terms = resolve_terms_for_plan(
        getattr(record, 'payment_plan', ''),
        getattr(record, 'academic_term', ''),
        getattr(record, 'covered_terms', []),
    )
    if terms:
        return terms
    fallback = normalize_term_key(getattr(record, 'academic_term', ''))
    if fallback in TERM_SEQUENCE:
        return [fallback]
    return []


def _record_terms_label(record):
    terms = _record_included_terms(record)
    if not terms:
        return (record.academic_term or '').strip()
    return ', '.join(term.replace('_', ' ').title() for term in terms)


def _record_due_by_term(record, school, school_fees_map, transport_opt_in_cache=None):
    terms = _record_included_terms(record)
    if not terms:
        return {}

    if record.payment_type != 'school_fees':
        split_due = to_decimal(record.total_amount_due) / Decimal(str(len(terms)))
        return {term: split_due for term in terms}

    student = record.student
    if not student or not student.student_class:
        return {}

    due_by_term = {}
    for term in terms:
        fee_row = school_fees_map.get((student.student_class.grade_level, term))
        if not fee_row:
            continue
        due_by_term[term] = _school_fee_total_for_student(
            fee_row,
            student,
            school,
            transport_opt_in_cache=transport_opt_in_cache,
        )
    if due_by_term:
        return due_by_term

    # Legacy fallback: when fee tables are missing, allocate from record snapshot.
    split_due = to_decimal(record.total_amount_due) / Decimal(str(len(terms)))
    return {term: split_due for term in terms}


def _aggregate_additional_fee_maps(school, academic_year, terms):
    fees = AdditionalFee.objects.filter(
        school=school,
        academic_year=academic_year,
        academic_term__in=terms,
    )

    expected_by_student = defaultdict(Decimal)
    expected_by_class = defaultdict(Decimal)
    expected_global = defaultdict(Decimal)

    collected_by_student = defaultdict(Decimal)
    collected_by_class = defaultdict(Decimal)
    collected_global = defaultdict(Decimal)

    for fee in fees:
        amount = to_decimal(fee.amount)
        term = normalize_term_key(fee.academic_term)
        if term not in terms:
            continue

        if fee.student_id:
            expected_by_student[(fee.student_id, term)] += amount
            if fee.is_paid:
                collected_by_student[(fee.student_id, term)] += amount
            continue

        if fee.student_class_id:
            expected_by_class[(fee.student_class_id, term)] += amount
            if fee.is_paid:
                collected_by_class[(fee.student_class_id, term)] += amount
            continue

        expected_global[term] += amount
        if fee.is_paid:
            collected_global[term] += amount

    return {
        'expected_by_student': expected_by_student,
        'expected_by_class': expected_by_class,
        'expected_global': expected_global,
        'collected_by_student': collected_by_student,
        'collected_by_class': collected_by_class,
        'collected_global': collected_global,
    }


def _student_term_financials(students, school, academic_year, terms):
    term_set = set(terms)
    transport_opt_in_cache = {}
    grade_levels = {
        student.student_class.grade_level
        for student in students
        if getattr(student, 'student_class', None)
    }
    school_fees_map = _build_school_fees_map(
        school=school,
        academic_year=academic_year,
        terms=terms,
        grade_levels=grade_levels,
    )

    expected_map = defaultdict(Decimal)
    collected_map = defaultdict(Decimal)

    additional_maps = _aggregate_additional_fee_maps(school, academic_year, terms)

    students_by_id = {student.id: student for student in students}
    for student in students:
        if not student.student_class:
            continue
        class_id = student.student_class_id
        grade_level = student.student_class.grade_level
        for term in terms:
            fee_row = school_fees_map.get((grade_level, term))
            if fee_row:
                expected_map[(student.id, term)] += _school_fee_total_for_student(
                    fee_row,
                    student,
                    school,
                    transport_opt_in_cache=transport_opt_in_cache,
                )
            expected_map[(student.id, term)] += additional_maps['expected_by_student'].get((student.id, term), Decimal('0'))
            expected_map[(student.id, term)] += additional_maps['expected_by_class'].get((class_id, term), Decimal('0'))
            expected_map[(student.id, term)] += additional_maps['expected_global'].get(term, Decimal('0'))

            collected_map[(student.id, term)] += additional_maps['collected_by_student'].get((student.id, term), Decimal('0'))
            collected_map[(student.id, term)] += additional_maps['collected_by_class'].get((class_id, term), Decimal('0'))
            collected_map[(student.id, term)] += additional_maps['collected_global'].get(term, Decimal('0'))

    records = StudentPaymentRecord.objects.filter(
        school=school,
        academic_year=academic_year,
        student_id__in=students_by_id.keys(),
    ).select_related('student__student_class')

    for record in records:
        if record.student_id not in students_by_id:
            continue
        due_by_term = _record_due_by_term(
            record,
            school=school,
            school_fees_map=school_fees_map,
            transport_opt_in_cache=transport_opt_in_cache,
        )
        if not due_by_term:
            continue

        for term, due in due_by_term.items():
            if term in term_set and expected_map.get((record.student_id, term), Decimal('0')) <= 0:
                expected_map[(record.student_id, term)] += to_decimal(due)

        paid_by_term = allocate_paid_across_terms(due_by_term, to_decimal(record.amount_paid))
        for term, paid in paid_by_term.items():
            if term in term_set:
                collected_map[(record.student_id, term)] += to_decimal(paid)

    return expected_map, collected_map


def _notify_admin_and_root_hr_boss(school, title, message, link=''):
    if not school:
        return
    root_hr_ids = HRPermissionProfile.objects.filter(
        school=school,
        is_root_boss=True,
    ).values_list('user_id', flat=True)
    recipients = CustomUser.objects.filter(
        school=school,
        is_active=True,
    ).filter(
        Q(role='admin') | Q(id__in=root_hr_ids)
    ).distinct()
    notifications = [
        Notification(
            user=user,
            title=title,
            message=message,
            notification_type='general',
            link=link or '',
        )
        for user in recipients
    ]
    if notifications:
        Notification.objects.bulk_create(notifications)


# Fee Type Views
class FeeTypeListCreateView(generics.ListCreateAPIView):
    """Represents FeeTypeListCreateView."""
    queryset = FeeType.objects.all()
    serializer_class = FeeTypeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        if user.school:
            queryset = FeeType.objects.filter(school=user.school)
        else:
            queryset = FeeType.objects.none()
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        return queryset
    
    def perform_create(self, serializer):
        """Execute perform create."""
        serializer.save(school=self.request.user.school)


class FeeTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents FeeTypeDetailView."""
    queryset = FeeType.objects.all()
    serializer_class = FeeTypeSerializer
    permission_classes = [permissions.IsAuthenticated]


# Student Fee Views
class StudentFeeListCreateView(generics.ListCreateAPIView):
    """Represents StudentFeeListCreateView."""
    queryset = StudentFee.objects.all()
    serializer_class = StudentFeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user

        # Filter by school first
        if user.school:
            queryset = StudentFee.objects.filter(student__user__school=user.school).select_related(
                'student__user', 'fee_type'
            )
        else:
            queryset = StudentFee.objects.none()

        # Filter by user role
        if user.role == 'student':
            queryset = queryset.filter(student__user=user)
        elif user.role == 'parent':
            children_ids = user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_id__in=children_ids)
        
        # Additional filters
        student_id = self.request.query_params.get('student')
        is_paid = self.request.query_params.get('is_paid')
        academic_year = self.request.query_params.get('academic_year')
        academic_term = self.request.query_params.get('academic_term')
        
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if is_paid is not None:
            queryset = queryset.filter(is_paid=is_paid.lower() == 'true')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        if academic_term:
            queryset = queryset.filter(academic_term=academic_term)
            
        return queryset.order_by('-due_date')


class StudentFeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents StudentFeeDetailView."""
    queryset = StudentFee.objects.all()
    serializer_class = StudentFeeSerializer
    permission_classes = [permissions.IsAuthenticated]


# Payment Views
class PaymentListCreateView(generics.ListCreateAPIView):
    """Represents PaymentListCreateView."""
    queryset = Payment.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        """Return serializer class."""
        if self.request.method == 'POST':
            return CreatePaymentSerializer
        return PaymentSerializer

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user

        # Filter by school first
        if user.school:
            queryset = Payment.objects.filter(student_fee__student__user__school=user.school).select_related(
                'student_fee__student__user', 'student_fee__fee_type', 'processed_by'
            )
        else:
            queryset = Payment.objects.none()

        # Filter by user role
        if user.role == 'student':
            queryset = queryset.filter(student_fee__student__user=user)
        elif user.role == 'parent':
            children_ids = user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_fee__student_id__in=children_ids)
        
        # Additional filters
        student_id = self.request.query_params.get('student')
        payment_status = self.request.query_params.get('status')
        payment_method = self.request.query_params.get('method')
        
        if student_id:
            queryset = queryset.filter(student_fee__student_id=student_id)
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)
            
        return queryset.order_by('-payment_date')

    def perform_create(self, serializer):
        """Execute perform create."""
        if self.request.user.role not in ['admin', 'accountant']:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admin/accountant can record payments.')
        payment = serializer.save(processed_by=self.request.user)
        # Notify parents of the student that a payment was recorded
        try:
            student = payment.student_fee.student
            school_name = student.user.school.name if student.user.school else "Your School"
            class_name = student.student_class.name if student.student_class else "N/A"
            student_name = f"{student.user.first_name} {student.user.last_name}".strip()
            for p in get_parents_of_student(student):
                send_payment_received_email(
                    parent_email=p['email'],
                    parent_name=p['name'],
                    school_name=school_name,
                    student_name=student_name,
                    class_name=class_name,
                    amount_usd=str(payment.amount),
                    payment_method=payment.payment_method or "cash",
                    reference=payment.transaction_id or "",
                )
        except Exception as exc:
            logger.error("Payment email notification failed: %s", exc)


class PaymentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents PaymentDetailView."""
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Payment.objects.filter(student_fee__student__user__school=user.school).select_related(
                'student_fee__student__user', 'student_fee__fee_type', 'processed_by'
            )
        return Payment.objects.none()

    def update(self, request, *args, **kwargs):
        if request.user.role not in ['admin', 'accountant']:
            return Response({'error': 'Only admin/accountant can edit payments.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ['admin', 'accountant']:
            return Response({'error': 'Only admin/accountant can delete payments.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


# Invoice Views
class InvoiceListCreateView(generics.ListCreateAPIView):
    """Represents InvoiceListCreateView."""
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user

        # Ensure both paid and unpaid records have invoice snapshots.
        if user.school and user.role in ['admin', 'accountant', 'hr']:
            _ensure_invoice_snapshots_for_school(user.school)
        
        # Filter by school first
        if user.school:
            queryset = Invoice.objects.filter(student__user__school=user.school).select_related(
                'student__user', 'school'
            )
        else:
            queryset = Invoice.objects.none()
        
        # Filter by user role
        if user.role == 'student':
            queryset = queryset.filter(student__user=user)
        elif user.role == 'parent':
            children_ids = user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_id__in=children_ids)
        
        # Additional filters
        student_id = self.request.query_params.get('student')
        is_paid = self.request.query_params.get('is_paid')
        
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if is_paid is not None:
            queryset = queryset.filter(is_paid=is_paid.lower() == 'true')
            
        return queryset.order_by('-issue_date')

    def perform_create(self, serializer):
        if self.request.user.role not in ['admin', 'accountant']:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admin/accountant can create invoices.')
        serializer.save()


class InvoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents InvoiceDetailView."""
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Invoice.objects.filter(student__user__school=user.school).select_related(
                'student__user', 'school'
            )
        return Invoice.objects.none()

    def update(self, request, *args, **kwargs):
        if request.user.role not in ['admin', 'accountant']:
            return Response({'error': 'Only admin/accountant can update invoices.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ['admin', 'accountant']:
            return Response({'error': 'Only admin/accountant can delete invoices.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


# Financial Report Views
class FinancialReportListCreateView(generics.ListCreateAPIView):
    """Represents FinancialReportListCreateView."""
    queryset = FinancialReport.objects.all()
    serializer_class = FinancialReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        
        # Only accountants and admins can view financial reports
        if user.role not in ['accountant', 'admin']:
            return FinancialReport.objects.none()
        
        # Filter by school
        if user.school:
            queryset = FinancialReport.objects.filter(generated_by__school=user.school)
        else:
            queryset = FinancialReport.objects.none()
        
        report_type = self.request.query_params.get('type')
        academic_year = self.request.query_params.get('academic_year')
        
        if report_type:
            queryset = queryset.filter(report_type=report_type)
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
            
        return queryset.order_by('-date_generated')

    def perform_create(self, serializer):
        """Execute perform create."""
        report = serializer.save(generated_by=self.request.user)
        # Enqueue heavy aggregation as a background task — do not block the request
        from .tasks import generate_financial_report_task
        generate_financial_report_task.delay(report.id)


class SchoolExpenseListCreateView(generics.ListCreateAPIView):
    """Create/list school operational expenses pending admin approval."""
    serializer_class = SchoolExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role not in ['admin', 'superadmin', 'accountant', 'hr']:
            return SchoolExpense.objects.none()
        if not user.school:
            return SchoolExpense.objects.none()
        qs = SchoolExpense.objects.filter(school=user.school).select_related('created_by', 'approved_by')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        is_root_hr_head = bool(getattr(self.request, 'is_root_hr_boss', False))
        if user.role not in ['accountant', 'admin', 'superadmin'] and not is_root_hr_head:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only accountant, root HR head, or admin can add school expenses.')
        expense = serializer.save(
            school=user.school,
            created_by=user,
            status='pending',
            approved_by=None,
            approved_at=None,
        )
        _notify_admin_and_root_hr_boss(
            school=user.school,
            title='New Expense Awaiting Approval',
            message=f"{user.full_name} submitted expense '{expense.title}' ({expense.expense_frequency}) for approval.",
            link='/hr/accounting',
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def school_expense_approve_view(request, expense_id):
    user = request.user
    if user.role not in ['admin', 'superadmin'] or getattr(request, 'is_root_hr_boss', False):
        return Response({'error': 'Only admin can approve or reject expenses.'}, status=status.HTTP_403_FORBIDDEN)
    if not user.school:
        return Response({'error': 'No school associated with current user.'}, status=status.HTTP_400_BAD_REQUEST)

    decision = (request.data.get('status') or '').strip().lower()
    if decision not in ('approved', 'rejected'):
        return Response({'error': "status must be 'approved' or 'rejected'."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        expense = SchoolExpense.objects.get(id=expense_id, school=user.school)
    except SchoolExpense.DoesNotExist:
        return Response({'error': 'Expense not found.'}, status=status.HTTP_404_NOT_FOUND)

    expense.status = decision
    expense.approved_by = user
    expense.approved_at = timezone.now()
    expense.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])

    _notify_admin_and_root_hr_boss(
        school=user.school,
        title=f"Expense {decision.title()}",
        message=f"{user.full_name} {decision} expense '{expense.title}'.",
        link='/hr/accounting',
    )
    return Response(SchoolExpenseSerializer(expense).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def finance_summary_view(request):
    user = request.user
    if user.role not in ['admin', 'superadmin', 'accountant', 'hr']:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    if not user.school:
        return Response({'error': 'No school associated with current user.'}, status=status.HTTP_400_BAD_REQUEST)

    today = timezone.localdate()
    month_name = today.strftime('%B')
    year = today.year
    school = user.school
    term_start, term_end, current_year, _term_labels, term_key = _current_term_window(user)

    monthly_salary_total = Payroll.objects.filter(
        staff__user__school=school,
        month=month_name,
        year=year,
    ).aggregate(total=Sum('net_salary'))['total'] or Decimal('0')

    selected_terms = [term_key]
    students = list(
        Student.objects.filter(
            user__school=school,
            user__is_active=True,
        ).select_related('student_class')
    )
    expected_map, collected_map = _student_term_financials(
        students=students,
        school=school,
        academic_year=current_year,
        terms=selected_terms,
    )

    term_expected_revenue = Decimal('0')
    term_collected_revenue = Decimal('0')
    term_paid_students = 0
    term_partial_students = 0
    term_unpaid_students = 0
    for student in students:
        student_expected = Decimal('0')
        student_collected = Decimal('0')
        for term in selected_terms:
            student_expected += expected_map.get((student.id, term), Decimal('0'))
            student_collected += collected_map.get((student.id, term), Decimal('0'))

        term_expected_revenue += student_expected
        term_collected_revenue += student_collected

        student_balance = student_expected - student_collected
        if student_expected <= 0:
            continue
        if student_balance <= 0:
            term_paid_students += 1
        elif student_collected > 0:
            term_partial_students += 1
        else:
            term_unpaid_students += 1

    term_revenue = term_expected_revenue if term_expected_revenue > 0 else term_collected_revenue
    term_outstanding_revenue = max(Decimal('0'), term_revenue - term_collected_revenue)
    term_collection_rate = Decimal('0')
    if term_revenue > 0:
        term_collection_rate = (term_collected_revenue / term_revenue) * Decimal('100')

    # Business rule: one term carries 4 months of salary cost.
    term_salary_expenses = monthly_salary_total * Decimal('4')

    approved_expenses = SchoolExpense.objects.filter(
        school=school,
        status='approved',
        is_active=True,
        start_date__lte=term_end,
    )
    term_other_expenses = sum(
        (_expense_value_in_window(expense, term_start, term_end) for expense in approved_expenses),
        Decimal('0'),
    )
    term_total_expenses = term_salary_expenses + term_other_expenses
    term_profit = term_revenue - term_total_expenses
    term_cash_profit = term_collected_revenue - term_total_expenses

    payroll_qs = Payroll.objects.filter(staff__user__school=school, month=month_name, year=year)
    paid_count = payroll_qs.filter(is_paid=True).count()
    unpaid_count = payroll_qs.filter(is_paid=False).count()

    return Response({
        'current_month': month_name,
        'current_year': year,
        'current_term': term_key,
        'monthly_salary_total': monthly_salary_total,
        'term_revenue': term_revenue,
        'term_expected_revenue': term_expected_revenue,
        'term_collected_revenue': term_collected_revenue,
        'term_outstanding_revenue': term_outstanding_revenue,
        'term_collection_rate': term_collection_rate,
        'term_other_expenses': term_other_expenses,
        'term_salary_expenses': term_salary_expenses,
        'term_total_expenses': term_total_expenses,
        'term_profit': term_profit,
        'term_cash_profit': term_cash_profit,
        'term_paid_students': term_paid_students,
        'term_partial_students': term_partial_students,
        'term_unpaid_students': term_unpaid_students,
        'monthly_paid_count': paid_count,
        'monthly_unpaid_count': unpaid_count,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_financial_summary(request, student_id):
    """Get comprehensive financial summary for a student"""
    try:
        student = Student.objects.get(id=student_id)
        
        # Check permissions
        if request.user.role == 'student' and request.user.student.id != student_id:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        elif request.user.role == 'parent':
            from academics.models import ParentChildLink
            if not ParentChildLink.objects.filter(
                parent=request.user.parent, student_id=student_id, is_confirmed=True
            ).exists():
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Calculate financial summary
        fees = StudentFee.objects.filter(student=student)
        payments = Payment.objects.filter(student_fee__student=student, payment_status='completed')
        
        total_fees_due = fees.aggregate(total=Sum('amount_due'))['total'] or 0
        total_fees_paid = fees.aggregate(total=Sum('amount_paid'))['total'] or 0
        
        # Include additional fees
        additional_fees = AdditionalFee.objects.filter(
            school=student.user.school,
            is_paid=False
        ).filter(Q(student=student) | Q(student_class=student.student_class))
        additional_fees_total = sum(float(f.amount) for f in additional_fees)
        additional_fees_list = [{'name': f.fee_name, 'amount': float(f.amount), 'reason': f.reason} for f in additional_fees]
        
        total_fees_due = float(total_fees_due) + additional_fees_total
        total_balance = total_fees_due - float(total_fees_paid)
        unpaid_fees_count = fees.filter(is_paid=False).count()
        
        # Get recent payments and pending fees
        recent_payments = payments.order_by('-payment_date')[:5]
        pending_fees = fees.filter(is_paid=False).order_by('due_date')
        
        summary_data = {
            'student_id': student.id,
            'student_name': student.user.full_name,
            'student_number': student.user.student_number,
            'total_fees_due': total_fees_due,
            'total_fees_paid': total_fees_paid,
            'total_balance': total_balance,
            'unpaid_fees_count': unpaid_fees_count,
            'recent_payments': PaymentSerializer(recent_payments, many=True).data,
            'pending_fees': StudentFeeSerializer(pending_fees, many=True).data,
            'additional_fees': additional_fees_list,
            'additional_fees_total': additional_fees_total
        }
        
        return Response(summary_data)
        
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def process_whatsapp_payment(request):
    """Process payment made through WhatsApp"""
    if request.user.role not in ['student', 'parent']:
        return Response({'error': 'Only students and parents can make WhatsApp payments'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    student_fee_id = request.data.get('student_fee_id')
    amount = request.data.get('amount')
    payment_reference = request.data.get('payment_reference')
    
    try:
        student_fee = StudentFee.objects.get(id=student_fee_id)
        
        # Validate permission
        if request.user.role == 'student':
            if student_fee.student.user != request.user:
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        elif request.user.role == 'parent':
            from academics.models import ParentChildLink
            if not ParentChildLink.objects.filter(
                parent=request.user.parent, student_id=student_fee.student.id, is_confirmed=True
            ).exists():
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Create payment record
        payment = Payment.objects.create(
            student_fee=student_fee,
            amount=amount,
            payment_method='whatsapp',
            payment_status='completed',
            transaction_id=payment_reference,
            processed_by=request.user,
            notes=f'WhatsApp payment processed automatically'
        )
        
        # Update student fee
        # Prevent negative payment fraud
        if float(amount) <= 0:
            return Response({'error': 'Payment amount must be positive'}, status=status.HTTP_400_BAD_REQUEST)

        student_fee.amount_paid += float(amount)
        if student_fee.amount_paid >= student_fee.amount_due:
            student_fee.is_paid = True
        student_fee.save()
        
        return Response({
            'message': 'Payment processed successfully',
            'payment': PaymentSerializer(payment).data
        })
        
    except StudentFee.DoesNotExist:
        return Response({'error': 'Student fee not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class SchoolFeesListCreateView(generics.ListCreateAPIView):
    """Represents SchoolFeesListCreateView."""
    queryset = SchoolFees.objects.all()
    serializer_class = SchoolFeesSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        
        # Filter by school
        if user.school:
            queryset = SchoolFees.objects.filter(school=user.school)
        else:
            queryset = SchoolFees.objects.none()
        
        academic_year = self.request.query_params.get('academic_year')
        academic_term = self.request.query_params.get('academic_term')
        grade_level = self.request.query_params.get('grade_level')
        
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        if academic_term:
            queryset = queryset.filter(academic_term=academic_term)
        if grade_level:
            queryset = queryset.filter(grade_level=grade_level)
            
        return queryset.order_by('grade_level', 'academic_term')

    def perform_create(self, serializer):
        """Execute perform create."""
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can create school fees")
        fee = serializer.save(created_by=self.request.user, school=self.request.user.school)
        ensure_three_term_invoices_for_school(
            school=self.request.user.school,
            academic_year=fee.academic_year,
            recorded_by=self.request.user,
            grade_level=fee.grade_level,
        )
        # Notify parents of all students in this grade
        try:
            from academics.models import Student
            school = self.request.user.school
            school_name = school.name if school else "Your School"
            students_in_grade = Student.objects.filter(
                user__school=school,
                student_class__grade_level=fee.grade_level,
            ).select_related('user', 'student_class')
            for student in students_in_grade:
                student_name = f"{student.user.first_name} {student.user.last_name}".strip()
                class_name = student.student_class.name if student.student_class else "N/A"
                for p in get_parents_of_student(student):
                    send_grade_fee_notice_email(
                        parent_email=p['email'],
                        parent_name=p['name'],
                        school_name=school_name,
                        student_name=student_name,
                        class_name=class_name,
                        grade_level=fee.grade_name or str(fee.grade_level),
                        academic_year=fee.academic_year or "",
                        academic_term=fee.academic_term or "",
                        tuition_fee=str(fee.tuition_fee or 0),
                        levy_fee=str(fee.levy_fee or 0),
                        sports_fee=str(fee.sports_fee or 0),
                        computer_fee=str(fee.computer_fee or 0),
                        other_fees=str(fee.other_fees or 0),
                    )
        except Exception as exc:
            logger.error("Grade fee notice email failed: %s", exc)


class SchoolFeesDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents SchoolFeesDetailView."""
    queryset = SchoolFees.objects.all()
    serializer_class = SchoolFeesSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        if user.school:
            return SchoolFees.objects.filter(school=user.school)
        return SchoolFees.objects.none()
    
    def perform_update(self, serializer):
        """Execute perform update."""
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can update school fees")
        fee = serializer.save()
        ensure_three_term_invoices_for_school(
            school=self.request.user.school,
            academic_year=fee.academic_year,
            recorded_by=self.request.user,
            grade_level=fee.grade_level,
        )
    
    def perform_destroy(self, instance):
        """Execute perform destroy."""
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can delete school fees")
        instance.delete()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_my_school_fees(request):
    """Get school fees for a student or parent's children based on their grade/form"""
    user = request.user
    school = user.school
    
    if user.role == 'student':
        try:
            student = user.student
            student_class = student.student_class
            grade_level = student_class.grade_level if student_class else None

            fee_breakdown = build_school_fee_breakdown(student, school)
            school_fee_row = fee_breakdown['school_fee']

            fees = []
            if school_fee_row:
                fees = SchoolFeesSerializer([school_fee_row], many=True).data

            additional_fees = get_additional_fees_for_student(student, school)
            additional_fees_list = [
                {'name': f.fee_name, 'amount': float(f.amount), 'reason': f.reason, 'currency': f.currency}
                for f in additional_fees
            ]
            additional_fees_total = sum(float(f.amount) for f in additional_fees)
            
            return Response({
                'student_name': user.full_name,
                'student_number': user.student_number,
                'class_name': student_class.name if student_class else None,
                'grade_level': grade_level,
                'residence_type': student.residence_type,
                'fees': fees,
                'applied_school_fee_total': float(fee_breakdown['total_school_fee']),
                'boarding_fee_applied': float(fee_breakdown['boarding']),
                'transport_fee_applied': float(fee_breakdown['transport']),
                'transport_fee_opted_in': fee_breakdown['transport_opted_in'],
                'additional_fees': additional_fees_list,
                'additional_fees_total': additional_fees_total
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    elif user.role == 'parent':
        try:
            confirmed_links = ParentChildLink.objects.filter(
                parent=user.parent,
                is_confirmed=True
            ).select_related('student__student_class', 'student__user')
            
            children_fees = []
            for link in confirmed_links:
                student = link.student
                student_class = student.student_class
                grade_level = student_class.grade_level if student_class else None

                fee_breakdown = build_school_fee_breakdown(student, school, parent=user.parent)
                school_fee_row = fee_breakdown['school_fee']
                fees = []
                if school_fee_row:
                    fees = SchoolFeesSerializer([school_fee_row], many=True).data

                additional_fees = get_additional_fees_for_student(student, school)
                additional_fees_list = [
                    {'name': f.fee_name, 'amount': float(f.amount), 'reason': f.reason, 'currency': f.currency}
                    for f in additional_fees
                ]
                additional_fees_total = sum(float(f.amount) for f in additional_fees)
                
                children_fees.append({
                    'student_id': student.id,
                    'student_name': student.user.full_name,
                    'student_number': student.user.student_number,
                    'class_name': student_class.name if student_class else None,
                    'grade_level': grade_level,
                    'residence_type': student.residence_type,
                    'fees': fees,
                    'applied_school_fee_total': float(fee_breakdown['total_school_fee']),
                    'boarding_fee_applied': float(fee_breakdown['boarding']),
                    'transport_fee_applied': float(fee_breakdown['transport']),
                    'transport_fee_opted_in': fee_breakdown['transport_opted_in'],
                    'additional_fees': additional_fees_list,
                    'additional_fees_total': additional_fees_total
                })
            
            return Response({'children_fees': children_fees})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    return Response({'error': 'Invalid user role'}, status=status.HTTP_403_FORBIDDEN)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_all_grades(request):
    """Get all unique grade levels from classes for the fees dropdown"""
    if request.user.role != 'admin':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    grades = Class.objects.values('grade_level', 'name').distinct().order_by('grade_level')
    
    grade_list = []
    seen_levels = set()
    for g in grades:
        if g['grade_level'] not in seen_levels:
            seen_levels.add(g['grade_level'])
            grade_list.append({
                'grade_level': g['grade_level'],
                'grade_name': g['name']
            })
    
    return Response({'grades': grade_list})


class StudentPaymentRecordListCreateView(generics.ListCreateAPIView):
    """Represents StudentPaymentRecordListCreateView."""
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        """Return serializer class."""
        if self.request.method == 'POST':
            return CreatePaymentRecordSerializer
        return StudentPaymentRecordSerializer

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        
        if user.role not in ['admin', 'accountant', 'hr']:
            return StudentPaymentRecord.objects.none()
        
        if user.school and user.role in ['admin', 'accountant', 'hr']:
            _ensure_invoice_snapshots_for_school(user.school)

        if user.school:
            queryset = StudentPaymentRecord.objects.filter(school=user.school)
        else:
            queryset = StudentPaymentRecord.objects.none()
        
        student_id = self.request.query_params.get('student')
        class_id = self.request.query_params.get('class_id')
        payment_status = self.request.query_params.get('status')
        payment_type = self.request.query_params.get('type')
        academic_year = self.request.query_params.get('academic_year')
        academic_term = self.request.query_params.get('academic_term')
        
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if class_id:
            queryset = queryset.filter(student__student_class_id=class_id)
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)
        if payment_type:
            queryset = queryset.filter(payment_type=payment_type)
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        if academic_term:
            normalized_term = normalize_term_key(academic_term)
            queryset = queryset.filter(
                Q(academic_term=academic_term) |
                Q(academic_term=normalized_term) |
                Q(payment_plan='full_year')
            )
            
        return queryset.order_by('-date_created')

    def perform_create(self, serializer):
        """Execute perform create."""
        if self.request.user.role not in ['admin', 'accountant']:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admin/accountant can create payment records.')
        record = serializer.save()
        # Notify parents that a fee has been assigned to their child
        try:
            student = record.student
            school_name = student.user.school.name if student.user.school else "Your School"
            class_name = student.student_class.name if student.student_class else "N/A"
            student_name = f"{student.user.first_name} {student.user.last_name}".strip()
            for p in get_parents_of_student(student):
                send_fee_assigned_to_student_email(
                    parent_email=p['email'],
                    parent_name=p['name'],
                    school_name=school_name,
                    student_name=student_name,
                    class_name=class_name,
                    amount_usd=str(record.total_amount_due),
                    academic_year=record.academic_year or "",
                    payment_type=record.payment_type or "one_term",
                )
        except Exception as exc:
            logger.error("Fee assignment email notification failed: %s", exc)


class StudentPaymentRecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents StudentPaymentRecordDetailView."""
    serializer_class = StudentPaymentRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        if user.role not in ['admin', 'accountant', 'hr']:
            return StudentPaymentRecord.objects.none()
        if user.school:
            return StudentPaymentRecord.objects.filter(school=user.school)
        return StudentPaymentRecord.objects.none()

    def update(self, request, *args, **kwargs):
        if request.user.role not in ['admin', 'accountant']:
            return Response({'error': 'Only admin/accountant can edit payment records.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        """Only admin can delete payment records; recalculate related balances."""
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can delete payment records.")

        student = instance.student
        school = instance.school
        academic_year = instance.academic_year
        covered_terms = normalize_terms(getattr(instance, 'covered_terms', []))
        academic_term = normalize_term_key(instance.academic_term)

        with transaction.atomic():
            # Delete snapshot invoices linked to this payment record to avoid stale orphan invoices.
            Invoice.objects.filter(payment_record=instance, school=school).delete()
            instance.delete()
            terms_to_recalc = covered_terms or ([academic_term] if academic_term else [''])
            for term in terms_to_recalc:
                _recalculate_additional_fees_for_student(student, school, academic_year, term)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def add_payment_to_record(request):
    """Add a payment to an existing payment record"""
    if request.user.role not in ['admin', 'accountant']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = AddPaymentSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        payment_record = serializer.save()
        return Response({
            'message': 'Payment added successfully',
            'payment_record': StudentPaymentRecordSerializer(payment_record).data
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def update_payment_status(request, record_id):
    """Mark a payment record as paid/unpaid/partial"""
    if request.user.role not in ['admin', 'accountant']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        record = StudentPaymentRecord.objects.get(id=record_id, school=request.user.school)
        new_status = request.data.get('status')
        
        if new_status not in ['unpaid', 'partial', 'paid']:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        
        if new_status == 'unpaid':
            return Response(
                {'error': 'Direct unpaid override is disabled. Use transaction reversal/adjustment flow.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == 'paid':
            outstanding = _record_balance(record)
            if outstanding > 0:
                _apply_payment_to_record(
                    record,
                    outstanding,
                    method='other',
                    actor=request.user,
                    notes='Manual paid status adjustment',
                )
            record.payment_status = 'paid'
            record.save(update_fields=['payment_status', 'date_updated'])
        else:
            # For partial, keep amounts unchanged and derive status from recorded amount.
            record.payment_status = 'partial' if record.amount_paid > 0 else 'unpaid'
            record.save(update_fields=['payment_status', 'date_updated'])
        
        return Response({
            'message': 'Status updated successfully',
            'payment_record': StudentPaymentRecordSerializer(record).data
        })
    except StudentPaymentRecord.DoesNotExist:
        return Response({'error': 'Payment record not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def class_fees_report(request):
    """Get class-based fees report showing paid/unpaid students"""
    if request.user.role not in ['admin', 'accountant', 'hr']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    class_id = request.query_params.get('class_id')
    academic_year = request.query_params.get('academic_year')
    academic_term = request.query_params.get('academic_term')
    terms_param = request.query_params.get('terms')
    
    if not request.user.school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not class_id:
        return Response({'reports': [], 'message': 'Please select a class'})
    
    try:
        cls = Class.objects.get(id=class_id, school=request.user.school)
    except Class.DoesNotExist:
        return Response({'error': 'Class not found'}, status=status.HTTP_404_NOT_FOUND)
    
    students = list(
        Student.objects.filter(student_class=cls).select_related('student_class', 'user')
    )

    if not academic_year:
        _, _, inferred_year, _, _ = _current_term_window(request.user)
        academic_year = inferred_year

    if terms_param:
        selected_terms = normalize_terms([part for part in terms_param.split(',') if part.strip()])
    elif academic_term:
        selected_terms = normalize_terms([academic_term])
    else:
        _, _, _, _, current_term = _current_term_window(request.user)
        selected_terms = [current_term]

    if not selected_terms:
        return Response({'error': 'At least one valid term is required.'}, status=status.HTTP_400_BAD_REQUEST)

    expected_map, collected_map = _student_term_financials(
        students=students,
        school=request.user.school,
        academic_year=academic_year,
        terms=selected_terms,
    )
    
    paid_count = 0
    partial_count = 0
    unpaid_count = 0
    total_due = 0
    total_collected = 0
    student_data = []
    
    for student in students:
        student_due = Decimal('0')
        student_paid = Decimal('0')
        for term in selected_terms:
            student_due += expected_map.get((student.id, term), Decimal('0'))
            student_paid += collected_map.get((student.id, term), Decimal('0'))
        student_balance = max(Decimal('0'), student_due - student_paid)

        if student_due <= 0:
            status_text = 'No Fees'
        elif student_balance <= 0:
            paid_count += 1
            status_text = 'Paid'
        elif student_paid > 0:
            partial_count += 1
            status_text = 'Partial'
        else:
            unpaid_count += 1
            status_text = 'Unpaid'
        
        total_due += student_due
        total_collected += student_paid
        
        student_data.append({
            'student_id': student.id,
            'student_name': student.user.full_name,
            'student_number': student.user.student_number,
            'total_due': float(student_due),
            'total_paid': float(student_paid),
            'balance': float(student_balance),
            'status': status_text,
        })
    
    report = {
        'class_id': cls.id,
        'class_name': cls.name,
        'academic_year': academic_year,
        'terms': selected_terms,
        'total_students': len(students),
        'paid_count': paid_count,
        'partial_count': partial_count,
        'unpaid_count': unpaid_count,
        'total_due': float(total_due),
        'total_collected': float(total_collected),
        'total_outstanding': float(max(Decimal('0'), total_due - total_collected)),
        'students': student_data,
    }
    
    return Response({'reports': [report]})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_invoice_detail(request, invoice_id):
    """Get detailed invoice for PDF generation"""
    try:
        if request.user.school:
            invoice = Invoice.objects.get(id=invoice_id, school=request.user.school)
        else:
            invoice = Invoice.objects.get(id=invoice_id, student__user__school=request.user.school)
        
        if request.user.role == 'parent':
            from academics.models import ParentChildLink
            links = ParentChildLink.objects.filter(parent=request.user.parent, is_confirmed=True)
            child_ids = [link.student_id for link in links]
            if invoice.student_id not in child_ids:
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        return Response(InvoiceDetailSerializer(invoice).data)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def parent_invoices(request):
    """Get all invoices for parent's children - includes auto-generated from school fees"""
    if request.user.role != 'parent':
        return Response({'error': 'Parent access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        links = ParentChildLink.objects.filter(
            parent=request.user.parent,
            is_confirmed=True,
        ).select_related('student__user', 'student__student_class')
        
        invoices_data = []
        
        for link in links:
            student = link.student
            grade_level = student.student_class.grade_level if student.student_class else None
            
            # Get existing invoices for this student
            existing_invoices = Invoice.objects.filter(
                student=student,
                school=request.user.school,
            ).order_by('-issue_date')
            
            for inv in existing_invoices:
                invoices_data.append({
                    'id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'payment_record_id': inv.payment_record_id,
                    'student_id': student.id,
                    'student_name': student.user.full_name,
                    'student_number': student.user.student_number,
                    'class_name': student.student_class.name if student.student_class else 'N/A',
                    'issue_date': inv.issue_date.strftime('%Y-%m-%d'),
                    'due_date': inv.due_date.strftime('%Y-%m-%d'),
                    'total_amount': float(inv.total_amount),
                    'amount_paid': float(inv.amount_paid),
                    'balance': float(inv.balance),
                    'status': 'paid' if inv.is_paid else ('partial' if inv.amount_paid > 0 else 'unpaid'),
                    'is_auto_generated': False,
                    'currency': inv.payment_record.currency if inv.payment_record else 'USD'
                })
            
            payment_records = StudentPaymentRecord.objects.filter(
                student=student,
                school=request.user.school,
            ).order_by('-date_created')
            for record in payment_records:
                invoice = _ensure_invoice_snapshot_for_record(record)
                if not invoice:
                    continue
                if existing_invoices.filter(id=invoice.id).exists():
                    continue
                invoices_data.append({
                    'id': invoice.id,
                    'invoice_number': invoice.invoice_number,
                    'payment_record_id': record.id,
                    'student_id': student.id,
                    'student_name': student.user.full_name,
                    'student_number': student.user.student_number,
                    'class_name': student.student_class.name if student.student_class else 'N/A',
                    'issue_date': invoice.issue_date.strftime('%Y-%m-%d'),
                    'due_date': invoice.due_date.strftime('%Y-%m-%d'),
                    'total_amount': float(invoice.total_amount),
                    'amount_paid': float(invoice.amount_paid),
                    'balance': float(invoice.balance),
                    'status': 'paid' if invoice.is_paid else ('partial' if invoice.amount_paid > 0 else 'unpaid'),
                    'is_auto_generated': True,
                    'currency': record.currency or 'USD',
                    'academic_year': record.academic_year,
                    'academic_term': record.academic_term,
                })
        
        return Response({'invoices': invoices_data})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
def parent_transport_preference(request, child_id):
    """Get or update a parent's transport fee preference for a specific child."""
    if request.user.role != 'parent':
        return Response({'error': 'Parent access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        link = ParentChildLink.objects.select_related('student__student_class').get(
            parent=request.user.parent,
            student_id=child_id,
            is_confirmed=True,
        )
    except ParentChildLink.DoesNotExist:
        return Response({'error': 'Child not found or not confirmed for this parent.'}, status=status.HTTP_404_NOT_FOUND)

    student = link.student
    preference, _ = TransportFeePreference.objects.get_or_create(
        parent=request.user.parent,
        student=student,
        defaults={'updated_by': request.user},
    )

    if request.method == 'PUT':
        raw_value = request.data.get('include_transport_fee')
        if isinstance(raw_value, bool):
            include_transport_fee = raw_value
        elif isinstance(raw_value, int):
            include_transport_fee = bool(raw_value)
        elif isinstance(raw_value, str):
            if raw_value.strip().lower() in ('true', '1', 'yes', 'on'):
                include_transport_fee = True
            elif raw_value.strip().lower() in ('false', '0', 'no', 'off'):
                include_transport_fee = False
            else:
                return Response({'error': 'include_transport_fee must be true or false.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'include_transport_fee is required.'}, status=status.HTTP_400_BAD_REQUEST)

        preference.include_transport_fee = include_transport_fee
        preference.updated_by = request.user
        preference.save(update_fields=['include_transport_fee', 'updated_by', 'updated_at'])

    fee_breakdown = build_school_fee_breakdown(
        student,
        request.user.school,
        parent=request.user.parent,
    )

    return Response({
        'student_id': student.id,
        'include_transport_fee': preference.include_transport_fee,
        'transport_fee_available': bool(fee_breakdown['transport_available']),
        'configured_transport_fee': float(fee_breakdown['transport_configured']),
        'applied_transport_fee': float(fee_breakdown['transport']),
        'updated_at': preference.updated_at,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_students_for_payment(request):
    """Get list of students for payment recording"""
    if request.user.role not in ['admin', 'accountant', 'hr']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    class_id = request.query_params.get('class_id')
    academic_year = request.query_params.get('academic_year')
    academic_term = normalize_term_key(request.query_params.get('academic_term'))
    if not academic_year or not academic_term:
        _, _, inferred_year, _, inferred_term = _current_term_window(request.user)
        academic_year = academic_year or inferred_year
        academic_term = academic_term or inferred_term
    
    students = Student.objects.filter(user__school=request.user.school)
    if class_id:
        students = students.filter(student_class_id=class_id)

    students = list(students.select_related('student_class', 'user'))
    grade_levels = {
        student.student_class.grade_level
        for student in students
        if student.student_class
    }
    school_fee_rows = SchoolFees.objects.filter(
        school=request.user.school,
        academic_year=academic_year,
        academic_term=academic_term,
        grade_level__in=grade_levels,
    )
    fee_by_grade = {fee.grade_level: fee for fee in school_fee_rows}

    additional_fees = AdditionalFee.objects.filter(
        school=request.user.school,
        academic_year=academic_year,
        academic_term=academic_term,
    )
    additional_by_student = defaultdict(Decimal)
    additional_by_class = defaultdict(Decimal)
    additional_global = Decimal('0')
    for fee in additional_fees:
        amount = to_decimal(fee.amount)
        if fee.student_id:
            additional_by_student[fee.student_id] += amount
        elif fee.student_class_id:
            additional_by_class[fee.student_class_id] += amount
        else:
            additional_global += amount
    
    student_list = []
    for student in students:
        grade_level = student.student_class.grade_level if student.student_class else None
        fee_row = fee_by_grade.get(grade_level)
        additional_fees_total = (
            additional_by_student.get(student.id, Decimal('0')) +
            additional_by_class.get(student.student_class_id, Decimal('0')) +
            additional_global
        )
        
        school_fee = None
        if fee_row:
            base_fee_total = (
                fee_row.tuition_fee +
                fee_row.levy_fee +
                fee_row.sports_fee +
                fee_row.computer_fee +
                fee_row.other_fees
            )
            school_supports_boarding = bool(
                request.user.school and getattr(request.user.school, 'accommodation_type', 'day') in ('boarding', 'both')
            )
            boarding_fee_applied = fee_row.boarding_fee if (school_supports_boarding and student.residence_type == 'boarding') else Decimal('0')
            transport_opted_in = bool(fee_row.transport_fee and fee_row.transport_fee > 0 and get_transport_opt_in(student))
            transport_fee_applied = fee_row.transport_fee if transport_opted_in else Decimal('0')
            school_fee_total = base_fee_total + boarding_fee_applied + transport_fee_applied
            school_fee = {
                'total_fee': float(school_fee_total + additional_fees_total),
                'base_fee': float(base_fee_total),
                'boarding_fee': float(boarding_fee_applied),
                'transport_fee': float(transport_fee_applied),
                'transport_opted_in': transport_opted_in,
                'additional_fees_total': float(additional_fees_total),
                'currency': fee_row.currency,
                'academic_year': academic_year,
                'academic_term': academic_term,
            }
        elif additional_fees_total > 0:
            school_fee = {
                'total_fee': float(additional_fees_total),
                'base_fee': 0,
                'boarding_fee': 0,
                'transport_fee': 0,
                'transport_opted_in': False,
                'additional_fees_total': float(additional_fees_total),
                'currency': 'USD',
                'academic_year': academic_year,
                'academic_term': academic_term,
            }
        
        student_list.append({
            'id': student.id,
            'name': student.user.full_name,
            'student_number': student.user.student_number,
            'class_name': student.student_class.name if student.student_class else 'Not Assigned',
            'class_id': student.student_class.id if student.student_class else None,
            'grade_level': grade_level,
            'school_fee': school_fee
        })
    
    return Response({'students': student_list})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_invoices_by_class(request):
    """
    Auto-generate invoices for all students in a class based on their school fees.
    Shows both outstanding (unpaid) and paid invoices.
    """
    user = request.user
    if user.role not in ['admin', 'accountant', 'hr']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    class_id = request.query_params.get('class_id')
    if not class_id:
        return Response({'invoices': []})
    
    # Get all students in the class
    students = Student.objects.filter(
        user__school=user.school,
        student_class_id=class_id
    ).select_related('user', 'student_class')
    
    invoices_data = []
    
    for student in students:
        payment_records = StudentPaymentRecord.objects.filter(
            student=student,
            school=user.school,
        ).order_by('-date_created')

        for record in payment_records:
            invoice = _ensure_invoice_snapshot_for_record(record)
            if not invoice:
                continue
            invoices_data.append({
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'payment_record_id': record.id,
                'student_id': student.id,
                'student_name': student.user.full_name,
                'student_number': student.user.student_number,
                'class_name': student.student_class.name if student.student_class else 'N/A',
                'issue_date': invoice.issue_date.strftime('%Y-%m-%d'),
                'due_date': invoice.due_date.strftime('%Y-%m-%d'),
                'total_amount': float(invoice.total_amount),
                'amount_paid': float(invoice.amount_paid),
                'balance': float(invoice.balance),
                'status': 'paid' if invoice.is_paid else ('partial' if invoice.amount_paid > 0 else 'unpaid'),
                'is_auto_generated': True,
                'currency': record.currency or 'USD',
                'academic_year': record.academic_year,
                'academic_term': record.academic_term,
            })
    
    return Response({'invoices': invoices_data})


# Additional Fees Views
class AdditionalFeeListCreateView(generics.ListCreateAPIView):
    """Represents AdditionalFeeListCreateView."""
    queryset = AdditionalFee.objects.all()
    serializer_class = AdditionalFeeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        if user.role not in ['admin', 'accountant']:
            if user.role == 'parent':
                from academics.models import ParentChildLink
                links = ParentChildLink.objects.filter(parent=user.parent, is_confirmed=True)
                child_ids = [link.student_id for link in links]
                return AdditionalFee.objects.filter(
                    Q(student_id__in=child_ids) | 
                    Q(student_class__students__id__in=child_ids)
                ).distinct()
            return AdditionalFee.objects.none()
        
        if user.school:
            queryset = AdditionalFee.objects.filter(school=user.school)
        else:
            queryset = AdditionalFee.objects.none()
        
        class_id = self.request.query_params.get('class_id')
        student_id = self.request.query_params.get('student_id')
        
        if class_id:
            queryset = queryset.filter(Q(student_class_id=class_id) | Q(student__student_class_id=class_id))
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """Execute perform create."""
        serializer.save(school=self.request.user.school, created_by=self.request.user)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def daily_transaction_report(request):
    """Execute daily transaction report."""
    from datetime import datetime
    
    user = request.user
    if user.role not in ['admin', 'accountant']:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    date_str = request.query_params.get('date')
    if date_str:
        try:
            report_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        report_date = timezone.now().date()

    search_query = (request.query_params.get('search') or '').strip()
    
    transactions = PaymentTransaction.objects.filter(
        payment_record__school=user.school,
        payment_date__date=report_date
    ).select_related(
        'payment_record__student__user',
        'payment_record__student__student_class',
        'processed_by'
    ).order_by('-payment_date')

    if search_query:
        search_filter = (
            Q(payment_record__student__user__first_name__icontains=search_query) |
            Q(payment_record__student__user__last_name__icontains=search_query) |
            Q(payment_record__student__user__student_number__icontains=search_query) |
            Q(transaction_reference__icontains=search_query)
        )
        search_parts = [part for part in search_query.split() if part]
        if len(search_parts) >= 2:
            first_part = search_parts[0]
            last_part = search_parts[-1]
            search_filter |= (
                Q(payment_record__student__user__first_name__icontains=first_part) &
                Q(payment_record__student__user__last_name__icontains=last_part)
            )
            search_filter |= (
                Q(payment_record__student__user__first_name__icontains=last_part) &
                Q(payment_record__student__user__last_name__icontains=first_part)
            )
        transactions = transactions.filter(search_filter)
    
    transaction_list = []
    total_collected = 0
    method_totals = {}
    
    for txn in transactions:
        amount = float(txn.amount)
        total_collected += amount
        method = txn.get_payment_method_display()
        method_totals[method] = method_totals.get(method, 0) + amount
        
        student = txn.payment_record.student
        transaction_list.append({
            'id': txn.id,
            'student_name': student.user.full_name,
            'student_number': student.user.student_number or '',
            'class_name': student.student_class.name if student.student_class else 'N/A',
            'amount': amount,
            'payment_method': method,
            'payment_method_key': txn.payment_method,
            'transaction_reference': txn.transaction_reference or '',
            'notes': txn.notes or '',
            'payment_time': txn.payment_date.strftime('%H:%M'),
            'processed_by': txn.processed_by.full_name if txn.processed_by else 'System',
        })
    
    method_breakdown = [
        {'method': method, 'total': total}
        for method, total in sorted(method_totals.items(), key=lambda x: -x[1])
    ]
    
    return Response({
        'date': report_date.isoformat(),
        'search': search_query,
        'total_collected': total_collected,
        'transaction_count': len(transaction_list),
        'transactions': transaction_list,
        'method_breakdown': method_breakdown,
    })


class AdditionalFeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents AdditionalFeeDetailView."""
    queryset = AdditionalFee.objects.all()
    serializer_class = AdditionalFeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        if user.role not in ['admin', 'accountant']:
            return AdditionalFee.objects.none()
        if user.school:
            return AdditionalFee.objects.filter(school=user.school)
        return AdditionalFee.objects.none()


def _record_total_due(record):
    return compute_record_totals(record)['total_due']


def _record_balance(record):
    return compute_record_totals(record)['balance']


def _ensure_invoice_snapshot_for_record(record):
    """Ensure at least one invoice exists for a payment record and keep it in sync."""
    total_due = _record_total_due(record)
    if total_due <= 0:
        return None

    invoice = (
        Invoice.objects
        .filter(payment_record=record, school=record.school)
        .order_by('-issue_date', '-id')
        .first()
    )

    if not invoice:
        return Invoice.objects.create(
            student=record.student,
            school=record.school,
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            total_amount=total_due,
            amount_paid=to_decimal(record.amount_paid),
            due_date=record.due_date or (date.today() + timedelta(days=30)),
            is_paid=_record_balance(record) <= 0,
            payment_record=record,
            notes=(
                f"Snapshot invoice for {record.get_payment_type_display()} "
                f"{record.academic_year} {_record_terms_label(record)}"
            ),
        )

    changed_fields = []
    paid_amount = to_decimal(record.amount_paid)
    record_is_paid = _record_balance(record) <= 0
    desired_due_date = record.due_date or invoice.due_date or (date.today() + timedelta(days=30))

    if invoice.total_amount != total_due:
        invoice.total_amount = total_due
        changed_fields.append('total_amount')
    if invoice.amount_paid != paid_amount:
        invoice.amount_paid = paid_amount
        changed_fields.append('amount_paid')
    if invoice.is_paid != record_is_paid:
        invoice.is_paid = record_is_paid
        changed_fields.append('is_paid')
    if invoice.due_date != desired_due_date:
        invoice.due_date = desired_due_date
        changed_fields.append('due_date')

    if changed_fields:
        invoice.save(update_fields=changed_fields)
    return invoice


def _ensure_invoice_snapshots_for_school(school):
    """Backfill/sync invoice snapshots so paid and unpaid records are visible in invoice lists."""
    records = (
        StudentPaymentRecord.objects
        .filter(school=school)
        .select_related('student', 'school')
    )
    for record in records:
        _ensure_invoice_snapshot_for_record(record)


def _sync_invoice_with_record(invoice, record):
    if not invoice:
        return
    invoice.amount_paid = to_decimal(record.amount_paid)
    invoice.is_paid = _record_balance(record) <= 0
    invoice.save(update_fields=['amount_paid', 'is_paid'])


def _apply_payment_to_record(record, amount, method='other', actor=None, reference='', notes='', target_invoice=None):
    """Apply payment atomically to record, transactions, invoice and additional-fee flags."""
    amount = to_decimal(amount)
    if amount <= 0:
        raise ValueError('Amount must be greater than zero.')

    outstanding = _record_balance(record)
    if amount > outstanding:
        raise ValueError('Payment amount cannot exceed remaining balance.')

    PaymentTransaction.objects.create(
        payment_record=record,
        amount=amount,
        payment_method=method,
        transaction_reference=reference or '',
        processed_by=actor,
        notes=notes or '',
    )

    record.amount_paid = to_decimal(record.amount_paid) + amount
    record.payment_status = compute_record_totals(record)['status']
    record.save(update_fields=['amount_paid', 'payment_status', 'date_updated'])

    invoice = target_invoice or Invoice.objects.filter(payment_record=record, school=record.school).order_by('-issue_date', '-id').first()
    _sync_invoice_with_record(invoice, record)

    settle_additional_fees_for_record(record)

    return record


def _recalculate_additional_fees_for_student(student, school, academic_year, academic_term=''):
    recalculate_student_additional_fees(student, school, academic_year, academic_term)


# ---------------------------------------------------------------
# PayNow Zimbabwe Payments
# ---------------------------------------------------------------

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def paynow_initiate_payment(request):
    """
    Initiate a PayNow payment for a student fee or invoice.
    Body: { invoice_number, amount, mobile_number (optional), method: ecocash|onemoney|web }
    """
    if request.user.role not in ('parent', 'student', 'admin', 'accountant'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from .paynow_service import initiate_web_payment, initiate_mobile_payment
    from users.models import SchoolSettings

    # Fetch per-school PayNow credentials
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with your account.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        school_settings = SchoolSettings.objects.get(school=school)
        integration_id = school_settings.paynow_integration_id
        integration_key = school_settings.paynow_integration_key
    except SchoolSettings.DoesNotExist:
        integration_id = ''
        integration_key = ''

    if not integration_id or not integration_key:
        return Response(
            {'error': 'PayNow credentials are not configured for your school. Please contact your administrator.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    requested_amount = request.data.get('amount')
    description = request.data.get('description', 'School Fees')
    mobile_number = request.data.get('mobile_number', '').strip()
    method = request.data.get('method', 'web').lower()
    email = request.user.email or 'payer@myschoolhub.local'

    invoice_id = request.data.get('invoice_id')
    payment_record_id = request.data.get('payment_record_id')
    student_id = request.data.get('student_id')
    invoice_number = (request.data.get('invoice_number') or '').strip()

    payment_record = None
    linked_invoice = None

    if not invoice_number:
        return Response({'error': 'invoice_number is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        linked_invoice = Invoice.objects.select_related('payment_record', 'student').get(
            invoice_number=invoice_number,
            school=school,
        )
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

    payment_record = linked_invoice.payment_record
    if not payment_record:
        return Response({'error': 'Invoice has no linked payment record.'}, status=status.HTTP_400_BAD_REQUEST)

    if invoice_id and str(linked_invoice.id) != str(invoice_id):
        return Response({'error': 'invoice_id does not match invoice_number.'}, status=status.HTTP_400_BAD_REQUEST)
    if payment_record_id and str(payment_record.id) != str(payment_record_id):
        return Response({'error': 'payment_record_id does not match invoice_number.'}, status=status.HTTP_400_BAD_REQUEST)
    if student_id and str(payment_record.student_id) != str(student_id):
        return Response({'error': 'student_id does not match invoice_number.'}, status=status.HTTP_400_BAD_REQUEST)

    if request.user.role == 'parent':
        parent_owns_student = ParentChildLink.objects.filter(
            parent=request.user.parent,
            student=payment_record.student,
            is_confirmed=True,
        ).exists()
        if not parent_owns_student:
            return Response({'error': 'Permission denied for this student.'}, status=status.HTTP_403_FORBIDDEN)
    elif request.user.role == 'student' and getattr(request.user, 'student', None) and request.user.student.id != payment_record.student_id:
        return Response({'error': 'Permission denied for this student.'}, status=status.HTTP_403_FORBIDDEN)

    outstanding = _record_balance(payment_record)
    if outstanding <= 0:
        return Response({'error': 'This payment record is already fully settled.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        amount = to_decimal(requested_amount if requested_amount not in (None, '') else outstanding)
    except (TypeError, ValueError, InvalidOperation):
        return Response({'error': 'Invalid amount value.'}, status=status.HTTP_400_BAD_REQUEST)
    if amount <= 0:
        return Response({'error': 'Amount must be greater than 0.'}, status=status.HTTP_400_BAD_REQUEST)
    if amount > outstanding:
        return Response(
            {'error': f'Amount exceeds remaining balance ({payment_record.currency}{outstanding}).'},
            status=status.HTTP_400_BAD_REQUEST
        )

    provider_reference = f"MSH-{school.id}-{payment_record.id}-{uuid.uuid4().hex[:12].upper()}"
    items = [{'description': description, 'amount': float(amount)}]

    if method in ('ecocash', 'onemoney', 'innbucks'):
        if not mobile_number:
            return Response({'error': 'Mobile number is required for mobile payments.'}, status=status.HTTP_400_BAD_REQUEST)
        result = initiate_mobile_payment(provider_reference, email, items, mobile_number, integration_id, integration_key, method)
    else:
        result = initiate_web_payment(provider_reference, email, items, integration_id, integration_key)

    if result['success']:
        intent = PaymentIntent.objects.create(
            school=school,
            student=payment_record.student,
            payment_record=payment_record,
            invoice=linked_invoice,
            expected_amount=amount,
            currency=payment_record.currency or 'USD',
            provider='paynow',
            payment_method=method,
            provider_reference=provider_reference,
            poll_url=result.get('poll_url') or '',
            idempotency_key=uuid.uuid4().hex,
            status='pending',
            created_by=request.user,
        )
        return Response({
            'success': True,
            'redirect_url': result.get('redirect_url'),
            'poll_url': result.get('poll_url'),
            'instructions': result.get('instructions'),
            'reference': provider_reference,
            'intent_id': intent.id,
            'message': 'Payment initiated. Follow the link to complete payment.' if method == 'web'
                       else f'Check your {method.upper()} prompt to approve payment.',
        })
    return Response({'error': result.get('error', 'Payment initiation failed.')}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # PayNow server callback — no auth token
def paynow_result_callback(request):
    """
    Server-to-server result URL callback from PayNow.
    Updates the payment record status based on PayNow response.
    """
    reference = request.data.get('reference', '').strip()
    paynow_reference = request.data.get('paynowreference', '').strip()
    amount = request.data.get('amount', 0)
    status_value = request.data.get('status', '').lower()

    logger.info('PayNow callback: ref=%s paynow_ref=%s status=%s amount=%s',
                reference, paynow_reference, status_value, amount)

    if not reference:
        return Response({'status': 'ignored', 'reason': 'missing reference'})

    try:
        with transaction.atomic():
            intent = PaymentIntent.objects.select_for_update().select_related(
                'payment_record__student__user',
                'payment_record__student__student_class',
            ).filter(provider_reference=reference, provider='paynow').first()
            if not intent:
                logger.warning('PayNow callback unmatched reference=%s payload=%s', reference, dict(request.data))
                return Response({'status': 'ignored'})

            intent.raw_callback_payload = dict(request.data)
            if intent.status == 'paid':
                intent.save(update_fields=['raw_callback_payload'])
                return Response({'status': 'received'})

            if status_value in ('paid', 'awaiting delivery'):
                callback_amount = to_decimal(amount)
                if callback_amount <= 0:
                    callback_amount = intent.expected_amount
                if callback_amount != intent.expected_amount:
                    logger.warning(
                        'PayNow callback amount mismatch ref=%s expected=%s got=%s',
                        reference,
                        intent.expected_amount,
                        callback_amount,
                    )
                    return Response({'status': 'ignored', 'reason': 'amount mismatch'})

                try:
                    _apply_payment_to_record(
                        intent.payment_record,
                        callback_amount,
                        method='mobile_money' if intent.payment_method in ('ecocash', 'onemoney', 'innbucks') else 'card',
                        actor=intent.created_by,
                        reference=paynow_reference or reference,
                        notes=f'PayNow callback ({status_value})',
                        target_invoice=intent.invoice,
                    )
                except ValueError as exc:
                    return Response({'status': 'ignored', 'reason': str(exc)})

                intent.status = 'paid'
                intent.paid_amount = callback_amount
                intent.completed_at = timezone.now()
                intent.save(update_fields=['status', 'paid_amount', 'completed_at', 'raw_callback_payload'])

                # Notify parents of successful PayNow payment
                try:
                    student = intent.payment_record.student
                    school_name = student.user.school.name if student.user.school else "Your School"
                    class_name = student.student_class.name if student.student_class else "N/A"
                    student_name = f"{student.user.first_name} {student.user.last_name}".strip()
                    for p in get_parents_of_student(student):
                        send_payment_received_email(
                            parent_email=p['email'],
                            parent_name=p['name'],
                            school_name=school_name,
                            student_name=student_name,
                            class_name=class_name,
                            amount_usd=str(callback_amount),
                            payment_method="PayNow",
                            reference=paynow_reference or reference,
                        )
                except Exception as email_exc:
                    logger.error("PayNow payment email failed: %s", email_exc)
            elif status_value in ('failed', 'cancelled'):
                intent.status = 'failed' if status_value == 'failed' else 'cancelled'
                intent.save(update_fields=['status', 'raw_callback_payload'])
            else:
                # Keep pending state for unknown/intermediate statuses.
                intent.status = 'pending'
                intent.save(update_fields=['status', 'raw_callback_payload'])
    except Exception as exc:
        logger.error('PayNow callback update failed: %s', exc)
        return Response({'status': 'error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'status': 'received'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def paynow_check_status(request):
    """Check payment status by poll URL."""
    intent_id = request.query_params.get('intent_id')
    poll_url = request.query_params.get('poll_url')
    intent = None

    if intent_id:
        intent = PaymentIntent.objects.filter(
            id=intent_id,
            school=request.user.school,
            provider='paynow',
        ).select_related('payment_record').first()
        if not intent:
            return Response({'error': 'Payment intent not found.'}, status=status.HTTP_404_NOT_FOUND)
        poll_url = intent.poll_url

    if not poll_url:
        return Response({'error': 'poll_url is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from .paynow_service import check_payment_status
    from users.models import SchoolSettings

    school = request.user.school
    try:
        school_settings = SchoolSettings.objects.get(school=school)
        integration_id = school_settings.paynow_integration_id
        integration_key = school_settings.paynow_integration_key
    except (SchoolSettings.DoesNotExist, AttributeError):
        return Response({'error': 'PayNow not configured for your school.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    result = check_payment_status(poll_url, integration_id, integration_key)
    if intent and result.get('paid') and intent.status != 'paid':
        with transaction.atomic():
            locked = PaymentIntent.objects.select_for_update().get(id=intent.id)
            if locked.status != 'paid':
                try:
                    _apply_payment_to_record(
                        locked.payment_record,
                        locked.expected_amount,
                        method='mobile_money' if locked.payment_method in ('ecocash', 'onemoney', 'innbucks') else 'card',
                        actor=locked.created_by,
                        reference=locked.provider_reference,
                        notes='PayNow status poll settlement',
                    )
                    locked.status = 'paid'
                    locked.paid_amount = locked.expected_amount
                    locked.completed_at = timezone.now()
                    locked.save(update_fields=['status', 'paid_amount', 'completed_at'])
                    result['settled'] = True
                except ValueError:
                    result['settled'] = False
    return Response(result)


# ---------------------------------------------------------------
# Bulk CSV Import — Fees
# ---------------------------------------------------------------

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def bulk_import_fees(request):
    """
    Import student fees from a CSV file.
    CSV columns: student_number, fee_type_name, amount, academic_year, academic_term
    """
    import csv
    import io

    if request.user.role not in ('admin', 'accountant'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    csv_file = request.FILES.get('file')
    if not csv_file:
        return Response({'error': 'No CSV file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    school = request.user.school
    from .models import StudentFee, FeeType
    from academics.models import Student

    decoded = csv_file.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))

    created_count = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            student_number = row.get('student_number', '').strip()
            fee_type_name = row.get('fee_type_name', '').strip()
            amount = float(row.get('amount', 0))
            academic_year = row.get('academic_year', '').strip()
            academic_term = row.get('academic_term', '').strip()

            student = Student.objects.get(user__student_number=student_number, user__school=school)
            fee_type, _ = FeeType.objects.get_or_create(
                name=fee_type_name,
                defaults={'amount': amount, 'academic_year': academic_year}
            )

            import datetime
            StudentFee.objects.get_or_create(
                student=student, fee_type=fee_type,
                academic_term=academic_term, academic_year=academic_year,
                defaults={
                    'amount_due': amount,
                    'due_date': datetime.date.today(),
                }
            )
            created_count += 1
        except Student.DoesNotExist:
            errors.append({'row': i, 'error': f"Student '{row.get('student_number')}' not found."})
        except Exception as exc:
            errors.append({'row': i, 'error': str(exc)})

    return Response({
        'created': created_count,
        'errors': errors,
        'message': f'Imported {created_count} fee records with {len(errors)} errors.'
    })
