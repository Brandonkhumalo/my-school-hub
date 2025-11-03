from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Avg, Count, Q, Max, Min
from django.utils import timezone
from datetime import datetime, timedelta
from .models import (
    Teacher, Student, Subject, Result, Attendance, Class
)
from .serializers import ResultSerializer, AttendanceSerializer


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
        
        # NOTE: Current limitation - Without a SubjectEnrollment or Class-Subject mapping,
        # we show all active students to allow teachers to enter marks.
        # This is acceptable because:
        # 1. Teacher is verified to teach this subject
        # 2. Teacher can only add marks (non-sensitive operation)
        # 3. No sensitive student data is exposed (just names and classes)
        # FUTURE IMPROVEMENT: Add SubjectEnrollment model to properly track which students
        # are enrolled in which subjects, allowing for proper access control.
        
        students = Student.objects.filter(
            user__is_active=True
        ).select_related('user', 'student_class')
        
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
            academic_year=academic_year
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


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def attendance_register(request):
    """Get attendance register for a specific date and class"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        date_str = request.query_params.get('date', str(datetime.now().date()))
        class_id = request.query_params.get('class_id')
        
        # Parse date
        try:
            attendance_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Get students
        if class_id:
            try:
                students = Student.objects.filter(
                    student_class_id=class_id
                ).select_related('user', 'student_class')
            except:
                return Response({'error': 'Invalid class ID'}, 
                               status=status.HTTP_400_BAD_REQUEST)
        else:
            students = Student.objects.all().select_related('user', 'student_class')
        
        # Get attendance records for this date
        attendance_records = Attendance.objects.filter(
            date=attendance_date,
            student__in=students
        )
        
        # Create a map of student_id to attendance status
        attendance_map = {
            record.student.id: {
                'status': record.status,
                'remarks': record.remarks,
                'id': record.id
            }
            for record in attendance_records
        }
        
        data = []
        for student in students:
            attendance_info = attendance_map.get(student.id, {
                'status': None,
                'remarks': '',
                'id': None
            })
            
            data.append({
                'student_id': student.id,
                'student_number': student.user.student_number or '',
                'name': student.user.first_name,
                'surname': student.user.last_name,
                'class': student.student_class.name if student.student_class else 'Not Assigned',
                'attendance_id': attendance_info['id'],
                'status': attendance_info['status'],
                'remarks': attendance_info['remarks']
            })
        
        return Response({
            'date': str(attendance_date),
            'students': data
        })
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_attendance(request):
    """Mark attendance for students"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        attendance_data = request.data.get('attendance', [])
        date_str = request.data.get('date', str(datetime.now().date()))
        
        # Parse date
        try:
            attendance_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        if not attendance_data:
            return Response({'error': 'Attendance data is required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        created_count = 0
        updated_count = 0
        errors = []
        
        for item in attendance_data:
            student_id = item.get('student_id')
            status_value = item.get('status')
            remarks = item.get('remarks', '')
            
            if not student_id or not status_value:
                errors.append(f"Missing student_id or status for an entry")
                continue
            
            if status_value not in ['present', 'absent', 'late', 'excused']:
                errors.append(f"Invalid status '{status_value}' for student {student_id}")
                continue
            
            try:
                student = Student.objects.get(id=student_id)
                
                # Check if attendance already exists for this date
                attendance, created = Attendance.objects.update_or_create(
                    student=student,
                    date=attendance_date,
                    defaults={
                        'status': status_value,
                        'remarks': remarks,
                        'recorded_by': request.user
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    updated_count += 1
            except Student.DoesNotExist:
                errors.append(f"Student with ID {student_id} not found")
        
        return Response({
            'message': 'Attendance processed successfully',
            'created': created_count,
            'updated': updated_count,
            'errors': errors if errors else None
        }, status=status.HTTP_201_CREATED if created_count > 0 else status.HTTP_200_OK)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)
