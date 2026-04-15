import logging

from django.db.models import Avg, Count, Q, Max, Min
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from datetime import datetime, timedelta
from .models import (
    Teacher, Student, Subject, Result, ClassAttendance, SubjectAttendance, Class, Timetable
)
from .serializers import ResultSerializer, ClassAttendanceSerializer, SubjectAttendanceSerializer


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_subjects(request):
    """Get all subjects taught by the logged-in teacher"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        subjects = teacher.subjects_taught.all()
        
        data = []
        for subject in subjects:
            # Get students count for this subject
            students_count = Student.objects.filter(
                student_class__in=Class.objects.filter(
                    students__results__subject=subject,
                    students__results__teacher=teacher
                ).distinct()
            ).distinct().count()
            
            data.append({
                'id': subject.id,
                'name': subject.name,
                'code': subject.code,
                'description': subject.description,
                'students_count': students_count
            })
        
        return Response(data)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def subject_students(request, subject_id):
    """Get students enrolled in classes for a specific subject taught by the teacher"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        subject = Subject.objects.get(id=subject_id)
        
        # Verify teacher teaches this subject
        if not teacher.subjects_taught.filter(id=subject_id).exists():
            return Response({'error': 'You do not teach this subject'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        # Filter students more intelligently:
        # 1. Students who already have results for this subject with this teacher (enrolled)
        # 2. Students from classes that this teacher teaches (class teacher)
        # This provides a better filtering approach than showing all students
        
        # Get students who have existing results for this subject
        students_with_results = Student.objects.filter(
            results__subject=subject,
            results__teacher=teacher
        ).distinct().values_list('id', flat=True)
        
        # Get classes taught by this teacher
        classes_taught = Class.objects.filter(class_teacher=teacher.user)
        
        # Combine both filters
        students = Student.objects.filter(
            Q(id__in=students_with_results) | Q(student_class__in=classes_taught),
            user__is_active=True
        ).distinct().select_related('user', 'student_class')
        
        data = []
        for student in students:
            # Get latest result for this student and subject
            latest_result = Result.objects.filter(
                student=student,
                subject=subject,
                teacher=teacher
            ).order_by('-date_recorded').first()
            
            data.append({
                'id': student.id,
                'student_number': student.user.student_number or '',
                'name': student.user.first_name,
                'surname': student.user.last_name,
                'class': student.student_class.name if student.student_class else 'Not Assigned',
                'latest_score': latest_result.score if latest_result else None,
                'latest_max_score': latest_result.max_score if latest_result else None,
                'latest_exam_type': latest_result.exam_type if latest_result else None
            })
        
        return Response(data)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def add_student_mark(request):
    """Add or update a student's mark for a subject"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        student_id = request.data.get('student_id')
        subject_id = request.data.get('subject_id')
        exam_type = request.data.get('exam_type')
        score = request.data.get('score')
        max_score = request.data.get('max_score')
        academic_term = request.data.get('academic_term', 'Term 1')
        academic_year = request.data.get('academic_year', str(datetime.now().year))
        include_in_report = request.data.get('include_in_report', True)
        report_term = request.data.get('report_term', '')
        
        # Validation
        if not all([student_id, subject_id, exam_type, score, max_score]):
            return Response({'error': 'All fields are required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        try:
            score = float(score)
            max_score = float(max_score)
        except ValueError:
            return Response({'error': 'Score and max_score must be numbers'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        if score > max_score:
            return Response({'error': 'Score cannot exceed max_score'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Get student and subject
        try:
            student = Student.objects.get(id=student_id)
            subject = Subject.objects.get(id=subject_id)
        except (Student.DoesNotExist, Subject.DoesNotExist):
            return Response({'error': 'Student or subject not found'}, 
                           status=status.HTTP_404_NOT_FOUND)
        
        # Verify teacher teaches this subject
        if not teacher.subjects_taught.filter(id=subject_id).exists():
            return Response({'error': 'You do not teach this subject'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        # SECURITY: Verify student is active and exists
        if not student.user.is_active:
            return Response({'error': 'Cannot add marks for inactive students'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        # Create result
        result = Result.objects.create(
            student=student,
            subject=subject,
            teacher=teacher,
            exam_type=exam_type,
            score=score,
            max_score=max_score,
            academic_term=academic_term,
            academic_year=academic_year,
            include_in_report=bool(include_in_report),
            report_term=report_term or '',
        )
        
        return Response({
            'id': result.id,
            'student': f"{student.user.first_name} {student.user.last_name}",
            'subject': subject.name,
            'exam_type': exam_type,
            'score': score,
            'max_score': max_score,
            'percentage': round((score / max_score) * 100, 2),
            'message': 'Mark added successfully'
        }, status=status.HTTP_201_CREATED)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def subject_performance(request, subject_id):
    """Get performance analytics for a subject"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        subject = Subject.objects.get(id=subject_id)
        
        # Verify teacher teaches this subject
        if not teacher.subjects_taught.filter(id=subject_id).exists():
            return Response({'error': 'You do not teach this subject'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        # Get all results for this subject and teacher
        results = Result.objects.filter(subject=subject, teacher=teacher)
        
        if not results.exists():
            return Response({
                'subject_name': subject.name,
                'subject_code': subject.code,
                'total_students': 0,
                'average_score': 0,
                'highest_score': 0,
                'lowest_score': 0,
                'pass_rate': 0,
                'exam_types': []
            })
        
        # Calculate percentages for each result
        percentages = []
        for result in results:
            if result.max_score > 0:
                percentages.append((result.score / result.max_score) * 100)
        
        # Calculate statistics
        avg_percentage = sum(percentages) / len(percentages) if percentages else 0
        pass_rate = sum(1 for p in percentages if p >= 50) / len(percentages) * 100 if percentages else 0
        
        # Get unique students
        total_students = results.values('student').distinct().count()
        
        # Get exam type breakdown
        exam_types_data = []
        for exam_type in results.values_list('exam_type', flat=True).distinct():
            exam_results = results.filter(exam_type=exam_type)
            exam_percentages = []
            for result in exam_results:
                if result.max_score > 0:
                    exam_percentages.append((result.score / result.max_score) * 100)
            
            exam_types_data.append({
                'exam_type': exam_type,
                'average': round(sum(exam_percentages) / len(exam_percentages), 2) if exam_percentages else 0,
                'count': exam_results.count()
            })
        
        # Get top performers
        top_performers = []
        student_averages = {}
        for result in results:
            student_id = result.student.id
            percentage = (result.score / result.max_score * 100) if result.max_score > 0 else 0
            
            if student_id not in student_averages:
                student_averages[student_id] = {
                    'student': result.student,
                    'scores': [],
                    'total': 0,
                    'count': 0
                }
            
            student_averages[student_id]['scores'].append(percentage)
            student_averages[student_id]['total'] += percentage
            student_averages[student_id]['count'] += 1
        
        for student_id, data in student_averages.items():
            avg = data['total'] / data['count']
            top_performers.append({
                'student_name': f"{data['student'].user.first_name} {data['student'].user.last_name}",
                'student_number': data['student'].user.student_number or '',
                'average_percentage': round(avg, 2)
            })
        
        # Sort by average and get top 5
        top_performers = sorted(top_performers, key=lambda x: x['average_percentage'], reverse=True)[:5]
        
        return Response({
            'subject_name': subject.name,
            'subject_code': subject.code,
            'total_students': total_students,
            'total_results': results.count(),
            'average_percentage': round(avg_percentage, 2),
            'highest_percentage': round(max(percentages), 2) if percentages else 0,
            'lowest_percentage': round(min(percentages), 2) if percentages else 0,
            'pass_rate': round(pass_rate, 2),
            'exam_types': exam_types_data,
            'top_performers': top_performers
        })
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


## --------------- helpers ---------------

def _parse_date(raw):
    """Return a date object or None."""
    try:
        return datetime.strptime(raw, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None

VALID_STATUSES = {'present', 'absent', 'late', 'excused'}


## --------------- CLASS attendance ---------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def class_attendance_register(request):
    """Return the class attendance register for the class teacher's class."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        attendance_date = _parse_date(request.query_params.get('date', str(datetime.now().date())))
        if not attendance_date:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Class attendance is only for the class teacher's own class
        teacher_class = Class.objects.filter(class_teacher=request.user).first()
        if not teacher_class:
            return Response({
                'no_class': True,
                'error': 'You are not a class teacher. Contact admin to assign you as a class teacher.',
                'students': [],
                'class_name': ''
            })

        students = (Student.objects.filter(student_class=teacher_class)
                    .select_related('user', 'student_class')
                    .order_by('user__last_name', 'user__first_name'))

        records = ClassAttendance.objects.filter(date=attendance_date, student__in=students)
        att_map = {r.student_id: {'status': r.status, 'remarks': r.remarks, 'id': r.id} for r in records}

        # locked = at least one record already exists for this date+class
        locked = records.exists()

        data = []
        for s in students:
            info = att_map.get(s.id, {'status': None, 'remarks': '', 'id': None})
            data.append({
                'student_id': s.id,
                'student_number': s.user.student_number or '',
                'name': s.user.first_name,
                'surname': s.user.last_name,
                'class': s.student_class.name if s.student_class else 'Not Assigned',
                'attendance_id': info['id'],
                'status': info['status'],
                'remarks': info['remarks'],
            })

        return Response({
            'date': str(attendance_date),
            'class_name': teacher_class.name,
            'class_id': teacher_class.id,
            'locked': locked,
            'students': data,
        })
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_class_attendance(request):
    """Bulk-create class attendance for a day. Rejects if already marked."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        attendance_data = request.data.get('attendance', [])
        attendance_date = _parse_date(request.data.get('date', str(datetime.now().date())))
        if not attendance_date:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not attendance_data:
            return Response({'error': 'Attendance data is required'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Only class teacher can mark class attendance
        teacher_class = Class.objects.filter(class_teacher=request.user).first()
        if not teacher_class:
            return Response({'error': 'You are not a class teacher'},
                            status=status.HTTP_403_FORBIDDEN)

        # Lock check — if any record already exists for this class+date, reject
        already_exists = ClassAttendance.objects.filter(
            class_assigned=teacher_class, date=attendance_date
        ).exists()
        if already_exists:
            return Response({'error': 'Class attendance for this date has already been submitted and cannot be changed.'},
                            status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        errors = []
        for item in attendance_data:
            student_id = item.get('student_id')
            status_value = item.get('status')
            remarks = item.get('remarks', '')

            if not student_id or not status_value:
                errors.append('Missing student_id or status for an entry')
                continue
            if status_value not in VALID_STATUSES:
                errors.append(f"Invalid status '{status_value}' for student {student_id}")
                continue
            try:
                student = Student.objects.get(id=student_id)
                if student.student_class_id != teacher_class.id:
                    errors.append(f'Student {student_id} is not in your class')
                    continue
                ClassAttendance.objects.create(
                    student=student,
                    class_assigned=teacher_class,
                    date=attendance_date,
                    status=status_value,
                    remarks=remarks,
                    recorded_by=request.user,
                )
                created_count += 1
            except Student.DoesNotExist:
                errors.append(f'Student with ID {student_id} not found')

        return Response({
            'message': 'Class attendance submitted successfully',
            'created': created_count,
            'errors': errors if errors else None,
        }, status=status.HTTP_201_CREATED)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


## --------------- SUBJECT attendance ---------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def subject_attendance_register(request):
    """Return the subject attendance register for a specific class+subject the teacher teaches."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        attendance_date = _parse_date(request.query_params.get('date', str(datetime.now().date())))
        if not attendance_date:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'},
                            status=status.HTTP_400_BAD_REQUEST)

        class_id = request.query_params.get('class_id')
        subject_id = request.query_params.get('subject_id')
        if not class_id or not subject_id:
            return Response({'error': 'class_id and subject_id are required'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Verify the teacher teaches this subject in this class via timetable
        teaches = Timetable.objects.filter(
            teacher=teacher, class_assigned_id=class_id, subject_id=subject_id
        ).exists()
        if not teaches:
            return Response({'error': 'You do not teach this subject in this class'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            the_class = Class.objects.get(id=class_id)
            the_subject = Subject.objects.get(id=subject_id)
        except (Class.DoesNotExist, Subject.DoesNotExist):
            return Response({'error': 'Class or subject not found'}, status=status.HTTP_404_NOT_FOUND)

        students = (Student.objects.filter(student_class=the_class)
                    .select_related('user', 'student_class')
                    .order_by('user__last_name', 'user__first_name'))

        records = SubjectAttendance.objects.filter(
            date=attendance_date, subject=the_subject, student__in=students
        )
        att_map = {r.student_id: {'status': r.status, 'remarks': r.remarks, 'id': r.id} for r in records}

        locked = records.exists()

        data = []
        for s in students:
            info = att_map.get(s.id, {'status': None, 'remarks': '', 'id': None})
            data.append({
                'student_id': s.id,
                'student_number': s.user.student_number or '',
                'name': s.user.first_name,
                'surname': s.user.last_name,
                'class': s.student_class.name if s.student_class else 'Not Assigned',
                'attendance_id': info['id'],
                'status': info['status'],
                'remarks': info['remarks'],
            })

        return Response({
            'date': str(attendance_date),
            'class_name': the_class.name,
            'class_id': the_class.id,
            'subject_name': the_subject.name,
            'subject_id': the_subject.id,
            'locked': locked,
            'students': data,
        })
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_subject_attendance(request):
    """Bulk-create subject attendance for a class+subject+day. Rejects if already marked."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        attendance_data = request.data.get('attendance', [])
        attendance_date = _parse_date(request.data.get('date', str(datetime.now().date())))
        class_id = request.data.get('class_id')
        subject_id = request.data.get('subject_id')

        if not attendance_date:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not attendance_data:
            return Response({'error': 'Attendance data is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not class_id or not subject_id:
            return Response({'error': 'class_id and subject_id are required'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Verify teacher teaches this subject in this class
        teaches = Timetable.objects.filter(
            teacher=teacher, class_assigned_id=class_id, subject_id=subject_id
        ).exists()
        if not teaches:
            return Response({'error': 'You do not teach this subject in this class'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            the_class = Class.objects.get(id=class_id)
            the_subject = Subject.objects.get(id=subject_id)
        except (Class.DoesNotExist, Subject.DoesNotExist):
            return Response({'error': 'Class or subject not found'}, status=status.HTTP_404_NOT_FOUND)

        # Lock check
        already_exists = SubjectAttendance.objects.filter(
            class_assigned=the_class, subject=the_subject, date=attendance_date
        ).exists()
        if already_exists:
            return Response({'error': 'Subject attendance for this class and date has already been submitted and cannot be changed.'},
                            status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        errors = []
        for item in attendance_data:
            student_id = item.get('student_id')
            status_value = item.get('status')
            remarks = item.get('remarks', '')

            if not student_id or not status_value:
                errors.append('Missing student_id or status for an entry')
                continue
            if status_value not in VALID_STATUSES:
                errors.append(f"Invalid status '{status_value}' for student {student_id}")
                continue
            try:
                student = Student.objects.get(id=student_id)
                if student.student_class_id != the_class.id:
                    errors.append(f'Student {student_id} is not in this class')
                    continue
                SubjectAttendance.objects.create(
                    student=student,
                    class_assigned=the_class,
                    subject=the_subject,
                    date=attendance_date,
                    status=status_value,
                    remarks=remarks,
                    recorded_by=request.user,
                )
                created_count += 1
            except Student.DoesNotExist:
                errors.append(f'Student with ID {student_id} not found')

        return Response({
            'message': 'Subject attendance submitted successfully',
            'created': created_count,
            'errors': errors if errors else None,
        }, status=status.HTTP_201_CREATED)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


# ── Assignment Submission Management ─────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def assignment_submissions(request, assignment_id):
    """List all student submissions for an assignment (teacher only)."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    from .models import Assignment, AssignmentSubmission

    try:
        assignment = Assignment.objects.select_related('subject', 'assigned_class').get(
            id=assignment_id, teacher=teacher
        )
    except Assignment.DoesNotExist:
        return Response({'error': 'Assignment not found or not yours'}, status=status.HTTP_404_NOT_FOUND)

    submissions = (
        AssignmentSubmission.objects
        .filter(assignment=assignment)
        .select_related('student__user')
        .order_by('submitted_at')
    )

    data = []
    for s in submissions:
        data.append({
            'id': s.id,
            'student_id': s.student.id,
            'student_name': f"{s.student.user.first_name} {s.student.user.last_name}",
            'student_number': s.student.user.student_number or '',
            'status': s.status,
            'submitted_at': s.submitted_at.isoformat(),
            'grade': s.grade,
            'feedback': s.feedback,
            'text_submission': s.text_submission,
            'file_url': s.submitted_file.url if s.submitted_file else None,
        })

    total_students = assignment.assigned_class.students.count()
    return Response({
        'assignment_id': assignment_id,
        'assignment_title': assignment.title,
        'deadline': assignment.deadline.isoformat(),
        'total_students': total_students,
        'submitted_count': len(data),
        'submissions': data,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def grade_submission(request, submission_id):
    """Grade a student submission (teacher only)."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    from .models import AssignmentSubmission

    try:
        submission = AssignmentSubmission.objects.select_related(
            'assignment__teacher'
        ).get(id=submission_id, assignment__teacher=teacher)
    except AssignmentSubmission.DoesNotExist:
        return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

    grade = request.data.get('grade')
    feedback = request.data.get('feedback', '')

    if grade is None:
        return Response({'error': 'grade is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        grade = float(grade)
    except (TypeError, ValueError):
        return Response({'error': 'grade must be a number'}, status=status.HTTP_400_BAD_REQUEST)

    submission.grade = grade
    submission.feedback = feedback
    submission.status = 'graded'
    submission.save(update_fields=['grade', 'feedback', 'status'])

    return Response({
        'message': 'Graded successfully.',
        'submission_id': submission_id,
        'grade': submission.grade,
        'feedback': submission.feedback,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def results_for_report(request):
    """
    List results for a class/subject so the teacher can manage which ones
    appear on the report card and which term they count toward.
    Query params: ?class_id=X&subject_id=Y&year=2025
    """
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    class_id = request.query_params.get('class_id')
    subject_id = request.query_params.get('subject_id')
    year = request.query_params.get('year', str(datetime.now().year))

    if not class_id or not subject_id:
        return Response({'error': 'class_id and subject_id are required'},
                        status=status.HTTP_400_BAD_REQUEST)

    results = (
        Result.objects.filter(
            teacher=teacher,
            subject_id=subject_id,
            student__student_class_id=class_id,
            academic_year=year,
        )
        .select_related('student__user', 'subject')
        .order_by('student__user__last_name', 'student__user__first_name', 'exam_type')
    )

    data = []
    for r in results:
        data.append({
            'id': r.id,
            'student_id': r.student.id,
            'student_name': r.student.user.full_name,
            'student_number': r.student.user.student_number or '',
            'subject_name': r.subject.name,
            'exam_type': r.exam_type,
            'score': r.score,
            'max_score': r.max_score,
            'percentage': round((r.score / r.max_score) * 100, 2) if r.max_score > 0 else 0,
            'academic_term': r.academic_term,
            'include_in_report': r.include_in_report,
            'report_term': r.report_term,
            'effective_term': r.report_term if r.report_term else r.academic_term,
        })

    return Response({'results': data})


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_report_settings(request):
    """
    Bulk update include_in_report and report_term on results.
    Body: { "updates": [ { "id": 123, "include_in_report": true, "report_term": "Term 3" }, ... ] }
    """
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    updates = request.data.get('updates', [])
    if not updates:
        return Response({'error': 'No updates provided'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate all IDs belong to this teacher
    result_ids = [u['id'] for u in updates if 'id' in u]
    teacher_results = Result.objects.filter(id__in=result_ids, teacher=teacher)
    valid_ids = set(teacher_results.values_list('id', flat=True))

    updated_count = 0
    errors = []
    for u in updates:
        rid = u.get('id')
        if rid not in valid_ids:
            errors.append(f'Result {rid} not found or not yours')
            continue

        update_fields = {}
        if 'include_in_report' in u:
            update_fields['include_in_report'] = bool(u['include_in_report'])
        if 'report_term' in u:
            update_fields['report_term'] = u['report_term']

        if update_fields:
            Result.objects.filter(id=rid).update(**update_fields)
            updated_count += 1

    return Response({
        'message': f'{updated_count} result(s) updated',
        'updated': updated_count,
        'errors': errors if errors else None,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_classes(request):
    """Get all classes this teacher is authorized for (class teacher + timetable)"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                       status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        from .models import Timetable

        # Classes where teacher is class_teacher
        class_teacher_classes = set(Class.objects.filter(
            class_teacher=request.user
        ).values_list('id', flat=True))

        # Classes where teacher has timetable entries
        timetable_classes = set(Timetable.objects.filter(
            teacher=teacher
        ).values_list('class_assigned_id', flat=True).distinct())

        all_class_ids = class_teacher_classes | timetable_classes
        classes = Class.objects.filter(id__in=all_class_ids).order_by('name')

        data = [{
            'id': c.id,
            'name': c.name,
            'grade_level': c.grade_level,
            'academic_year': c.academic_year,
            'is_class_teacher': c.id in class_teacher_classes,
            'student_count': c.students.count(),
        } for c in classes]

        return Response({'classes': data})
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_class_subjects(request, class_id):
    """Get subjects this teacher teaches in a specific class (from timetable)."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        subject_ids = (Timetable.objects
                       .filter(teacher=teacher, class_assigned_id=class_id)
                       .values_list('subject_id', flat=True)
                       .distinct())
        subjects = Subject.objects.filter(id__in=subject_ids).order_by('name')
        data = [{'id': s.id, 'name': s.name, 'code': s.code} for s in subjects]
        return Response(data)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
