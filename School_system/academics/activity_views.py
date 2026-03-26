import logging

from django.db.models import Sum, Count
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import (
    Activity, ActivityEnrollment, ActivityEvent,
    Accolade, StudentAccolade, Student
)

logger = logging.getLogger(__name__)


# ── Serializer helpers (inline to keep in one file) ──────────────────────────

def serialize_activity(activity):
    return {
        'id': activity.id,
        'name': activity.name,
        'activity_type': activity.activity_type,
        'activity_type_display': activity.get_activity_type_display(),
        'description': activity.description,
        'coach': activity.coach_id,
        'coach_name': activity.coach.full_name if activity.coach else None,
        'schedule_day': activity.schedule_day,
        'schedule_time': str(activity.schedule_time) if activity.schedule_time else None,
        'location': activity.location,
        'max_participants': activity.max_participants,
        'is_active': activity.is_active,
        'enrolled_count': activity.enrollments.filter(is_active=True).count(),
        'date_created': activity.date_created.isoformat(),
    }


def serialize_enrollment(enrollment):
    return {
        'id': enrollment.id,
        'student_id': enrollment.student.id,
        'student_name': enrollment.student.user.full_name,
        'student_number': enrollment.student.user.student_number or '',
        'class_name': enrollment.student.student_class.name if enrollment.student.student_class else '',
        'role': enrollment.role,
        'role_display': enrollment.get_role_display(),
        'date_joined': str(enrollment.date_joined),
        'is_active': enrollment.is_active,
    }


def serialize_event(event):
    return {
        'id': event.id,
        'activity_id': event.activity_id,
        'activity_name': event.activity.name,
        'title': event.title,
        'event_type': event.event_type,
        'event_type_display': event.get_event_type_display(),
        'event_date': event.event_date.isoformat(),
        'location': event.location,
        'opponent': event.opponent,
        'result': event.result,
        'notes': event.notes,
    }


def serialize_accolade(accolade):
    return {
        'id': accolade.id,
        'name': accolade.name,
        'description': accolade.description,
        'icon': accolade.icon,
        'category': accolade.category,
        'category_display': accolade.get_category_display(),
        'points_value': accolade.points_value,
    }


def serialize_student_accolade(sa):
    return {
        'id': sa.id,
        'accolade': serialize_accolade(sa.accolade),
        'student_id': sa.student_id,
        'student_name': sa.student.user.full_name,
        'awarded_by_name': sa.awarded_by.full_name if sa.awarded_by else None,
        'date_awarded': sa.date_awarded.isoformat(),
        'reason': sa.reason,
        'academic_term': sa.academic_term,
        'academic_year': sa.academic_year,
    }


# ── Activity CRUD ────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def activity_list_create(request):
    """GET: list activities for the school. POST: create (admin only)."""
    school = request.user.school

    if request.method == 'GET':
        activities = Activity.objects.filter(school=school).select_related('coach')
        return Response([serialize_activity(a) for a in activities])

    # POST — admin only
    if request.user.role != 'admin':
        return Response({'error': 'Only admins can create activities'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    try:
        activity = Activity.objects.create(
            name=data['name'],
            activity_type=data.get('activity_type', 'sport'),
            description=data.get('description', ''),
            school=school,
            coach_id=data.get('coach') or None,
            schedule_day=data.get('schedule_day', ''),
            schedule_time=data.get('schedule_time') or None,
            location=data.get('location', ''),
            max_participants=data.get('max_participants', 30),
            is_active=data.get('is_active', True),
        )
        return Response(serialize_activity(activity), status=status.HTTP_201_CREATED)
    except KeyError as e:
        return Response({'error': f'Missing required field: {e}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception("Error creating activity")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def activity_detail(request, activity_id):
    """PUT: update activity. DELETE: delete activity. Admin only."""
    if request.user.role != 'admin':
        return Response({'error': 'Only admins can modify activities'}, status=status.HTTP_403_FORBIDDEN)

    try:
        activity = Activity.objects.select_related('coach').get(id=activity_id, school=request.user.school)
    except Activity.DoesNotExist:
        return Response({'error': 'Activity not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        activity.delete()
        return Response({'message': 'Activity deleted'}, status=status.HTTP_200_OK)

    # PUT
    data = request.data
    activity.name = data.get('name', activity.name)
    activity.activity_type = data.get('activity_type', activity.activity_type)
    activity.description = data.get('description', activity.description)
    activity.coach_id = data.get('coach') or activity.coach_id
    activity.schedule_day = data.get('schedule_day', activity.schedule_day)
    activity.schedule_time = data.get('schedule_time') or activity.schedule_time
    activity.location = data.get('location', activity.location)
    activity.max_participants = data.get('max_participants', activity.max_participants)
    activity.is_active = data.get('is_active', activity.is_active)
    activity.save()
    return Response(serialize_activity(activity))


# ── Enrollments ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def activity_enrollments(request, activity_id):
    """List enrolled students for an activity."""
    try:
        activity = Activity.objects.get(id=activity_id, school=request.user.school)
    except Activity.DoesNotExist:
        return Response({'error': 'Activity not found'}, status=status.HTTP_404_NOT_FOUND)

    enrollments = ActivityEnrollment.objects.filter(
        activity=activity
    ).select_related('student__user', 'student__student_class')
    return Response([serialize_enrollment(e) for e in enrollments])


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def enroll_student(request, activity_id):
    """Enroll a student in an activity. Admin or coach only."""
    if request.user.role not in ('admin', 'teacher'):
        return Response({'error': 'Only admins or coaches can enrol students'}, status=status.HTTP_403_FORBIDDEN)

    try:
        activity = Activity.objects.get(id=activity_id, school=request.user.school)
    except Activity.DoesNotExist:
        return Response({'error': 'Activity not found'}, status=status.HTTP_404_NOT_FOUND)

    student_id = request.data.get('student_id')
    role = request.data.get('role', 'member')

    try:
        student = Student.objects.get(id=student_id, user__school=request.user.school)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    # Check capacity
    current_count = activity.enrollments.filter(is_active=True).count()
    if current_count >= activity.max_participants:
        return Response({'error': 'Activity is at full capacity'}, status=status.HTTP_400_BAD_REQUEST)

    enrollment, created = ActivityEnrollment.objects.get_or_create(
        student=student,
        activity=activity,
        defaults={'role': role, 'is_active': True},
    )
    if not created:
        enrollment.is_active = True
        enrollment.role = role
        enrollment.save()

    return Response(serialize_enrollment(enrollment), status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def unenroll_student(request, activity_id, student_id):
    """Remove a student from an activity."""
    if request.user.role not in ('admin', 'teacher'):
        return Response({'error': 'Only admins or coaches can remove students'}, status=status.HTTP_403_FORBIDDEN)

    try:
        enrollment = ActivityEnrollment.objects.get(
            activity_id=activity_id,
            student_id=student_id,
            activity__school=request.user.school,
        )
    except ActivityEnrollment.DoesNotExist:
        return Response({'error': 'Enrollment not found'}, status=status.HTTP_404_NOT_FOUND)

    enrollment.delete()
    return Response({'message': 'Student removed from activity'}, status=status.HTTP_200_OK)


# ── Activity Events ──────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def activity_events(request, activity_id):
    """GET: list events for an activity. POST: create event (admin/coach)."""
    try:
        activity = Activity.objects.get(id=activity_id, school=request.user.school)
    except Activity.DoesNotExist:
        return Response({'error': 'Activity not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        events = ActivityEvent.objects.filter(activity=activity).select_related('activity')
        return Response([serialize_event(e) for e in events])

    # POST
    if request.user.role not in ('admin', 'teacher'):
        return Response({'error': 'Only admins or coaches can create events'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    try:
        event = ActivityEvent.objects.create(
            activity=activity,
            title=data['title'],
            event_type=data.get('event_type', 'practice'),
            event_date=data['event_date'],
            location=data.get('location', ''),
            opponent=data.get('opponent', ''),
            result=data.get('result', ''),
            notes=data.get('notes', ''),
        )
        return Response(serialize_event(event), status=status.HTTP_201_CREATED)
    except KeyError as e:
        return Response({'error': f'Missing required field: {e}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception("Error creating activity event")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ── Student's own activities ─────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_activities(request):
    """Get activities for the logged-in student."""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)

    try:
        student = request.user.student
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    enrollments = ActivityEnrollment.objects.filter(
        student=student, is_active=True
    ).select_related('activity__coach')

    activities = []
    for enrollment in enrollments:
        activity = enrollment.activity
        upcoming_events = ActivityEvent.objects.filter(activity=activity).order_by('event_date')[:5]
        activities.append({
            **serialize_activity(activity),
            'my_role': enrollment.role,
            'my_role_display': enrollment.get_role_display(),
            'date_joined': str(enrollment.date_joined),
            'upcoming_events': [serialize_event(e) for e in upcoming_events],
        })

    return Response(activities)


# ── Accolades CRUD ───────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def accolade_list_create(request):
    """GET: list available accolades. POST: create (admin only)."""
    school = request.user.school

    if request.method == 'GET':
        accolades = Accolade.objects.filter(school=school)
        return Response([serialize_accolade(a) for a in accolades])

    if request.user.role != 'admin':
        return Response({'error': 'Only admins can create accolades'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    try:
        accolade = Accolade.objects.create(
            name=data['name'],
            description=data.get('description', ''),
            icon=data.get('icon', 'fa-trophy'),
            category=data.get('category', 'academic'),
            points_value=data.get('points_value', 10),
            school=school,
        )
        return Response(serialize_accolade(accolade), status=status.HTTP_201_CREATED)
    except KeyError as e:
        return Response({'error': f'Missing required field: {e}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception("Error creating accolade")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def award_accolade(request):
    """Award an accolade to a student. Admin or teacher only."""
    if request.user.role not in ('admin', 'teacher'):
        return Response({'error': 'Only admins or teachers can award accolades'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    try:
        accolade = Accolade.objects.get(id=data['accolade_id'], school=request.user.school)
        student = Student.objects.get(id=data['student_id'], user__school=request.user.school)
    except Accolade.DoesNotExist:
        return Response({'error': 'Accolade not found'}, status=status.HTTP_404_NOT_FOUND)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
    except KeyError as e:
        return Response({'error': f'Missing required field: {e}'}, status=status.HTTP_400_BAD_REQUEST)

    sa = StudentAccolade.objects.create(
        student=student,
        accolade=accolade,
        awarded_by=request.user,
        reason=data.get('reason', ''),
        academic_term=data.get('academic_term', ''),
        academic_year=data.get('academic_year', ''),
    )
    return Response(serialize_student_accolade(sa), status=status.HTTP_201_CREATED)


# ── Student's own accolades ──────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_accolades(request):
    """Get accolades for the logged-in student."""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)

    try:
        student = request.user.student
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    awards = StudentAccolade.objects.filter(
        student=student
    ).select_related('accolade', 'awarded_by')

    total_points = awards.aggregate(total=Sum('accolade__points_value'))['total'] or 0

    return Response({
        'total_points': total_points,
        'awards': [serialize_student_accolade(a) for a in awards],
    })


# ── Leaderboard ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def accolade_leaderboard(request):
    """Top students by accolade points in the school."""
    school = request.user.school

    leaderboard = (
        StudentAccolade.objects
        .filter(student__user__school=school)
        .values('student__id', 'student__user__first_name', 'student__user__last_name')
        .annotate(
            total_points=Sum('accolade__points_value'),
            award_count=Count('id'),
        )
        .order_by('-total_points')[:20]
    )

    results = []
    for idx, entry in enumerate(leaderboard, 1):
        results.append({
            'rank': idx,
            'student_id': entry['student__id'],
            'student_name': f"{entry['student__user__first_name']} {entry['student__user__last_name']}",
            'total_points': entry['total_points'],
            'award_count': entry['award_count'],
        })

    return Response(results)
