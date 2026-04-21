from decimal import Decimal

from django.db.models import Q

from academics.models import ParentChildLink

from .models import AdditionalFee, SchoolFees, TransportFeePreference
from .term_finance import normalize_terms


def _to_decimal(value):
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def get_latest_school_fee_for_student(student, school):
    if not school or not getattr(student, 'student_class', None):
        return None
    return SchoolFees.objects.filter(
        school=school,
        grade_level=student.student_class.grade_level,
    ).order_by('-academic_year', '-academic_term').first()


def get_additional_fees_for_student(student, school):
    if not school:
        return []
    return list(
        AdditionalFee.objects.filter(
            school=school,
            is_paid=False,
        ).filter(
            Q(student=student) | Q(student_class=student.student_class)
        )
    )


def get_unpaid_additional_fees_for_record(payment_record):
    """Return unpaid additional fees applicable to a specific payment record scope."""
    if not payment_record or not payment_record.school:
        return []

    queryset = AdditionalFee.objects.filter(
        school=payment_record.school,
        is_paid=False,
        academic_year=payment_record.academic_year,
    ).filter(
        Q(student=payment_record.student) | Q(student_class=payment_record.student.student_class)
    )
    covered_terms = normalize_terms(getattr(payment_record, 'covered_terms', []))
    if covered_terms:
        queryset = queryset.filter(academic_term__in=covered_terms)
    elif payment_record.academic_term:
        queryset = queryset.filter(academic_term=payment_record.academic_term)
    return list(queryset.order_by('created_at', 'id'))


def get_additional_fees_total_for_record(payment_record):
    return sum((_to_decimal(fee.amount) for fee in get_unpaid_additional_fees_for_record(payment_record)), Decimal('0'))


def get_transport_opt_in(student, parent=None):
    if parent is not None:
        pref = TransportFeePreference.objects.filter(parent=parent, student=student).first()
        return bool(pref and pref.include_transport_fee)

    confirmed_parent_ids = ParentChildLink.objects.filter(
        student=student,
        is_confirmed=True,
    ).values_list('parent_id', flat=True)
    if not confirmed_parent_ids:
        return False
    return TransportFeePreference.objects.filter(
        student=student,
        parent_id__in=confirmed_parent_ids,
        include_transport_fee=True,
    ).exists()


def build_school_fee_breakdown(student, school, parent=None):
    fee = get_latest_school_fee_for_student(student, school)
    if not fee:
        return {
            'school_fee': None,
            'currency': 'USD',
            'academic_year': None,
            'academic_term': None,
            'tuition': Decimal('0'),
            'levy': Decimal('0'),
            'sports': Decimal('0'),
            'computer': Decimal('0'),
            'other': Decimal('0'),
            'boarding': Decimal('0'),
            'transport': Decimal('0'),
            'transport_configured': Decimal('0'),
            'boarding_applied': False,
            'transport_available': False,
            'transport_opted_in': False,
            'total_school_fee': Decimal('0'),
        }

    tuition = _to_decimal(fee.tuition_fee)
    levy = _to_decimal(fee.levy_fee)
    sports = _to_decimal(fee.sports_fee)
    computer = _to_decimal(fee.computer_fee)
    other = _to_decimal(fee.other_fees)

    school_supports_boarding = bool(school and getattr(school, 'accommodation_type', 'day') in ('boarding', 'both'))
    boarding_applied = school_supports_boarding and student.residence_type == 'boarding'
    boarding = _to_decimal(fee.boarding_fee) if boarding_applied else Decimal('0')

    transport_configured = _to_decimal(fee.transport_fee)
    transport_available = transport_configured > 0
    transport_opted_in = get_transport_opt_in(student, parent=parent) if transport_available else False
    transport = transport_configured if (transport_available and transport_opted_in) else Decimal('0')

    total_school_fee = tuition + levy + sports + computer + other + boarding + transport

    return {
        'school_fee': fee,
        'currency': fee.currency,
        'academic_year': fee.academic_year,
        'academic_term': fee.academic_term,
        'tuition': tuition,
        'levy': levy,
        'sports': sports,
        'computer': computer,
        'other': other,
        'boarding': boarding,
        'transport': transport,
        'transport_configured': transport_configured,
        'boarding_applied': boarding_applied,
        'transport_available': transport_available,
        'transport_opted_in': transport_opted_in,
        'total_school_fee': total_school_fee,
    }
