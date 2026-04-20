from django.db import models
from django.conf import settings
from academics.models import Student
from users.models import TenantAwareManager


class FeeType(models.Model):
    """Represents FeeType."""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    academic_year = models.CharField(max_length=20)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='fee_types', null=True, blank=True)

    objects = TenantAwareManager()

    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.name} - ${self.amount}"


class StudentFee(models.Model):
    """Represents StudentFee."""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fees', db_index=True)
    fee_type = models.ForeignKey(FeeType, on_delete=models.CASCADE, db_index=True)
    amount_due = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    due_date = models.DateField()
    academic_term = models.CharField(max_length=50, db_index=True)
    academic_year = models.CharField(max_length=20, db_index=True)
    is_paid = models.BooleanField(default=False, db_index=True)
    
    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.student.user.full_name} - {self.fee_type.name}"
    
    @property
    def balance(self):
        """Execute balance."""
        return self.amount_due - self.amount_paid


class Payment(models.Model):
    """Represents Payment."""
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
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending', db_index=True)
    transaction_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)
    
    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.student_fee.student.user.full_name} - ${self.amount} ({self.payment_status})"


class Invoice(models.Model):
    """Represents Invoice."""
    objects = TenantAwareManager()

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
        """Return a human-readable string representation."""
        return f"Invoice {self.invoice_number} - {self.student.user.full_name}"
    
    @property
    def balance(self):
        """Execute balance."""
        return self.total_amount - self.amount_paid


class StudentPaymentRecord(models.Model):
    """Represents StudentPaymentRecord."""
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
    
    objects = TenantAwareManager()

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='payment_records', db_index=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='payment_records', db_index=True)
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, default='school_fees')
    payment_plan = models.CharField(max_length=20, choices=PAYMENT_PLAN_CHOICES, default='one_term')
    description = models.CharField(max_length=255, blank=True)
    
    academic_year = models.CharField(max_length=20)
    academic_term = models.CharField(max_length=20, blank=True)
    
    total_amount_due = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default='USD')
    
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid', db_index=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, blank=True)
    
    due_date = models.DateField(null=True, blank=True)
    next_payment_due = models.DateField(null=True, blank=True)
    
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='recorded_payments')
    notes = models.TextField(blank=True)
    
    class Meta:
        """Represents Meta."""
        ordering = ['-date_created']
    
    @property
    def balance(self):
        """Execute balance."""
        return self.total_amount_due - self.amount_paid
    
    @property
    def is_fully_paid(self):
        """Check whether fully paid."""
        return self.amount_paid >= self.total_amount_due
    
    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.student.user.full_name} - {self.payment_type} ({self.payment_status})"


class PaymentTransaction(models.Model):
    """Represents PaymentTransaction."""
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
        """Return a human-readable string representation."""
        return f"{self.payment_record.student.user.full_name} - {self.amount}"


class PaymentIntent(models.Model):
    """Tracks a single online payment attempt and callback lifecycle."""

    STATUS_CHOICES = [
        ('initiated', 'Initiated'),
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    objects = TenantAwareManager()

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='payment_intents')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='payment_intents')
    payment_record = models.ForeignKey(
        StudentPaymentRecord,
        on_delete=models.CASCADE,
        related_name='payment_intents',
    )
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_intents',
    )
    expected_amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default='USD')
    provider = models.CharField(max_length=20, default='paynow')
    payment_method = models.CharField(max_length=20, default='web')
    provider_reference = models.CharField(max_length=120, unique=True)
    poll_url = models.URLField(max_length=500, blank=True)
    idempotency_key = models.CharField(max_length=120, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='initiated', db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    raw_callback_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['school', 'status']),
            models.Index(fields=['school', 'student']),
        ]

    def __str__(self):
        return f"{self.provider_reference} ({self.status})"


class FinancialReport(models.Model):
    """Represents FinancialReport."""
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
        """Return a human-readable string representation."""
        return f"{self.title} - {self.report_type}"


class SchoolExpense(models.Model):
    """Recurring school expense that requires admin approval before counting."""
    EXPENSE_FREQUENCY_CHOICES = [
        ('monthly', 'Monthly'),
        ('term', 'Per Term'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='school_expenses')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_frequency = models.CharField(max_length=20, choices=EXPENSE_FREQUENCY_CHOICES)
    start_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_school_expenses')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_school_expenses')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['school', 'status']),
            models.Index(fields=['school', 'expense_frequency']),
            models.Index(fields=['school', 'start_date']),
        ]

    def __str__(self):
        return f"{self.school.name} - {self.title} ({self.expense_frequency})"


class SchoolFees(models.Model):
    """Represents SchoolFees."""
    objects = TenantAwareManager()

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
    boarding_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    transport_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    academic_year = models.CharField(max_length=20)
    academic_term = models.CharField(max_length=20, choices=TERM_CHOICES)
    currency = models.CharField(max_length=10, default='USD')
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        """Represents Meta."""
        unique_together = ('school', 'grade_level', 'academic_year', 'academic_term')
        verbose_name_plural = "School Fees"
    
    @property
    def total_fee(self):
        """Execute total fee."""
        return self.tuition_fee + self.levy_fee + self.sports_fee + self.computer_fee + self.other_fees
    
    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.grade_name} - {self.academic_term} {self.academic_year}: {self.currency}{self.total_fee}"


class TransportFeePreference(models.Model):
    """Per-parent opt-in/out setting for a child's transport fee."""
    parent = models.ForeignKey('academics.Parent', on_delete=models.CASCADE, related_name='transport_fee_preferences')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='transport_fee_preferences')
    include_transport_fee = models.BooleanField(default=False)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('parent', 'student')
        ordering = ['-updated_at']

    def __str__(self):
        status = 'Included' if self.include_transport_fee else 'Excluded'
        return f"Transport ({status}) - {self.parent.user.full_name} / {self.student.user.full_name}"


class AdditionalFee(models.Model):
    """Additional one-time fees that admin can add for students (e.g., trip fees, uniform, books)"""
    objects = TenantAwareManager()

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='additional_fees')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='additional_fees', null=True, blank=True)
    student_class = models.ForeignKey('academics.Class', on_delete=models.CASCADE, related_name='additional_fees', null=True, blank=True)
    fee_name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    currency = models.CharField(max_length=10, default='USD')
    academic_year = models.CharField(max_length=20)
    academic_term = models.CharField(max_length=20, default='term_1')
    is_paid = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        """Represents Meta."""
        ordering = ['-created_at']
    
    def __str__(self):
        """Return a human-readable string representation."""
        target = self.student.user.full_name if self.student else (self.student_class.name if self.student_class else 'All Students')
        return f"{self.fee_name} - {self.currency}{self.amount} ({target})"
