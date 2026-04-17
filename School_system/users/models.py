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
    ACCOMMODATION_TYPE_CHOICES = [
        ('day', 'Day School'),
        ('boarding', 'Boarding School'),
        ('both', 'Day & Boarding School'),
    ]

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, unique=True)
    school_type = models.CharField(max_length=20, choices=SCHOOL_TYPE_CHOICES, default='secondary')
    accommodation_type = models.CharField(
        max_length=20,
        choices=ACCOMMODATION_TYPE_CHOICES,
        default='day',
        db_index=True,
    )
    curriculum = models.CharField(max_length=20, choices=CURRICULUM_CHOICES, default='zimsec')
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default='Zimbabwe')
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    logo = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    is_suspended = models.BooleanField(default=False)
    suspension_reason = models.TextField(blank=True, null=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

    @property
    def supports_boarding(self):
        return self.accommodation_type in ('boarding', 'both')

    @property
    def supports_day(self):
        return self.accommodation_type in ('day', 'both')

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
        ('security', 'Security'),
        ('cleaner', 'Cleaner'),
        ('librarian', 'Librarian'),
        ('superadmin', 'Super Admin'),
    ]

    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, db_index=True)
    student_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    whatsapp_pin = models.CharField(max_length=128, null=True, blank=True)
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
    # Per-term opening and closing dates
    term_1_start = models.DateField(null=True, blank=True)
    term_1_end = models.DateField(null=True, blank=True)
    term_2_start = models.DateField(null=True, blank=True)
    term_2_end = models.DateField(null=True, blank=True)
    term_3_start = models.DateField(null=True, blank=True)
    term_3_end = models.DateField(null=True, blank=True)
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


class ReportCardConfig(models.Model):
    """Per-school report card customisation — controls PDF appearance and content."""
    BORDER_CHOICES = [
        ('simple', 'Simple Line'),
        ('decorative', 'Decorative'),
        ('none', 'No Border'),
    ]
    LOGO_POSITION_CHOICES = [
        ('left', 'Left of School Name'),
        ('right', 'Right of School Name'),
        ('center', 'Centered Above Name'),
    ]
    FONT_FAMILY_CHOICES = [
        ('serif', 'Serif (Classic)'),
        ('sans', 'Sans-Serif (Modern)'),
        ('elegant', 'Elegant (Italic Serif)'),
    ]
    FONT_SCALE_CHOICES = [
        ('compact', 'Compact'),
        ('normal', 'Normal'),
        ('large', 'Large'),
    ]
    HEADER_STYLE_CHOICES = [
        ('solid', 'Solid Colour'),
        ('gradient', 'Gradient'),
        ('banner', 'Banner Image'),
    ]
    PAGE_SIZE_CHOICES = [('A4', 'A4'), ('letter', 'Letter')]
    ORIENTATION_CHOICES = [('portrait', 'Portrait'), ('landscape', 'Landscape')]

    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='report_config')

    # ── Branding ────────────────────────────────────────────────────
    logo = models.ImageField(upload_to='report_logos/', blank=True)
    stamp_image = models.ImageField(upload_to='report_stamps/', blank=True)
    banner_image = models.ImageField(upload_to='report_banners/', blank=True)
    logo_position = models.CharField(max_length=10, choices=LOGO_POSITION_CHOICES, default='center')
    primary_color = models.CharField(max_length=7, default='#1d4ed8')
    secondary_color = models.CharField(max_length=7, default='#f3f4f6')
    gradient_start_color = models.CharField(max_length=7, default='#1d4ed8')
    gradient_end_color = models.CharField(max_length=7, default='#3b82f6')
    header_style = models.CharField(max_length=10, choices=HEADER_STYLE_CHOICES, default='solid')

    # ── Typography / page ───────────────────────────────────────────
    font_family = models.CharField(max_length=10, choices=FONT_FAMILY_CHOICES, default='serif')
    font_size_scale = models.CharField(max_length=10, choices=FONT_SCALE_CHOICES, default='normal')
    page_size = models.CharField(max_length=10, choices=PAGE_SIZE_CHOICES, default='A4')
    page_orientation = models.CharField(max_length=10, choices=ORIENTATION_CHOICES, default='portrait')
    one_page_fit = models.BooleanField(default=False, help_text='Auto-shrink to one page')
    template_preset = models.CharField(max_length=30, blank=True, help_text='Last applied preset name')

    # ── Layout ──────────────────────────────────────────────────────
    show_grading_key = models.BooleanField(default=True)
    show_attendance = models.BooleanField(default=True)
    show_attendance_breakdown = models.BooleanField(default=False, help_text='Present/absent/late breakdown')
    show_overall_average = models.BooleanField(default=True)
    show_position = models.BooleanField(default=True, help_text='Position in class')
    show_class_average = models.BooleanField(default=False, help_text='Class average & highest columns')
    show_previous_term = models.BooleanField(default=False, help_text='Previous-term trend column')
    show_effort_grade = models.BooleanField(default=False, help_text='Effort/attitude grade per subject')
    show_subject_chart = models.BooleanField(default=False, help_text='Bar chart of subject scores')
    show_promotion_status = models.BooleanField(default=False)
    show_fees_status = models.BooleanField(default=False, help_text='Show fees balance line')
    show_qr_code = models.BooleanField(default=False, help_text='QR code linking to online verification')
    subject_grouping_enabled = models.BooleanField(default=False, help_text='Group by Core/Electives/Languages')

    # ── Content ─────────────────────────────────────────────────────
    principal_name = models.CharField(max_length=120, blank=True)
    principal_title = models.CharField(max_length=120, blank=True, default='Head of School')
    show_class_teacher = models.BooleanField(default=True)
    teacher_comments_default = models.TextField(blank=True, help_text='Default teacher comment on every report')
    principal_comments_default = models.TextField(blank=True, help_text='Default principal comment on every report')
    comment_char_limit = models.IntegerField(default=250, help_text='Max chars for per-subject teacher comments')
    show_next_term_dates = models.BooleanField(default=True, help_text='Show next term opening/closing (hidden for Term 3)')
    custom_footer_text = models.CharField(max_length=255, blank=True)

    # ── Grading display ─────────────────────────────────────────────
    show_grade_remark = models.BooleanField(default=True, help_text='Show Distinction/Merit/Credit etc.')
    show_exam_types = models.BooleanField(default=True, help_text='Show individual exam types vs aggregated average')
    highlight_pass_fail = models.BooleanField(default=False, help_text='Color-code rows by grade')

    # ── Extras ──────────────────────────────────────────────────────
    watermark_text = models.CharField(max_length=60, blank=True)
    border_style = models.CharField(max_length=15, choices=BORDER_CHOICES, default='simple')
    show_conduct_section = models.BooleanField(default=False)
    show_activities_section = models.BooleanField(default=False)

    def __str__(self):
        return f"Report Card Config for {self.school.name}"


class ReportCardTemplate(models.Model):
    """Shareable report card templates — global across all tenants."""
    name = models.CharField(max_length=80, unique=True)
    description = models.CharField(max_length=255, blank=True)
    config_json = models.JSONField(default=dict, help_text='Snapshot of ReportCardConfig field values')
    is_builtin = models.BooleanField(default=False, help_text='System-provided presets cannot be deleted')
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_builtin', 'name']

    def __str__(self):
        return f"Template: {self.name}"


class SubjectGroup(models.Model):
    """Lets a school group subjects (Core / Electives / Languages) for report card sections."""
    GROUP_TYPE_CHOICES = [
        ('core', 'Core'),
        ('elective', 'Electives'),
        ('language', 'Languages'),
        ('other', 'Other'),
    ]
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='subject_groups')
    subject = models.ForeignKey('academics.Subject', on_delete=models.CASCADE, related_name='groups')
    group_type = models.CharField(max_length=20, choices=GROUP_TYPE_CHOICES, default='core')

    class Meta:
        unique_together = ('school', 'subject')

    def __str__(self):
        return f"{self.subject.name} → {self.group_type}"


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


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('announcement', 'Announcement'),
        ('message', 'Message'),
        ('fee_reminder', 'Fee Reminder'),
        ('homework', 'Homework'),
        ('attendance', 'Attendance'),
        ('result', 'Result'),
        ('general', 'General'),
    ]
    user = models.ForeignKey('CustomUser', on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='general')
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=500, blank=True)
    date_created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_created']

    def __str__(self):
        return f"{self.user.email} - {self.title} ({'Read' if self.is_read else 'Unread'})"
