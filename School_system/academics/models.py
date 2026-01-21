from django.db import models
from django.conf import settings


class Subject(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)
    description = models.TextField(blank=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, null=True, blank=True, related_name='subjects')
    
    class Meta:
        unique_together = ('code', 'school')
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class Class(models.Model):
    name = models.CharField(max_length=50)
    grade_level = models.IntegerField()
    academic_year = models.CharField(max_length=20)
    class_teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='taught_classes')
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, null=True, blank=True, related_name='classes')
    
    class Meta:
        verbose_name_plural = "Classes"
    
    def __str__(self):
        return f"{self.name} - {self.academic_year}"


class Student(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='students')
    admission_date = models.DateField()
    parent_contact = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    
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
    occupation = models.CharField(max_length=100, blank=True)
    
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
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='results')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    exam_type = models.CharField(max_length=50)  # Midterm, Final, Quiz, etc.
    score = models.FloatField()
    max_score = models.FloatField()
    date_recorded = models.DateTimeField(auto_now_add=True)
    academic_term = models.CharField(max_length=50)
    academic_year = models.CharField(max_length=20)
    
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
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('submitted', 'Submitted'),
        ('overdue', 'Overdue'),
    ]
    
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
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
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
