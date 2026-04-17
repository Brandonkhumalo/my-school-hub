import logging

from django.db.models import Sum, Count
from django.utils import timezone
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
    """Execute serialize activity."""
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
    """Execute serialize enrollment."""
    return {
        'id': enrollment.id,
        'activity_id': enrollment.activity_id,
        'activity_name': enrollment.activity.name,
        'student_id': enrollment.student.id,
        'student_name': enrollment.student.user.full_name,
        'student_number': enrollment.student.user.student_number or '',
        'class_name': enrollment.student.student_class.name if enrollment.student.student_class else '',
        'role': enrollment.role,
        'role_display': enrollment.get_role_display(),
        'status': enrollment.status,
        'status_display': enrollment.get_status_display(),
        'requested_by_name': enrollment.requested_by.full_name if enrollment.requested_by else None,
        'reviewed_by_name': enrollment.reviewed_by.full_name if enrollment.reviewed_by else None,
        'reviewed_at': enrollment.reviewed_at.isoformat() if enrollment.reviewed_at else None,
        'review_note': enrollment.review_note,
        'date_joined': str(enrollment.date_joined),
        'is_active': enrollment.is_active,
    }


def serialize_event(event):
    """Execute serialize event."""
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
    """Execute serialize accolade."""
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
    """Execute serialize student accolade."""
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
        payload = [serialize_activity(a) for a in activities]

        # For students, include current enrollment status per activity for self-service enrolment UI.
        if request.user.role == 'student':
            try:
                student = request.user.student
                my_enrollments = ActivityEnrollment.objects.filter(student=student)
                status_map = {
                    e.activity_id: {
                        'status': e.status,
                        'status_display': e.get_status_display(),
                        'role': e.role,
                        'is_active': e.is_active,
                    }
                    for e in my_enrollments
                }
                for activity_data in payload:
                    mine = status_map.get(activity_data['id'])
                    activity_data['my_enrollment'] = mine
                    activity_data['can_request_enrollment'] = (
                        activity_data.get('is_active', False) and
                        (mine is None or mine.get('status') == 'declined')
                    )
            except Student.DoesNotExist:
                for activity_data in payload:
                    activity_data['my_enrollment'] = None
                    activity_data['can_request_enrollment'] = False

        return Response(payload)

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
    try:
        activity = Activity.objects.get(id=activity_id, school=request.user.school)
    except Activity.DoesNotExist:
        return Response({'error': 'Activity not found'}, status=status.HTTP_404_NOT_FOUND)

    user_role = request.user.role
    is_management_actor = user_role in ('admin', 'hr', 'teacher')
    is_student_actor = user_role == 'student'
    if not is_management_actor and not is_student_actor:
        return Response({'error': 'Only admin/hr/teacher/students can enrol in activities'}, status=status.HTTP_403_FORBIDDEN)

    if not activity.is_active:
        return Response({'error': 'This activity is not currently active'}, status=status.HTTP_400_BAD_REQUEST)

    student_id = request.data.get('student_id')
    role = request.data.get('role', 'member')
    if role not in dict(ActivityEnrollment.ROLE_CHOICES):
        role = 'member'

    if is_student_actor:
        try:
            student = request.user.student
        except Student.DoesNotExist:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
        # Students can only request enrolment for themselves, as members.
        role = 'member'
    else:
        try:
            student = Student.objects.get(id=student_id, user__school=request.user.school)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    enrollment, created = ActivityEnrollment.objects.get_or_create(
        student=student,
        activity=activity,
        defaults={
            'role': role,
            'status': 'approved' if is_management_actor else 'pending',
            'is_active': True if is_management_actor else False,
            'requested_by': request.user,
            'reviewed_by': request.user if is_management_actor else None,
            'reviewed_at': timezone.now() if is_management_actor else None,
        },
    )

    if created and is_management_actor:
        # Capacity check only matters for approved enrollments.
        current_count = activity.enrollments.filter(status='approved', is_active=True).count()
        if current_count > activity.max_participants:
            enrollment.delete()
            return Response({'error': 'Activity is at full capacity'}, status=status.HTTP_400_BAD_REQUEST)

    if not created:
        if is_student_actor:
            if enrollment.status == 'approved' and enrollment.is_active:
                return Response({'error': 'You are already enrolled in this activity'}, status=status.HTTP_400_BAD_REQUEST)
            if enrollment.status == 'pending':
                return Response({'error': 'Your enrollment request is already pending review'}, status=status.HTTP_400_BAD_REQUEST)
            # Re-apply after decline/inactive.
            enrollment.status = 'pending'
            enrollment.role = 'member'
            enrollment.is_active = False
            enrollment.requested_by = request.user
            enrollment.reviewed_by = None
            enrollment.reviewed_at = None
            enrollment.review_note = ''
            enrollment.save(update_fields=[
                'status', 'role', 'is_active', 'requested_by',
                'reviewed_by', 'reviewed_at', 'review_note',
            ])
            return Response(serialize_enrollment(enrollment), status=status.HTTP_201_CREATED)

        # Admin/HR/teacher direct enroll/restore approved enrollment.
        if enrollment.status != 'approved' or not enrollment.is_active:
            current_count = activity.enrollments.filter(status='approved', is_active=True).exclude(id=enrollment.id).count()
            if current_count >= activity.max_participants:
                return Response({'error': 'Activity is at full capacity'}, status=status.HTTP_400_BAD_REQUEST)
        enrollment.status = 'approved'
        enrollment.is_active = True
        enrollment.role = role
        enrollment.reviewed_by = request.user
        enrollment.reviewed_at = timezone.now()
        enrollment.save(update_fields=['status', 'is_active', 'role', 'reviewed_by', 'reviewed_at'])

    return Response(serialize_enrollment(enrollment), status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def unenroll_student(request, activity_id, student_id):
    """Remove a student from an activity."""
    if request.user.role not in ('admin', 'hr', 'teacher'):
        return Response({'error': 'Only admins/HR/coaches can remove students'}, status=status.HTTP_403_FORBIDDEN)

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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def review_activity_enrollment(request, activity_id, enrollment_id):
    """Approve or decline an activity enrollment request. HR/admin only."""
    if request.user.role not in ('admin', 'hr'):
        return Response({'error': 'Only admin/HR can review enrollment requests'}, status=status.HTTP_403_FORBIDDEN)

    decision = (request.data.get('decision') or '').strip().lower()
    review_note = (request.data.get('review_note') or '').strip()
    if decision not in ('approve', 'decline'):
        return Response({'error': 'decision must be "approve" or "decline"'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        enrollment = ActivityEnrollment.objects.select_related('activity').get(
            id=enrollment_id,
            activity_id=activity_id,
            activity__school=request.user.school,
        )
    except ActivityEnrollment.DoesNotExist:
        return Response({'error': 'Enrollment request not found'}, status=status.HTTP_404_NOT_FOUND)

    if decision == 'approve':
        approved_count = ActivityEnrollment.objects.filter(
            activity=enrollment.activity,
            status='approved',
            is_active=True,
        ).exclude(id=enrollment.id).count()
        if approved_count >= enrollment.activity.max_participants:
            return Response({'error': 'Activity is at full capacity'}, status=status.HTTP_400_BAD_REQUEST)
        enrollment.status = 'approved'
        enrollment.is_active = True
    else:
        enrollment.status = 'declined'
        enrollment.is_active = False

    enrollment.reviewed_by = request.user
    enrollment.reviewed_at = timezone.now()
    enrollment.review_note = review_note
    enrollment.save(update_fields=['status', 'is_active', 'reviewed_by', 'reviewed_at', 'review_note'])

    return Response(serialize_enrollment(enrollment))


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
        student=student, status='approved', is_active=True
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
