import logging

from django.core.exceptions import ValidationError
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import (
    Activity, ActivityEnrollment, ActivityEvent,
    Accolade, StudentAccolade, Student,
    SportsHouse, MatchSquadEntry, TrainingAttendance, HousePointEntry
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
        'age_group': activity.age_group,
        'age_group_display': activity.get_age_group_display(),
        'gender_category': activity.gender_category,
        'gender_category_display': activity.get_gender_category_display(),
        'level': activity.level,
        'level_display': activity.get_level_display(),
        'description': activity.description,
        'coach': activity.coach_id,
        'coach_name': activity.coach.full_name if activity.coach else None,
        'schedule_day': activity.schedule_day,
        'schedule_time': str(activity.schedule_time) if activity.schedule_time else None,
        'location': activity.location,
        'max_participants': activity.max_participants,
        'is_active': activity.is_active,
        'enrolled_count': activity.enrollments.filter(is_active=True, is_suspended=False).count(),
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
        'is_suspended': enrollment.is_suspended,
        'suspension_reason': enrollment.suspension_reason,
        'is_injured': enrollment.is_injured,
        'injury_cleared_date': enrollment.injury_cleared_date.isoformat() if enrollment.injury_cleared_date else None,
        'injury_notes': enrollment.injury_notes,
        'is_age_eligible': (
            enrollment.student.date_of_birth is None or
            enrollment.activity.age_group in ['open', 'first_team'] or
            _check_age_eligibility(enrollment.student.date_of_birth, enrollment.activity.age_group)
        ),
    }


def _check_age_eligibility(date_of_birth, age_group):
    import datetime
    if not date_of_birth or not age_group or age_group in ['open', 'first_team']:
        return True
    try:
        max_age = int(age_group[1:])
    except ValueError:
        return True
    today = timezone.now().date()
    age = today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
    return age <= max_age


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
        'venue': event.venue,
        'opponent': event.opponent,
        'opponent_school': event.opponent_school,
        'is_home': event.is_home,
        'transport_required': event.transport_required,
        'status': event.status,
        'status_display': event.get_status_display(),
        'our_score': event.our_score,
        'opponent_score': event.opponent_score,
        'match_result': event.match_result,
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

    # POST
    if request.user.role not in ('admin', 'hr', 'sports_director', 'superadmin'):
        return Response({'error': 'Only admins, HR or Sports Directors can create activities'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    try:
        activity = Activity.objects.create(
            name=data['name'],
            activity_type=data.get('activity_type', 'sport'),
            age_group=data.get('age_group', 'open'),
            gender_category=data.get('gender_category', 'mixed'),
            level=data.get('level', 'social'),
            description=data.get('description', ''),
            school=school,
            coach_id=data.get('coach') or None,
            assistant_coach_id=data.get('assistant_coach') or None,
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
    """PUT: update activity. DELETE: delete activity."""
    if request.user.role not in ('admin', 'hr', 'sports_director', 'superadmin'):
        return Response({'error': 'Only admins, HR or Sports Directors can modify activities'}, status=status.HTTP_403_FORBIDDEN)

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
    activity.age_group = data.get('age_group', activity.age_group)
    activity.gender_category = data.get('gender_category', activity.gender_category)
    activity.level = data.get('level', activity.level)
    activity.description = data.get('description', activity.description)
    activity.coach_id = data.get('coach') or activity.coach_id
    activity.assistant_coach_id = data.get('assistant_coach') or activity.assistant_coach_id
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
    is_management_actor = user_role in ('admin', 'hr', 'teacher', 'sports_director', 'superadmin')
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
    if request.user.role not in ('admin', 'hr', 'teacher', 'sports_director', 'superadmin'):
        return Response({'error': 'Only admins/HR/coaches/sports directors can remove students'}, status=status.HTTP_403_FORBIDDEN)

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
    """Approve or decline an activity enrollment request."""
    if request.user.role not in ('admin', 'hr', 'sports_director', 'superadmin'):
        return Response({'error': 'Only admin/HR/sports directors can review enrollment requests'}, status=status.HTTP_403_FORBIDDEN)

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
    if request.user.role not in ('admin', 'teacher', 'hr', 'sports_director', 'superadmin'):
        return Response({'error': 'Only authorized staff can create events'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    try:
        event = ActivityEvent.objects.create(
            activity=activity,
            title=data['title'],
            event_type=data.get('event_type', 'training'),
            event_date=data['event_date'],
            location=data.get('location', ''),
            venue=data.get('venue', ''),
            opponent=data.get('opponent', ''),
            opponent_school=data.get('opponent_school', ''),
            is_home=data.get('is_home', True),
            transport_required=data.get('transport_required', False),
            status=data.get('status', 'scheduled'),
            our_score=data.get('our_score', ''),
            opponent_score=data.get('opponent_score', ''),
            match_result=data.get('match_result', 'na'),
            result=data.get('result', ''),
            notes=data.get('notes', ''),
        )
        return Response(serialize_event(event), status=status.HTTP_201_CREATED)
    except KeyError as e:
        return Response({'error': f'Missing required field: {e}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception("Error creating activity event")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def sports_houses(request):
    """List and create sports houses."""
    school = request.user.school
    if request.method == 'GET':
        houses = SportsHouse.objects.filter(school=school).select_related('captain')
        return Response([{
            'id': house.id,
            'name': house.name,
            'color': house.color,
            'captain': house.captain_id,
            'captain_name': house.captain.user.full_name if house.captain else None,
        } for house in houses])

    if request.user.role not in ('admin', 'hr', 'sports_director', 'superadmin'):
        return Response({'error': 'Only admin, HR, or sports directors can create houses'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    try:
        house = SportsHouse.objects.create(
            school=school,
            name=data['name'],
            color=data.get('color', '#2563eb'),
            captain_id=data.get('captain') or None,
        )
        return Response({
            'id': house.id,
            'name': house.name,
            'color': house.color,
            'captain': house.captain_id,
            'captain_name': house.captain.user.full_name if house.captain else None,
        }, status=status.HTTP_201_CREATED)
    except KeyError as e:
        return Response({'error': f'Missing required field: {e}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception('Error creating sports house')
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def event_squad(request, event_id):
    try:
        event = ActivityEvent.objects.get(id=event_id, activity__school=request.user.school)
    except ActivityEvent.DoesNotExist:
        return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        squad = MatchSquadEntry.objects.filter(event=event).select_related('student__user')
        return Response([{
            'id': entry.id,
            'student_id': entry.student_id,
            'student_name': entry.student.user.full_name,
            'is_captain': entry.is_captain,
            'jersey_number': entry.jersey_number,
            'played': entry.played,
        } for entry in squad])

    if request.user.role not in ('admin', 'hr', 'teacher', 'sports_director', 'superadmin'):
        return Response({'error': 'Only authorized staff can update squads'}, status=status.HTTP_403_FORBIDDEN)

    squad_data = request.data.get('squad', [])
    if not isinstance(squad_data, list):
        return Response({'error': 'squad must be an array'}, status=status.HTTP_400_BAD_REQUEST)

    updated = []
    for item in squad_data:
        student_id = item.get('student_id')
        if not student_id:
            continue
        entry, _ = MatchSquadEntry.objects.update_or_create(
            event=event,
            student_id=student_id,
            defaults={
                'is_captain': bool(item.get('is_captain', False)),
                'jersey_number': item.get('jersey_number'),
                'played': bool(item.get('played', True)),
            }
        )
        updated.append({
            'id': entry.id,
            'student_id': entry.student_id,
            'student_name': entry.student.user.full_name,
            'is_captain': entry.is_captain,
            'jersey_number': entry.jersey_number,
            'played': entry.played,
        })

    return Response(updated)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def event_training_attendance(request, event_id):
    try:
        event = ActivityEvent.objects.get(id=event_id, activity__school=request.user.school)
    except ActivityEvent.DoesNotExist:
        return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        attendance = TrainingAttendance.objects.filter(event=event).select_related('student__user')
        return Response([{
            'id': entry.id,
            'student_id': entry.student_id,
            'student_name': entry.student.user.full_name,
            'present': entry.present,
            'notes': entry.notes,
        } for entry in attendance])

    if request.user.role not in ('admin', 'hr', 'teacher', 'sports_director', 'superadmin'):
        return Response({'error': 'Only authorized staff can log training attendance'}, status=status.HTTP_403_FORBIDDEN)

    attendance_data = request.data.get('attendance', [])
    if not isinstance(attendance_data, list):
        return Response({'error': 'attendance must be an array'}, status=status.HTTP_400_BAD_REQUEST)

    created = []
    for item in attendance_data:
        student_id = item.get('student_id')
        if not student_id:
            continue
        entry = TrainingAttendance.objects.create(
            event=event,
            student_id=student_id,
            present=bool(item.get('present', True)),
            notes=item.get('notes', ''),
        )
        created.append({
            'id': entry.id,
            'student_id': entry.student_id,
            'student_name': entry.student.user.full_name,
            'present': entry.present,
            'notes': entry.notes,
        })

    return Response(created)


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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def suspend_student_activity(request, activity_id, student_id):
    """Suspend a student from an activity."""
    if request.user.role not in ('admin', 'hr', 'teacher', 'sports_director', 'superadmin'):
        return Response({'error': 'Only authorized staff can suspend students'}, status=status.HTTP_403_FORBIDDEN)

    try:
        enrollment = ActivityEnrollment.objects.get(
            activity_id=activity_id,
            student_id=student_id,
            activity__school=request.user.school,
        )
    except ActivityEnrollment.DoesNotExist:
        return Response({'error': 'Enrollment not found'}, status=status.HTTP_404_NOT_FOUND)

    reason = request.data.get('reason', '')
    is_suspended = request.data.get('is_suspended', True)

    enrollment.is_suspended = is_suspended
    enrollment.suspension_reason = reason if is_suspended else ''
    enrollment.save(update_fields=['is_suspended', 'suspension_reason'])

    return Response(serialize_enrollment(enrollment))


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def sports_analytics(request):
    """Get analytics for sports and activities."""
    if request.user.role not in ('admin', 'hr', 'sports_director', 'superadmin'):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    activities = Activity.objects.filter(school=school)

    total_activities = activities.count()
    enrollment_qs = ActivityEnrollment.objects.filter(activity__school=school, status='approved', is_active=True, is_suspended=False)
    total_enrollments = enrollment_qs.count()
    unique_students = enrollment_qs.values('student_id').distinct().count()

    events = ActivityEvent.objects.filter(activity__school=school)
    total_matches = events.filter(event_type__in=('match', 'competition', 'tournament', 'inter_house'), match_result__in=('win', 'loss', 'draw')).count()
    total_wins = events.filter(match_result='win').count()
    total_losses = events.filter(match_result='loss').count()
    total_draws = events.filter(match_result='draw').count()

    upcoming_events = events.filter(event_date__gte=timezone.now()).order_by('event_date')[:5]

    house_leaderboard_qs = HousePointEntry.objects.filter(house__school=school).values(
        'house__id', 'house__name', 'house__color'
    ).annotate(
        total_points=Sum('points'),
        awards=Count('id'),
    ).order_by('-total_points')

    top_athlete_commitments_qs = (
        enrollment_qs
        .values('student__id', 'student__user__first_name', 'student__user__last_name', 'student__student_class__name')
        .annotate(activity_count=Count('activity', distinct=True))
        .filter(activity_count__gte=3)
        .order_by('-activity_count')[:20]
    )

    age_group_records = events.filter(match_result__in=('win', 'loss', 'draw')).values(
        'activity__age_group'
    ).annotate(
        total=Count('id'),
        wins=Count('id', filter=Q(match_result='win')),
        losses=Count('id', filter=Q(match_result='loss')),
        draws=Count('id', filter=Q(match_result='draw')),
    )

    activity_type_records = events.filter(match_result__in=('win', 'loss', 'draw')).values(
        'activity__activity_type'
    ).annotate(
        total=Count('id'),
        wins=Count('id', filter=Q(match_result='win')),
        losses=Count('id', filter=Q(match_result='loss')),
        draws=Count('id', filter=Q(match_result='draw')),
    )

    overage_enrollees = []
    for enrollment in ActivityEnrollment.objects.filter(activity__school=school, status='approved', is_active=True).select_related('student', 'activity'):
        if enrollment.student.date_of_birth and enrollment.activity.age_group not in ['open', 'first_team']:
            if not _check_age_eligibility(enrollment.student.date_of_birth, enrollment.activity.age_group):
                overage_enrollees.append({
                    'student_id': enrollment.student.id,
                    'student_name': enrollment.student.user.full_name,
                    'activity': enrollment.activity.name,
                    'age_group': enrollment.activity.age_group,
                    'class_name': enrollment.student.student_class.name if enrollment.student.student_class else None,
                })

    def format_agg(record, field_name, group_label):
        total = record['total'] or 0
        return {
            group_label: record[field_name],
            'total': total,
            'wins': record['wins'],
            'losses': record['losses'],
            'draws': record['draws'],
            'win_rate': round(record['wins'] / total * 100, 1) if total else 0,
        }

    return Response({
        'overview': {
            'total_activities': total_activities,
            'total_active_participants': unique_students,
            'total_enrollments': total_enrollments,
        },
        'matches': {
            'total_played': total_matches,
            'wins': total_wins,
            'losses': total_losses,
            'draws': total_draws,
            'win_ratio': round((total_wins / total_matches * 100), 1) if total_matches else 0,
        },
        'house_points': [
            {
                'house_id': rec['house__id'],
                'house_name': rec['house__name'],
                'house_color': rec['house__color'],
                'total_points': rec['total_points'] or 0,
                'awards': rec['awards'],
            }
            for rec in house_leaderboard_qs
        ],
        'top_commitments': [
            {
                'student_id': rec['student__id'],
                'student_name': f"{rec['student__user__first_name']} {rec['student__user__last_name']}",
                'class_name': rec['student__student_class__name'],
                'activity_count': rec['activity_count'],
            }
            for rec in top_athlete_commitments_qs
        ],
        'win_rate_by_age_group': [
            format_agg(rec, 'activity__age_group', 'age_group')
            for rec in age_group_records
        ],
        'win_rate_by_activity_type': [
            format_agg(rec, 'activity__activity_type', 'activity_type')
            for rec in activity_type_records
        ],
        'overage_enrollees': overage_enrollees,
        'upcoming_events': [serialize_event(e) for e in upcoming_events],
    })
