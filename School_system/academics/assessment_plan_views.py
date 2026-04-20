"""Assessment plan CRUD (admin / HR-boss) and read endpoints for teachers, parents, students.

HR head (HRPermissionProfile.is_root_boss=True) is rewritten to role='admin' by
HRAccessControlMiddleware, so the admin role check below covers them transparently.
"""
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Prefetch
from django.utils import timezone

from .models import AssessmentPlan, Subject, Student, Parent, ParentChildLink, Teacher, Timetable, Class
from .serializers import AssessmentPlanSerializer
from users.models import SchoolSettings


def _filter_plans_for_school(user):
    return AssessmentPlan.objects.filter(school=user.school).prefetch_related('subjects')


def _parse_grade_levels(raw_levels):
    if raw_levels in (None, '', []):
        return []
    parsed = []
    for level in raw_levels:
        try:
            parsed.append(int(level))
        except (TypeError, ValueError):
            continue
    return sorted(set(parsed))


def _grades_overlap(plan_a_levels, plan_b_levels):
    """Empty grade list means 'all grades', so it overlaps everything."""
    a = _parse_grade_levels(plan_a_levels)
    b = _parse_grade_levels(plan_b_levels)
    if not a or not b:
        return True
    return bool(set(a) & set(b))


def _current_school_academic_year(user):
    settings = SchoolSettings.objects.filter(school=user.school).first()
    if settings and settings.current_academic_year:
        return str(settings.current_academic_year)
    return str(timezone.now().year)


def _find_conflicting_plan(user, year, term, subject_ids, grade_levels, exclude_pk=None):
    qs = AssessmentPlan.objects.filter(
        school=user.school,
        academic_year=year,
        academic_term=term,
        subjects__id__in=subject_ids,
    ).distinct().prefetch_related('subjects')
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    for candidate in qs:
        if _grades_overlap(candidate.grade_levels, grade_levels):
            return candidate
    return None


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
        grade = request.GET.get('grade')
        subject_id = request.GET.get('subject')
        if year:
            qs = qs.filter(academic_year=year)
        if term:
            qs = qs.filter(academic_term=term)
        if subject_id:
            qs = qs.filter(subjects__id=subject_id)
        if grade:
            try:
                grade_int = int(grade)
                qs = [p for p in qs if (not p.grade_levels) or (grade_int in _parse_grade_levels(p.grade_levels))]
            except ValueError:
                return Response({'error': 'grade must be an integer'}, status=status.HTTP_400_BAD_REQUEST)
            qs = sorted(qs, key=lambda p: (p.academic_year, p.academic_term), reverse=True)
            return Response(AssessmentPlanSerializer(qs, many=True).data)
        qs = qs.distinct().order_by('-academic_year', 'academic_term')
        return Response(AssessmentPlanSerializer(qs, many=True).data)

    if user.role != 'admin':
        return Response({'error': 'Only admin or HR head can create plans'}, status=status.HTTP_403_FORBIDDEN)

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

    payload = request.data.copy()
    current_year = _current_school_academic_year(user)
    payload['academic_year'] = current_year
    serializer = AssessmentPlanSerializer(data=payload)
    serializer.is_valid(raise_exception=True)

    year = current_year
    term = serializer.validated_data['academic_term']
    grade_levels = serializer.validated_data.get('grade_levels', [])
    # Enforce: one plan per (school, year, term, subject). If a plan already covers
    # any requested subject for overlapping grades, reject.
    conflict = _find_conflicting_plan(
        user=user,
        year=year,
        term=term,
        subject_ids=valid_subject_ids,
        grade_levels=grade_levels,
    )
    if conflict:
        conflicting_subjects = list(
            Subject.objects.filter(
                id__in=valid_subject_ids,
                assessment_plans=conflict,
            ).values_list('name', flat=True).distinct()
        )
        existing_grades = _parse_grade_levels(conflict.grade_levels)
        requested_grades = _parse_grade_levels(grade_levels)
        existing_scope = "all grades" if not existing_grades else f"grades {', '.join(map(str, existing_grades))}"
        requested_scope = "all grades" if not requested_grades else f"grades {', '.join(map(str, requested_grades))}"
        return Response(
            {
                'error': (
                    f'A plan already exists for {term} {year} covering {existing_scope} and subjects: '
                    f'{", ".join(conflicting_subjects)}. Your selection ({requested_scope}) overlaps; edit that plan instead.'
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    plan = serializer.save(school=user.school, created_by=user, academic_year=current_year)
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
        return Response({'error': 'Only admin or HR head can modify plans'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    partial = request.method == 'PATCH'
    payload = request.data.copy()
    current_year = _current_school_academic_year(user)
    payload['academic_year'] = current_year
    serializer = AssessmentPlanSerializer(plan, data=payload, partial=partial)
    serializer.is_valid(raise_exception=True)

    subject_ids = request.data.get('subject_ids')
    if subject_ids is not None:
        candidate_subject_ids = subject_ids
    else:
        candidate_subject_ids = list(plan.subjects.values_list('id', flat=True))

    valid_subject_ids = list(
        Subject.objects.filter(id__in=candidate_subject_ids, school=user.school).values_list('id', flat=True)
    )
    if len(valid_subject_ids) != len(candidate_subject_ids):
        return Response({'error': 'One or more subjects do not belong to your school'},
                        status=status.HTTP_400_BAD_REQUEST)

    conflict = _find_conflicting_plan(
        user=user,
        year=current_year,
        term=serializer.validated_data.get('academic_term', plan.academic_term),
        subject_ids=valid_subject_ids,
        grade_levels=serializer.validated_data.get('grade_levels', plan.grade_levels),
        exclude_pk=plan.pk,
    )
    if conflict:
        return Response(
            {'error': 'Another plan already covers one of the selected subjects for this term and grade scope.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer.save(academic_year=current_year)
    return Response(AssessmentPlanSerializer(plan).data)


def _plan_for_subject(user, subject_id, year, term, grade_level=None):
    qs = AssessmentPlan.objects.filter(school=user.school, subjects__id=subject_id)
    if year:
        qs = qs.filter(academic_year=year)
    if term:
        qs = qs.filter(academic_term=term)
    qs = qs.prefetch_related('subjects').order_by('-date_updated')
    if grade_level in (None, ''):
        return qs.first()

    try:
        grade_level = int(grade_level)
    except (TypeError, ValueError):
        return None

    plans = list(qs)
    specific = [plan for plan in plans if grade_level in _parse_grade_levels(plan.grade_levels)]
    if specific:
        return specific[0]
    global_scope = [plan for plan in plans if not _parse_grade_levels(plan.grade_levels)]
    return global_scope[0] if global_scope else None


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def plan_for_teacher(request):
    """Teachers fetch the active plan for a subject they teach, in a given term.

    Query params: subject (required), year (required), term (required), class_id (optional).
    """
    user = request.user
    if user.role != 'teacher':
        return Response({'error': 'Teachers only'}, status=status.HTTP_403_FORBIDDEN)
    subject_id = request.GET.get('subject')
    year = request.GET.get('year')
    term = request.GET.get('term')
    class_id = request.GET.get('class_id')
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

    grade_level = None
    if class_id:
        try:
            class_id_int = int(class_id)
        except ValueError:
            return Response({'error': 'class_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)
        authorised_ids = set(
            Timetable.objects.filter(teacher=teacher, subject_id=subject_id).values_list('class_assigned_id', flat=True)
        )
        authorised_ids.update(Class.objects.filter(class_teacher=user).values_list('id', flat=True))
        authorised_ids.update(teacher.teaching_classes.values_list('id', flat=True))
        if class_id_int not in authorised_ids:
            return Response({'error': 'You are not assigned to this class for this subject'}, status=status.HTTP_403_FORBIDDEN)
        cls = Class.objects.filter(id=class_id_int, school=user.school).first()
        if not cls:
            return Response({'error': 'Class not found'}, status=status.HTTP_404_NOT_FOUND)
        grade_level = cls.grade_level

    plan = _plan_for_subject(user, subject_id, year, term, grade_level=grade_level)
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
    student_grade = student.student_class.grade_level if student.student_class else None
    if student_grade is not None:
        qs = [p for p in qs if (not _parse_grade_levels(p.grade_levels)) or (student_grade in _parse_grade_levels(p.grade_levels))]

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

    children = Student.objects.filter(id__in=confirmed_student_ids).select_related('student_class')
    class_ids = list(children.values_list('student_class_id', flat=True))
    child_grade_levels = set(c.student_class.grade_level for c in children if c.student_class_id)
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
    qs = [
        p for p in qs
        if (not _parse_grade_levels(p.grade_levels))
        or bool(set(_parse_grade_levels(p.grade_levels)) & child_grade_levels)
    ]

    return Response(AssessmentPlanSerializer(qs, many=True).data)
