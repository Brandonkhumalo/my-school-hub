import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Q

from .fee_calculator import get_unpaid_additional_fees_for_record
from .models import AdditionalFee, StudentPaymentRecord, Invoice, SchoolFees
from .term_finance import TERM_SEQUENCE, normalize_term_key, resolve_terms_for_plan


def to_decimal(value):
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def compute_record_additional_fees_total(record):
    return sum((to_decimal(f.amount) for f in get_unpaid_additional_fees_for_record(record)), Decimal('0'))


def compute_record_totals(record):
    base_due = to_decimal(record.total_amount_due)
    additional_due = compute_record_additional_fees_total(record)
    total_due = base_due + additional_due
    amount_paid = to_decimal(record.amount_paid)
    balance = total_due - amount_paid
    if balance <= 0:
        status = 'paid'
    elif amount_paid > 0:
        status = 'partial'
    else:
        status = 'unpaid'
    return {
        'base_due': base_due,
        'additional_due': additional_due,
        'total_due': total_due,
        'amount_paid': amount_paid,
        'balance': balance,
        'status': status,
    }


def sync_record_status(record, save=True):
    totals = compute_record_totals(record)
    record.payment_status = totals['status']
    if save:
        record.save(update_fields=['payment_status', 'date_updated'])
    return totals


def settle_additional_fees_for_record(record):
    totals = compute_record_totals(record)
    additional_paid_budget = max(Decimal('0'), totals['amount_paid'] - totals['base_due'])
    for fee in get_unpaid_additional_fees_for_record(record):
        fee_amount = to_decimal(fee.amount)
        if additional_paid_budget >= fee_amount:
            fee.is_paid = True
            fee.save(update_fields=['is_paid'])
            additional_paid_budget -= fee_amount
        else:
            break


def recalculate_student_additional_fees(student, school, academic_year, academic_term=''):
    if not student or not school or not academic_year:
        return

    records_qs = StudentPaymentRecord.objects.filter(
        student=student,
        school=school,
        academic_year=academic_year,
    )
    records = list(records_qs)
    if academic_term:
        target_term = normalize_term_key(academic_term)
        filtered_records = []
        for record in records:
            terms = resolve_terms_for_plan(
                record.payment_plan,
                record.academic_term,
                getattr(record, 'covered_terms', []),
            )
            if not terms and record.payment_plan == 'full_year':
                terms = ['term_1', 'term_2', 'term_3']
            if target_term in terms:
                filtered_records.append(record)
        records = filtered_records

    fees = AdditionalFee.objects.filter(
        school=school,
        academic_year=academic_year,
    ).filter(Q(student=student) | Q(student_class=student.student_class))
    if academic_term:
        fees = fees.filter(academic_term=academic_term)
    fees = fees.order_by('created_at', 'id')

    total_base_due = sum((to_decimal(record.total_amount_due) for record in records), Decimal('0'))
    total_base_paid = sum((to_decimal(record.amount_paid) for record in records), Decimal('0'))
    available_for_additional = max(Decimal('0'), total_base_paid - total_base_due)

    for fee in fees:
        fee_amount = to_decimal(fee.amount)
        should_be_paid = available_for_additional >= fee_amount
        if fee.is_paid != should_be_paid:
            fee.is_paid = should_be_paid
            fee.save(update_fields=['is_paid'])
        if should_be_paid:
            available_for_additional -= fee_amount


def _school_supports_boarding(school):
    return bool(school and getattr(school, 'accommodation_type', 'day') in ('boarding', 'both'))


def _school_fee_total_for_student_term(student, school, school_fee_row, transport_opted_in=False):
    if not school_fee_row:
        return Decimal('0')

    total = (
        to_decimal(school_fee_row.tuition_fee) +
        to_decimal(school_fee_row.levy_fee) +
        to_decimal(school_fee_row.sports_fee) +
        to_decimal(school_fee_row.computer_fee) +
        to_decimal(school_fee_row.other_fees)
    )

    if _school_supports_boarding(school) and getattr(student, 'residence_type', 'day') == 'boarding':
        total += to_decimal(school_fee_row.boarding_fee)

    transport_fee = to_decimal(getattr(school_fee_row, 'transport_fee', 0))
    if transport_opted_in and transport_fee > 0:
        total += transport_fee
    return total


def _sync_invoice_from_record(record):
    total_due = to_decimal(record.total_amount_due)
    invoice = (
        Invoice.objects
        .filter(payment_record=record, school=record.school)
        .order_by('-issue_date', '-id')
        .first()
    )
    if not invoice:
        invoice = Invoice.objects.create(
            student=record.student,
            school=record.school,
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            total_amount=total_due,
            amount_paid=to_decimal(record.amount_paid),
            due_date=record.due_date or (date.today() + timedelta(days=30)),
            is_paid=to_decimal(record.amount_paid) >= total_due,
            payment_record=record,
            notes=f"Auto-generated invoice for {record.academic_year} {record.academic_term}",
        )
        return invoice

    update_fields = []
    paid_amount = to_decimal(record.amount_paid)
    due_date = record.due_date or invoice.due_date or (date.today() + timedelta(days=30))
    is_paid = paid_amount >= total_due

    if invoice.total_amount != total_due:
        invoice.total_amount = total_due
        update_fields.append('total_amount')
    if invoice.amount_paid != paid_amount:
        invoice.amount_paid = paid_amount
        update_fields.append('amount_paid')
    if invoice.is_paid != is_paid:
        invoice.is_paid = is_paid
        update_fields.append('is_paid')
    if invoice.due_date != due_date:
        invoice.due_date = due_date
        update_fields.append('due_date')

    if update_fields:
        invoice.save(update_fields=update_fields)
    return invoice


def ensure_three_term_invoices_for_student(student, school, academic_year, recorded_by=None):
    if not student or not school or not academic_year or not getattr(student, 'student_class_id', None):
        return 0

    grade_level = getattr(student.student_class, 'grade_level', None)
    if grade_level is None:
        return 0

    fee_rows = list(
        SchoolFees.objects.filter(
            school=school,
            grade_level=grade_level,
            academic_year=academic_year,
        )
    )
    if not fee_rows:
        return 0

    fee_by_term = {row.academic_term: row for row in fee_rows}
    fallback_fee = fee_rows[0]

    from .fee_calculator import get_transport_opt_in
    transport_opted_in = get_transport_opt_in(student)

    touched = 0
    for term in TERM_SEQUENCE:
        fee_row = fee_by_term.get(term) or fallback_fee
        total_due = _school_fee_total_for_student_term(
            student=student,
            school=school,
            school_fee_row=fee_row,
            transport_opted_in=transport_opted_in,
        )

        record, created = StudentPaymentRecord.objects.get_or_create(
            school=school,
            student=student,
            payment_type='school_fees',
            payment_plan='one_term',
            academic_year=str(academic_year),
            academic_term=term,
            defaults={
                'total_amount_due': total_due,
                'amount_paid': Decimal('0'),
                'currency': fee_row.currency or 'USD',
                'payment_status': 'unpaid',
                'recorded_by': recorded_by,
                'covered_terms': [term],
            },
        )

        if created:
            _sync_invoice_from_record(record)
            touched += 1
            continue

        # Freeze already-paid records so fee increases do not create extra debt.
        previously_paid = (
            record.payment_status == 'paid' or
            to_decimal(record.amount_paid) >= to_decimal(record.total_amount_due)
        )
        if previously_paid:
            _sync_invoice_from_record(record)
            continue

        update_fields = []
        if to_decimal(record.total_amount_due) != total_due:
            record.total_amount_due = total_due
            update_fields.append('total_amount_due')
        if record.currency != (fee_row.currency or record.currency):
            record.currency = fee_row.currency or record.currency
            update_fields.append('currency')

        if to_decimal(record.amount_paid) >= to_decimal(record.total_amount_due):
            status_value = 'paid'
        elif to_decimal(record.amount_paid) > 0:
            status_value = 'partial'
        else:
            status_value = 'unpaid'
        if record.payment_status != status_value:
            record.payment_status = status_value
            update_fields.append('payment_status')

        if update_fields:
            update_fields.append('date_updated')
            record.save(update_fields=update_fields)
            touched += 1

        _sync_invoice_from_record(record)

    return touched


def ensure_three_term_invoices_for_school(school, academic_year, recorded_by=None, grade_level=None):
    if not school or not academic_year:
        return 0

    from academics.models import Student

    students = Student.objects.filter(user__school=school).select_related('student_class')
    if grade_level is not None:
        students = students.filter(student_class__grade_level=grade_level)

    touched = 0
    for student in students:
        touched += ensure_three_term_invoices_for_student(
            student=student,
            school=school,
            academic_year=academic_year,
            recorded_by=recorded_by,
        )
    return touched
