from rest_framework import serializers
from .models import FeeType, StudentFee, Payment, Invoice, FinancialReport, SchoolFees, StudentPaymentRecord, PaymentTransaction, AdditionalFee
from academics.models import Student
import uuid
from datetime import date


class FeeTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeType
        fields = '__all__'


class StudentFeeSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    fee_type_name = serializers.CharField(source='fee_type.name', read_only=True)
    balance = serializers.ReadOnlyField()

    class Meta:
        model = StudentFee
        fields = [
            'id', 'student', 'student_name', 'student_number', 'fee_type', 'fee_type_name',
            'amount_due', 'amount_paid', 'balance', 'due_date', 'academic_term',
            'academic_year', 'is_paid'
        ]


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student_fee.student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student_fee.student.user.student_number', read_only=True)
    fee_type_name = serializers.CharField(source='student_fee.fee_type.name', read_only=True)
    processed_by_name = serializers.CharField(source='processed_by.full_name', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'student_fee', 'student_name', 'student_number', 'fee_type_name',
            'amount', 'payment_method', 'payment_status', 'transaction_id',
            'payment_date', 'processed_by', 'processed_by_name', 'notes'
        ]

    def create(self, validated_data):
        # Set processed_by from request user if not provided
        if 'processed_by' not in validated_data:
            validated_data['processed_by'] = self.context['request'].user
        return super().create(validated_data)


class InvoiceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    balance = serializers.ReadOnlyField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'student', 'student_name', 'student_number', 'invoice_number',
            'total_amount', 'amount_paid', 'balance', 'issue_date', 'due_date',
            'is_paid', 'notes'
        ]


class FinancialReportSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True)
    net_profit = serializers.SerializerMethodField()

    class Meta:
        model = FinancialReport
        fields = [
            'id', 'title', 'report_type', 'academic_year', 'academic_term',
            'total_revenue', 'total_expenses', 'net_profit', 'generated_by',
            'generated_by_name', 'date_generated', 'file_path'
        ]

    def get_net_profit(self, obj):
        return obj.total_revenue - obj.total_expenses


class CreatePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['student_fee', 'amount', 'payment_method', 'transaction_id', 'notes']

    def validate(self, attrs):
        student_fee = attrs['student_fee']
        amount = attrs['amount']
        
        if amount <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        
        if amount > student_fee.balance:
            raise serializers.ValidationError("Payment amount cannot exceed the remaining balance.")
        
        return attrs

    def create(self, validated_data):
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
    total_fee = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = SchoolFees
        fields = [
            'id', 'grade_level', 'grade_name', 'tuition_fee', 'levy_fee',
            'sports_fee', 'computer_fee', 'other_fees', 'total_fee',
            'academic_year', 'academic_term', 'currency',
            'date_created', 'date_updated', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['created_by', 'date_created', 'date_updated']


class AdditionalFeeSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    class_name = serializers.CharField(source='student_class.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = AdditionalFee
        fields = [
            'id', 'student', 'student_name', 'student_class', 'class_name',
            'fee_name', 'amount', 'reason', 'currency', 'academic_year',
            'academic_term', 'is_paid', 'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['created_by', 'created_at']


class PaymentTransactionSerializer(serializers.ModelSerializer):
    processed_by_name = serializers.CharField(source='processed_by.full_name', read_only=True)
    
    class Meta:
        model = PaymentTransaction
        fields = [
            'id', 'payment_record', 'amount', 'payment_method', 
            'transaction_reference', 'payment_date', 'processed_by',
            'processed_by_name', 'notes'
        ]
        read_only_fields = ['processed_by', 'payment_date']


class StudentPaymentRecordSerializer(serializers.ModelSerializer):
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
        from django.db.models import Q
        additional_fees = AdditionalFee.objects.filter(
            school=obj.school,
            is_paid=False
        ).filter(Q(student=obj.student) | Q(student_class=obj.student.student_class))
        return sum(float(f.amount) for f in additional_fees)
    
    def get_total_amount_due(self, obj):
        return float(obj.total_amount_due) + self.get_additional_fees_total(obj)
    
    def get_balance(self, obj):
        total = self.get_total_amount_due(obj)
        return total - float(obj.amount_paid)
    
    def get_is_fully_paid(self, obj):
        return self.get_balance(obj) <= 0
    
    def get_additional_fees_list(self, obj):
        from django.db.models import Q
        additional_fees = AdditionalFee.objects.filter(
            school=obj.school,
            is_paid=False
        ).filter(Q(student=obj.student) | Q(student_class=obj.student.student_class))
        return [{'name': f.fee_name, 'amount': float(f.amount), 'reason': f.reason} for f in additional_fees]
    
    class Meta:
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
    class Meta:
        model = StudentPaymentRecord
        fields = [
            'student', 'payment_type', 'payment_plan', 'description',
            'academic_year', 'academic_term',
            'total_amount_due', 'amount_paid', 'currency',
            'payment_method', 'due_date', 'next_payment_due', 'notes'
        ]
    
    def validate(self, attrs):
        amount_paid = attrs.get('amount_paid', 0)
        total_due = attrs['total_amount_due']
        
        if amount_paid < 0:
            raise serializers.ValidationError("Amount paid cannot be negative.")
        if amount_paid > total_due:
            raise serializers.ValidationError("Amount paid cannot exceed total amount due.")
        
        return attrs
    
    def create(self, validated_data):
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
    payment_record_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=StudentPaymentRecord.PAYMENT_METHOD_CHOICES)
    transaction_reference = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    next_payment_due = serializers.DateField(required=False, allow_null=True)
    
    def validate(self, attrs):
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
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    class_name = serializers.SerializerMethodField()
    balance = serializers.ReadOnlyField()
    school_name = serializers.CharField(source='school.name', read_only=True)
    school_address = serializers.CharField(source='school.address', read_only=True)
    school_phone = serializers.CharField(source='school.phone_number', read_only=True)
    school_email = serializers.CharField(source='school.email', read_only=True)
    payment_details = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'student', 'student_name', 'student_number', 'class_name',
            'invoice_number', 'total_amount', 'amount_paid', 'balance',
            'issue_date', 'due_date', 'is_paid', 'notes',
            'school_name', 'school_address', 'school_phone', 'school_email',
            'payment_details'
        ]
    
    def get_class_name(self, obj):
        if obj.student and obj.student.student_class:
            return obj.student.student_class.name
        return ''
    
    def get_payment_details(self, obj):
        if obj.payment_record:
            return {
                'payment_type': obj.payment_record.get_payment_type_display(),
                'payment_plan': obj.payment_record.get_payment_plan_display(),
                'academic_year': obj.payment_record.academic_year,
                'academic_term': obj.payment_record.academic_term,
                'currency': obj.payment_record.currency,
            }
        return None