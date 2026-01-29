from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Avg, Count, Q
from django.utils import timezone
from datetime import timedelta, datetime
from .models import (
    Student, Subject, Result, Timetable, Teacher, 
    Announcement, Assignment, SchoolEvent, Attendance
)
from .serializers import (
    StudentSerializer, ResultSerializer, TimetableSerializer,
    AnnouncementSerializer, AssignmentSerializer, SchoolEventSerializer
)


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
        
        # Calculate overall average from results
        results = Result.objects.filter(student=student)
        avg_percentage = 0
        if results.exists():
            total_percentage = 0
            count = 0
            for result in results:
                if result.max_score > 0:
                    total_percentage += (result.score / result.max_score) * 100
                    count += 1
            if count > 0:
                avg_percentage = round(total_percentage / count, 1)
        
        # Get total subjects
        total_subjects = student.student_class.timetable.values('subject').distinct().count() if student.student_class else 0
        
        # Get pending submissions
        pending_submissions = Assignment.objects.filter(
            assigned_class=student.student_class,
            deadline__gt=timezone.now()
        ).count()
        
        # Calculate attendance percentage
        total_days = Attendance.objects.filter(student=student).count()
        present_days = Attendance.objects.filter(
            student=student, 
            status__in=['present', 'late']
        ).count()
        attendance_percentage = round((present_days / total_days * 100), 1) if total_days > 0 else 100
        
        data = {
            'overall_average': avg_percentage,
            'total_subjects': total_subjects,
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
        ).order_by('deadline')
        
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
        results = Result.objects.filter(student=student)
        
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
    
    events = SchoolEvent.objects.all().order_by('start_date')
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
        ).order_by('day_of_week', 'start_time')
        
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
    
    announcements = Announcement.objects.filter(
        Q(target_audience='all') | Q(target_audience='students'),
        is_active=True
    ).order_by('-date_posted')
    
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
            'date': announcement.date_posted.isoformat(),
            'priority': priority,
            'attachments': []
        })
    
    return Response(data)
