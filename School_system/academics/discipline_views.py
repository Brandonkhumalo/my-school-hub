from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone

from .models import DisciplinaryRecord, Student, Announcement
from users.models import CustomUser


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def discipline_list_create(request):
    """
    GET  — List disciplinary records for the school (admin/teacher).
           Supports query params: ?severity=minor&is_resolved=false&student_id=1
    POST — Create a new disciplinary record (admin/teacher).
    """
    if request.user.role not in ('admin', 'teacher', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        records = DisciplinaryRecord.objects.filter(school=school).select_related(
            'student__user', 'reported_by'
        )

        severity = request.query_params.get('severity')
        if severity:
            records = records.filter(severity=severity)

        is_resolved = request.query_params.get('is_resolved')
        if is_resolved is not None:
            records = records.filter(is_resolved=is_resolved.lower() == 'true')

        student_id = request.query_params.get('student_id')
        if student_id:
            records = records.filter(student_id=student_id)

        data = [
            {
                'id': r.id,
                'student_id': r.student.id,
                'student_name': r.student.user.full_name,
                'student_number': r.student.user.student_number,
                'reported_by': r.reported_by.full_name if r.reported_by else 'N/A',
                'incident_type': r.incident_type,
                'severity': r.severity,
                'description': r.description,
                'action_taken': r.action_taken,
                'date_of_incident': str(r.date_of_incident),
                'parent_notified': r.parent_notified,
                'follow_up_notes': r.follow_up_notes,
                'is_resolved': r.is_resolved,
                'date_created': r.date_created.isoformat(),
            }
            for r in records[:100]
        ]
        return Response({'results': data, 'count': len(data)})

    # POST — create
    student_id = request.data.get('student_id')
    if not student_id:
        return Response({'error': 'student_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        student = Student.objects.get(id=student_id, user__school=school)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    record = DisciplinaryRecord.objects.create(
        student=student,
        reported_by=request.user,
        incident_type=request.data.get('incident_type', ''),
        severity=request.data.get('severity', 'minor'),
        description=request.data.get('description', ''),
        action_taken=request.data.get('action_taken', ''),
        date_of_incident=request.data.get('date_of_incident'),
        parent_notified=request.data.get('parent_notified', False),
        follow_up_notes=request.data.get('follow_up_notes', ''),
        school=school,
    )

    # Create announcements targeting student, parents, and teachers
    try:
        severity_label = dict(DisciplinaryRecord.SEVERITY_CHOICES).get(record.severity, record.severity)
        announcement_title = f"{severity_label.title()} Disciplinary Record - {student.user.full_name}"
        announcement_content = f"""
A disciplinary record has been created:

Student: {student.user.full_name}
Incident Type: {record.incident_type}
Severity: {severity_label}
Description: {record.description}
Date of Incident: {record.date_of_incident}
Action Taken: {record.action_taken if record.action_taken else "To be determined"}
Reported by: {request.user.full_name}

Please review this record and take appropriate action if needed.
        """.strip()

        # Create announcement
        Announcement.objects.create(
            title=announcement_title,
            content=announcement_content,
            author=request.user,
            target_audience='mixed',
            target_audiences=['student', 'parent', 'teacher'],
            target_class=student.student_class,
            is_active=True,
        )
    except Exception as e:
        # Log the error but don't fail the record creation
        print(f"Warning: Failed to create announcement for discipline record {record.id}: {str(e)}")

    return Response({
        'message': 'Disciplinary record created',
        'id': record.id,
    }, status=status.HTTP_201_CREATED)


@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def discipline_update(request, record_id):
    """Update a disciplinary record (admin/hr only)."""
    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Only admin/HR can update records'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    try:
        record = DisciplinaryRecord.objects.get(id=record_id, school=school)
    except DisciplinaryRecord.DoesNotExist:
        return Response({'error': 'Record not found'}, status=status.HTTP_404_NOT_FOUND)

    # Update allowed fields
    for field in ['incident_type', 'severity', 'description', 'action_taken',
                  'date_of_incident', 'parent_notified', 'follow_up_notes', 'is_resolved']:
        if field in request.data:
            setattr(record, field, request.data[field])
    record.save()

    return Response({
        'message': 'Record updated',
        'id': record.id,
        'is_resolved': record.is_resolved,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def discipline_by_student(request, student_id):
    """Get disciplinary records for a specific student."""
    if request.user.role not in ('admin', 'teacher', 'parent', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    records = DisciplinaryRecord.objects.filter(
        student_id=student_id, school=school
    ).select_related('student__user', 'reported_by')

    data = [
        {
            'id': r.id,
            'student_name': r.student.user.full_name,
            'reported_by': r.reported_by.full_name if r.reported_by else 'N/A',
            'incident_type': r.incident_type,
            'severity': r.severity,
            'description': r.description,
            'action_taken': r.action_taken,
            'date_of_incident': str(r.date_of_incident),
            'parent_notified': r.parent_notified,
            'follow_up_notes': r.follow_up_notes,
            'is_resolved': r.is_resolved,
            'date_created': r.date_created.isoformat(),
        }
        for r in records
    ]
    return Response({'results': data, 'count': len(data)})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def discipline_resolve(request, record_id):
    """Mark a disciplinary record as resolved."""
    if request.user.role not in ('admin', 'teacher', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    try:
        record = DisciplinaryRecord.objects.get(id=record_id, school=school)
    except DisciplinaryRecord.DoesNotExist:
        return Response({'error': 'Record not found'}, status=status.HTTP_404_NOT_FOUND)

    record.is_resolved = True
    if request.data.get('follow_up_notes'):
        record.follow_up_notes = request.data['follow_up_notes']
    record.save()

    return Response({'message': 'Record marked as resolved', 'id': record.id})
