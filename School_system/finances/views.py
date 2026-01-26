from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Sum, Q
from .models import FeeType, StudentFee, Payment, Invoice, FinancialReport, SchoolFees
from academics.models import Student, Class
from .serializers import (
    FeeTypeSerializer, StudentFeeSerializer, PaymentSerializer,
    InvoiceSerializer, FinancialReportSerializer, CreatePaymentSerializer,
    StudentFinancialSummarySerializer, SchoolFeesSerializer
)


# Fee Type Views
class FeeTypeListCreateView(generics.ListCreateAPIView):
    queryset = FeeType.objects.all()
    serializer_class = FeeTypeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
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
        serializer.save(school=self.request.user.school)


class FeeTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = FeeType.objects.all()
    serializer_class = FeeTypeSerializer
    permission_classes = [permissions.IsAuthenticated]


# Student Fee Views
class StudentFeeListCreateView(generics.ListCreateAPIView):
    queryset = StudentFee.objects.all()
    serializer_class = StudentFeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # Filter by school first
        if user.school:
            queryset = StudentFee.objects.filter(student__user__school=user.school)
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
    queryset = StudentFee.objects.all()
    serializer_class = StudentFeeSerializer
    permission_classes = [permissions.IsAuthenticated]


# Payment Views
class PaymentListCreateView(generics.ListCreateAPIView):
    queryset = Payment.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreatePaymentSerializer
        return PaymentSerializer

    def get_queryset(self):
        user = self.request.user
        
        # Filter by school first
        if user.school:
            queryset = Payment.objects.filter(student_fee__student__user__school=user.school)
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
        serializer.save(processed_by=self.request.user)


class PaymentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]


# Invoice Views
class InvoiceListCreateView(generics.ListCreateAPIView):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # Filter by school first
        if user.school:
            queryset = Invoice.objects.filter(student__user__school=user.school)
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
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]


# Financial Report Views
class FinancialReportListCreateView(generics.ListCreateAPIView):
    queryset = FinancialReport.objects.all()
    serializer_class = FinancialReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
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
        serializer.save(generated_by=self.request.user)


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
            if not request.user.parent.children.filter(id=student_id).exists():
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Calculate financial summary
        fees = StudentFee.objects.filter(student=student)
        payments = Payment.objects.filter(student_fee__student=student, payment_status='completed')
        
        total_fees_due = fees.aggregate(total=Sum('amount_due'))['total'] or 0
        total_fees_paid = fees.aggregate(total=Sum('amount_paid'))['total'] or 0
        total_balance = total_fees_due - total_fees_paid
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
            'pending_fees': StudentFeeSerializer(pending_fees, many=True).data
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
            if not request.user.parent.children.filter(id=student_fee.student.id).exists():
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
    queryset = SchoolFees.objects.all()
    serializer_class = SchoolFeesSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
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
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can create school fees")
        serializer.save(created_by=self.request.user, school=self.request.user.school)


class SchoolFeesDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SchoolFees.objects.all()
    serializer_class = SchoolFeesSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.school:
            return SchoolFees.objects.filter(school=user.school)
        return SchoolFees.objects.none()
    
    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can update school fees")
        serializer.save()
    
    def perform_destroy(self, instance):
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can delete school fees")
        instance.delete()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_my_school_fees(request):
    """Get school fees for a student or parent's children based on their grade/form"""
    user = request.user
    
    if user.role == 'student':
        try:
            student = user.student
            student_class = student.student_class
            grade_level = student_class.grade_level
            
            fees = SchoolFees.objects.filter(grade_level=grade_level).order_by('-academic_year', 'academic_term')
            
            return Response({
                'student_name': user.full_name,
                'student_number': user.student_number,
                'class_name': student_class.name,
                'grade_level': grade_level,
                'fees': SchoolFeesSerializer(fees, many=True).data
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    elif user.role == 'parent':
        try:
            from academics.models import ParentChildLink
            
            confirmed_links = ParentChildLink.objects.filter(
                parent=user.parent,
                is_confirmed=True
            ).select_related('student__student_class', 'student__user')
            
            children_fees = []
            for link in confirmed_links:
                student = link.student
                student_class = student.student_class
                grade_level = student_class.grade_level
                
                fees = SchoolFees.objects.filter(grade_level=grade_level).order_by('-academic_year', 'academic_term')
                
                children_fees.append({
                    'student_id': student.id,
                    'student_name': student.user.full_name,
                    'student_number': student.user.student_number,
                    'class_name': student_class.name,
                    'grade_level': grade_level,
                    'fees': SchoolFeesSerializer(fees, many=True).data
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