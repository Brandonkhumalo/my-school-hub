from rest_framework import serializers
from .models import FeeType, StudentFee, Payment, Invoice, FinancialReport
from academics.models import Student


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