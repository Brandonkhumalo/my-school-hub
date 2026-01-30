from django.db import models
from django.conf import settings
from academics.models import Student


class FeeType(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    academic_year = models.CharField(max_length=20)
    
    def __str__(self):
        return f"{self.name} - ${self.amount}"


class StudentFee(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fees')
    fee_type = models.ForeignKey(FeeType, on_delete=models.CASCADE)
    amount_due = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    due_date = models.DateField()
    academic_term = models.CharField(max_length=50)
    academic_year = models.CharField(max_length=20)
    is_paid = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.student.user.full_name} - {self.fee_type.name}"
    
    @property
    def balance(self):
        return self.amount_due - self.amount_paid


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('card', 'Card'),
        ('mobile_money', 'Mobile Money'),
        ('whatsapp', 'WhatsApp Payment'),
    ]
    
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]
    
    student_fee = models.ForeignKey(StudentFee, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    transaction_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.student_fee.student.user.full_name} - ${self.amount} ({self.payment_status})"


class Invoice(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='invoices')
    invoice_number = models.CharField(max_length=50, unique=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    issue_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()
    is_paid = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='invoices', null=True, blank=True)
    payment_record = models.ForeignKey('StudentPaymentRecord', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    
    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.student.user.full_name}"
    
    @property
    def balance(self):
        return self.total_amount - self.amount_paid


class StudentPaymentRecord(models.Model):
    PAYMENT_TYPE_CHOICES = [
        ('school_fees', 'School Fees'),
        ('other', 'Other Payment'),
    ]
    
    PAYMENT_PLAN_CHOICES = [
        ('full_year', 'Full Year Payment'),
        ('two_terms', 'Two Terms Payment'),
        ('one_term', 'One Term Payment'),
        ('batch', 'Batch Payment'),
    ]
    
    PAYMENT_STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('partial', 'Partially Paid'),
        ('paid', 'Fully Paid'),
    ]
    
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('card', 'Card'),
        ('mobile_money', 'Mobile Money'),
        ('ecocash', 'EcoCash'),
        ('innbucks', 'InnBucks'),
        ('other', 'Other'),
    ]
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='payment_records')
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='payment_records')
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, default='school_fees')
    payment_plan = models.CharField(max_length=20, choices=PAYMENT_PLAN_CHOICES, default='one_term')
    description = models.CharField(max_length=255, blank=True)
    
    academic_year = models.CharField(max_length=20)
    academic_term = models.CharField(max_length=20, blank=True)
    
    total_amount_due = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default='USD')
    
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, blank=True)
    
    due_date = models.DateField(null=True, blank=True)
    next_payment_due = models.DateField(null=True, blank=True)
    
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='recorded_payments')
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-date_created']
    
    @property
    def balance(self):
        return self.total_amount_due - self.amount_paid
    
    @property
    def is_fully_paid(self):
        return self.amount_paid >= self.total_amount_due
    
    def __str__(self):
        return f"{self.student.user.full_name} - {self.payment_type} ({self.payment_status})"


class PaymentTransaction(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('card', 'Card'),
        ('mobile_money', 'Mobile Money'),
        ('ecocash', 'EcoCash'),
        ('innbucks', 'InnBucks'),
        ('other', 'Other'),
    ]
    
    payment_record = models.ForeignKey(StudentPaymentRecord, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    transaction_reference = models.CharField(max_length=100, blank=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    notes = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.payment_record.student.user.full_name} - {self.amount}"


class FinancialReport(models.Model):
    title = models.CharField(max_length=200)
    report_type = models.CharField(max_length=50)  # monthly, quarterly, annual
    academic_year = models.CharField(max_length=20)
    academic_term = models.CharField(max_length=50, blank=True)
    total_revenue = models.DecimalField(max_digits=15, decimal_places=2)
    total_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_generated = models.DateTimeField(auto_now_add=True)
    file_path = models.CharField(max_length=500, blank=True)
    
    def __str__(self):
        return f"{self.title} - {self.report_type}"


class SchoolFees(models.Model):
    TERM_CHOICES = [
        ('term_1', 'Term 1'),
        ('term_2', 'Term 2'),
        ('term_3', 'Term 3'),
    ]
    
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='school_fees', null=True, blank=True)
    grade_level = models.IntegerField()
    grade_name = models.CharField(max_length=50)
    tuition_fee = models.DecimalField(max_digits=10, decimal_places=2)
    levy_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sports_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    computer_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_fees = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    academic_year = models.CharField(max_length=20)
    academic_term = models.CharField(max_length=20, choices=TERM_CHOICES)
    currency = models.CharField(max_length=10, default='USD')
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        unique_together = ('school', 'grade_level', 'academic_year', 'academic_term')
        verbose_name_plural = "School Fees"
    
    @property
    def total_fee(self):
        return self.tuition_fee + self.levy_fee + self.sports_fee + self.computer_fee + self.other_fees
    
    def __str__(self):
        return f"{self.grade_name} - {self.academic_term} {self.academic_year}: {self.currency}{self.total_fee}"
