from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from datetime import datetime
from .models import (
    Parent, Student, ParentChildLink, Result, WeeklyMessage, Attendance
)
from .serializers import ParentChildLinkSerializer, WeeklyMessageSerializer
from finances.models import StudentFee, Payment


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def parent_children_list(request):
    """Get all CONFIRMED children linked to the logged-in parent"""
    if request.user.role != 'parent':
        return Response({
            'error': 'Only parents can access this endpoint',
            'current_role': getattr(request.user, 'role', 'No role set')
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        # Only return confirmed children to prevent data leakage
        child_links = ParentChildLink.objects.filter(
            parent=parent, 
            is_confirmed=True
        ).select_related('student__user', 'student__student_class')
        
        data = []
        for link in child_links:
            data.append({
                'id': link.student.id,
                'name': link.student.user.first_name,
                'surname': link.student.user.last_name,
                'class': link.student.student_class.name if link.student.student_class else 'Not Assigned',
                'student_number': link.student.user.student_number or '',
                'is_confirmed': link.is_confirmed
            })
        
        return Response(data)
    except Parent.DoesNotExist:
        return Response({
            'error': 'Parent profile not found. Please contact administrator.',
            'message': 'Your account exists but no parent profile is linked to it.'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def available_children_to_confirm(request):
    """Get children that are linked but not confirmed by parent"""
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        unconfirmed_links = ParentChildLink.objects.filter(
            parent=parent, 
            is_confirmed=False
        ).select_related('student__user', 'student__student_class')
        
        data = []
        for link in unconfirmed_links:
            data.append({
                'id': link.student.id,
                'name': link.student.user.first_name,
                'surname': link.student.user.last_name,
                'class': link.student.student_class.name if link.student.student_class else 'Not Assigned',
                'student_number': link.student.user.student_number or ''
            })
        
        return Response(data)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_students(request):
    """Search for students by name+surname OR student number - privacy-focused endpoint"""
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        
        # Get search parameters
        student_number = request.query_params.get('student_number', '').strip()
        first_name = request.query_params.get('first_name', '').strip()
        last_name = request.query_params.get('last_name', '').strip()
        
        # Validate: must have either student_number OR (first_name AND last_name)
        if student_number:
            # Search by student number - must be at least 3 characters
            if len(student_number) < 3:
                return Response({
                    'error': 'Student number must be at least 3 characters'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            students = Student.objects.filter(
                user__student_number__icontains=student_number
            ).select_related('user', 'student_class')[:10]
            
        elif first_name and last_name:
            # Search by name AND surname - both required, at least 2 chars each
            if len(first_name) < 2 or len(last_name) < 2:
                return Response({
                    'error': 'First name and last name must each be at least 2 characters'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            students = Student.objects.filter(
                user__first_name__icontains=first_name,
                user__last_name__icontains=last_name
            ).select_related('user', 'student_class')[:10]
            
        else:
            # No valid search criteria provided
            return Response({
                'error': 'Please provide either a student number OR both first name and last name',
                'hint': 'For privacy, you cannot browse all students. Search for your specific child.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get already linked student IDs (both confirmed and unconfirmed)
        linked_student_ids = list(ParentChildLink.objects.filter(
            parent=parent
        ).values_list('student_id', flat=True))
        
        data = []
        for student in students:
            is_linked = student.id in linked_student_ids
            data.append({
                'id': student.id,
                'name': student.user.first_name,
                'surname': student.user.last_name,
                'class': student.student_class.name if student.student_class else 'Not Assigned',
                'student_number': student.user.student_number or '',
                'is_linked': is_linked
            })
        
        return Response(data)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def request_child_link(request):
    """Request to link a child to the parent - requires ADMIN approval"""
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        student_id = request.data.get('student_id')
        
        if not student_id:
            return Response({'error': 'student_id is required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, 
                           status=status.HTTP_404_NOT_FOUND)
        
        # Check if link already exists
        existing_link = ParentChildLink.objects.filter(
            parent=parent, 
            student=student
        ).first()
        
        if existing_link:
            return Response({
                'error': 'Link request already exists. Waiting for admin approval.',
                'is_confirmed': existing_link.is_confirmed
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create new link request (unconfirmed, requires admin approval)
        # Note: Parents CANNOT confirm these themselves for security
        link = ParentChildLink.objects.create(
            parent=parent,
            student=student,
            is_confirmed=False  # Only admins can set to True
        )
        
        return Response({
            'id': student.id,
            'name': student.user.first_name,
            'surname': student.user.last_name,
            'class': student.student_class.name if student.student_class else 'Not Assigned',
            'student_number': student.user.student_number or '',
            'is_confirmed': False,
            'message': 'Link request submitted successfully. Waiting for administrator approval.'
        }, status=status.HTTP_201_CREATED)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def confirm_child(request, child_id):
    """ADMIN ONLY: Approve parent-child link requests"""
    # Only admins can confirm links for security
    if request.user.role not in ['admin', 'teacher']:
        return Response({
            'error': 'Only administrators can approve parent-child links. Your request is pending admin approval.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Admin confirms any parent-child link
        link = ParentChildLink.objects.get(student_id=child_id)
        
        if link.is_confirmed:
            return Response({'message': 'Link already confirmed'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        link.is_confirmed = True
        link.confirmed_date = timezone.now()
        link.save()
        
        return Response({
            'id': link.student.id,
            'name': link.student.user.first_name,
            'surname': link.student.user.last_name,
            'class': link.student.student_class.name if link.student.student_class else 'Not Assigned',
            'student_number': link.student.user.student_number or '',
            'parent_name': f"{link.parent.user.first_name} {link.parent.user.last_name}",
            'is_confirmed': True,
            'message': 'Parent-child link approved successfully'
        })
    except ParentChildLink.DoesNotExist:
        return Response({'error': 'Link request not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def child_dashboard_stats(request, child_id):
    """Get dashboard statistics for a specific child"""
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        # Verify this child belongs to the parent and is confirmed
        link = ParentChildLink.objects.get(parent=parent, student_id=child_id, is_confirmed=True)
        student = link.student
        
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
        
        # Calculate attendance percentage
        total_days = Attendance.objects.filter(student=student).count()
        present_days = Attendance.objects.filter(
            student=student, 
            status__in=['present', 'late']
        ).count()
        attendance_percentage = round((present_days / total_days * 100), 1) if total_days > 0 else 100
        
        # Calculate outstanding fees
        student_fees = StudentFee.objects.filter(student=student)
        outstanding_fees = sum(fee.balance for fee in student_fees)
        
        data = {
            'overall_average': avg_percentage,
            'total_subjects': total_subjects,
            'attendance_percentage': attendance_percentage,
            'outstanding_fees': float(outstanding_fees)
        }
        
        return Response(data)
    except ParentChildLink.DoesNotExist:
        return Response({'error': 'Child not found or not confirmed'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def child_performance(request, child_id):
    """Get academic performance data for a specific child"""
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        # Verify this child belongs to the parent and is confirmed
        link = ParentChildLink.objects.get(parent=parent, student_id=child_id, is_confirmed=True)
        student = link.student
        
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
            
            # Overall term and year percentage
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
    except ParentChildLink.DoesNotExist:
        return Response({'error': 'Child not found or not confirmed'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def child_weekly_messages(request, child_id=None):
    """Get weekly messages from teachers about a child or all children"""
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        
        if child_id:
            # Get messages for specific child
            link = ParentChildLink.objects.get(parent=parent, student_id=child_id, is_confirmed=True)
            messages = WeeklyMessage.objects.filter(student=link.student).order_by('-date_sent')
        else:
            # Get messages for all confirmed children
            confirmed_children = ParentChildLink.objects.filter(
                parent=parent, 
                is_confirmed=True
            ).values_list('student_id', flat=True)
            messages = WeeklyMessage.objects.filter(student_id__in=confirmed_children).order_by('-date_sent')
        
        data = []
        for message in messages:
            data.append({
                'id': message.id,
                'subject': message.subject.name,
                'teacher': f"{message.teacher.user.first_name} {message.teacher.user.last_name}",
                'message': message.message,
                'date': message.date_sent.strftime('%Y-%m-%d'),
                'week_number': message.week_number,
                'performance_rating': message.performance_rating,
                'areas_of_improvement': message.areas_of_improvement or [],
                'strengths': message.strengths or []
            })
        
        return Response(data)
    except ParentChildLink.DoesNotExist:
        return Response({'error': 'Child not found or not confirmed'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def all_weekly_messages(request):
    """Get all weekly messages for all confirmed children"""
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        
        # Get messages for all confirmed children
        confirmed_children = ParentChildLink.objects.filter(
            parent=parent, 
            is_confirmed=True
        ).values_list('student_id', flat=True)
        messages = WeeklyMessage.objects.filter(student_id__in=confirmed_children).order_by('-date_sent')
        
        data = []
        for message in messages:
            data.append({
                'id': message.id,
                'subject': message.subject.name,
                'teacher': f"{message.teacher.user.first_name} {message.teacher.user.last_name}",
                'message': message.message,
                'date': message.date_sent.strftime('%Y-%m-%d'),
                'week_number': message.week_number,
                'performance_rating': message.performance_rating,
                'areas_of_improvement': message.areas_of_improvement or [],
                'strengths': message.strengths or [],
                'student_name': f"{message.student.user.first_name} {message.student.user.last_name}",
                'student_id': message.student.id
            })
        
        return Response(data)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def child_fees(request, child_id):
    """Get fee information for a specific child"""
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        # Verify this child belongs to the parent and is confirmed
        link = ParentChildLink.objects.get(parent=parent, student_id=child_id, is_confirmed=True)
        student = link.student
        
        # Get all fees for this student
        student_fees = StudentFee.objects.filter(student=student)
        
        # Calculate totals
        total_fees = sum(fee.amount_due for fee in student_fees)
        total_paid = sum(fee.amount_paid for fee in student_fees)
        outstanding = total_fees - total_paid
        
        # Build fees list
        fees_list = []
        for fee in student_fees:
            fee_status = 'paid' if fee.is_paid else 'pending'
            if not fee.is_paid and fee.due_date < timezone.now().date():
                fee_status = 'overdue'
            
            fees_list.append({
                'id': fee.id,
                'type': fee.fee_type.name,
                'amount': float(fee.amount_due),
                'due_date': fee.due_date.strftime('%Y-%m-%d'),
                'status': fee_status
            })
        
        # Get payment history
        payments = Payment.objects.filter(
            student_fee__student=student,
            payment_status='completed'
        ).order_by('-payment_date')
        
        payment_history = []
        for payment in payments:
            payment_history.append({
                'id': payment.id,
                'description': payment.student_fee.fee_type.name,
                'amount': float(payment.amount),
                'date': payment.payment_date.strftime('%Y-%m-%d')
            })
        
        data = {
            'total_fees': float(total_fees),
            'total_paid': float(total_paid),
            'outstanding': float(outstanding),
            'fees': fees_list,
            'payment_history': payment_history
        }
        
        return Response(data)
    except ParentChildLink.DoesNotExist:
        return Response({'error': 'Child not found or not confirmed'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)
