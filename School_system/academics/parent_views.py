import logging

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from datetime import datetime
from .models import (
    Parent, Student, ParentChildLink, Result, ClassAttendance, SubjectAttendance, Timetable
)
from .utils import MAX_PARENTS_PER_CHILD, check_rate_limit, log_school_audit
from finances.models import StudentFee, Payment, StudentPaymentRecord, PaymentTransaction
from finances.fee_calculator import build_school_fee_breakdown, get_additional_fees_for_student


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
                'residence_type': link.student.residence_type,
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
                'student_number': link.student.user.student_number or '',
                'residence_type': link.student.residence_type,
            })
        
        return Response(data)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_students(request):
    """Search for students by school + (name+surname OR student number) - privacy-focused endpoint"""
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        
        # Get search parameters
        school_id = request.query_params.get('school_id', '').strip()
        student_number = request.query_params.get('student_number', '').strip()
        first_name = request.query_params.get('first_name', '').strip()
        last_name = request.query_params.get('last_name', '').strip()
        
        # School selection is now required
        if not school_id:
            return Response({
                'error': 'Please select a school first',
                'hint': 'Search for your child\'s school, then search for your child within that school.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Base queryset filtered by school
        base_queryset = Student.objects.filter(
            user__school_id=school_id
        ).select_related('user', 'student_class')
        
        # Validate: must have either student_number OR (first_name AND last_name)
        if student_number:
            # Search by student number - must be at least 3 characters
            if len(student_number) < 3:
                return Response({
                    'error': 'Student number must be at least 3 characters'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            students = base_queryset.filter(
                user__student_number__icontains=student_number
            )[:10]
            
        elif first_name and last_name:
            # Search by name AND surname - both required, at least 2 chars each
            if len(first_name) < 2 or len(last_name) < 2:
                return Response({
                    'error': 'First name and last name must each be at least 2 characters'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            students = base_queryset.filter(
                user__first_name__icontains=first_name,
                user__last_name__icontains=last_name
            )[:10]
            
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
                'residence_type': student.residence_type,
                'school_name': student.user.school.name if student.user.school else None,
                'school_code': student.user.school.code if student.user.school else None,
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
    
    if check_rate_limit(request, group='parent_link_request', rate='10/m'):
        return Response({'error': 'Too many requests. Please try again shortly.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

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

        # Enforce max parents per child
        current_parent_count = Parent.objects.filter(children=student).count()
        if current_parent_count >= MAX_PARENTS_PER_CHILD:
            return Response({
                'error': f'This student already has the maximum of {MAX_PARENTS_PER_CHILD} parents linked.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
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
        log_school_audit(
            user=request.user,
            action='CREATE',
            model_name='ParentChildLinkRequest',
            object_id=link.id,
            object_repr=f"Parent {parent.id} requested student {student.id}",
            changes={'student_id': student.id, 'parent_id': parent.id, 'is_confirmed': False},
            status_code=status.HTTP_201_CREATED,
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        
        return Response({
            'id': student.id,
            'name': student.user.first_name,
            'surname': student.user.last_name,
            'class': student.student_class.name if student.student_class else 'Not Assigned',
            'student_number': student.user.student_number or '',
            'residence_type': student.residence_type,
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
    if request.user.role != 'admin':
        return Response({
            'error': 'Only administrators can approve parent-child links. Your request is pending admin approval.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Admin confirms any parent-child link
        link = ParentChildLink.objects.get(student_id=child_id)
        
        if link.is_confirmed:
            return Response({'message': 'Link already confirmed'}, 
                           status=status.HTTP_400_BAD_REQUEST)

        # Enforce max parents per child before confirming
        current_parent_count = Parent.objects.filter(children=link.student).count()
        if current_parent_count >= MAX_PARENTS_PER_CHILD:
            return Response({
                'error': f'Cannot approve link: this student already has {MAX_PARENTS_PER_CHILD} parents linked.'
            }, status=status.HTTP_400_BAD_REQUEST)

        link.is_confirmed = True
        link.confirmed_date = timezone.now()
        link.save()
        link.parent.children.add(link.student)
        log_school_audit(
            user=request.user,
            action='APPROVE',
            model_name='ParentChildLink',
            object_id=link.id,
            object_repr=f"Approved parent {link.parent_id} -> student {link.student_id}",
            changes={'is_confirmed': True, 'student_id': link.student_id, 'parent_id': link.parent_id},
            status_code=status.HTTP_200_OK,
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        
        return Response({
            'id': link.student.id,
            'name': link.student.user.first_name,
            'surname': link.student.user.last_name,
            'class': link.student.student_class.name if link.student.student_class else 'Not Assigned',
            'student_number': link.student.user.student_number or '',
            'residence_type': link.student.residence_type,
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
        
        # Get subjects the child is currently learning from their timetable
        subjects = []
        if student.student_class:
            subject_rows = (
                Timetable.objects.filter(
                    class_assigned=student.student_class,
                    class_assigned__school=request.user.school,
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
        
        # Calculate attendance percentage
        total_days = ClassAttendance.objects.filter(student=student).count()
        present_days = ClassAttendance.objects.filter(
            student=student,
            status__in=['present', 'late']
        ).count()
        attendance_percentage = round((present_days / total_days * 100), 1) if total_days > 0 else 100
        bunked_periods = SubjectAttendance.objects.filter(student=student, bunk_flag=True).count()
        
        # Calculate outstanding fees using the same logic/path as the Parent Fees page.
        school = request.user.school
        student_fees = StudentFee.objects.filter(student=student)
        fee_breakdown = build_school_fee_breakdown(student, school, parent=parent)
        additional_fees = get_additional_fees_for_student(student, school)

        legacy_total_fees = sum(float(fee.amount_due) for fee in student_fees)
        school_fee_total = float(fee_breakdown['total_school_fee'])
        additional_fees_total = sum(float(f.amount) for f in additional_fees)
        total_fees = school_fee_total + additional_fees_total + legacy_total_fees

        legacy_paid = sum(float(fee.amount_paid) for fee in student_fees)
        payment_records_paid = sum(
            float(record.amount_paid)
            for record in StudentPaymentRecord.objects.filter(
                student=student,
                school=school,
            )
        )
        total_paid = legacy_paid + payment_records_paid
        outstanding_fees = max(total_fees - total_paid, 0)
        
        data = {
            'overall_average': avg_percentage,
            'total_subjects': total_subjects,
            'subjects': subjects,
            'attendance_percentage': attendance_percentage,
            'bunked_periods': bunked_periods,
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
        school = request.user.school

        # Legacy per-student fees (still supported)
        student_fees = StudentFee.objects.filter(student=student)

        fee_breakdown = build_school_fee_breakdown(student, school, parent=parent)
        additional_fees = get_additional_fees_for_student(student, school)

        legacy_total_fees = sum(float(fee.amount_due) for fee in student_fees)
        school_fee_total = float(fee_breakdown['total_school_fee'])
        additional_fees_total = sum(float(f.amount) for f in additional_fees)
        total_fees = school_fee_total + additional_fees_total + legacy_total_fees

        # Paid amounts from both legacy and new payment-record paths.
        legacy_paid = sum(float(fee.amount_paid) for fee in student_fees)
        payment_records_paid = sum(
            float(record.amount_paid) for record in StudentPaymentRecord.objects.filter(
                student=student,
                school=school,
            )
        )
        total_paid = legacy_paid + payment_records_paid
        outstanding = max(total_fees - total_paid, 0)
        
        # Build fees list
        today_str = timezone.now().date().strftime('%Y-%m-%d')
        fees_list = []

        # Current school fee structure (applies by child residence type)
        if fee_breakdown['school_fee']:
            fees_list.extend([
                {'id': 'sf-tuition', 'type': 'Tuition Fee', 'amount': float(fee_breakdown['tuition']), 'due_date': today_str, 'status': 'pending'},
                {'id': 'sf-levy', 'type': 'Levy Fee', 'amount': float(fee_breakdown['levy']), 'due_date': today_str, 'status': 'pending'},
                {'id': 'sf-sports', 'type': 'Sports Fee', 'amount': float(fee_breakdown['sports']), 'due_date': today_str, 'status': 'pending'},
                {'id': 'sf-computer', 'type': 'Computer Fee', 'amount': float(fee_breakdown['computer']), 'due_date': today_str, 'status': 'pending'},
                {'id': 'sf-other', 'type': 'Other Fees', 'amount': float(fee_breakdown['other']), 'due_date': today_str, 'status': 'pending'},
            ])

            if fee_breakdown['boarding_applied'] and fee_breakdown['boarding'] > 0:
                fees_list.append({
                    'id': 'sf-boarding',
                    'type': 'Boarding Fee',
                    'amount': float(fee_breakdown['boarding']),
                    'due_date': today_str,
                    'status': 'pending',
                })

            if fee_breakdown['transport'] > 0:
                fees_list.append({
                    'id': 'sf-transport',
                    'type': 'Transport Fee',
                    'amount': float(fee_breakdown['transport']),
                    'due_date': today_str,
                    'status': 'pending',
                })

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
        
        # Add additional fees to the fees list
        for af in additional_fees:
            fees_list.append({
                'id': f'af-{af.id}',
                'type': af.fee_name,
                'amount': float(af.amount),
                'due_date': af.created_at.strftime('%Y-%m-%d') if af.created_at else None,
                'status': 'pending',
                'reason': af.reason
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

        payment_transactions = PaymentTransaction.objects.filter(
            payment_record__student=student,
            payment_record__school=school,
        ).order_by('-payment_date')[:20]
        for tx in payment_transactions:
            payment_history.append({
                'id': f'ptr-{tx.id}',
                'description': f"{tx.payment_record.get_payment_type_display()} payment",
                'amount': float(tx.amount),
                'date': tx.payment_date.strftime('%Y-%m-%d')
            })
        payment_history = sorted(payment_history, key=lambda p: p['date'], reverse=True)
        
        data = {
            'total_fees': float(total_fees),
            'total_paid': float(total_paid),
            'outstanding': float(outstanding),
            'fees': fees_list,
            'payment_history': payment_history,
            'additional_fees_total': additional_fees_total,
            'residence_type': student.residence_type,
            'transport': {
                'available': bool(fee_breakdown['transport_available']),
                'configured_amount': float(fee_breakdown['transport_configured']),
                'include_transport_fee': bool(fee_breakdown['transport_opted_in']),
                'applied_amount': float(fee_breakdown['transport']),
            },
            'boarding': {
                'applied': bool(fee_breakdown['boarding_applied']),
                'amount': float(fee_breakdown['boarding']),
            },
        }
        
        return Response(data)
    except ParentChildLink.DoesNotExist:
        return Response({'error': 'Child not found or not confirmed'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)
    if check_rate_limit(request, group='parent_link_approve', rate='20/m'):
        return Response({'error': 'Too many requests. Please try again shortly.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
