from django.db import models
from django.conf import settings
from django.utils import timezone
from users.models import TenantAwareManager, TenantSoftDeleteManager


class Subject(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)
    description = models.TextField(blank=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, null=True, blank=True, related_name='subjects')
    # Grade weighting for CA vs Final Exam (must sum to 1.0)
    ca_weight = models.FloatField(default=0.4, help_text='Continuous Assessment weight (e.g. 0.4 = 40%)')
    exam_weight = models.FloatField(default=0.6, help_text='Final Exam weight (e.g. 0.6 = 60%)')
    # Priority subjects get scheduled every day (1-2 periods/day) before others
    is_priority = models.BooleanField(default=False, help_text='Priority subjects (e.g. Math, English) get daily periods')
    # Soft delete
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = TenantSoftDeleteManager()

    class Meta:
        unique_together = ('code', 'school')

    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        super().delete()

    def __str__(self):
        return f"{self.code} - {self.name}"


class Class(models.Model):
    name = models.CharField(max_length=50)
    grade_level = models.IntegerField()
    academic_year = models.CharField(max_length=20)
    class_teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='taught_classes')
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, null=True, blank=True, related_name='classes')

    objects = TenantAwareManager()
    
    first_period_start = models.TimeField(null=True, blank=True, help_text="Time first period starts (24hr format, e.g., 07:30)")
    last_period_end = models.TimeField(null=True, blank=True, help_text="Time last period ends (24hr format, e.g., 16:00)")
    period_duration_minutes = models.IntegerField(default=45, help_text="Duration of each period in minutes")
    break_start = models.TimeField(null=True, blank=True, help_text="Morning break start time")
    break_end = models.TimeField(null=True, blank=True, help_text="Morning break end time")
    lunch_start = models.TimeField(null=True, blank=True, help_text="Lunch break start time")
    lunch_end = models.TimeField(null=True, blank=True, help_text="Lunch break end time")
    friday_last_period_end = models.TimeField(null=True, blank=True, help_text="Time last period ends on Friday (schools often close early)")
    include_transition_time = models.BooleanField(default=False, help_text="Include 5 minutes between periods for class changes")
    
    class Meta:
        verbose_name_plural = "Classes"
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} - {self.academic_year}"


class SportsHouse(models.Model):
    school = models.ForeignKey('users.School', on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default="#2563eb")
    captain = models.ForeignKey('Student', null=True, blank=True, on_delete=models.SET_NULL, related_name='house_captaincy')

    def __str__(self):
        return f"{self.name} House"


class Student(models.Model):
    RESIDENCE_TYPE_CHOICES = [
        ('day', 'Day Scholar'),
        ('boarding', 'Boarding Scholar'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='students')
    residence_type = models.CharField(max_length=20, choices=RESIDENCE_TYPE_CHOICES, default='day', db_index=True)
    admission_date = models.DateField()
    parent_contact = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    emergency_contact = models.CharField(max_length=20, blank=True)
    house = models.ForeignKey(SportsHouse, null=True, blank=True, on_delete=models.SET_NULL, related_name='students')

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return f"{self.user.student_number} - {self.user.full_name}"


class DietaryFlag(models.Model):
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='dietary_flag')
    allergies = models.TextField(blank=True)
    special_diet = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dietary Flag - {self.student.user.full_name}"


class Dormitory(models.Model):
    GENDER_CHOICES = [
        ('mixed', 'Mixed'),
        ('male', 'Male'),
        ('female', 'Female'),
    ]

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='dormitories')
    name = models.CharField(max_length=100)
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, default='mixed')
    capacity = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('school', 'name')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.school.name})"


class DormAssignment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='dorm_assignments')
    dormitory = models.ForeignKey(Dormitory, on_delete=models.CASCADE, related_name='assignments')
    room_name = models.CharField(max_length=50)
    bed_name = models.CharField(max_length=50)
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-assigned_at']

    def __str__(self):
        return f"{self.student.user.full_name} - {self.dormitory.name} ({self.room_name}/{self.bed_name})"


class MealMenu(models.Model):
    MEAL_TYPE_CHOICES = [
        ('breakfast', 'Breakfast'),
        ('lunch', 'Lunch'),
        ('supper', 'Supper'),
    ]

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='meal_menus')
    date = models.DateField(db_index=True)
    meal_type = models.CharField(max_length=20, choices=MEAL_TYPE_CHOICES, db_index=True)
    menu_text = models.TextField()
    posted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('school', 'date', 'meal_type')
        ordering = ['-date', 'meal_type']

    def __str__(self):
        return f"{self.school.name} - {self.date} {self.meal_type}"


class MealAttendance(models.Model):
    STATUS_CHOICES = [
        ('ate', 'Ate'),
        ('absent', 'Absent'),
        ('excused', 'Excused'),
    ]

    meal_menu = models.ForeignKey(MealMenu, on_delete=models.CASCADE, related_name='attendance_records')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='meal_attendance')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ate')
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    marked_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('meal_menu', 'student')
        ordering = ['-marked_at']

    def __str__(self):
        return f"{self.student.user.full_name} - {self.meal_menu.date} {self.meal_menu.meal_type} ({self.status})"


class DormRollCall(models.Model):
    CALL_TYPE_CHOICES = [
        ('morning', 'Morning'),
        ('evening', 'Evening'),
    ]
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('excused', 'Excused'),
    ]

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='dorm_roll_calls')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='dorm_roll_calls')
    call_date = models.DateField(db_index=True)
    call_type = models.CharField(max_length=20, choices=CALL_TYPE_CHOICES, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present')
    remarks = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'call_date', 'call_type')
        ordering = ['-call_date', '-created_at']

    def __str__(self):
        return f"{self.student.user.full_name} - {self.call_date} {self.call_type}"


class LightsOutRecord(models.Model):
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='lights_out_records')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='lights_out_records')
    date = models.DateField(db_index=True)
    in_bed_time = models.TimeField()
    remarks = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.student.user.full_name} - {self.date} {self.in_bed_time}"


class ExeatRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('denied', 'Denied'),
    ]

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='exeat_requests')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='exeat_requests')
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    date_from = models.DateField()
    date_to = models.DateField()
    reason = models.TextField()
    collecting_person = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    decision_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_exeat_requests'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Exeat - {self.student.user.full_name} ({self.status})"


class ExeatMovementLog(models.Model):
    ACTION_CHOICES = [
        ('sign_out', 'Sign Out'),
        ('sign_in', 'Sign In'),
    ]

    exeat_request = models.ForeignKey(ExeatRequest, on_delete=models.CASCADE, related_name='movement_logs')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='exeat_movement_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    action_time = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-action_time']

    def __str__(self):
        return f"{self.student.user.full_name} - {self.action} @ {self.action_time}"


class MedicationSchedule(models.Model):
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='medication_schedules')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='medication_schedules')
    medication_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=100)
    administration_time = models.TimeField()
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    instructions = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.user.full_name} - {self.medication_name}"


class TuckWallet(models.Model):
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='tuck_wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Tuck Wallet - {self.student.user.full_name}"


class TuckTransaction(models.Model):
    TRANSACTION_TYPE_CHOICES = [
        ('topup', 'Top Up'),
        ('purchase', 'Purchase'),
    ]

    wallet = models.ForeignKey(TuckWallet, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.wallet.student.user.full_name} - {self.transaction_type} {self.amount}"


class LaundrySchedule(models.Model):
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='laundry_schedules')
    dormitory = models.ForeignKey(Dormitory, on_delete=models.SET_NULL, null=True, blank=True, related_name='laundry_schedules')
    day_of_week = models.CharField(max_length=20)
    time_slot = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['day_of_week', 'time_slot']

    def __str__(self):
        dorm = self.dormitory.name if self.dormitory else "All Dorms"
        return f"{self.school.name} - {dorm} ({self.day_of_week})"


class LostItemReport(models.Model):
    STATUS_CHOICES = [
        ('reported', 'Reported'),
        ('found', 'Found'),
        ('resolved', 'Resolved'),
    ]

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='lost_item_reports')
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='lost_item_reports')
    item_description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='reported')
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_lost_items'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Lost Item - {self.status}"


class PrepAttendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('excused', 'Excused'),
    ]

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='prep_attendance')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='prep_attendance')
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present')
    remarks = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"Prep - {self.student.user.full_name} ({self.date})"


class DormInspectionScore(models.Model):
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='dorm_inspections')
    dormitory = models.ForeignKey(Dormitory, on_delete=models.CASCADE, related_name='inspections')
    inspection_date = models.DateField(db_index=True)
    score = models.IntegerField()
    max_score = models.IntegerField(default=10)
    notes = models.TextField(blank=True)
    inspected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-inspection_date']

    def __str__(self):
        return f"{self.dormitory.name} - {self.inspection_date} ({self.score}/{self.max_score})"


class StudentWellnessCheckIn(models.Model):
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='wellness_checkins')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='wellness_checkins')
    check_date = models.DateField(db_index=True)
    mood_score = models.IntegerField(help_text='1-5 wellbeing score')
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-check_date']

    def __str__(self):
        return f"Wellness - {self.student.user.full_name} ({self.check_date})"


class Teacher(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    subjects_taught = models.ManyToManyField(Subject, related_name='teachers')
    teaching_classes = models.ManyToManyField(
        Class,
        related_name='assigned_subject_teachers',
        blank=True,
        help_text='Forms/grades this teacher is approved to teach across (in addition to class teacher role).',
    )
    hire_date = models.DateField()
    qualification = models.CharField(max_length=200, blank=True)
    
    def __str__(self):
        return f"{self.user.full_name} - Teacher"


class Parent(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    children = models.ManyToManyField(Student, related_name='parents', blank=True)
    schools = models.ManyToManyField('users.School', related_name='parents', blank=True)
    occupation = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name} - Parent"


class ParentChildLink(models.Model):
    """Track confirmed/unconfirmed parent-child relationships"""
    parent = models.ForeignKey(Parent, on_delete=models.CASCADE, related_name='child_links')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='parent_links')
    is_confirmed = models.BooleanField(default=False)
    linked_date = models.DateTimeField(auto_now_add=True)
    confirmed_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ('parent', 'student')
    
    def __str__(self):
        status = "Confirmed" if self.is_confirmed else "Pending"
        return f"{self.parent.user.first_name} {self.parent.user.last_name} -> {self.student.user.first_name} {self.student.user.last_name} ({status})"


class Result(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='results', db_index=True)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, db_index=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, db_index=True)
    exam_type = models.CharField(max_length=50)  # Midterm, Final, Quiz, CA, etc.
    score = models.FloatField()
    max_score = models.FloatField()
    weight = models.FloatField(default=1.0, help_text='Weight for weighted average (e.g. 0.4 for CA, 0.6 for Exam)')
    date_recorded = models.DateTimeField(auto_now_add=True)
    academic_term = models.CharField(max_length=50, db_index=True)
    academic_year = models.CharField(max_length=20, db_index=True)
    include_in_report = models.BooleanField(default=True, db_index=True,
        help_text='Whether this result appears on the report card')
    report_term = models.CharField(max_length=50, blank=True, default='', db_index=True,
        help_text='Override term for report card (blank = use academic_term)')
    assessment_plan = models.ForeignKey(
        'AssessmentPlan', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='results',
        help_text='Plan this result belongs to (null for legacy / ad-hoc entries)'
    )
    component_kind = models.CharField(
        max_length=10, blank=True, default='',
        help_text="Plan component kind: 'paper', 'test', 'assignment', or '' for legacy/other"
    )
    component_index = models.IntegerField(
        null=True, blank=True,
        help_text='1-based index within its kind (e.g. paper_number 1..6, test 1..N)'
    )

    class Meta:
        indexes = [
            models.Index(fields=['student', 'academic_year', 'academic_term']),
            models.Index(fields=['student', 'academic_year', 'include_in_report']),
        ]

    @property
    def percentage(self):
        if self.max_score and self.max_score > 0:
            return round((self.score / self.max_score) * 100, 2)
        return 0.0

    def __str__(self):
        return f"{self.student.user.full_name} - {self.subject.name}: {self.score}/{self.max_score}"


class AssessmentPlan(models.Model):
    """
    Admin/HR-boss-defined plan of which assessment components are being written
    in a given term for a set of subjects. Teachers enter marks against components
    declared here; parents and students see the same plan.

    A plan is scoped to (school, academic_year, academic_term) and attached to
    one or more Subjects via the M2M `subjects`. Each (school, year, term, subject)
    triple should have at most one active plan — enforced in the save() below.
    """
    school = models.ForeignKey(
        'users.School', on_delete=models.CASCADE, related_name='assessment_plans', db_index=True
    )
    academic_year = models.CharField(max_length=20, db_index=True)
    academic_term = models.CharField(max_length=50, db_index=True)
    subjects = models.ManyToManyField(Subject, related_name='assessment_plans')
    grade_levels = models.JSONField(
        default=list, blank=True,
        help_text='Optional list of grade/form levels this plan applies to, e.g. [1,2]. Empty = all grades.'
    )

    num_papers = models.PositiveSmallIntegerField(
        default=0, help_text='How many exam papers are written this term (0-6)'
    )
    paper_numbers = models.JSONField(
        default=list, blank=True,
        help_text='Which paper numbers are written, e.g. [1,2,4]. If empty, defaults to 1..num_papers'
    )
    paper_weights = models.JSONField(
        default=dict, blank=True,
        help_text='Optional per-paper weight map, e.g. {"1": 0.25, "2": 0.25, "4": 0.5}. Empty = equal weights'
    )
    num_tests = models.PositiveSmallIntegerField(default=0)
    num_assignments = models.PositiveSmallIntegerField(default=0)

    # Composite weights: how much each component category contributes to the final
    # subject percentage. Must sum to 1.0. If a category has zero items, its weight
    # is redistributed proportionally at calc time so no marks are "lost".
    papers_weight = models.FloatField(
        default=0.6, help_text='Weight of combined exam papers in final mark (0..1)'
    )
    tests_weight = models.FloatField(
        default=0.25, help_text='Weight of combined tests in final mark (0..1)'
    )
    assignments_weight = models.FloatField(
        default=0.15, help_text='Weight of combined assignments in final mark (0..1)'
    )

    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assessment_plans_created'
    )
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['school', 'academic_year', 'academic_term']),
        ]

    def __str__(self):
        return f"AssessmentPlan({self.academic_year} {self.academic_term}) — {self.num_papers}P/{self.num_tests}T/{self.num_assignments}A"

    def effective_paper_numbers(self):
        """Return the list of paper numbers actually written, defaulting to 1..num_papers."""
        if self.paper_numbers:
            return [int(n) for n in self.paper_numbers]
        return list(range(1, int(self.num_papers) + 1))


class SubjectTermFeedback(models.Model):
    """Per-student, per-subject, per-term teacher comment + effort grade for the report card."""
    EFFORT_CHOICES = [
        ('A', 'Excellent'),
        ('B', 'Good'),
        ('C', 'Satisfactory'),
        ('D', 'Needs Improvement'),
        ('E', 'Poor'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='subject_feedback')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='term_feedback')
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True)
    academic_year = models.CharField(max_length=20, db_index=True)
    academic_term = models.CharField(max_length=50, db_index=True)
    comment = models.TextField(blank=True)
    effort_grade = models.CharField(max_length=1, choices=EFFORT_CHOICES, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'subject', 'academic_year', 'academic_term')

    def __str__(self):
        return f"{self.student.user.full_name} – {self.subject.name} ({self.academic_term} {self.academic_year})"


class Timetable(models.Model):
    class_assigned = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='timetable')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    day_of_week = models.CharField(max_length=20)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=50, blank=True)
    
    def __str__(self):
        return f"{self.class_assigned.name} - {self.subject.name} - {self.day_of_week}"


class Announcement(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    target_audience = models.CharField(max_length=50)  # all, students, parents, teachers, staff
    target_audiences = models.JSONField(default=list, blank=True)
    target_class = models.ForeignKey('Class', on_delete=models.CASCADE, null=True, blank=True,
        help_text='If set, only users in this class see the announcement')
    date_posted = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        audiences = self.target_audiences or [self.target_audience]
        return f"{self.title} - {', '.join(audiences)}"


class AnnouncementDismissal(models.Model):
    """Per-user dismissal so users can clear announcements from their own feed only."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='dismissed_announcements')
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='dismissals')
    dismissed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('user', 'announcement')
        indexes = [
            models.Index(fields=['user', 'dismissed_at']),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.announcement_id}"


class ReportCardRelease(models.Model):
    """Tracks which class/year/term report cards have been published by the admin."""
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='report_releases')
    class_obj = models.ForeignKey('Class', on_delete=models.CASCADE, related_name='report_releases')
    academic_year = models.CharField(max_length=20)
    academic_term = models.CharField(max_length=50)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('school', 'class_obj', 'academic_year', 'academic_term')

    def __str__(self):
        return f"{self.class_obj.name} - {self.academic_term} {self.academic_year}"


class ReportCardApprovalRequest(models.Model):
    """Teacher submission that requires admin sign-off before report visibility."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='report_approval_requests')
    class_obj = models.ForeignKey('Class', on_delete=models.CASCADE, related_name='report_approval_requests')
    academic_year = models.CharField(max_length=20)
    academic_term = models.CharField(max_length=50)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='report_approval_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_report_approval_requests')
    admin_note = models.TextField(blank=True)
    teacher_comment = models.TextField(blank=True, help_text='Class teacher remark for the report card')

    class Meta:
        unique_together = ('school', 'class_obj', 'academic_year', 'academic_term')
        indexes = [
            models.Index(fields=['school', 'status']),
            models.Index(fields=['school', 'academic_year', 'academic_term']),
        ]
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.class_obj.name} - {self.academic_term} {self.academic_year} ({self.status})"


class Complaint(models.Model):
    COMPLAINT_TYPE_CHOICES = [
        ('parent', 'Parent'),
        ('teacher', 'Teacher'),
        ('general', 'General'),
    ]

    student = models.ForeignKey(Student, on_delete=models.SET_NULL, related_name='complaints', null=True, blank=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='complaints', null=True, blank=True)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    complaint_type = models.CharField(max_length=20, choices=COMPLAINT_TYPE_CHOICES, default='general')
    title = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(max_length=50, default='pending')  # pending, in_progress, resolved
    date_submitted = models.DateTimeField(auto_now_add=True)
    date_resolved = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.title} - {self.status}"


class Suspension(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='suspensions')
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    reason = models.TextField()
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    date_created = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.student.user.first_name} {self.student.user.last_name} - Suspended ({self.start_date} to {self.end_date})"


class SchoolEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ('holiday', 'Holiday'),
        ('activity', 'Activity'),
        ('exam', 'Exam'),
        ('event', 'Event'),
    ]
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    location = models.CharField(max_length=200, blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_created = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.title} ({self.event_type}) - {self.start_date}"


class Assignment(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='assignments')
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='assignments')
    assigned_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='assignments')
    deadline = models.DateTimeField()
    date_created = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.title} - {self.subject.name} ({self.assigned_class.name})"


class WeeklyMessage(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='weekly_messages')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='weekly_messages')
    message = models.TextField()
    week_number = models.IntegerField()
    performance_rating = models.IntegerField(null=True, blank=True)  # 1-5 stars
    areas_of_improvement = models.JSONField(default=list, blank=True)
    strengths = models.JSONField(default=list, blank=True)
    date_sent = models.DateField()
    academic_year = models.CharField(max_length=20)
    academic_term = models.CharField(max_length=50)
    
    def __str__(self):
        return f"{self.subject.name} - {self.student.user.first_name} {self.student.user.last_name} (Week {self.week_number})"


ATTENDANCE_STATUS_CHOICES = [
    ('present', 'Present'),
    ('absent', 'Absent'),
    ('late', 'Late'),
    ('excused', 'Excused'),
]


class ClassAttendance(models.Model):
    """Daily class attendance — marked once per day by the class teacher."""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='class_attendance_records', db_index=True)
    class_assigned = models.ForeignKey('Class', on_delete=models.CASCADE, related_name='class_attendance_records')
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=20, choices=ATTENDANCE_STATUS_CHOICES, db_index=True)
    remarks = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    date_recorded = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'date')

    def __str__(self):
        return f"{self.student.user.first_name} {self.student.user.last_name} - {self.date} ({self.status})"


class SubjectAttendance(models.Model):
    """Per-subject attendance — marked by the subject teacher at lesson start."""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='subject_attendance_records', db_index=True)
    class_assigned = models.ForeignKey('Class', on_delete=models.CASCADE, related_name='subject_attendance_records')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='subject_attendance_records')
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=20, choices=ATTENDANCE_STATUS_CHOICES, db_index=True)
    remarks = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    date_recorded = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'date', 'subject')

    def __str__(self):
        return f"{self.student.user.first_name} {self.student.user.last_name} - {self.subject.name} - {self.date} ({self.status})"


# Keep backward-compatible alias so existing imports (report card, etc.) don't break immediately
Attendance = ClassAttendance


class ParentTeacherMessage(models.Model):
    """Messages between parents and teachers"""
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_messages')
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='related_messages')
    parent_message = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    is_read = models.BooleanField(default=False)
    date_sent = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-date_sent']
    
    def __str__(self):
        return f"From {self.sender.first_name} to {self.recipient.first_name} - {self.date_sent.strftime('%Y-%m-%d %H:%M')}"


def homework_file_path(instance, filename):
    return f'homework/{instance.subject.code}/{filename}'


class Homework(models.Model):
    title = models.CharField(max_length=200)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='homework')
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='homework')
    assigned_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='homework')
    description = models.TextField(blank=True)
    file = models.FileField(upload_to=homework_file_path, blank=True, null=True)
    due_date = models.DateField()
    date_created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_created']

    def __str__(self):
        return f"{self.subject.name} Homework - {self.title} ({self.assigned_class.name})"


def submission_file_path(instance, filename):
    return f'submissions/{instance.assignment.subject.code}/{filename}'


class AssignmentSubmission(models.Model):
    """Student submission for an Assignment."""
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('late', 'Late Submission'),
        ('graded', 'Graded'),
    ]

    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='submissions')
    submitted_file = models.FileField(upload_to=submission_file_path, blank=True, null=True)
    text_submission = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    grade = models.FloatField(null=True, blank=True)
    feedback = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')

    class Meta:
        unique_together = ('assignment', 'student')
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.student.user.full_name} → {self.assignment.title}"


class PromotionRecord(models.Model):
    """Records year-end student promotions, repeats, and graduations."""
    ACTION_CHOICES = [
        ('promote', 'Promoted'),
        ('repeat', 'Repeating'),
        ('graduate', 'Graduated'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='promotions')
    from_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, related_name='promotions_from')
    to_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, blank=True, related_name='promotions_to')
    academic_year = models.CharField(max_length=20)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default='promote')
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    date_processed = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, null=True, blank=True)

    class Meta:
        unique_together = ('student', 'academic_year')

    def __str__(self):
        return f"{self.student.user.full_name}: {self.from_class} -> {self.to_class or 'Graduated'} ({self.action})"


class Activity(models.Model):
    ACTIVITY_TYPES = [
        ('sport', 'Sport'),
        ('club', 'Club'),
        ('society', 'Society'),
        ('arts', 'Arts'),
    ]
    AGE_GROUP_CHOICES = [
        ('u13', 'Under 13'),
        ('u14', 'Under 14'),
        ('u15', 'Under 15'),
        ('u16', 'Under 16'),
        ('u17', 'Under 17'),
        ('u18', 'Under 18'),
        ('u19', 'Under 19'),
        ('u20', 'Under 20'),
        ('first_team', 'First Team'),
        ('open', 'Open'),
    ]
    GENDER_CHOICES = [
        ('boys', 'Boys'),
        ('girls', 'Girls'),
        ('mixed', 'Mixed'),
    ]
    LEVEL_CHOICES = [
        ('inter_house', 'Inter-House'),
        ('inter_school', 'Inter-School'),
        ('social', 'Social/Recreational'),
    ]
    name = models.CharField(max_length=100)
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    age_group = models.CharField(max_length=20, choices=AGE_GROUP_CHOICES, default='open')
    gender_category = models.CharField(max_length=20, choices=GENDER_CHOICES, default='mixed')
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='social')
    description = models.TextField(blank=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='activities')
    coach = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='coached_activities')
    assistant_coach = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assistant_coached_activities')
    schedule_day = models.CharField(max_length=20, blank=True)
    schedule_time = models.TimeField(null=True, blank=True)
    location = models.CharField(max_length=200, blank=True)
    max_participants = models.IntegerField(default=30)
    is_active = models.BooleanField(default=True)
    date_created = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Activities"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_activity_type_display()})"


class ActivityEnrollment(models.Model):
    ROLE_CHOICES = [
        ('member', 'Member'),
        ('captain', 'Captain'),
        ('vice_captain', 'Vice Captain'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('declined', 'Declined'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='activity_enrollments')
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='enrollments')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='approved')
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_enrollment_requests',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_enrollment_reviews',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    date_joined = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    is_suspended = models.BooleanField(default=False)
    suspension_reason = models.TextField(blank=True)
    is_injured = models.BooleanField(default=False)
    injury_cleared_date = models.DateField(null=True, blank=True)
    injury_notes = models.TextField(blank=True)

    class Meta:
        unique_together = ('student', 'activity')

    def __str__(self):
        return f"{self.student.user.full_name} - {self.activity.name} ({self.role})"


class ActivityEvent(models.Model):
    EVENT_TYPES = [
        ('practice', 'Practice'),
        ('match', 'Match'),
        ('competition', 'Competition'),
        ('performance', 'Performance'),
        ('meeting', 'Meeting'),
    ]
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='events')
    title = models.CharField(max_length=200)
    event_type = models.CharField(max_length=20, choices=[('training', 'Training'), ('match', 'Match'), ('tournament', 'Tournament'), ('inter_house', 'Inter-House')], default='training')
    event_date = models.DateTimeField()
    location = models.CharField(max_length=200, blank=True)
    venue = models.CharField(max_length=255, blank=True)
    opponent = models.CharField(max_length=200, blank=True)
    opponent_school = models.CharField(max_length=255, blank=True)
    is_home = models.BooleanField(default=True)
    transport_required = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=[('scheduled', 'Scheduled'), ('completed', 'Completed'), ('cancelled', 'Cancelled'), ('postponed', 'Postponed')], default='scheduled')
    our_score = models.CharField(max_length=50, blank=True, help_text="e.g. 2, 14, 120/4")
    opponent_score = models.CharField(max_length=50, blank=True, help_text="e.g. 1, 10, 110/10")
    match_result = models.CharField(max_length=20, choices=[('win', 'Win'), ('loss', 'Loss'), ('draw', 'Draw'), ('na', 'N/A')], default='na')
    result = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    date_created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-event_date']

    def __str__(self):
        return f"{self.activity.name} - {self.title} ({self.event_date.strftime('%Y-%m-%d')})"

class MatchSquadEntry(models.Model):
    event = models.ForeignKey(ActivityEvent, on_delete=models.CASCADE, related_name='squad')
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    is_captain = models.BooleanField(default=False)
    jersey_number = models.IntegerField(null=True, blank=True)
    played = models.BooleanField(default=True)

class TrainingAttendance(models.Model):
    event = models.ForeignKey(ActivityEvent, on_delete=models.CASCADE, related_name='attendance_records')
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    present = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True)

class HousePointEntry(models.Model):
    house = models.ForeignKey(SportsHouse, on_delete=models.CASCADE, related_name='points')
    activity_event = models.ForeignKey(ActivityEvent, null=True, blank=True, on_delete=models.SET_NULL)
    points = models.IntegerField()
    reason = models.CharField(max_length=255)
    awarded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    date = models.DateField(auto_now_add=True)


class Accolade(models.Model):
    CATEGORY_CHOICES = [
        ('academic', 'Academic'),
        ('sports', 'Sports'),
        ('conduct', 'Conduct'),
        ('attendance', 'Attendance'),
        ('extracurricular', 'Extracurricular'),
        ('leadership', 'Leadership'),
    ]
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, default='fa-trophy')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    points_value = models.IntegerField(default=10)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='accolades')

    def __str__(self):
        return f"{self.name} ({self.category})"


class StudentAccolade(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='accolades')
    accolade = models.ForeignKey(Accolade, on_delete=models.CASCADE, related_name='awards')
    awarded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    date_awarded = models.DateTimeField(auto_now_add=True)
    reason = models.TextField(blank=True)
    academic_term = models.CharField(max_length=50, blank=True)
    academic_year = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ['-date_awarded']

    def __str__(self):
        return f"{self.student.user.full_name} - {self.accolade.name}"


class ConferenceSlot(models.Model):
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='conference_slots')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_booked = models.BooleanField(default=False)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, null=True)

    class Meta:
        ordering = ['date', 'start_time']
        unique_together = ('teacher', 'date', 'start_time')

    def __str__(self):
        return f"{self.teacher.user.full_name} - {self.date} {self.start_time}-{self.end_time}"


class ConferenceBooking(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]
    slot = models.OneToOneField(ConferenceSlot, on_delete=models.CASCADE, related_name='booking')
    parent = models.ForeignKey(Parent, on_delete=models.CASCADE, related_name='conference_bookings')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='conference_bookings')
    purpose = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed')
    date_booked = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-date_booked']

    def __str__(self):
        return f"{self.parent.user.full_name} -> {self.slot.teacher.user.full_name} ({self.slot.date})"


class DisciplinaryRecord(models.Model):
    SEVERITY_CHOICES = [
        ('minor', 'Minor'),
        ('major', 'Major'),
        ('critical', 'Critical'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='disciplinary_records')
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    incident_type = models.CharField(max_length=100)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='minor')
    description = models.TextField()
    action_taken = models.TextField(blank=True)
    date_of_incident = models.DateField()
    parent_notified = models.BooleanField(default=False)
    follow_up_notes = models.TextField(blank=True)
    is_resolved = models.BooleanField(default=False)
    date_created = models.DateTimeField(auto_now_add=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, null=True)

    class Meta:
        ordering = ['-date_of_incident']

    def __str__(self):
        return f"{self.student.user.full_name} - {self.incident_type} ({self.severity})"


class HealthRecord(models.Model):
    BLOOD_TYPES = [
        ('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'),
        ('AB+', 'AB+'), ('AB-', 'AB-'), ('O+', 'O+'), ('O-', 'O-'),
    ]
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='health_record')
    blood_type = models.CharField(max_length=5, choices=BLOOD_TYPES, blank=True)
    allergies = models.TextField(blank=True, help_text='Comma-separated list of allergies')
    chronic_conditions = models.TextField(blank=True)
    medications = models.TextField(blank=True)
    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    emergency_contact_relationship = models.CharField(max_length=50, blank=True)
    medical_aid_name = models.CharField(max_length=100, blank=True)
    medical_aid_number = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Health Record - {self.student.user.full_name}"


class ClinicVisit(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='clinic_visits')
    visit_date = models.DateTimeField(auto_now_add=True)
    complaint = models.TextField()
    diagnosis = models.TextField(blank=True)
    treatment = models.TextField(blank=True)
    nurse_notes = models.TextField(blank=True)
    parent_notified = models.BooleanField(default=False)
    follow_up_required = models.BooleanField(default=False)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, null=True)

    class Meta:
        ordering = ['-visit_date']

    def __str__(self):
        return f"{self.student.user.full_name} - {self.visit_date.strftime('%Y-%m-%d')}"


class AtRiskAlert(models.Model):
    """Track student at-risk alerts and interventions."""
    STATUS_CHOICES = [
        ('new', 'New'),
        ('acknowledged', 'Acknowledged'),
        ('intervention_scheduled', 'Intervention Scheduled'),
        ('resolved', 'Resolved'),
        ('escalated', 'Escalated'),
    ]
    TRIGGER_CHOICES = [
        ('grade_drop', 'Grade Drop'),
        ('prediction_fail', 'Predicted Failure'),
        ('current_failing', 'Currently Failing'),
        ('consecutive_d_or_e', 'Consecutive D/E Grades'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='at_risk_alerts')
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name='at_risk_alerts')
    triggered_by = models.CharField(max_length=20, choices=TRIGGER_CHOICES)
    previous_grade = models.CharField(max_length=2, null=True, blank=True)
    current_grade = models.CharField(max_length=2)
    predicted_grade = models.CharField(max_length=2, null=True, blank=True)
    predicted_percentage = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='new')
    trend = models.CharField(max_length=20, choices=[('up', 'Improving'), ('down', 'Declining'), ('stable', 'Stable')], null=True, blank=True)
    confidence = models.CharField(max_length=20, choices=[('high', 'High'), ('medium', 'Medium'), ('low', 'Low')], null=True, blank=True)
    
    # Notification flags
    notified_teacher = models.BooleanField(default=False)
    notified_parent = models.BooleanField(default=False)
    notified_admin = models.BooleanField(default=False)
    
    # Follow-up notes
    noted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='at_risk_notes')
    notes = models.TextField(blank=True)
    intervention_plan = models.TextField(blank=True, help_text='Recommended intervention actions')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, null=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', '-created_at']),
            models.Index(fields=['school', 'status']),
            models.Index(fields=['subject', 'status']),
        ]

    def __str__(self):
        return f"{self.student.user.full_name} - {self.subject.name if self.subject else 'Overall'} ({self.status})"
