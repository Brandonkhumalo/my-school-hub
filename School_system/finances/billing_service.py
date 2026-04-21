from decimal import Decimal

from django.db.models import Q

from .fee_calculator import get_unpaid_additional_fees_for_record
from .models import AdditionalFee, StudentPaymentRecord
from .term_finance import normalize_term_key, resolve_terms_for_plan


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
