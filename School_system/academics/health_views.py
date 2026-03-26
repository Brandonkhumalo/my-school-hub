import logging

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Student, HealthRecord, ClinicVisit
from .health_serializers import HealthRecordSerializer, ClinicVisitSerializer

logger = logging.getLogger(__name__)


# ── Health Record (per student) ───────────────────────────────────────────────

@api_view(['GET', 'POST', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
def health_record_view(request, student_id):
    """
    GET  — view health record (admin, teacher, parent of student)
    POST — create health record if it doesn't exist (admin)
    PUT  — update health record (admin)
    """
    school = request.user.school
    try:
        student = Student.objects.select_related('user').get(id=student_id, user__school=school)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    # Permission check: admin, teacher, or parent of this student
    user = request.user
    allowed = False
    if user.role == 'admin':
        allowed = True
    elif user.role == 'teacher':
        allowed = True
    elif user.role == 'parent':
        from .models import ParentChildLink
        allowed = ParentChildLink.objects.filter(
            parent__user=user, student=student, is_confirmed=True
        ).exists()

    if not allowed:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        try:
            record = student.health_record
            return Response(HealthRecordSerializer(record).data)
        except HealthRecord.DoesNotExist:
            return Response({'detail': 'No health record found'}, status=status.HTTP_404_NOT_FOUND)

    # POST / PUT — admin only
    if user.role != 'admin':
        return Response({'error': 'Only admins can create/update health records'},
                        status=status.HTTP_403_FORBIDDEN)

    if request.method == 'POST':
        if HealthRecord.objects.filter(student=student).exists():
            return Response({'error': 'Health record already exists. Use PUT to update.'},
                            status=status.HTTP_400_BAD_REQUEST)
        serializer = HealthRecordSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(student=student)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'PUT':
        try:
            record = student.health_record
        except HealthRecord.DoesNotExist:
            return Response({'error': 'No health record to update. Use POST first.'},
                            status=status.HTTP_404_NOT_FOUND)
        serializer = HealthRecordSerializer(record, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Clinic Visits ─────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def clinic_visits_view(request):
    """
    GET  — list clinic visits (admin: all, filter by ?student_id=)
    POST — record a new clinic visit (admin)
    """
    if request.user.role != 'admin':
        return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school

    if request.method == 'GET':
        qs = ClinicVisit.objects.filter(school=school).select_related('student__user', 'recorded_by')
        student_id = request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)
        serializer = ClinicVisitSerializer(qs, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        serializer = ClinicVisitSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(recorded_by=request.user, school=school)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Student own health record ─────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_own_health(request):
    """Student views their own health record."""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        student = request.user.student
        record = student.health_record
        return Response(HealthRecordSerializer(record).data)
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except HealthRecord.DoesNotExist:
        return Response({'detail': 'No health record found'}, status=status.HTTP_404_NOT_FOUND)
