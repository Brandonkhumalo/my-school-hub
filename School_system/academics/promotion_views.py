"""
Views for student year-end promotions (promote, repeat, graduate).
All endpoints are admin/HR.
"""

import logging

from django.db import transaction
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Student, Class, PromotionRecord

logger = logging.getLogger(__name__)


def _is_admin_or_hr(user):
    """Return True if the authenticated user has the admin/HR role."""
    return getattr(user, 'role', None) in ('admin', 'hr', 'superadmin')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def promotion_preview(request):
    """
    GET /api/v1/academics/promotions/preview/?class_id=X&academic_year=Y

    Returns a list of students in the given class with a suggested
    promotion action and target class.

    Logic:
    - Find the next class by looking for grade_level + 1 in the same
      school.  If no such class exists the student is suggested for
      'graduate'.
    - All students default to 'promote' unless they are in the final
      grade, in which case the suggestion is 'graduate'.
    """
    if not _is_admin_or_hr(request.user):
        return Response({'error': 'Admin/HR access required.'}, status=status.HTTP_403_FORBIDDEN)

    class_id = request.query_params.get('class_id')
    academic_year = request.query_params.get('academic_year')

    if not class_id or not academic_year:
        return Response(
            {'error': 'Both class_id and academic_year query parameters are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        current_class = Class.objects.get(id=class_id, school=request.user.school)
    except Class.DoesNotExist:
        return Response({'error': 'Class not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Students currently in this class
    students = (
        Student.objects
        .filter(student_class=current_class)
        .select_related('user', 'student_class')
        .order_by('user__last_name', 'user__first_name')
    )

    # Try to find the next class (grade_level + 1) in the same school
    next_class = (
        Class.objects
        .filter(school=request.user.school, grade_level=current_class.grade_level + 1)
        .first()
    )

    preview = []
    for student in students:
        # Check if a promotion record already exists for this student & year
        already_processed = PromotionRecord.objects.filter(
            student=student, academic_year=academic_year
        ).exists()

        if next_class:
            suggested_action = 'promote'
            suggested_to_class = {
                'id': next_class.id,
                'name': str(next_class),
                'grade_level': next_class.grade_level,
            }
        else:
            suggested_action = 'graduate'
            suggested_to_class = None

        preview.append({
            'student_id': student.id,
            'student_name': student.user.full_name,
            'student_number': getattr(student.user, 'student_number', ''),
            'current_class': {
                'id': current_class.id,
                'name': str(current_class),
                'grade_level': current_class.grade_level,
            },
            'suggested_action': suggested_action,
            'suggested_to_class': suggested_to_class,
            'already_processed': already_processed,
        })

    return Response({
        'class': str(current_class),
        'academic_year': academic_year,
        'students': preview,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def process_promotions(request):
    """
    POST /api/v1/academics/promotions/

    Payload:
    {
        "academic_year": "2026",
        "promotions": [
            { "student_id": 1, "action": "promote", "to_class_id": 5 },
            { "student_id": 2, "action": "repeat" },
            { "student_id": 3, "action": "graduate" }
        ]
    }

    For each entry:
    - 'promote': move the student to the specified to_class
    - 'repeat': keep in the same class, just record the decision
    - 'graduate': clear the student's class assignment (set to None is
      not possible because of FK constraint, so we keep the class but
      record the graduation)
    """
    if not _is_admin_or_hr(request.user):
        return Response({'error': 'Admin/HR access required.'}, status=status.HTTP_403_FORBIDDEN)

    academic_year = request.data.get('academic_year')
    promotions = request.data.get('promotions', [])

    if not academic_year:
        return Response({'error': 'academic_year is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not promotions:
        return Response({'error': 'promotions list is required.'}, status=status.HTTP_400_BAD_REQUEST)

    results = {'promoted': 0, 'repeated': 0, 'graduated': 0, 'errors': []}

    with transaction.atomic():
        for entry in promotions:
            student_id = entry.get('student_id')
            action = entry.get('action', 'promote')
            to_class_id = entry.get('to_class_id')

            try:
                student = Student.objects.select_related('student_class', 'user').get(
                    id=student_id,
                    student_class__school=request.user.school,
                )
            except Student.DoesNotExist:
                results['errors'].append(f'Student {student_id} not found.')
                continue

            # Skip if already processed for this academic year
            if PromotionRecord.objects.filter(student=student, academic_year=academic_year).exists():
                results['errors'].append(
                    f'{student.user.full_name} has already been processed for {academic_year}.'
                )
                continue

            from_class = student.student_class
            to_class = None

            if action == 'promote':
                if not to_class_id:
                    results['errors'].append(
                        f'{student.user.full_name}: to_class_id is required for promotion.'
                    )
                    continue
                try:
                    to_class = Class.objects.get(id=to_class_id, school=request.user.school)
                except Class.DoesNotExist:
                    results['errors'].append(
                        f'{student.user.full_name}: target class {to_class_id} not found.'
                    )
                    continue
                student.student_class = to_class
                student.save(update_fields=['student_class'])
                results['promoted'] += 1

            elif action == 'repeat':
                # Student stays in the same class — no model change needed
                to_class = from_class
                results['repeated'] += 1

            elif action == 'graduate':
                # Record graduation. The student keeps their last class
                # reference for historical records.
                results['graduated'] += 1

            else:
                results['errors'].append(
                    f'{student.user.full_name}: invalid action "{action}".'
                )
                continue

            PromotionRecord.objects.create(
                student=student,
                from_class=from_class,
                to_class=to_class,
                academic_year=academic_year,
                action=action,
                decided_by=request.user,
                notes=entry.get('notes', ''),
                school=request.user.school,
            )

    return Response({
        'message': 'Promotions processed successfully.',
        'summary': results,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def promotion_history(request):
    """
    GET /api/v1/academics/promotions/history/?academic_year=2026

    Returns all promotion records for the school, optionally filtered by
    academic_year.
    """
    if not _is_admin_or_hr(request.user):
        return Response({'error': 'Admin/HR access required.'}, status=status.HTTP_403_FORBIDDEN)

    qs = (
        PromotionRecord.objects
        .filter(school=request.user.school)
        .select_related('student__user', 'from_class', 'to_class', 'decided_by')
        .order_by('-date_processed')
    )

    academic_year = request.query_params.get('academic_year')
    if academic_year:
        qs = qs.filter(academic_year=academic_year)

    records = []
    for rec in qs:
        records.append({
            'id': rec.id,
            'student_name': rec.student.user.full_name,
            'student_number': getattr(rec.student.user, 'student_number', ''),
            'from_class': str(rec.from_class) if rec.from_class else '',
            'to_class': str(rec.to_class) if rec.to_class else '',
            'action': rec.action,
            'academic_year': rec.academic_year,
            'decided_by': rec.decided_by.full_name if rec.decided_by else '',
            'date_processed': rec.date_processed.isoformat(),
            'notes': rec.notes,
        })

    return Response(records)
