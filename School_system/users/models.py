from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import secrets
import string


class SoftDeleteManager(models.Manager):
    """Manager that excludes soft-deleted records by default."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

    def all_with_deleted(self):
        return super().get_queryset()

    def deleted_only(self):
        return super().get_queryset().filter(is_deleted=True)


class TenantAwareManager(models.Manager):
    """
    Drop-in manager that enforces school-scoped queries.
    Usage:  Model.objects.for_school(school)
    Falls back to the normal manager for non-tenant access (e.g. superadmin).
    """

    def for_school(self, school):
        if school is None:
            return self.none()
        return self.filter(school=school)


class TenantSoftDeleteManager(models.Manager):
    """Combined tenant-aware + soft-delete manager."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

    def for_school(self, school):
        if school is None:
            return self.none()
        return self.get_queryset().filter(school=school)

    def all_with_deleted(self):
        return super().get_queryset()


class School(models.Model):
    """Multi-tenant School entity - each school is a separate tenant"""
    SCHOOL_TYPE_CHOICES = [
        ('primary', 'Primary School'),
        ('secondary', 'Secondary School'),
        ('high', 'High School'),
        ('combined', 'Combined School'),
    ]

    CURRICULUM_CHOICES = [
        ('zimsec', 'ZIMSEC'),
        ('cambridge', 'Cambridge International'),
        ('both', 'ZIMSEC & Cambridge'),
    ]

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, unique=True)
    school_type = models.CharField(max_length=20, choices=SCHOOL_TYPE_CHOICES, default='secondary')
    curriculum = models.CharField(max_length=20, choices=CURRICULUM_CHOICES, default='zimsec')
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default='Zimbabwe')
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    logo = models.URLField(blank=True)
    admin_password = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_suspended = models.BooleanField(default=False)
    suspension_reason = models.TextField(blank=True, null=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

    @staticmethod
    def generate_school_code():
        """Generate a unique 6-character school code"""
        chars = string.ascii_uppercase + string.digits
        while True:
            code = 'SCH' + ''.join(secrets.choice(chars) for _ in range(5))
            if not School.objects.filter(code=code).exists():
                return code


class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('parent', 'Parent'),
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
        ('hr', 'HR'),
        ('accountant', 'Accountant'),
        ('superadmin', 'Super Admin'),
    ]

    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, db_index=True)
    student_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    whatsapp_pin = models.CharField(max_length=6, null=True, blank=True)
    school = models.ForeignKey(School, on_delete=models.CASCADE, null=True, blank=True, related_name='users', db_index=True)
    created_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_users')

    class Meta:
        ordering = ['-id']

    def save(self, *args, **kwargs):
        # Normalize empty phone_number to None so unique constraint allows multiple blanks
        if not self.phone_number:
            self.phone_number = None
        super().save(*args, **kwargs)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email


class BlacklistedToken(models.Model):
    token = models.TextField(unique=True)
    blacklisted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Blacklisted token at {self.blacklisted_at}"


class SchoolSettings(models.Model):
    """Per-school configuration (term dates, grading system, currency, etc.)"""
    GRADING_CHOICES = [
        ('zimsec', 'ZIMSEC (A-U)'),
        ('cambridge', 'Cambridge International'),
        ('percentage', 'Percentage Only'),
    ]

    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='settings')
    current_academic_year = models.CharField(max_length=20, default='2025')
    current_term = models.CharField(max_length=50, default='Term 1')
    term_start_date = models.DateField(null=True, blank=True)
    term_end_date = models.DateField(null=True, blank=True)
    grading_system = models.CharField(max_length=20, choices=GRADING_CHOICES, default='zimsec')
    school_motto = models.CharField(max_length=255, blank=True)
    currency = models.CharField(max_length=10, default='USD')
    timezone = models.CharField(max_length=50, default='Africa/Harare')
    max_students_per_class = models.IntegerField(default=40)
    late_fee_percentage = models.FloatField(default=0.0, help_text='Percentage charged on overdue fees')
    paynow_integration_id = models.CharField(max_length=100, blank=True, help_text='PayNow Zimbabwe integration ID for this school')
    paynow_integration_key = models.CharField(max_length=255, blank=True, help_text='PayNow Zimbabwe integration key for this school')

    def __str__(self):
        return f"Settings for {self.school.name}"


class AuditLog(models.Model):
    """Tracks every write operation across the system for accountability."""
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
        ('SUSPEND', 'Suspend'),
        ('APPROVE', 'Approve'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    school = models.ForeignKey(School, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)
    model_name = models.CharField(max_length=100, db_index=True)
    object_id = models.CharField(max_length=50, blank=True)
    object_repr = models.CharField(max_length=500, blank=True)
    changes = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    response_status = models.IntegerField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        user_str = self.user.full_name if self.user else 'System'
        return f"{user_str} — {self.action} {self.model_name} at {self.timestamp.strftime('%Y-%m-%d %H:%M')}"
