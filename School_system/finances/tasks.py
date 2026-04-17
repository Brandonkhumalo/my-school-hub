"""
Celery tasks for financial operations.

Heavy aggregation (report generation, bulk fee calculations) runs as background
tasks so HTTP requests return immediately.
"""
from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def generate_financial_report_task(self, report_id: int):
    """
    Populate aggregated figures on an already-created FinancialReport record.
    The view creates the shell record and enqueues this task; the frontend
    can poll the record for completion.
    """
    try:
        from django.db.models import Sum, Q
        from .models import FinancialReport, StudentPaymentRecord

        report = FinancialReport.objects.select_related('generated_by__school').get(id=report_id)
        school = report.generated_by.school

        filters = Q(school=school, academic_year=report.academic_year)
        if report.academic_term:
            filters &= Q(academic_term=report.academic_term)

        agg = StudentPaymentRecord.objects.filter(filters).aggregate(
            total_revenue=Sum('amount_paid'),
        )

        report.total_revenue = agg['total_revenue'] or 0
        report.save(update_fields=['total_revenue'])

        logger.info("Financial report %s generated for school %s", report_id, school)
        return report_id

    except FinancialReport.DoesNotExist:
        logger.error("FinancialReport %s not found", report_id)
    except Exception as exc:
        logger.error("Error generating financial report %s: %s", report_id, exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def bulk_assign_fees_task(self, school_id: int, academic_year: str, academic_term: str):
    """
    Assign school fees to all students for a given academic term.
    Runs as a background task to avoid blocking the HTTP request.
    """
    try:
        from django.db import transaction
        from users.models import School
        from academics.models import Student
        from datetime import date
        from .models import SchoolFees, StudentFee, FeeType
        from .fee_calculator import build_school_fee_breakdown

        school = School.objects.get(id=school_id)
        fee_structures = SchoolFees.objects.filter(
            school=school,
            academic_year=academic_year,
            academic_term=academic_term,
        )

        students = Student.objects.filter(
            user__school=school
        ).select_related('student_class', 'user')

        created_count = 0
        with transaction.atomic():
            for student in students:
                grade_level = student.student_class.grade_level if student.student_class else None
                if grade_level is None:
                    continue
                fee_structure = fee_structures.filter(grade_level=grade_level).first()
                if not fee_structure:
                    continue
                fee_breakdown = build_school_fee_breakdown(student, school)
                student_amount_due = fee_breakdown['total_school_fee']
                fee_type, _ = FeeType.objects.get_or_create(
                    name=fee_structure.grade_name,
                    school=school,
                    academic_year=academic_year,
                    defaults={'amount': student_amount_due},
                )
                _, created = StudentFee.objects.get_or_create(
                    student=student,
                    fee_type=fee_type,
                    academic_year=academic_year,
                    academic_term=academic_term,
                    defaults={
                        'amount_due': student_amount_due,
                        'due_date': fee_structure.date_updated.date() if hasattr(fee_structure, 'date_updated') else date.today(),
                    },
                )
                if created:
                    created_count += 1

        logger.info("Assigned fees to %d students for %s %s in school %s",
                    created_count, academic_year, academic_term, school)
        return created_count

    except Exception as exc:
        logger.error("Error in bulk_assign_fees_task: %s", exc)
        raise self.retry(exc=exc)
