"""Assessment plan CRUD (admin / HR-boss) and read endpoints for teachers, parents, students.

HR boss (HRPermissionProfile.is_root_boss=True) is rewritten to role='admin' by
HRAccessControlMiddleware, so the admin role check below covers them transparently.
"""
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Prefetch

from .models import AssessmentPlan, Subject, Student, Parent, ParentChildLink, Teacher, Timetable, Class
from .serializers import AssessmentPlanSerializer


def _filter_plans_for_school(user):
    return AssessmentPlan.objects.filter(school=user.school).prefetch_related('subjects')


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def assessment_plans_list_create(request):
    user = request.user
    if request.method == 'GET':
        if user.role not in ('admin', 'teacher', 'parent', 'student'):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        qs = _filter_plans_for_school(user)
        year = request.GET.get('year')
        term = request.GET.get('term')
        subject_id = request.GET.get('subject')
        if year:
            qs = qs.filter(academic_year=year)
        if term:
            qs = qs.filter(academic_term=term)
        if subject_id:
            qs = qs.filter(subjects__id=subject_id)
        qs = qs.distinct().order_by('-academic_year', 'academic_term')
        return Response(AssessmentPlanSerializer(qs, many=True).data)

    if user.role != 'admin':
        return Response({'error': 'Only admin or HR boss can create plans'}, status=status.HTTP_403_FORBIDDEN)

    subject_ids = request.data.get('subject_ids', [])
    if not subject_ids:
        return Response({'error': 'At least one subject is required'}, status=status.HTTP_400_BAD_REQUEST)
    # Prevent subjects belonging to a different school leaking into the plan
    valid_subject_ids = list(
        Subject.objects.filter(id__in=subject_ids, school=user.school).values_list('id', flat=True)
    )
    if len(valid_subject_ids) != len(subject_ids):
        return Response({'error': 'One or more subjects do not belong to your school'},
                        status=status.HTTP_400_BAD_REQUEST)

    serializer = AssessmentPlanSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    year = serializer.validated_data['academic_year']
    term = serializer.validated_data['academic_term']
    # Enforce: one plan per (school, year, term, subject). If a plan already covers
    # any requested subject, reject — admin must edit the existing one instead.
    conflict = AssessmentPlan.objects.filter(
        school=user.school, academic_year=year, academic_term=term, subjects__id__in=valid_subject_ids
    ).distinct()
    if conflict.exists():
        conflicting_subjects = list(
            Subject.objects.filter(
                id__in=valid_subject_ids,
                assessment_plans__in=conflict,
            ).values_list('name', flat=True).distinct()
        )
        return Response(
            {'error': f'A plan already exists for {term} {year} covering: {", ".join(conflicting_subjects)}. Edit the existing plan instead.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    plan = serializer.save(school=user.school, created_by=user)
    return Response(AssessmentPlanSerializer(plan).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def assessment_plan_detail(request, pk):
    user = request.user
    try:
        plan = AssessmentPlan.objects.prefetch_related('subjects').get(pk=pk, school=user.school)
    except AssessmentPlan.DoesNotExist:
        return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(AssessmentPlanSerializer(plan).data)

    if user.role != 'admin':
        return Response({'error': 'Only admin or HR boss can modify plans'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    partial = request.method == 'PATCH'
    serializer = AssessmentPlanSerializer(plan, data=request.data, partial=partial)
    serializer.is_valid(raise_exception=True)

    subject_ids = request.data.get('subject_ids')
    if subject_ids is not None:
        valid_subject_ids = list(
            Subject.objects.filter(id__in=subject_ids, school=user.school).values_list('id', flat=True)
        )
        if len(valid_subject_ids) != len(subject_ids):
            return Response({'error': 'One or more subjects do not belong to your school'},
                            status=status.HTTP_400_BAD_REQUEST)
        # Conflict check: exclude the current plan from the lookup
        conflict = AssessmentPlan.objects.filter(
            school=user.school,
            academic_year=serializer.validated_data.get('academic_year', plan.academic_year),
            academic_term=serializer.validated_data.get('academic_term', plan.academic_term),
            subjects__id__in=valid_subject_ids,
        ).exclude(pk=plan.pk).distinct()
        if conflict.exists():
            return Response(
                {'error': 'Another plan already covers one of the selected subjects for this term.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    serializer.save()
    return Response(AssessmentPlanSerializer(plan).data)


def _plan_for_subject(user, subject_id, year, term):
    qs = AssessmentPlan.objects.filter(school=user.school, subjects__id=subject_id)
    if year:
        qs = qs.filter(academic_year=year)
    if term:
        qs = qs.filter(academic_term=term)
    return qs.prefetch_related('subjects').order_by('-date_updated').first()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def plan_for_teacher(request):
    """Teachers fetch the active plan for a subject they teach, in a given term.

    Query params: subject (required), year (required), term (required).
    """
    user = request.user
    if user.role != 'teacher':
        return Response({'error': 'Teachers only'}, status=status.HTTP_403_FORBIDDEN)
    subject_id = request.GET.get('subject')
    year = request.GET.get('year')
    term = request.GET.get('term')
    if not (subject_id and year and term):
        return Response({'error': 'subject, year, and term are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        teacher = Teacher.objects.get(user=user)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    teaches_subject = (
        teacher.subjects_taught.filter(id=subject_id).exists()
        or Timetable.objects.filter(teacher=teacher, subject_id=subject_id).exists()
    )
    if not teaches_subject:
        return Response({'error': 'You do not teach this subject'}, status=status.HTTP_403_FORBIDDEN)

    plan = _plan_for_subject(user, subject_id, year, term)
    if not plan:
        return Response({'plan': None, 'message': 'No plan set for this subject/term yet.'})
    return Response({'plan': AssessmentPlanSerializer(plan).data})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def plans_for_student(request):
    """Student sees plans for their enrolled subjects in the current or specified term."""
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Students only'}, status=status.HTTP_403_FORBIDDEN)
    try:
        student = Student.objects.select_related('student_class').get(user=user)
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    year = request.GET.get('year')
    term = request.GET.get('term')

    # Subjects the student takes = subjects scheduled for their class in the timetable
    subject_ids = list(
        Timetable.objects.filter(class_assigned=student.student_class)
        .values_list('subject_id', flat=True).distinct()
    )

    qs = AssessmentPlan.objects.filter(school=user.school, subjects__id__in=subject_ids)
    if year:
        qs = qs.filter(academic_year=year)
    if term:
        qs = qs.filter(academic_term=term)
    qs = qs.prefetch_related('subjects').distinct().order_by('-academic_year', 'academic_term')

    return Response(AssessmentPlanSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def plans_for_parent(request):
    """Parent sees plans for subjects taken by their confirmed children.

    Optional query params: child (student id), year, term.
    """
    user = request.user
    if user.role != 'parent':
        return Response({'error': 'Parents only'}, status=status.HTTP_403_FORBIDDEN)
    try:
        parent = Parent.objects.get(user=user)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, status=status.HTTP_404_NOT_FOUND)

    child_id = request.GET.get('child')
    year = request.GET.get('year')
    term = request.GET.get('term')

    child_qs = ParentChildLink.objects.filter(parent=parent, is_confirmed=True)
    if child_id:
        child_qs = child_qs.filter(student_id=child_id)
    confirmed_student_ids = list(child_qs.values_list('student_id', flat=True))
    if not confirmed_student_ids:
        return Response([])

    class_ids = list(
        Student.objects.filter(id__in=confirmed_student_ids).values_list('student_class_id', flat=True)
    )
    subject_ids = list(
        Timetable.objects.filter(class_assigned_id__in=class_ids)
        .values_list('subject_id', flat=True).distinct()
    )

    qs = AssessmentPlan.objects.filter(school=user.school, subjects__id__in=subject_ids)
    if year:
        qs = qs.filter(academic_year=year)
    if term:
        qs = qs.filter(academic_term=term)
    qs = qs.prefetch_related('subjects').distinct().order_by('-academic_year', 'academic_term')

    return Response(AssessmentPlanSerializer(qs, many=True).data)
