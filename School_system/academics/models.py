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


class Student(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='students')
    admission_date = models.DateField()
    parent_contact = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    emergency_contact = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return f"{self.user.student_number} - {self.user.full_name}"


class Teacher(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    subjects_taught = models.ManyToManyField(Subject, related_name='teachers')
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

    class Meta:
        indexes = [
            models.Index(fields=['student', 'academic_year', 'academic_term']),
        ]

    @property
    def percentage(self):
        if self.max_score and self.max_score > 0:
            return round((self.score / self.max_score) * 100, 2)
        return 0.0

    def __str__(self):
        return f"{self.student.user.full_name} - {self.subject.name}: {self.score}/{self.max_score}"


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
    date_posted = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.title} - {self.target_audience}"


class Complaint(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='complaints')
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
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


class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('excused', 'Excused'),
    ]
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendance_records', db_index=True)
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, db_index=True)
    remarks = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    date_recorded = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'date')
    
    def __str__(self):
        return f"{self.student.user.first_name} {self.student.user.last_name} - {self.date} ({self.status})"


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
    name = models.CharField(max_length=100)
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    description = models.TextField(blank=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='activities')
    coach = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='coached_activities')
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
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='activity_enrollments')
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='enrollments')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    date_joined = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

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
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    event_date = models.DateTimeField()
    location = models.CharField(max_length=200, blank=True)
    opponent = models.CharField(max_length=200, blank=True)
    result = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    date_created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-event_date']

    def __str__(self):
        return f"{self.activity.name} - {self.title} ({self.event_date.strftime('%Y-%m-%d')})"


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
