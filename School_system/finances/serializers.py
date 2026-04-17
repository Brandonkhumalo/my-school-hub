from rest_framework import serializers
from .models import FeeType, StudentFee, Payment, Invoice, FinancialReport, SchoolFees, StudentPaymentRecord, PaymentTransaction, AdditionalFee
from academics.models import Student
import uuid
from datetime import date
from decimal import Decimal

from .fee_calculator import get_transport_opt_in


class FeeTypeSerializer(serializers.ModelSerializer):
    """Represents FeeTypeSerializer."""
    class Meta:
        """Represents Meta."""
        model = FeeType
        fields = '__all__'


class StudentFeeSerializer(serializers.ModelSerializer):
    """Represents StudentFeeSerializer."""
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    fee_type_name = serializers.CharField(source='fee_type.name', read_only=True)
    balance = serializers.ReadOnlyField()

    class Meta:
        """Represents Meta."""
        model = StudentFee
        fields = [
            'id', 'student', 'student_name', 'student_number', 'fee_type', 'fee_type_name',
            'amount_due', 'amount_paid', 'balance', 'due_date', 'academic_term',
            'academic_year', 'is_paid'
        ]


class PaymentSerializer(serializers.ModelSerializer):
    """Represents PaymentSerializer."""
    student_name = serializers.CharField(source='student_fee.student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student_fee.student.user.student_number', read_only=True)
    fee_type_name = serializers.CharField(source='student_fee.fee_type.name', read_only=True)
    processed_by_name = serializers.CharField(source='processed_by.full_name', read_only=True)

    class Meta:
        """Represents Meta."""
        model = Payment
        fields = [
            'id', 'student_fee', 'student_name', 'student_number', 'fee_type_name',
            'amount', 'payment_method', 'payment_status', 'transaction_id',
            'payment_date', 'processed_by', 'processed_by_name', 'notes'
        ]

    def create(self, validated_data):
        # Set processed_by from request user if not provided
        """Create and return a new instance."""
        if 'processed_by' not in validated_data:
            validated_data['processed_by'] = self.context['request'].user
        return super().create(validated_data)


class InvoiceSerializer(serializers.ModelSerializer):
    """Represents InvoiceSerializer."""
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    balance = serializers.ReadOnlyField()

    class Meta:
        """Represents Meta."""
        model = Invoice
        fields = [
            'id', 'student', 'student_name', 'student_number', 'invoice_number',
            'total_amount', 'amount_paid', 'balance', 'issue_date', 'due_date',
            'is_paid', 'notes'
        ]


class FinancialReportSerializer(serializers.ModelSerializer):
    """Represents FinancialReportSerializer."""
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True)
    net_profit = serializers.SerializerMethodField()

    class Meta:
        """Represents Meta."""
        model = FinancialReport
        fields = [
            'id', 'title', 'report_type', 'academic_year', 'academic_term',
            'total_revenue', 'total_expenses', 'net_profit', 'generated_by',
            'generated_by_name', 'date_generated', 'file_path'
        ]

    def get_net_profit(self, obj):
        """Return net profit."""
        return obj.total_revenue - obj.total_expenses


class CreatePaymentSerializer(serializers.ModelSerializer):
    """Represents CreatePaymentSerializer."""
    class Meta:
        """Represents Meta."""
        model = Payment
        fields = ['student_fee', 'amount', 'payment_method', 'transaction_id', 'notes']

    def validate(self, attrs):
        """Validate incoming data."""
        student_fee = attrs['student_fee']
        amount = attrs['amount']
        
        if amount <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        
        if amount > student_fee.balance:
            raise serializers.ValidationError("Payment amount cannot exceed the remaining balance.")
        
        return attrs

    def create(self, validated_data):
        """Create and return a new instance."""
        payment = super().create(validated_data)
        
        # Update student fee balance
        student_fee = payment.student_fee
        student_fee.amount_paid += payment.amount
        if student_fee.amount_paid >= student_fee.amount_due:
            student_fee.is_paid = True
        student_fee.save()
        
        # Set payment status to completed
        payment.payment_status = 'completed'
        payment.save()
        
        return payment


class StudentFinancialSummarySerializer(serializers.Serializer):
    """Represents StudentFinancialSummarySerializer."""
    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    student_number = serializers.CharField()
    total_fees_due = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_fees_paid = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    unpaid_fees_count = serializers.IntegerField()
    recent_payments = PaymentSerializer(many=True)
    pending_fees = StudentFeeSerializer(many=True)


class SchoolFeesSerializer(serializers.ModelSerializer):
    """Represents SchoolFeesSerializer."""
    total_fee = serializers.ReadOnlyField()
    day_total_fee = serializers.SerializerMethodField()
    boarding_total_fee = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        """Represents Meta."""
        model = SchoolFees
        fields = [
            'id', 'grade_level', 'grade_name', 'tuition_fee', 'levy_fee',
            'sports_fee', 'computer_fee', 'other_fees', 'boarding_fee', 'transport_fee',
            'total_fee', 'day_total_fee', 'boarding_total_fee',
            'academic_year', 'academic_term', 'currency',
            'date_created', 'date_updated', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['created_by', 'date_created', 'date_updated']

    def get_day_total_fee(self, obj):
        return float(obj.total_fee)

    def get_boarding_total_fee(self, obj):
        return float(obj.total_fee + obj.boarding_fee)

    def validate(self, attrs):
        request = self.context.get('request')
        school = None
        if request and hasattr(request.user, 'school'):
            school = request.user.school
        elif self.instance:
            school = self.instance.school

        if school and school.accommodation_type == 'day':
            attrs['boarding_fee'] = 0

        return attrs


class AdditionalFeeSerializer(serializers.ModelSerializer):
    """Represents AdditionalFeeSerializer."""
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    class_name = serializers.CharField(source='student_class.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        """Represents Meta."""
        model = AdditionalFee
        fields = [
            'id', 'student', 'student_name', 'student_class', 'class_name',
            'fee_name', 'amount', 'reason', 'currency', 'academic_year',
            'academic_term', 'is_paid', 'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['created_by', 'created_at']


class PaymentTransactionSerializer(serializers.ModelSerializer):
    """Represents PaymentTransactionSerializer."""
    processed_by_name = serializers.CharField(source='processed_by.full_name', read_only=True)
    
    class Meta:
        """Represents Meta."""
        model = PaymentTransaction
        fields = [
            'id', 'payment_record', 'amount', 'payment_method', 
            'transaction_reference', 'payment_date', 'processed_by',
            'processed_by_name', 'notes'
        ]
        read_only_fields = ['processed_by', 'payment_date']


class StudentPaymentRecordSerializer(serializers.ModelSerializer):
    """Represents StudentPaymentRecordSerializer."""
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    class_name = serializers.CharField(source='student.student_class.name', read_only=True)
    balance = serializers.SerializerMethodField()
    is_fully_paid = serializers.SerializerMethodField()
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)
    transactions = PaymentTransactionSerializer(many=True, read_only=True)
    total_amount_due = serializers.SerializerMethodField()
    base_school_fee = serializers.DecimalField(source='total_amount_due', max_digits=12, decimal_places=2, read_only=True)
    additional_fees_list = serializers.SerializerMethodField()
    
    def get_additional_fees_total(self, obj):
        """Return additional fees total."""
        from django.db.models import Q
        additional_fees = AdditionalFee.objects.filter(
            school=obj.school,
            is_paid=False
        ).filter(Q(student=obj.student) | Q(student_class=obj.student.student_class))
        return sum(float(f.amount) for f in additional_fees)
    
    def get_total_amount_due(self, obj):
        """Return total amount due."""
        return float(obj.total_amount_due) + self.get_additional_fees_total(obj)
    
    def get_balance(self, obj):
        """Return balance."""
        total = self.get_total_amount_due(obj)
        return total - float(obj.amount_paid)
    
    def get_is_fully_paid(self, obj):
        """Return is fully paid."""
        return self.get_balance(obj) <= 0
    
    def get_additional_fees_list(self, obj):
        """Return additional fees list."""
        from django.db.models import Q
        additional_fees = AdditionalFee.objects.filter(
            school=obj.school,
            is_paid=False
        ).filter(Q(student=obj.student) | Q(student_class=obj.student.student_class))
        return [{'name': f.fee_name, 'amount': float(f.amount), 'reason': f.reason} for f in additional_fees]
    
    class Meta:
        """Represents Meta."""
        model = StudentPaymentRecord
        fields = [
            'id', 'student', 'student_name', 'student_number', 'class_name', 'school',
            'payment_type', 'payment_plan', 'description',
            'academic_year', 'academic_term',
            'total_amount_due', 'base_school_fee', 'amount_paid', 'balance', 'currency',
            'payment_status', 'payment_method', 'is_fully_paid',
            'due_date', 'next_payment_due',
            'date_created', 'date_updated', 'recorded_by', 'recorded_by_name',
            'notes', 'transactions', 'additional_fees_list'
        ]
        read_only_fields = ['recorded_by', 'date_created', 'date_updated', 'school']


class CreatePaymentRecordSerializer(serializers.ModelSerializer):
    """Represents CreatePaymentRecordSerializer."""
    total_amount_due = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    TERM_SEQUENCE = ['term_1', 'term_2', 'term_3']

    class Meta:
        """Represents Meta."""
        model = StudentPaymentRecord
        fields = [
            'student', 'payment_type', 'payment_plan', 'description',
            'academic_year', 'academic_term',
            'total_amount_due', 'amount_paid', 'currency',
            'payment_method', 'due_date', 'next_payment_due', 'notes'
        ]

    def _terms_for_plan(self, payment_plan, academic_term):
        """Resolve included terms based on selected payment plan."""
        if payment_plan == 'full_year':
            return list(self.TERM_SEQUENCE)

        if payment_plan == 'one_term':
            if not academic_term:
                raise serializers.ValidationError({'academic_term': 'Academic term is required for one-term payments.'})
            if academic_term not in self.TERM_SEQUENCE:
                raise serializers.ValidationError({'academic_term': 'Invalid academic term.'})
            return [academic_term]

        if payment_plan == 'two_terms':
            if not academic_term:
                raise serializers.ValidationError({'academic_term': 'Academic term is required for two-term payments.'})
            if academic_term not in self.TERM_SEQUENCE:
                raise serializers.ValidationError({'academic_term': 'Invalid academic term.'})
            start_index = self.TERM_SEQUENCE.index(academic_term)
            terms = self.TERM_SEQUENCE[start_index:start_index + 2]
            if len(terms) < 2:
                raise serializers.ValidationError({'academic_term': 'Two-term payment must start at Term 1 or Term 2.'})
            return terms

        return []

    def _calculate_due_for_school_fees(self, attrs):
        """Calculate amount due from SchoolFees using selected plan/year/term."""
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        school = getattr(user, 'school', None)
        student = attrs.get('student')
        academic_year = attrs.get('academic_year')
        payment_plan = attrs.get('payment_plan')
        academic_term = attrs.get('academic_term')

        if not school:
            raise serializers.ValidationError({'school': 'No school associated with current user.'})
        if not student:
            raise serializers.ValidationError({'student': 'Student is required.'})
        if not getattr(student, 'student_class', None):
            raise serializers.ValidationError({'student': 'Student must be assigned to a class.'})
        if not academic_year:
            raise serializers.ValidationError({'academic_year': 'Academic year is required.'})

        included_terms = self._terms_for_plan(payment_plan, academic_term)
        if not included_terms:
            # For "batch" we keep manual amount due.
            return None

        fee_rows = SchoolFees.objects.filter(
            school=school,
            grade_level=student.student_class.grade_level,
            academic_year=academic_year,
            academic_term__in=included_terms,
        )
        fee_by_term = {fee.academic_term: fee for fee in fee_rows}
        missing_terms = [term for term in included_terms if term not in fee_by_term]
        if missing_terms:
            readable = ', '.join(term.replace('_', ' ').title() for term in missing_terms)
            raise serializers.ValidationError({
                'total_amount_due': f'School fees are not configured for {readable} ({academic_year}).'
            })

        school_supports_boarding = bool(
            school and getattr(school, 'accommodation_type', 'day') in ('boarding', 'both')
        )
        boarding_applies = school_supports_boarding and student.residence_type == 'boarding'
        transport_opted_in = get_transport_opt_in(student)

        total_due = Decimal('0')
        for term in included_terms:
            fee = fee_by_term[term]
            term_total = (
                fee.tuition_fee +
                fee.levy_fee +
                fee.sports_fee +
                fee.computer_fee +
                fee.other_fees
            )
            if boarding_applies:
                term_total += fee.boarding_fee
            if fee.transport_fee and fee.transport_fee > 0 and transport_opted_in:
                term_total += fee.transport_fee
            total_due += term_total

        return total_due
    
    def validate(self, attrs):
        """Validate incoming data."""
        if attrs.get('payment_type') == 'school_fees':
            calculated_due = self._calculate_due_for_school_fees(attrs)
            if calculated_due is not None:
                attrs['total_amount_due'] = calculated_due

        if 'total_amount_due' not in attrs:
            raise serializers.ValidationError({'total_amount_due': 'Total amount due is required.'})

        amount_paid = attrs.get('amount_paid', 0)
        total_due = attrs['total_amount_due']
        
        if amount_paid < 0:
            raise serializers.ValidationError("Amount paid cannot be negative.")
        if amount_paid > total_due:
            raise serializers.ValidationError("Amount paid cannot exceed total amount due.")
        
        return attrs
    
    def create(self, validated_data):
        """Create and return a new instance."""
        user = self.context['request'].user
        validated_data['recorded_by'] = user
        validated_data['school'] = user.school
        
        amount_paid = validated_data.get('amount_paid', 0)
        total_due = validated_data['total_amount_due']
        
        if amount_paid >= total_due:
            validated_data['payment_status'] = 'paid'
        elif amount_paid > 0:
            validated_data['payment_status'] = 'partial'
        else:
            validated_data['payment_status'] = 'unpaid'
        
        payment_record = super().create(validated_data)
        
        if amount_paid > 0:
            PaymentTransaction.objects.create(
                payment_record=payment_record,
                amount=amount_paid,
                payment_method=validated_data.get('payment_method', 'cash'),
                processed_by=user,
                notes='Initial payment'
            )
            
            self._create_invoice(payment_record, amount_paid, user)
        
        return payment_record
    
    def _create_invoice(self, payment_record, amount, user):
        """Execute create invoice."""
        invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
        Invoice.objects.create(
            student=payment_record.student,
            school=payment_record.school,
            invoice_number=invoice_number,
            total_amount=payment_record.total_amount_due,
            amount_paid=amount,
            due_date=payment_record.due_date or date.today(),
            is_paid=payment_record.payment_status == 'paid',
            payment_record=payment_record,
            notes=f"Payment for {payment_record.get_payment_type_display()} - {payment_record.academic_year}"
        )


class AddPaymentSerializer(serializers.Serializer):
    """Represents AddPaymentSerializer."""
    payment_record_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=StudentPaymentRecord.PAYMENT_METHOD_CHOICES)
    transaction_reference = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    next_payment_due = serializers.DateField(required=False, allow_null=True)
    
    def validate(self, attrs):
        """Validate incoming data."""
        payment_record_id = attrs['payment_record_id']
        amount = attrs['amount']
        
        try:
            payment_record = StudentPaymentRecord.objects.get(id=payment_record_id)
        except StudentPaymentRecord.DoesNotExist:
            raise serializers.ValidationError("Payment record not found.")
        
        if amount <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        
        if amount > payment_record.balance:
            raise serializers.ValidationError("Payment amount cannot exceed remaining balance.")
        
        attrs['payment_record'] = payment_record
        return attrs
    
    def create(self, validated_data):
        """Create and return a new instance."""
        user = self.context['request'].user
        payment_record = validated_data['payment_record']
        amount = validated_data['amount']
        
        PaymentTransaction.objects.create(
            payment_record=payment_record,
            amount=amount,
            payment_method=validated_data['payment_method'],
            transaction_reference=validated_data.get('transaction_reference', ''),
            processed_by=user,
            notes=validated_data.get('notes', '')
        )
        
        payment_record.amount_paid += amount
        if validated_data.get('next_payment_due'):
            payment_record.next_payment_due = validated_data['next_payment_due']
        
        if payment_record.amount_paid >= payment_record.total_amount_due:
            payment_record.payment_status = 'paid'
        else:
            payment_record.payment_status = 'partial'
        
        payment_record.save()
        
        invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
        Invoice.objects.create(
            student=payment_record.student,
            school=payment_record.school,
            invoice_number=invoice_number,
            total_amount=payment_record.total_amount_due,
            amount_paid=payment_record.amount_paid,
            due_date=payment_record.due_date or date.today(),
            is_paid=payment_record.payment_status == 'paid',
            payment_record=payment_record,
            notes=f"Payment of {payment_record.currency}{amount} for {payment_record.get_payment_type_display()}"
        )
        
        return payment_record


class ClassFeesReportSerializer(serializers.Serializer):
    """Represents ClassFeesReportSerializer."""
    class_id = serializers.IntegerField()
    class_name = serializers.CharField()
    total_students = serializers.IntegerField()
    paid_count = serializers.IntegerField()
    partial_count = serializers.IntegerField()
    unpaid_count = serializers.IntegerField()
    total_due = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_collected = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_outstanding = serializers.DecimalField(max_digits=12, decimal_places=2)
    students = serializers.ListField(child=serializers.DictField())


class InvoiceDetailSerializer(serializers.ModelSerializer):
    """Represents InvoiceDetailSerializer."""
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    class_name = serializers.SerializerMethodField()
    balance = serializers.ReadOnlyField()
    school_name = serializers.CharField(source='school.name', read_only=True)
    school_address = serializers.CharField(source='school.address', read_only=True)
    school_phone = serializers.CharField(source='school.phone', read_only=True)
    school_email = serializers.CharField(source='school.email', read_only=True)
    payment_details = serializers.SerializerMethodField()

    class Meta:
        """Represents Meta."""
        model = Invoice
        fields = [
            'id', 'student', 'student_name', 'student_number', 'class_name',
            'invoice_number', 'total_amount', 'amount_paid', 'balance',
            'issue_date', 'due_date', 'is_paid', 'notes',
            'school_name', 'school_address', 'school_phone', 'school_email',
            'payment_details'
        ]
    
    def get_class_name(self, obj):
        """Return class name."""
        if obj.student and obj.student.student_class:
            return obj.student.student_class.name
        return ''
    
    def get_payment_details(self, obj):
        """Return payment details."""
        if obj.payment_record:
            return {
                'payment_type': obj.payment_record.get_payment_type_display(),
                'payment_plan': obj.payment_record.get_payment_plan_display(),
                'academic_year': obj.payment_record.academic_year,
                'academic_term': obj.payment_record.academic_term,
                'currency': obj.payment_record.currency,
            }
        return None
