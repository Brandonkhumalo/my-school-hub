import logging

from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from datetime import timedelta, datetime
from .models import (
    Student, Subject, Result, Timetable, Teacher,
    Announcement, AnnouncementDismissal, Assignment, SchoolEvent, ClassAttendance, SubjectAttendance
)
from .serializers import (
    StudentSerializer, ResultSerializer, TimetableSerializer,
    AnnouncementSerializer, AssignmentSerializer, SchoolEventSerializer
)


def _parse_attachment_rows(raw_items):
    import json
    if isinstance(raw_items, str):
        try:
            raw_items = json.loads(raw_items)
        except Exception:
            raw_items = []
    rows = []
    if not isinstance(raw_items, list):
        return rows
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        file_key = str(item.get('file_key') or '').strip()
        if not file_key:
            continue
        rows.append({
            'file_key': file_key,
            'original_filename': str(item.get('original_filename') or file_key).strip()[:255],
            'mime_type': str(item.get('mime_type') or '').strip()[:100],
            'size_bytes': int(item.get('size_bytes') or 0),
        })
    return rows


def _level_kind_from_school_type(school_type):
    if school_type == 'primary':
        return 'grade'
    return 'form'


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_profile(request):
    """Get logged-in student's profile"""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        student = request.user.student
        
        # Get parent ID from ParentChildLink if exists
        from .models import ParentChildLink
        parent_id = ''
        parent_link = ParentChildLink.objects.filter(student=student, is_confirmed=True).first()
        if parent_link:
            parent_id = parent_link.parent.id
        
        data = {
            'id': student.id,
            'name': request.user.first_name,
            'surname': request.user.last_name,
            'class': student.student_class.name if student.student_class else 'Not Assigned',
            'residence_type': student.residence_type,
            'phone_number': request.user.phone_number or '',
            'parent_id': parent_id,
            'student_number': request.user.student_number or ''
        }
        return Response(data)
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_dashboard_stats(request):
    """Get dashboard statistics for logged-in student"""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        student = request.user.student
        
        # Composite per-subject percentages via the admin-defined AssessmentPlan
        # weights, then mean across subjects. Falls back to equal weighting when
        # no plan is attached to the results.
        from .grading_calc import compute_from_queryset
        per_subject = compute_from_queryset(
            Result.objects.filter(student=student).select_related('assessment_plan')
        )
        avg_percentage = round(
            sum(per_subject.values()) / len(per_subject), 1
        ) if per_subject else 0
        
        # Get subjects the student is currently learning from their timetable
        subjects = []
        if student.student_class:
            subject_rows = (
                Timetable.objects.filter(
                    class_assigned=student.student_class,
                    class_assigned__school=student.user.school,
                    subject__is_deleted=False,
                )
                .values('subject_id', 'subject__name', 'subject__code')
                .distinct()
                .order_by('subject__name')
            )
            subjects = [
                {
                    'id': row['subject_id'],
                    'name': row['subject__name'],
                    'code': row['subject__code'],
                }
                for row in subject_rows
            ]
        total_subjects = len(subjects)
        
        # Get pending submissions
        pending_submissions = Assignment.objects.filter(
            assigned_class=student.student_class,
            deadline__gt=timezone.now()
        ).count()
        
        # Calculate attendance percentage (based on class attendance)
        total_days = ClassAttendance.objects.filter(student=student).count()
        present_days = ClassAttendance.objects.filter(
            student=student,
            status__in=['present', 'late']
        ).count()
        attendance_percentage = round((present_days / total_days * 100), 1) if total_days > 0 else 100
        
        data = {
            'overall_average': avg_percentage,
            'total_subjects': total_subjects,
            'subjects': subjects,
            'pending_submissions': pending_submissions,
            'attendance_percentage': attendance_percentage
        }
        
        return Response(data)
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_submissions(request):
    """Get upcoming submissions/assignments for logged-in student"""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        student = request.user.student
        assignments = Assignment.objects.filter(
            assigned_class=student.student_class
        ).select_related('subject').order_by('deadline')
        
        data = []
        for assignment in assignments:
            now = timezone.now()
            assignment_status = 'pending'
            if assignment.deadline < now:
                assignment_status = 'overdue'
            
            data.append({
                'id': assignment.id,
                'title': assignment.title,
                'description': assignment.description,
                'subject_name': assignment.subject.name,
                'deadline': assignment.deadline.isoformat(),
                'status': assignment_status
            })
        
        return Response(data)
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_marks(request):
    """Get grades and performance data for logged-in student"""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        student = request.user.student
        results = Result.objects.filter(student=student).select_related('subject')

        # Group results by subject
        subjects_data = {}
        for result in results:
            subject_id = result.subject.id
            if subject_id not in subjects_data:
                subjects_data[subject_id] = {
                    'subject_id': subject_id,
                    'subject_name': result.subject.name,
                    'test_scores': [],
                    'assignment_scores': [],
                    'recent_scores': []
                }
            
            # Calculate percentage
            percentage = round((result.score / result.max_score * 100), 1) if result.max_score > 0 else 0
            
            # Categorize by exam type
            if 'test' in result.exam_type.lower() or 'exam' in result.exam_type.lower():
                subjects_data[subject_id]['test_scores'].append(percentage)
            else:
                subjects_data[subject_id]['assignment_scores'].append(percentage)
            
            # Add to recent scores
            subjects_data[subject_id]['recent_scores'].append({
                'name': result.exam_type,
                'percentage': percentage,
                'date': result.date_recorded.strftime('%Y-%m-%d')
            })
        
        # Calculate averages
        data = []
        for subject in subjects_data.values():
            test_avg = round(sum(subject['test_scores']) / len(subject['test_scores']), 1) if subject['test_scores'] else 0
            assignment_avg = round(sum(subject['assignment_scores']) / len(subject['assignment_scores']), 1) if subject['assignment_scores'] else 0
            
            # Overall term and year percentage (simplified - can be enhanced)
            all_scores = subject['test_scores'] + subject['assignment_scores']
            overall_avg = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0
            
            data.append({
                'subject_id': subject['subject_id'],
                'subject_name': subject['subject_name'],
                'test_score_percentage': test_avg,
                'assignment_score_percentage': assignment_avg,
                'overall_term_percentage': overall_avg,
                'overall_year_percentage': overall_avg,
                'recent_scores': sorted(subject['recent_scores'], key=lambda x: x['date'], reverse=True)[:3]
            })
        
        return Response(data)
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def school_calendar(request):
    """Get school events and holidays"""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    school = request.user.school
    events = SchoolEvent.objects.filter(created_by__school=school).select_related('created_by').order_by('start_date')
    data = []
    
    for event in events:
        data.append({
            'id': event.id,
            'title': event.title,
            'description': event.description,
            'type': event.event_type,
            'start_date': event.start_date.strftime('%Y-%m-%d'),
            'end_date': event.end_date.strftime('%Y-%m-%d'),
            'location': event.location or None
        })
    
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_timetable(request):
    """Get weekly timetable for logged-in student"""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        student = request.user.student
        student_class = student.student_class
        
        timetable_entries = Timetable.objects.filter(
            class_assigned=student_class
        ).select_related('subject', 'teacher__user').order_by('day_of_week', 'start_time')
        
        today = datetime.now().date()
        week_start = today - timedelta(days=today.weekday())
        
        schedule = {}
        for entry in timetable_entries:
            time_slot = f"{entry.start_time.strftime('%H:%M')} - {entry.end_time.strftime('%H:%M')}"
            
            if time_slot not in schedule:
                schedule[time_slot] = {}
            
            schedule[time_slot][entry.day_of_week] = {
                'subject': entry.subject.name,
                'teacher': f"{entry.teacher.user.first_name} {entry.teacher.user.last_name}",
                'room': entry.room or ''
            }
        
        class_config = None
        if student_class:
            class_config = {
                'first_period_start': student_class.first_period_start.strftime('%H:%M') if student_class.first_period_start else None,
                'last_period_end': student_class.last_period_end.strftime('%H:%M') if student_class.last_period_end else None,
                'period_duration_minutes': student_class.period_duration_minutes or 45,
                'break_start': student_class.break_start.strftime('%H:%M') if student_class.break_start else None,
                'break_end': student_class.break_end.strftime('%H:%M') if student_class.break_end else None,
                'lunch_start': student_class.lunch_start.strftime('%H:%M') if student_class.lunch_start else None,
                'lunch_end': student_class.lunch_end.strftime('%H:%M') if student_class.lunch_end else None,
                'include_transition_time': student_class.include_transition_time or False
            }
        
        data = {
            'week_start_date': week_start.strftime('%Y-%m-%d'),
            'notes': 'Current timetable',
            'schedule': schedule,
            'class_config': class_config
        }
        
        return Response(data)
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_teachers(request):
    """Get all teachers who teach the logged-in student"""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        student = request.user.student
        timetable_entries = Timetable.objects.filter(
            class_assigned=student.student_class
        ).select_related('teacher', 'subject').distinct()
        
        teachers_dict = {}
        for entry in timetable_entries:
            teacher_id = entry.teacher.id
            if teacher_id not in teachers_dict:
                teachers_dict[teacher_id] = {
                    'id': teacher_id,
                    'title': 'Mr.' if entry.teacher.user.first_name else 'Ms.',
                    'surname': entry.teacher.user.last_name,
                    'subject': entry.subject.name,
                    'email': entry.teacher.user.email or None,
                    'phone': entry.teacher.user.phone_number or None,
                    'office': entry.room or 'Main Office'
                }
        
        return Response(list(teachers_dict.values()))
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_announcements(request):
    """Get announcements for students"""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)

    try:
        student = request.user.student
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    announcements = Announcement.objects.filter(
        (
            Q(target_audience='all') |
            Q(target_audience='student') |
            Q(target_audience='students') |
            Q(target_audiences__contains=['all']) |
            Q(target_audiences__contains=['student']) |
            Q(target_audiences__contains=['students'])
        ),
        is_active=True,
        author__school=request.user.school,
    ).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
    ).filter(
        Q(target_class__isnull=True) | Q(target_class_id=student.student_class_id)
    ).exclude(
        id__in=AnnouncementDismissal.objects.filter(user=request.user).values_list('announcement_id', flat=True)
    ).select_related('author').order_by('-date_posted')
    
    data = []
    for announcement in announcements:
        # Determine priority based on title/content keywords
        priority = 'normal'
        if any(word in announcement.title.lower() for word in ['urgent', 'important', 'critical']):
            priority = 'urgent'
        elif any(word in announcement.title.lower() for word in ['attention', 'notice']):
            priority = 'high'
        
        data.append({
            'id': announcement.id,
            'title': announcement.title,
            'message': announcement.content,
            'author': announcement.author.first_name + ' ' + announcement.author.last_name,
            'author_id': announcement.author_id,
            'date': announcement.date_posted.isoformat(),
            'expires_at': announcement.expires_at.isoformat() if announcement.expires_at else None,
            'can_delete': (request.user.role in ('admin', 'hr', 'superadmin') and request.user.school_id == announcement.author.school_id) or announcement.author_id == request.user.id,
            'priority': priority,
            'attachments': []
        })
    
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_attendance(request):
    """Get the logged-in student's class and subject attendance records with stats."""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        student = request.user.student
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    # --- Class attendance ---
    class_qs = ClassAttendance.objects.filter(student=student).order_by('-date')
    class_total = class_qs.count()
    class_present = class_qs.filter(status__in=['present', 'late']).count()
    class_absent = class_qs.filter(status='absent').count()
    class_late = class_qs.filter(status='late').count()
    class_pct = round(class_present / class_total * 100, 1) if class_total else 100.0

    class_records = [
        {
            'id': r.id,
            'date': r.date.strftime('%Y-%m-%d'),
            'status': r.status,
            'remarks': r.remarks or '',
        }
        for r in class_qs[:60]
    ]

    # --- Subject attendance ---
    subj_qs = (SubjectAttendance.objects
               .filter(student=student)
               .select_related('subject')
               .order_by('-date'))
    subj_total = subj_qs.count()
    subj_present = subj_qs.filter(status__in=['present', 'late']).count()
    subj_absent = subj_qs.filter(status='absent').count()
    subj_late = subj_qs.filter(status='late').count()
    subj_pct = round(subj_present / subj_total * 100, 1) if subj_total else 100.0

    subject_records = [
        {
            'id': r.id,
            'date': r.date.strftime('%Y-%m-%d'),
            'subject': r.subject.name,
            'period_number': r.period_number,
            'period_label': r.period_label,
            'status': r.status,
            'remarks': r.remarks or '',
            'marked_with_permission': r.marked_with_permission,
            'bunk_flag': r.bunk_flag,
            'bunk_reason': r.bunk_reason,
        }
        for r in subj_qs[:100]
    ]

    return Response({
        'class_attendance': {
            'stats': {
                'total_days': class_total,
                'present': class_present,
                'absent': class_absent,
                'late': class_late,
                'attendance_percentage': class_pct,
            },
            'records': class_records,
        },
        'subject_attendance': {
            'stats': {
                'total_days': subj_total,
                'present': subj_present,
                'absent': subj_absent,
                'late': subj_late,
                'attendance_percentage': subj_pct,
            },
            'records': subject_records,
        },
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_assignments(request):
    """List assignments for the logged-in student's class."""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
    try:
        student = request.user.student
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    if not student.student_class_id:
        return Response({'assignments': []})

    from .models import Assignment, AssignmentSubmission, AssignmentSubmissionAttachment
    assignments = Assignment.objects.filter(
        assigned_class_id=student.student_class_id,
        school=request.user.school,
    ).select_related('subject', 'teacher__user').prefetch_related('attachments').order_by('-date_created')

    submission_map = {
        s.assignment_id: s for s in AssignmentSubmission.objects.filter(
            assignment__in=assignments, student=student
        ).prefetch_related('attachments')
    }
    data = []
    for a in assignments:
        sub = submission_map.get(a.id)
        data.append({
            'id': a.id,
            'title': a.title,
            'description': a.description,
            'subject_id': a.subject_id,
            'subject_name': a.subject.name,
            'teacher_name': a.teacher.user.full_name,
            'deadline': a.deadline.isoformat(),
            'max_score': a.max_score,
            'allow_late': a.allow_late,
            'attachments': [
                {
                    'id': att.id,
                    'file_key': att.file_key,
                    'original_filename': att.original_filename,
                    'mime_type': att.mime_type,
                    'size_bytes': att.size_bytes,
                }
                for att in a.attachments.all()
            ],
            'submission': None if not sub else {
                'id': sub.id,
                'status': sub.status,
                'submitted_at': sub.submitted_at.isoformat(),
                'grade': sub.grade,
                'feedback': sub.feedback,
                'is_late': sub.is_late,
                'text_submission': sub.text_submission,
                'file_url': sub.submitted_file.url if sub.submitted_file else None,
                'attachments': [
                    {
                        'id': att.id,
                        'file_key': att.file_key,
                        'original_filename': att.original_filename,
                        'mime_type': att.mime_type,
                        'size_bytes': att.size_bytes,
                    }
                    for att in sub.attachments.all()
                ],
            },
        })
    return Response({'assignments': data})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_tests(request):
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
    try:
        student = request.user.student
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    if not student.student_class_id:
        return Response({'tests': []})

    from .models import GeneratedTest, TestAttempt, Result
    now = timezone.now()
    level_kind = _level_kind_from_school_type(getattr(request.user.school, 'school_type', 'secondary'))
    subject_ids = list(
        Result.objects.filter(student=student).values_list('subject_id', flat=True).distinct()
    )
    qs = GeneratedTest.objects.filter(
        school=request.user.school,
        status='published',
        level_kind=level_kind,
        level_number=student.student_class.grade_level,
    ).select_related('subject')
    if subject_ids:
        qs = qs.filter(subject_id__in=subject_ids)
    else:
        qs = qs.none()
    tests = []
    attempts = {
        a.test_id: a for a in TestAttempt.objects.filter(test__in=qs, student=student)
    }
    for t in qs:
        if t.schedule_mode == 'scheduled':
            if t.available_from and now < t.available_from:
                continue
            if t.available_until and now > t.available_until:
                continue
        a = attempts.get(t.id)
        tests.append({
            'id': t.id,
            'title': t.title,
            'subject_name': t.subject.name,
            'duration_minutes': t.duration_minutes,
            'total_marks': t.total_marks,
            'academic_year': t.academic_year,
            'academic_term': t.academic_term,
            'status': a.status if a else 'not_started',
        })
    return Response({'tests': tests})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def student_start_test(request, test_id):
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
    try:
        student = request.user.student
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    from .models import GeneratedTest, TestAttempt
    try:
        test = GeneratedTest.objects.get(id=test_id, school=request.user.school, status='published')
    except GeneratedTest.DoesNotExist:
        return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)

    attempt, _ = TestAttempt.objects.get_or_create(
        test=test,
        student=student,
        defaults={'status': 'in_progress'},
    )
    if attempt.status == 'submitted':
        return Response({'error': 'This test is already submitted.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({
        'attempt_id': attempt.id,
        'status': attempt.status,
        'started_at': attempt.started_at.isoformat() if attempt.started_at else None,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_attempt_detail(request, attempt_id):
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
    from .models import TestAttempt
    try:
        attempt = TestAttempt.objects.select_related('test').get(
            id=attempt_id,
            student__user=request.user,
            test__school=request.user.school,
        )
    except TestAttempt.DoesNotExist:
        return Response({'error': 'Attempt not found'}, status=status.HTTP_404_NOT_FOUND)
    elapsed = (timezone.now() - attempt.started_at).total_seconds() if attempt.started_at else 0
    remaining = max(0, int((attempt.test.duration_minutes * 60) - elapsed))
    return Response({
        'attempt_id': attempt.id,
        'test_id': attempt.test_id,
        'title': attempt.test.title,
        'remaining_seconds': remaining,
        'status': attempt.status,
        'questions': [
            {
                'id': q.id,
                'order': q.order,
                'prompt_text': q.prompt_text,
                'marks': q.marks,
                'question_type': q.question_type,
                'options': q.options,
            }
            for q in attempt.test.questions.all().order_by('order', 'id')
        ],
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def student_submit_attempt(request, attempt_id):
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
    from .models import TestAttempt, TestAnswer
    try:
        attempt = TestAttempt.objects.select_related('test').get(
            id=attempt_id,
            student__user=request.user,
            test__school=request.user.school,
        )
    except TestAttempt.DoesNotExist:
        return Response({'error': 'Attempt not found'}, status=status.HTTP_404_NOT_FOUND)
    if attempt.status == 'submitted':
        # Return the existing result instead of an error — makes sync-queue retries idempotent
        return Response({
            'attempt_id': attempt.id,
            'status': attempt.status,
            'auto_score': attempt.auto_score,
            'final_score': attempt.final_score,
        })

    elapsed = (timezone.now() - attempt.started_at).total_seconds() if attempt.started_at else 0
    if elapsed > (attempt.test.duration_minutes * 60):
        # allow submit but force as expired; still record answers
        pass
    answers = request.data.get('answers') or []
    question_map = {q.id: q for q in attempt.test.questions.all()}
    auto_score = 0.0
    for row in answers:
        if not isinstance(row, dict):
            continue
        qid = row.get('question_id')
        if qid not in question_map:
            continue
        question = question_map[qid]
        answer_text = str(row.get('answer_text') or '').strip()
        awarded = 0.0
        if question.question_type == 'mcq':
            if answer_text and answer_text.lower() == (question.correct_answer or '').strip().lower():
                awarded = float(question.marks or 0)
        elif question.question_type == 'short':
            if answer_text and answer_text.lower() == (question.correct_answer or '').strip().lower():
                awarded = float(question.marks or 0)
        auto_score += awarded
        TestAnswer.objects.update_or_create(
            attempt=attempt,
            question_id=qid,
            defaults={'answer_text': answer_text, 'awarded_marks': awarded},
        )
    attempt.auto_score = round(auto_score, 4)
    attempt.final_score = round(auto_score + float(attempt.manual_score or 0), 4)
    attempt.submitted_at = timezone.now()
    attempt.status = 'submitted'
    attempt.save(update_fields=['auto_score', 'final_score', 'submitted_at', 'status'])
    return Response({
        'attempt_id': attempt.id,
        'status': attempt.status,
        'auto_score': attempt.auto_score,
        'final_score': attempt.final_score,
    })


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def student_assignment_submission(request, assignment_id):
    """
    GET  — retrieve student's own submission for an assignment.
    POST — submit (or resubmit) an assignment (text or file).
    """
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        student = request.user.student
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    from .models import Assignment, AssignmentSubmission

    try:
        assignment = Assignment.objects.get(
            id=assignment_id,
            assigned_class=student.student_class,
            school=request.user.school,
        )
    except Assignment.DoesNotExist:
        return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        submission = AssignmentSubmission.objects.filter(assignment=assignment, student=student).first()
        if not submission:
            return Response({'submitted': False, 'assignment_id': assignment_id})
        return Response({
            'submitted': True,
            'id': submission.id,
            'status': submission.status,
            'submitted_at': submission.submitted_at.isoformat(),
            'text_submission': submission.text_submission,
            'grade': submission.grade,
            'feedback': submission.feedback,
            'file_url': submission.submitted_file.url if submission.submitted_file else None,
            'is_late': submission.is_late,
            'attachments': [
                {
                    'id': att.id,
                    'file_key': att.file_key,
                    'original_filename': att.original_filename,
                    'mime_type': att.mime_type,
                    'size_bytes': att.size_bytes,
                }
                for att in submission.attachments.all()
            ],
        })

    # POST
    from django.utils import timezone as tz
    now = tz.now()
    is_late = now > assignment.deadline
    if is_late and not assignment.allow_late:
        return Response({'error': 'Late submissions are disabled for this assignment.'}, status=status.HTTP_400_BAD_REQUEST)
    text_submission = request.data.get('text_submission', '')
    submitted_file = request.FILES.get('file')
    attachment_rows = _parse_attachment_rows(request.data.get('attachments') or request.data.get('file_keys') or [])

    if not text_submission and not submitted_file and not attachment_rows:
        return Response({'error': 'Provide text_submission, a file, or attachments.'}, status=status.HTTP_400_BAD_REQUEST)

    submission, created = AssignmentSubmission.objects.get_or_create(
        assignment=assignment, student=student,
        defaults={
            'text_submission': text_submission,
            'submitted_file': submitted_file,
            'status': 'late' if is_late else 'submitted',
            'is_late': is_late,
        }
    )
    if not created:
        # resubmit
        submission.text_submission = text_submission
        if submitted_file:
            submission.submitted_file = submitted_file
        submission.status = 'late' if is_late else 'submitted'
        submission.is_late = is_late
        submission.submitted_at = now
        submission.save(update_fields=['text_submission', 'submitted_file', 'status', 'is_late', 'submitted_at'])
        AssignmentSubmissionAttachment.objects.filter(submission=submission).delete()
    for row in attachment_rows:
        AssignmentSubmissionAttachment.objects.create(submission=submission, **row)

    return Response({
        'message': 'Submitted successfully.',
        'status': submission.status,
        'is_late': submission.is_late,
        'submitted_at': submission.submitted_at.isoformat(),
    }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
