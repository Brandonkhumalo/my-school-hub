import logging
import uuid
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum, Q, Count
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)

from email_service import (
    send_payment_received_email,
    send_fee_assigned_to_student_email,
    send_grade_fee_notice_email,
    get_parents_of_student,
)
from .models import (
    FeeType,
    StudentFee,
    Payment,
    Invoice,
    FinancialReport,
    SchoolFees,
    StudentPaymentRecord,
    PaymentTransaction,
    PaymentIntent,
    AdditionalFee,
    TransportFeePreference,
)
from academics.models import Student, Class, ParentChildLink
from .fee_calculator import (
    build_school_fee_breakdown,
    get_additional_fees_for_student,
    get_unpaid_additional_fees_for_record,
    get_additional_fees_total_for_record,
)
from .serializers import (
    FeeTypeSerializer, StudentFeeSerializer, PaymentSerializer,
    InvoiceSerializer, FinancialReportSerializer, CreatePaymentSerializer,
    StudentFinancialSummarySerializer, SchoolFeesSerializer,
    StudentPaymentRecordSerializer, CreatePaymentRecordSerializer,
    AddPaymentSerializer, InvoiceDetailSerializer, PaymentTransactionSerializer,
    AdditionalFeeSerializer
)


# Fee Type Views
class FeeTypeListCreateView(generics.ListCreateAPIView):
    """Represents FeeTypeListCreateView."""
    queryset = FeeType.objects.all()
    serializer_class = FeeTypeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        if user.school:
            queryset = FeeType.objects.filter(school=user.school)
        else:
            queryset = FeeType.objects.none()
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        return queryset
    
    def perform_create(self, serializer):
        """Execute perform create."""
        serializer.save(school=self.request.user.school)


class FeeTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents FeeTypeDetailView."""
    queryset = FeeType.objects.all()
    serializer_class = FeeTypeSerializer
    permission_classes = [permissions.IsAuthenticated]


# Student Fee Views
class StudentFeeListCreateView(generics.ListCreateAPIView):
    """Represents StudentFeeListCreateView."""
    queryset = StudentFee.objects.all()
    serializer_class = StudentFeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user

        # Filter by school first
        if user.school:
            queryset = StudentFee.objects.filter(student__user__school=user.school).select_related(
                'student__user', 'fee_type'
            )
        else:
            queryset = StudentFee.objects.none()

        # Filter by user role
        if user.role == 'student':
            queryset = queryset.filter(student__user=user)
        elif user.role == 'parent':
            children_ids = user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_id__in=children_ids)
        
        # Additional filters
        student_id = self.request.query_params.get('student')
        is_paid = self.request.query_params.get('is_paid')
        academic_year = self.request.query_params.get('academic_year')
        academic_term = self.request.query_params.get('academic_term')
        
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if is_paid is not None:
            queryset = queryset.filter(is_paid=is_paid.lower() == 'true')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        if academic_term:
            queryset = queryset.filter(academic_term=academic_term)
            
        return queryset.order_by('-due_date')


class StudentFeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents StudentFeeDetailView."""
    queryset = StudentFee.objects.all()
    serializer_class = StudentFeeSerializer
    permission_classes = [permissions.IsAuthenticated]


# Payment Views
class PaymentListCreateView(generics.ListCreateAPIView):
    """Represents PaymentListCreateView."""
    queryset = Payment.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        """Return serializer class."""
        if self.request.method == 'POST':
            return CreatePaymentSerializer
        return PaymentSerializer

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user

        # Filter by school first
        if user.school:
            queryset = Payment.objects.filter(student_fee__student__user__school=user.school).select_related(
                'student_fee__student__user', 'student_fee__fee_type', 'processed_by'
            )
        else:
            queryset = Payment.objects.none()

        # Filter by user role
        if user.role == 'student':
            queryset = queryset.filter(student_fee__student__user=user)
        elif user.role == 'parent':
            children_ids = user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_fee__student_id__in=children_ids)
        
        # Additional filters
        student_id = self.request.query_params.get('student')
        payment_status = self.request.query_params.get('status')
        payment_method = self.request.query_params.get('method')
        
        if student_id:
            queryset = queryset.filter(student_fee__student_id=student_id)
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)
            
        return queryset.order_by('-payment_date')

    def perform_create(self, serializer):
        """Execute perform create."""
        payment = serializer.save(processed_by=self.request.user)
        # Notify parents of the student that a payment was recorded
        try:
            student = payment.student_fee.student
            school_name = student.user.school.name if student.user.school else "Your School"
            class_name = student.student_class.name if student.student_class else "N/A"
            student_name = f"{student.user.first_name} {student.user.last_name}".strip()
            for p in get_parents_of_student(student):
                send_payment_received_email(
                    parent_email=p['email'],
                    parent_name=p['name'],
                    school_name=school_name,
                    student_name=student_name,
                    class_name=class_name,
                    amount_usd=str(payment.amount),
                    payment_method=payment.payment_method or "cash",
                    reference=payment.transaction_id or "",
                )
        except Exception as exc:
            logger.error("Payment email notification failed: %s", exc)


class PaymentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents PaymentDetailView."""
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]


# Invoice Views
class InvoiceListCreateView(generics.ListCreateAPIView):
    """Represents InvoiceListCreateView."""
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        
        # Filter by school first
        if user.school:
            queryset = Invoice.objects.filter(student__user__school=user.school).select_related(
                'student__user', 'school'
            )
        else:
            queryset = Invoice.objects.none()
        
        # Filter by user role
        if user.role == 'student':
            queryset = queryset.filter(student__user=user)
        elif user.role == 'parent':
            children_ids = user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_id__in=children_ids)
        
        # Additional filters
        student_id = self.request.query_params.get('student')
        is_paid = self.request.query_params.get('is_paid')
        
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if is_paid is not None:
            queryset = queryset.filter(is_paid=is_paid.lower() == 'true')
            
        return queryset.order_by('-issue_date')


class InvoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents InvoiceDetailView."""
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]


# Financial Report Views
class FinancialReportListCreateView(generics.ListCreateAPIView):
    """Represents FinancialReportListCreateView."""
    queryset = FinancialReport.objects.all()
    serializer_class = FinancialReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        
        # Only accountants and admins can view financial reports
        if user.role not in ['accountant', 'admin']:
            return FinancialReport.objects.none()
        
        # Filter by school
        if user.school:
            queryset = FinancialReport.objects.filter(generated_by__school=user.school)
        else:
            queryset = FinancialReport.objects.none()
        
        report_type = self.request.query_params.get('type')
        academic_year = self.request.query_params.get('academic_year')
        
        if report_type:
            queryset = queryset.filter(report_type=report_type)
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
            
        return queryset.order_by('-date_generated')

    def perform_create(self, serializer):
        """Execute perform create."""
        report = serializer.save(generated_by=self.request.user)
        # Enqueue heavy aggregation as a background task — do not block the request
        from .tasks import generate_financial_report_task
        generate_financial_report_task.delay(report.id)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_financial_summary(request, student_id):
    """Get comprehensive financial summary for a student"""
    try:
        student = Student.objects.get(id=student_id)
        
        # Check permissions
        if request.user.role == 'student' and request.user.student.id != student_id:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        elif request.user.role == 'parent':
            from academics.models import ParentChildLink
            if not ParentChildLink.objects.filter(
                parent=request.user.parent, student_id=student_id, is_confirmed=True
            ).exists():
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Calculate financial summary
        fees = StudentFee.objects.filter(student=student)
        payments = Payment.objects.filter(student_fee__student=student, payment_status='completed')
        
        total_fees_due = fees.aggregate(total=Sum('amount_due'))['total'] or 0
        total_fees_paid = fees.aggregate(total=Sum('amount_paid'))['total'] or 0
        
        # Include additional fees
        additional_fees = AdditionalFee.objects.filter(
            school=student.user.school,
            is_paid=False
        ).filter(Q(student=student) | Q(student_class=student.student_class))
        additional_fees_total = sum(float(f.amount) for f in additional_fees)
        additional_fees_list = [{'name': f.fee_name, 'amount': float(f.amount), 'reason': f.reason} for f in additional_fees]
        
        total_fees_due = float(total_fees_due) + additional_fees_total
        total_balance = total_fees_due - float(total_fees_paid)
        unpaid_fees_count = fees.filter(is_paid=False).count()
        
        # Get recent payments and pending fees
        recent_payments = payments.order_by('-payment_date')[:5]
        pending_fees = fees.filter(is_paid=False).order_by('due_date')
        
        summary_data = {
            'student_id': student.id,
            'student_name': student.user.full_name,
            'student_number': student.user.student_number,
            'total_fees_due': total_fees_due,
            'total_fees_paid': total_fees_paid,
            'total_balance': total_balance,
            'unpaid_fees_count': unpaid_fees_count,
            'recent_payments': PaymentSerializer(recent_payments, many=True).data,
            'pending_fees': StudentFeeSerializer(pending_fees, many=True).data,
            'additional_fees': additional_fees_list,
            'additional_fees_total': additional_fees_total
        }
        
        return Response(summary_data)
        
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def process_whatsapp_payment(request):
    """Process payment made through WhatsApp"""
    if request.user.role not in ['student', 'parent']:
        return Response({'error': 'Only students and parents can make WhatsApp payments'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    student_fee_id = request.data.get('student_fee_id')
    amount = request.data.get('amount')
    payment_reference = request.data.get('payment_reference')
    
    try:
        student_fee = StudentFee.objects.get(id=student_fee_id)
        
        # Validate permission
        if request.user.role == 'student':
            if student_fee.student.user != request.user:
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        elif request.user.role == 'parent':
            from academics.models import ParentChildLink
            if not ParentChildLink.objects.filter(
                parent=request.user.parent, student_id=student_fee.student.id, is_confirmed=True
            ).exists():
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Create payment record
        payment = Payment.objects.create(
            student_fee=student_fee,
            amount=amount,
            payment_method='whatsapp',
            payment_status='completed',
            transaction_id=payment_reference,
            processed_by=request.user,
            notes=f'WhatsApp payment processed automatically'
        )
        
        # Update student fee
        # Prevent negative payment fraud
        if float(amount) <= 0:
            return Response({'error': 'Payment amount must be positive'}, status=status.HTTP_400_BAD_REQUEST)

        student_fee.amount_paid += float(amount)
        if student_fee.amount_paid >= student_fee.amount_due:
            student_fee.is_paid = True
        student_fee.save()
        
        return Response({
            'message': 'Payment processed successfully',
            'payment': PaymentSerializer(payment).data
        })
        
    except StudentFee.DoesNotExist:
        return Response({'error': 'Student fee not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class SchoolFeesListCreateView(generics.ListCreateAPIView):
    """Represents SchoolFeesListCreateView."""
    queryset = SchoolFees.objects.all()
    serializer_class = SchoolFeesSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        
        # Filter by school
        if user.school:
            queryset = SchoolFees.objects.filter(school=user.school)
        else:
            queryset = SchoolFees.objects.none()
        
        academic_year = self.request.query_params.get('academic_year')
        academic_term = self.request.query_params.get('academic_term')
        grade_level = self.request.query_params.get('grade_level')
        
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        if academic_term:
            queryset = queryset.filter(academic_term=academic_term)
        if grade_level:
            queryset = queryset.filter(grade_level=grade_level)
            
        return queryset.order_by('grade_level', 'academic_term')

    def perform_create(self, serializer):
        """Execute perform create."""
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can create school fees")
        fee = serializer.save(created_by=self.request.user, school=self.request.user.school)
        # Notify parents of all students in this grade
        try:
            from academics.models import Student
            school = self.request.user.school
            school_name = school.name if school else "Your School"
            students_in_grade = Student.objects.filter(
                user__school=school,
                student_class__grade_level=fee.grade_level,
            ).select_related('user', 'student_class')
            for student in students_in_grade:
                student_name = f"{student.user.first_name} {student.user.last_name}".strip()
                class_name = student.student_class.name if student.student_class else "N/A"
                for p in get_parents_of_student(student):
                    send_grade_fee_notice_email(
                        parent_email=p['email'],
                        parent_name=p['name'],
                        school_name=school_name,
                        student_name=student_name,
                        class_name=class_name,
                        grade_level=str(fee.grade_level),
                        academic_year=fee.academic_year or "",
                        academic_term=fee.academic_term or "",
                        tuition_fee=str(fee.tuition_fee or 0),
                        levy_fee=str(fee.levy_fee or 0),
                        sports_fee=str(fee.sports_fee or 0),
                        computer_fee=str(fee.computer_fee or 0),
                        other_fees=str(fee.other_fees or 0),
                    )
        except Exception as exc:
            logger.error("Grade fee notice email failed: %s", exc)


class SchoolFeesDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents SchoolFeesDetailView."""
    queryset = SchoolFees.objects.all()
    serializer_class = SchoolFeesSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        if user.school:
            return SchoolFees.objects.filter(school=user.school)
        return SchoolFees.objects.none()
    
    def perform_update(self, serializer):
        """Execute perform update."""
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can update school fees")
        serializer.save()
    
    def perform_destroy(self, instance):
        """Execute perform destroy."""
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can delete school fees")
        instance.delete()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_my_school_fees(request):
    """Get school fees for a student or parent's children based on their grade/form"""
    user = request.user
    school = user.school
    
    if user.role == 'student':
        try:
            student = user.student
            student_class = student.student_class
            grade_level = student_class.grade_level if student_class else None

            fee_breakdown = build_school_fee_breakdown(student, school)
            school_fee_row = fee_breakdown['school_fee']

            fees = []
            if school_fee_row:
                fees = SchoolFeesSerializer([school_fee_row], many=True).data

            additional_fees = get_additional_fees_for_student(student, school)
            additional_fees_list = [
                {'name': f.fee_name, 'amount': float(f.amount), 'reason': f.reason, 'currency': f.currency}
                for f in additional_fees
            ]
            additional_fees_total = sum(float(f.amount) for f in additional_fees)
            
            return Response({
                'student_name': user.full_name,
                'student_number': user.student_number,
                'class_name': student_class.name if student_class else None,
                'grade_level': grade_level,
                'residence_type': student.residence_type,
                'fees': fees,
                'applied_school_fee_total': float(fee_breakdown['total_school_fee']),
                'boarding_fee_applied': float(fee_breakdown['boarding']),
                'transport_fee_applied': float(fee_breakdown['transport']),
                'transport_fee_opted_in': fee_breakdown['transport_opted_in'],
                'additional_fees': additional_fees_list,
                'additional_fees_total': additional_fees_total
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    elif user.role == 'parent':
        try:
            confirmed_links = ParentChildLink.objects.filter(
                parent=user.parent,
                is_confirmed=True
            ).select_related('student__student_class', 'student__user')
            
            children_fees = []
            for link in confirmed_links:
                student = link.student
                student_class = student.student_class
                grade_level = student_class.grade_level if student_class else None

                fee_breakdown = build_school_fee_breakdown(student, school, parent=user.parent)
                school_fee_row = fee_breakdown['school_fee']
                fees = []
                if school_fee_row:
                    fees = SchoolFeesSerializer([school_fee_row], many=True).data

                additional_fees = get_additional_fees_for_student(student, school)
                additional_fees_list = [
                    {'name': f.fee_name, 'amount': float(f.amount), 'reason': f.reason, 'currency': f.currency}
                    for f in additional_fees
                ]
                additional_fees_total = sum(float(f.amount) for f in additional_fees)
                
                children_fees.append({
                    'student_id': student.id,
                    'student_name': student.user.full_name,
                    'student_number': student.user.student_number,
                    'class_name': student_class.name if student_class else None,
                    'grade_level': grade_level,
                    'residence_type': student.residence_type,
                    'fees': fees,
                    'applied_school_fee_total': float(fee_breakdown['total_school_fee']),
                    'boarding_fee_applied': float(fee_breakdown['boarding']),
                    'transport_fee_applied': float(fee_breakdown['transport']),
                    'transport_fee_opted_in': fee_breakdown['transport_opted_in'],
                    'additional_fees': additional_fees_list,
                    'additional_fees_total': additional_fees_total
                })
            
            return Response({'children_fees': children_fees})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    return Response({'error': 'Invalid user role'}, status=status.HTTP_403_FORBIDDEN)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_all_grades(request):
    """Get all unique grade levels from classes for the fees dropdown"""
    if request.user.role != 'admin':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    grades = Class.objects.values('grade_level', 'name').distinct().order_by('grade_level')
    
    grade_list = []
    seen_levels = set()
    for g in grades:
        if g['grade_level'] not in seen_levels:
            seen_levels.add(g['grade_level'])
            grade_list.append({
                'grade_level': g['grade_level'],
                'grade_name': g['name']
            })
    
    return Response({'grades': grade_list})


class StudentPaymentRecordListCreateView(generics.ListCreateAPIView):
    """Represents StudentPaymentRecordListCreateView."""
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        """Return serializer class."""
        if self.request.method == 'POST':
            return CreatePaymentRecordSerializer
        return StudentPaymentRecordSerializer

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        
        if user.role not in ['admin', 'accountant']:
            return StudentPaymentRecord.objects.none()
        
        if user.school:
            queryset = StudentPaymentRecord.objects.filter(school=user.school)
        else:
            queryset = StudentPaymentRecord.objects.none()
        
        student_id = self.request.query_params.get('student')
        class_id = self.request.query_params.get('class_id')
        payment_status = self.request.query_params.get('status')
        payment_type = self.request.query_params.get('type')
        academic_year = self.request.query_params.get('academic_year')
        
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if class_id:
            queryset = queryset.filter(student__student_class_id=class_id)
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)
        if payment_type:
            queryset = queryset.filter(payment_type=payment_type)
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
            
        return queryset.order_by('-date_created')

    def perform_create(self, serializer):
        """Execute perform create."""
        record = serializer.save()
        # Notify parents that a fee has been assigned to their child
        try:
            student = record.student
            school_name = student.user.school.name if student.user.school else "Your School"
            class_name = student.student_class.name if student.student_class else "N/A"
            student_name = f"{student.user.first_name} {student.user.last_name}".strip()
            for p in get_parents_of_student(student):
                send_fee_assigned_to_student_email(
                    parent_email=p['email'],
                    parent_name=p['name'],
                    school_name=school_name,
                    student_name=student_name,
                    class_name=class_name,
                    amount_usd=str(record.total_amount_due),
                    academic_year=record.academic_year or "",
                    payment_type=record.payment_type or "one_term",
                )
        except Exception as exc:
            logger.error("Fee assignment email notification failed: %s", exc)


class StudentPaymentRecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents StudentPaymentRecordDetailView."""
    serializer_class = StudentPaymentRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        if user.school:
            return StudentPaymentRecord.objects.filter(school=user.school)
        return StudentPaymentRecord.objects.none()

    def perform_destroy(self, instance):
        """Only admin can delete payment records; recalculate related balances."""
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can delete payment records.")

        student = instance.student
        school = instance.school
        academic_year = instance.academic_year
        academic_term = instance.academic_term or ''

        with transaction.atomic():
            # Delete snapshot invoices linked to this payment record to avoid stale orphan invoices.
            Invoice.objects.filter(payment_record=instance, school=school).delete()
            instance.delete()
            _recalculate_additional_fees_for_student(student, school, academic_year, academic_term)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def add_payment_to_record(request):
    """Add a payment to an existing payment record"""
    if request.user.role not in ['admin', 'accountant']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = AddPaymentSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        payment_record = serializer.save()
        return Response({
            'message': 'Payment added successfully',
            'payment_record': StudentPaymentRecordSerializer(payment_record).data
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def update_payment_status(request, record_id):
    """Mark a payment record as paid/unpaid/partial"""
    if request.user.role not in ['admin', 'accountant']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        record = StudentPaymentRecord.objects.get(id=record_id, school=request.user.school)
        new_status = request.data.get('status')
        
        if new_status not in ['unpaid', 'partial', 'paid']:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        
        if new_status == 'unpaid':
            return Response(
                {'error': 'Direct unpaid override is disabled. Use transaction reversal/adjustment flow.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == 'paid':
            outstanding = _record_balance(record)
            if outstanding > 0:
                _apply_payment_to_record(
                    record,
                    outstanding,
                    method='other',
                    actor=request.user,
                    notes='Manual paid status adjustment',
                )
            record.payment_status = 'paid'
            record.save(update_fields=['payment_status', 'date_updated'])
        else:
            # For partial, keep amounts unchanged and derive status from recorded amount.
            record.payment_status = 'partial' if record.amount_paid > 0 else 'unpaid'
            record.save(update_fields=['payment_status', 'date_updated'])
        
        return Response({
            'message': 'Status updated successfully',
            'payment_record': StudentPaymentRecordSerializer(record).data
        })
    except StudentPaymentRecord.DoesNotExist:
        return Response({'error': 'Payment record not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def class_fees_report(request):
    """Get class-based fees report showing paid/unpaid students"""
    if request.user.role not in ['admin', 'accountant']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    class_id = request.query_params.get('class_id')
    academic_year = request.query_params.get('academic_year')
    
    if not request.user.school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not class_id:
        return Response({'reports': [], 'message': 'Please select a class'})
    
    try:
        cls = Class.objects.get(id=class_id, school=request.user.school)
    except Class.DoesNotExist:
        return Response({'error': 'Class not found'}, status=status.HTTP_404_NOT_FOUND)
    
    students = Student.objects.filter(student_class=cls)
    
    paid_count = 0
    partial_count = 0
    unpaid_count = 0
    total_due = 0
    total_collected = 0
    student_data = []
    
    for student in students:
        fee_breakdown = build_school_fee_breakdown(student, request.user.school)
        additional_fees = get_additional_fees_for_student(student, request.user.school)
        additional_fees_total = sum(float(f.amount) for f in additional_fees)
        
        records = StudentPaymentRecord.objects.filter(
            student=student,
            school=request.user.school
        )
        if academic_year:
            records = records.filter(academic_year=academic_year)
        
        if records.exists():
            student_due = sum(float(_record_total_due(r)) for r in records)
            student_paid = sum(float(r.amount_paid) for r in records)
            student_balance = student_due - student_paid
            
            latest_record = records.first()
            if student_balance <= 0:
                paid_count += 1
                status_text = 'Paid'
            elif student_paid > 0:
                partial_count += 1
                status_text = 'Partial'
            else:
                unpaid_count += 1
                status_text = 'Unpaid'
        else:
            base_due = float(fee_breakdown['total_school_fee']) + additional_fees_total
            student_due = base_due
            student_paid = 0
            student_balance = student_due
            unpaid_count += 1
            status_text = 'No Record'
        
        total_due += student_due
        total_collected += student_paid
        
        student_data.append({
            'student_id': student.id,
            'student_name': student.user.full_name,
            'student_number': student.user.student_number,
            'total_due': float(student_due),
            'total_paid': float(student_paid),
            'balance': float(student_balance),
            'status': status_text
        })
    
    report = {
        'class_id': cls.id,
        'class_name': cls.name,
        'total_students': students.count(),
        'paid_count': paid_count,
        'partial_count': partial_count,
        'unpaid_count': unpaid_count,
        'total_due': float(total_due),
        'total_collected': float(total_collected),
        'total_outstanding': float(total_due - total_collected),
        'students': student_data
    }
    
    return Response({'reports': [report]})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_invoice_detail(request, invoice_id):
    """Get detailed invoice for PDF generation"""
    try:
        if request.user.school:
            invoice = Invoice.objects.get(id=invoice_id, school=request.user.school)
        else:
            invoice = Invoice.objects.get(id=invoice_id, student__user__school=request.user.school)
        
        if request.user.role == 'parent':
            from academics.models import ParentChildLink
            links = ParentChildLink.objects.filter(parent=request.user.parent, is_confirmed=True)
            child_ids = [link.student_id for link in links]
            if invoice.student_id not in child_ids:
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        return Response(InvoiceDetailSerializer(invoice).data)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def parent_invoices(request):
    """Get all invoices for parent's children - includes auto-generated from school fees"""
    if request.user.role != 'parent':
        return Response({'error': 'Parent access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        from datetime import date, timedelta
        
        links = ParentChildLink.objects.filter(
            parent=request.user.parent,
            is_confirmed=True,
        ).select_related('student__user', 'student__student_class')
        
        invoices_data = []
        
        for link in links:
            student = link.student
            grade_level = student.student_class.grade_level if student.student_class else None
            
            # Get existing invoices for this student
            existing_invoices = Invoice.objects.filter(
                student=student,
                school=request.user.school,
            ).order_by('-issue_date')
            
            for inv in existing_invoices:
                invoices_data.append({
                    'id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'payment_record_id': inv.payment_record_id,
                    'student_id': student.id,
                    'student_name': student.user.full_name,
                    'student_number': student.user.student_number,
                    'class_name': student.student_class.name if student.student_class else 'N/A',
                    'issue_date': inv.issue_date.strftime('%Y-%m-%d'),
                    'due_date': inv.due_date.strftime('%Y-%m-%d'),
                    'total_amount': float(inv.total_amount),
                    'amount_paid': float(inv.amount_paid),
                    'balance': float(inv.balance),
                    'status': 'paid' if inv.is_paid else ('partial' if inv.amount_paid > 0 else 'unpaid'),
                    'is_auto_generated': False,
                    'currency': inv.payment_record.currency if inv.payment_record else 'USD'
                })
            
            # If no invoice exists yet, persist invoice snapshots from payment records.
            if not existing_invoices.exists():
                payment_records = StudentPaymentRecord.objects.filter(
                    student=student,
                    school=request.user.school,
                ).order_by('-date_created')
                for record in payment_records:
                    total_due = _record_total_due(record)
                    if total_due <= 0:
                        continue
                    new_invoice = Invoice.objects.create(
                        student=student,
                        school=request.user.school,
                        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
                        total_amount=total_due,
                        amount_paid=record.amount_paid,
                        due_date=record.due_date or (date.today() + timedelta(days=30)),
                        is_paid=_record_balance(record) <= 0,
                        payment_record=record,
                        notes=f"Snapshot invoice for {record.get_payment_type_display()} {record.academic_year} {record.academic_term}",
                    )
                    invoices_data.append({
                        'id': new_invoice.id,
                        'invoice_number': new_invoice.invoice_number,
                        'payment_record_id': record.id,
                        'student_id': student.id,
                        'student_name': student.user.full_name,
                        'student_number': student.user.student_number,
                        'class_name': student.student_class.name if student.student_class else 'N/A',
                        'issue_date': new_invoice.issue_date.strftime('%Y-%m-%d'),
                        'due_date': new_invoice.due_date.strftime('%Y-%m-%d'),
                        'total_amount': float(new_invoice.total_amount),
                        'amount_paid': float(new_invoice.amount_paid),
                        'balance': float(new_invoice.balance),
                        'status': 'paid' if new_invoice.is_paid else ('partial' if new_invoice.amount_paid > 0 else 'unpaid'),
                        'is_auto_generated': True,
                        'currency': record.currency or 'USD',
                        'academic_year': record.academic_year,
                        'academic_term': record.academic_term,
                    })
        
        return Response({'invoices': invoices_data})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
def parent_transport_preference(request, child_id):
    """Get or update a parent's transport fee preference for a specific child."""
    if request.user.role != 'parent':
        return Response({'error': 'Parent access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        link = ParentChildLink.objects.select_related('student__student_class').get(
            parent=request.user.parent,
            student_id=child_id,
            is_confirmed=True,
        )
    except ParentChildLink.DoesNotExist:
        return Response({'error': 'Child not found or not confirmed for this parent.'}, status=status.HTTP_404_NOT_FOUND)

    student = link.student
    preference, _ = TransportFeePreference.objects.get_or_create(
        parent=request.user.parent,
        student=student,
        defaults={'updated_by': request.user},
    )

    if request.method == 'PUT':
        raw_value = request.data.get('include_transport_fee')
        if isinstance(raw_value, bool):
            include_transport_fee = raw_value
        elif isinstance(raw_value, int):
            include_transport_fee = bool(raw_value)
        elif isinstance(raw_value, str):
            if raw_value.strip().lower() in ('true', '1', 'yes', 'on'):
                include_transport_fee = True
            elif raw_value.strip().lower() in ('false', '0', 'no', 'off'):
                include_transport_fee = False
            else:
                return Response({'error': 'include_transport_fee must be true or false.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'include_transport_fee is required.'}, status=status.HTTP_400_BAD_REQUEST)

        preference.include_transport_fee = include_transport_fee
        preference.updated_by = request.user
        preference.save(update_fields=['include_transport_fee', 'updated_by', 'updated_at'])

    fee_breakdown = build_school_fee_breakdown(
        student,
        request.user.school,
        parent=request.user.parent,
    )

    return Response({
        'student_id': student.id,
        'include_transport_fee': preference.include_transport_fee,
        'transport_fee_available': bool(fee_breakdown['transport_available']),
        'configured_transport_fee': float(fee_breakdown['transport_configured']),
        'applied_transport_fee': float(fee_breakdown['transport']),
        'updated_at': preference.updated_at,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_students_for_payment(request):
    """Get list of students for payment recording"""
    if request.user.role not in ['admin', 'accountant']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    class_id = request.query_params.get('class_id')
    
    students = Student.objects.filter(user__school=request.user.school)
    if class_id:
        students = students.filter(student_class_id=class_id)
    
    student_list = []
    for student in students:
        grade_level = student.student_class.grade_level if student.student_class else None

        fee_breakdown = build_school_fee_breakdown(student, request.user.school)
        additional_fees = get_additional_fees_for_student(student, request.user.school)
        additional_fees_total = sum(float(f.amount) for f in additional_fees)
        
        school_fee = None
        fee_row = fee_breakdown['school_fee']
        if fee_row:
            school_fee = {
                'total_fee': float(fee_breakdown['total_school_fee']) + additional_fees_total,
                'base_fee': float(fee_breakdown['tuition'] + fee_breakdown['levy'] + fee_breakdown['sports'] + fee_breakdown['computer'] + fee_breakdown['other']),
                'boarding_fee': float(fee_breakdown['boarding']),
                'transport_fee': float(fee_breakdown['transport']),
                'transport_opted_in': bool(fee_breakdown['transport_opted_in']),
                'additional_fees_total': additional_fees_total,
                'currency': fee_row.currency,
                'academic_year': fee_row.academic_year,
                'academic_term': fee_row.academic_term
            }
        elif additional_fees_total > 0:
            school_fee = {
                'total_fee': additional_fees_total,
                'base_fee': 0,
                'boarding_fee': 0,
                'transport_fee': 0,
                'transport_opted_in': False,
                'additional_fees_total': additional_fees_total,
                'currency': 'USD',
                'academic_year': str(timezone.now().year),
                'academic_term': 'term_1'
            }
        
        student_list.append({
            'id': student.id,
            'name': student.user.full_name,
            'student_number': student.user.student_number,
            'class_name': student.student_class.name if student.student_class else 'Not Assigned',
            'class_id': student.student_class.id if student.student_class else None,
            'grade_level': grade_level,
            'school_fee': school_fee
        })
    
    return Response({'students': student_list})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_invoices_by_class(request):
    """
    Auto-generate invoices for all students in a class based on their school fees.
    Shows both outstanding (unpaid) and paid invoices.
    """
    user = request.user
    if user.role not in ['admin', 'accountant']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    class_id = request.query_params.get('class_id')
    if not class_id:
        return Response({'invoices': []})
    
    from datetime import date, timedelta
    import uuid
    
    # Get all students in the class
    students = Student.objects.filter(
        user__school=user.school,
        student_class_id=class_id
    ).select_related('user', 'student_class')
    
    invoices_data = []
    
    for student in students:
        grade_level = student.student_class.grade_level if student.student_class else None
        
        # Check if student has an existing invoice (from payment record)
        existing_invoice = Invoice.objects.filter(
            student=student,
            school=user.school
        ).order_by('-issue_date').first()
        
        if existing_invoice:
            # Use existing invoice
            invoices_data.append({
                'id': existing_invoice.id,
                'invoice_number': existing_invoice.invoice_number,
                'payment_record_id': existing_invoice.payment_record_id,
                'student_id': student.id,
                'student_name': student.user.full_name,
                'student_number': student.user.student_number,
                'class_name': student.student_class.name if student.student_class else 'N/A',
                'issue_date': existing_invoice.issue_date.strftime('%Y-%m-%d'),
                'due_date': existing_invoice.due_date.strftime('%Y-%m-%d'),
                'total_amount': float(existing_invoice.total_amount),
                'amount_paid': float(existing_invoice.amount_paid),
                'balance': float(existing_invoice.balance),
                'status': 'paid' if existing_invoice.is_paid else ('partial' if existing_invoice.amount_paid > 0 else 'unpaid'),
                'is_auto_generated': False,
                'currency': existing_invoice.payment_record.currency if existing_invoice.payment_record else 'USD'
            })
        else:
            payment_records = StudentPaymentRecord.objects.filter(
                student=student,
                school=user.school,
            ).order_by('-date_created')
            for record in payment_records:
                total_due = _record_total_due(record)
                if total_due <= 0:
                    continue
                created_invoice = Invoice.objects.create(
                    student=student,
                    school=user.school,
                    invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
                    total_amount=total_due,
                    amount_paid=record.amount_paid,
                    due_date=record.due_date or (date.today() + timedelta(days=30)),
                    is_paid=_record_balance(record) <= 0,
                    payment_record=record,
                    notes=f"Snapshot invoice for {record.get_payment_type_display()} {record.academic_year} {record.academic_term}",
                )
                invoices_data.append({
                    'id': created_invoice.id,
                    'invoice_number': created_invoice.invoice_number,
                    'payment_record_id': record.id,
                    'student_id': student.id,
                    'student_name': student.user.full_name,
                    'student_number': student.user.student_number,
                    'class_name': student.student_class.name if student.student_class else 'N/A',
                    'issue_date': created_invoice.issue_date.strftime('%Y-%m-%d'),
                    'due_date': created_invoice.due_date.strftime('%Y-%m-%d'),
                    'total_amount': float(created_invoice.total_amount),
                    'amount_paid': float(created_invoice.amount_paid),
                    'balance': float(created_invoice.balance),
                    'status': 'paid' if created_invoice.is_paid else ('partial' if created_invoice.amount_paid > 0 else 'unpaid'),
                    'is_auto_generated': True,
                    'currency': record.currency or 'USD',
                    'academic_year': record.academic_year,
                    'academic_term': record.academic_term,
                })
    
    return Response({'invoices': invoices_data})


# Additional Fees Views
class AdditionalFeeListCreateView(generics.ListCreateAPIView):
    """Represents AdditionalFeeListCreateView."""
    queryset = AdditionalFee.objects.all()
    serializer_class = AdditionalFeeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        if user.role not in ['admin', 'accountant']:
            if user.role == 'parent':
                from academics.models import ParentChildLink
                links = ParentChildLink.objects.filter(parent=user.parent, is_confirmed=True)
                child_ids = [link.student_id for link in links]
                return AdditionalFee.objects.filter(
                    Q(student_id__in=child_ids) | 
                    Q(student_class__students__id__in=child_ids)
                ).distinct()
            return AdditionalFee.objects.none()
        
        if user.school:
            queryset = AdditionalFee.objects.filter(school=user.school)
        else:
            queryset = AdditionalFee.objects.none()
        
        class_id = self.request.query_params.get('class_id')
        student_id = self.request.query_params.get('student_id')
        
        if class_id:
            queryset = queryset.filter(Q(student_class_id=class_id) | Q(student__student_class_id=class_id))
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """Execute perform create."""
        serializer.save(school=self.request.user.school, created_by=self.request.user)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def daily_transaction_report(request):
    """Execute daily transaction report."""
    from datetime import datetime
    
    user = request.user
    if user.role not in ['admin', 'accountant']:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    date_str = request.query_params.get('date')
    if date_str:
        try:
            report_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        report_date = timezone.now().date()
    
    transactions = PaymentTransaction.objects.filter(
        payment_record__school=user.school,
        payment_date__date=report_date
    ).select_related(
        'payment_record__student__user',
        'payment_record__student__student_class',
        'processed_by'
    ).order_by('-payment_date')
    
    transaction_list = []
    total_collected = 0
    method_totals = {}
    
    for txn in transactions:
        amount = float(txn.amount)
        total_collected += amount
        method = txn.get_payment_method_display()
        method_totals[method] = method_totals.get(method, 0) + amount
        
        student = txn.payment_record.student
        transaction_list.append({
            'id': txn.id,
            'student_name': student.user.full_name,
            'student_number': student.user.student_number or '',
            'class_name': student.student_class.name if student.student_class else 'N/A',
            'amount': amount,
            'payment_method': method,
            'payment_method_key': txn.payment_method,
            'transaction_reference': txn.transaction_reference or '',
            'notes': txn.notes or '',
            'payment_time': txn.payment_date.strftime('%H:%M'),
            'processed_by': txn.processed_by.full_name if txn.processed_by else 'System',
        })
    
    method_breakdown = [
        {'method': method, 'total': total}
        for method, total in sorted(method_totals.items(), key=lambda x: -x[1])
    ]
    
    return Response({
        'date': report_date.isoformat(),
        'total_collected': total_collected,
        'transaction_count': len(transaction_list),
        'transactions': transaction_list,
        'method_breakdown': method_breakdown,
    })


class AdditionalFeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents AdditionalFeeDetailView."""
    queryset = AdditionalFee.objects.all()
    serializer_class = AdditionalFeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        if user.role not in ['admin', 'accountant']:
            return AdditionalFee.objects.none()
        if user.school:
            return AdditionalFee.objects.filter(school=user.school)
        return AdditionalFee.objects.none()


def _to_decimal(value):
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal('0')
    return Decimal(str(value))


def _record_total_due(record):
    return _to_decimal(record.total_amount_due) + get_additional_fees_total_for_record(record)


def _record_balance(record):
    return _record_total_due(record) - _to_decimal(record.amount_paid)


def _sync_invoice_with_record(invoice, record):
    if not invoice:
        return
    invoice.amount_paid = _to_decimal(record.amount_paid)
    invoice.is_paid = _record_balance(record) <= 0
    invoice.save(update_fields=['amount_paid', 'is_paid'])


def _apply_payment_to_record(record, amount, method='other', actor=None, reference='', notes=''):
    """Apply payment atomically to record, transactions, invoice and additional-fee flags."""
    amount = _to_decimal(amount)
    if amount <= 0:
        raise ValueError('Amount must be greater than zero.')

    outstanding = _record_balance(record)
    if amount > outstanding:
        raise ValueError('Payment amount cannot exceed remaining balance.')

    PaymentTransaction.objects.create(
        payment_record=record,
        amount=amount,
        payment_method=method,
        transaction_reference=reference or '',
        processed_by=actor,
        notes=notes or '',
    )

    record.amount_paid = _to_decimal(record.amount_paid) + amount
    new_balance = _record_balance(record)
    if new_balance <= 0:
        record.payment_status = 'paid'
    elif record.amount_paid > 0:
        record.payment_status = 'partial'
    else:
        record.payment_status = 'unpaid'
    record.save(update_fields=['amount_paid', 'payment_status', 'date_updated'])

    invoice = Invoice.objects.filter(payment_record=record, school=record.school).order_by('-issue_date', '-id').first()
    _sync_invoice_with_record(invoice, record)

    base_due = _to_decimal(record.total_amount_due)
    additional_paid_budget = max(Decimal('0'), _to_decimal(record.amount_paid) - base_due)
    for fee in get_unpaid_additional_fees_for_record(record):
        fee_amount = _to_decimal(fee.amount)
        if additional_paid_budget >= fee_amount:
            fee.is_paid = True
            fee.save(update_fields=['is_paid'])
            additional_paid_budget -= fee_amount
        else:
            break

    return record


def _recalculate_additional_fees_for_student(student, school, academic_year, academic_term=''):
    """Recompute paid/unpaid flags for additional fees from remaining payment records."""
    if not student or not school or not academic_year:
        return

    records = StudentPaymentRecord.objects.filter(
        student=student,
        school=school,
        academic_year=academic_year,
    )
    if academic_term:
        records = records.filter(Q(academic_term=academic_term) | Q(academic_term=''))

    fees = AdditionalFee.objects.filter(
        school=school,
        academic_year=academic_year,
    ).filter(
        Q(student=student) | Q(student_class=student.student_class)
    )
    if academic_term:
        fees = fees.filter(academic_term=academic_term)
    fees = fees.order_by('created_at', 'id')

    total_base_due = records.aggregate(total=Sum('total_amount_due'))['total'] or Decimal('0')
    total_base_paid = records.aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')
    available_for_additional = max(Decimal('0'), Decimal(total_base_paid) - Decimal(total_base_due))

    for fee in fees:
        fee_amount = _to_decimal(fee.amount)
        should_be_paid = available_for_additional >= fee_amount
        if fee.is_paid != should_be_paid:
            fee.is_paid = should_be_paid
            fee.save(update_fields=['is_paid'])
        if should_be_paid:
            available_for_additional -= fee_amount


# ---------------------------------------------------------------
# PayNow Zimbabwe Payments
# ---------------------------------------------------------------

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def paynow_initiate_payment(request):
    """
    Initiate a PayNow payment for a student fee or invoice.
    Body: { invoice_id or record_id, amount, mobile_number (optional), method: ecocash|onemoney|web }
    """
    if request.user.role not in ('parent', 'student', 'admin', 'accountant'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from .paynow_service import initiate_web_payment, initiate_mobile_payment
    from users.models import SchoolSettings

    # Fetch per-school PayNow credentials
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with your account.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        school_settings = SchoolSettings.objects.get(school=school)
        integration_id = school_settings.paynow_integration_id
        integration_key = school_settings.paynow_integration_key
    except SchoolSettings.DoesNotExist:
        integration_id = ''
        integration_key = ''

    if not integration_id or not integration_key:
        return Response(
            {'error': 'PayNow credentials are not configured for your school. Please contact your administrator.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    requested_amount = request.data.get('amount')
    description = request.data.get('description', 'School Fees')
    mobile_number = request.data.get('mobile_number', '').strip()
    method = request.data.get('method', 'web').lower()
    email = request.user.email or 'payer@myschoolhub.local'

    invoice_id = request.data.get('invoice_id')
    payment_record_id = request.data.get('payment_record_id')
    student_id = request.data.get('student_id')

    payment_record = None
    linked_invoice = None

    if invoice_id:
        try:
            linked_invoice = Invoice.objects.select_related('payment_record', 'student').get(
                id=invoice_id,
                school=school,
            )
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
        payment_record = linked_invoice.payment_record
        if not payment_record:
            return Response({'error': 'Invoice has no linked payment record.'}, status=status.HTTP_400_BAD_REQUEST)
    elif payment_record_id:
        try:
            payment_record = StudentPaymentRecord.objects.select_related('student').get(
                id=payment_record_id,
                school=school,
            )
        except StudentPaymentRecord.DoesNotExist:
            return Response({'error': 'Payment record not found.'}, status=status.HTTP_404_NOT_FOUND)
        linked_invoice = Invoice.objects.filter(payment_record=payment_record, school=school).order_by('-issue_date', '-id').first()
    elif student_id:
        queryset = StudentPaymentRecord.objects.filter(
            school=school,
            student_id=student_id,
        ).exclude(payment_status='paid').order_by('due_date', 'date_created')
        payment_record = queryset.first()
        if not payment_record:
            return Response({'error': 'No outstanding payment record found for this student.'}, status=status.HTTP_400_BAD_REQUEST)
        linked_invoice = Invoice.objects.filter(payment_record=payment_record, school=school).order_by('-issue_date', '-id').first()
    else:
        return Response(
            {'error': 'invoice_id, payment_record_id, or student_id is required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if request.user.role == 'parent':
        parent_owns_student = ParentChildLink.objects.filter(
            parent=request.user.parent,
            student=payment_record.student,
            is_confirmed=True,
        ).exists()
        if not parent_owns_student:
            return Response({'error': 'Permission denied for this student.'}, status=status.HTTP_403_FORBIDDEN)
    elif request.user.role == 'student' and getattr(request.user, 'student', None) and request.user.student.id != payment_record.student_id:
        return Response({'error': 'Permission denied for this student.'}, status=status.HTTP_403_FORBIDDEN)

    outstanding = _record_balance(payment_record)
    if outstanding <= 0:
        return Response({'error': 'This payment record is already fully settled.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        amount = _to_decimal(requested_amount if requested_amount not in (None, '') else outstanding)
    except (TypeError, ValueError, InvalidOperation):
        return Response({'error': 'Invalid amount value.'}, status=status.HTTP_400_BAD_REQUEST)
    if amount <= 0:
        return Response({'error': 'Amount must be greater than 0.'}, status=status.HTTP_400_BAD_REQUEST)
    if amount > outstanding:
        return Response(
            {'error': f'Amount exceeds remaining balance ({payment_record.currency}{outstanding}).'},
            status=status.HTTP_400_BAD_REQUEST
        )

    provider_reference = f"MSH-{school.id}-{payment_record.id}-{uuid.uuid4().hex[:12].upper()}"
    items = [{'description': description, 'amount': float(amount)}]

    if method in ('ecocash', 'onemoney', 'innbucks'):
        if not mobile_number:
            return Response({'error': 'Mobile number is required for mobile payments.'}, status=status.HTTP_400_BAD_REQUEST)
        result = initiate_mobile_payment(provider_reference, email, items, mobile_number, integration_id, integration_key, method)
    else:
        result = initiate_web_payment(provider_reference, email, items, integration_id, integration_key)

    if result['success']:
        intent = PaymentIntent.objects.create(
            school=school,
            student=payment_record.student,
            payment_record=payment_record,
            invoice=linked_invoice,
            expected_amount=amount,
            currency=payment_record.currency or 'USD',
            provider='paynow',
            payment_method=method,
            provider_reference=provider_reference,
            poll_url=result.get('poll_url') or '',
            idempotency_key=uuid.uuid4().hex,
            status='pending',
            created_by=request.user,
        )
        return Response({
            'success': True,
            'redirect_url': result.get('redirect_url'),
            'poll_url': result.get('poll_url'),
            'instructions': result.get('instructions'),
            'reference': provider_reference,
            'intent_id': intent.id,
            'message': 'Payment initiated. Follow the link to complete payment.' if method == 'web'
                       else f'Check your {method.upper()} prompt to approve payment.',
        })
    return Response({'error': result.get('error', 'Payment initiation failed.')}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # PayNow server callback — no auth token
def paynow_result_callback(request):
    """
    Server-to-server result URL callback from PayNow.
    Updates the payment record status based on PayNow response.
    """
    reference = request.data.get('reference', '').strip()
    paynow_reference = request.data.get('paynowreference', '').strip()
    amount = request.data.get('amount', 0)
    status_value = request.data.get('status', '').lower()

    logger.info('PayNow callback: ref=%s paynow_ref=%s status=%s amount=%s',
                reference, paynow_reference, status_value, amount)

    if not reference:
        return Response({'status': 'ignored', 'reason': 'missing reference'})

    try:
        with transaction.atomic():
            intent = PaymentIntent.objects.select_for_update().select_related(
                'payment_record__student__user',
                'payment_record__student__student_class',
            ).filter(provider_reference=reference, provider='paynow').first()
            if not intent:
                logger.warning('PayNow callback unmatched reference=%s payload=%s', reference, dict(request.data))
                return Response({'status': 'ignored'})

            intent.raw_callback_payload = dict(request.data)
            if intent.status == 'paid':
                intent.save(update_fields=['raw_callback_payload'])
                return Response({'status': 'received'})

            if status_value in ('paid', 'awaiting delivery'):
                callback_amount = _to_decimal(amount)
                if callback_amount <= 0:
                    callback_amount = intent.expected_amount
                if callback_amount != intent.expected_amount:
                    logger.warning(
                        'PayNow callback amount mismatch ref=%s expected=%s got=%s',
                        reference,
                        intent.expected_amount,
                        callback_amount,
                    )
                    return Response({'status': 'ignored', 'reason': 'amount mismatch'})

                try:
                    _apply_payment_to_record(
                        intent.payment_record,
                        callback_amount,
                        method='mobile_money' if intent.payment_method in ('ecocash', 'onemoney', 'innbucks') else 'card',
                        actor=intent.created_by,
                        reference=paynow_reference or reference,
                        notes=f'PayNow callback ({status_value})',
                    )
                except ValueError as exc:
                    return Response({'status': 'ignored', 'reason': str(exc)})

                intent.status = 'paid'
                intent.paid_amount = callback_amount
                intent.completed_at = timezone.now()
                intent.save(update_fields=['status', 'paid_amount', 'completed_at', 'raw_callback_payload'])

                # Notify parents of successful PayNow payment
                try:
                    student = intent.payment_record.student
                    school_name = student.user.school.name if student.user.school else "Your School"
                    class_name = student.student_class.name if student.student_class else "N/A"
                    student_name = f"{student.user.first_name} {student.user.last_name}".strip()
                    for p in get_parents_of_student(student):
                        send_payment_received_email(
                            parent_email=p['email'],
                            parent_name=p['name'],
                            school_name=school_name,
                            student_name=student_name,
                            class_name=class_name,
                            amount_usd=str(callback_amount),
                            payment_method="PayNow",
                            reference=paynow_reference or reference,
                        )
                except Exception as email_exc:
                    logger.error("PayNow payment email failed: %s", email_exc)
            elif status_value in ('failed', 'cancelled'):
                intent.status = 'failed' if status_value == 'failed' else 'cancelled'
                intent.save(update_fields=['status', 'raw_callback_payload'])
            else:
                # Keep pending state for unknown/intermediate statuses.
                intent.status = 'pending'
                intent.save(update_fields=['status', 'raw_callback_payload'])
    except Exception as exc:
        logger.error('PayNow callback update failed: %s', exc)
        return Response({'status': 'error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'status': 'received'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def paynow_check_status(request):
    """Check payment status by poll URL."""
    intent_id = request.query_params.get('intent_id')
    poll_url = request.query_params.get('poll_url')
    intent = None

    if intent_id:
        intent = PaymentIntent.objects.filter(
            id=intent_id,
            school=request.user.school,
            provider='paynow',
        ).select_related('payment_record').first()
        if not intent:
            return Response({'error': 'Payment intent not found.'}, status=status.HTTP_404_NOT_FOUND)
        poll_url = intent.poll_url

    if not poll_url:
        return Response({'error': 'poll_url is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from .paynow_service import check_payment_status
    from users.models import SchoolSettings

    school = request.user.school
    try:
        school_settings = SchoolSettings.objects.get(school=school)
        integration_id = school_settings.paynow_integration_id
        integration_key = school_settings.paynow_integration_key
    except (SchoolSettings.DoesNotExist, AttributeError):
        return Response({'error': 'PayNow not configured for your school.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    result = check_payment_status(poll_url, integration_id, integration_key)
    if intent and result.get('paid') and intent.status != 'paid':
        with transaction.atomic():
            locked = PaymentIntent.objects.select_for_update().get(id=intent.id)
            if locked.status != 'paid':
                try:
                    _apply_payment_to_record(
                        locked.payment_record,
                        locked.expected_amount,
                        method='mobile_money' if locked.payment_method in ('ecocash', 'onemoney', 'innbucks') else 'card',
                        actor=locked.created_by,
                        reference=locked.provider_reference,
                        notes='PayNow status poll settlement',
                    )
                    locked.status = 'paid'
                    locked.paid_amount = locked.expected_amount
                    locked.completed_at = timezone.now()
                    locked.save(update_fields=['status', 'paid_amount', 'completed_at'])
                    result['settled'] = True
                except ValueError:
                    result['settled'] = False
    return Response(result)


# ---------------------------------------------------------------
# Bulk CSV Import — Fees
# ---------------------------------------------------------------

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def bulk_import_fees(request):
    """
    Import student fees from a CSV file.
    CSV columns: student_number, fee_type_name, amount, academic_year, academic_term
    """
    import csv
    import io

    if request.user.role not in ('admin', 'accountant'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    csv_file = request.FILES.get('file')
    if not csv_file:
        return Response({'error': 'No CSV file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    school = request.user.school
    from .models import StudentFee, FeeType
    from academics.models import Student

    decoded = csv_file.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))

    created_count = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            student_number = row.get('student_number', '').strip()
            fee_type_name = row.get('fee_type_name', '').strip()
            amount = float(row.get('amount', 0))
            academic_year = row.get('academic_year', '').strip()
            academic_term = row.get('academic_term', '').strip()

            student = Student.objects.get(user__student_number=student_number, user__school=school)
            fee_type, _ = FeeType.objects.get_or_create(
                name=fee_type_name,
                defaults={'amount': amount, 'academic_year': academic_year}
            )

            import datetime
            StudentFee.objects.get_or_create(
                student=student, fee_type=fee_type,
                academic_term=academic_term, academic_year=academic_year,
                defaults={
                    'amount_due': amount,
                    'due_date': datetime.date.today(),
                }
            )
            created_count += 1
        except Student.DoesNotExist:
            errors.append({'row': i, 'error': f"Student '{row.get('student_number')}' not found."})
        except Exception as exc:
            errors.append({'row': i, 'error': str(exc)})

    return Response({
        'created': created_count,
        'errors': errors,
        'message': f'Imported {created_count} fee records with {len(errors)} errors.'
    })
