from django.db import models
from django.conf import settings


class Department(models.Model):
    """Represents Department."""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    head = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='headed_departments')
    
    def __str__(self):
        """Return a human-readable string representation."""
        return self.name


class Staff(models.Model):
    """Represents Staff."""
    POSITION_CHOICES = [
        ('teacher', 'Teacher'),
        ('admin', 'Administrator'),
        ('hr', 'HR Personnel'),
        ('accountant', 'Accountant'),
        ('principal', 'Principal'),
        ('secretary', 'Secretary'),
        ('maintenance', 'Maintenance'),
        ('security', 'Security'),
        ('cleaner', 'Cleaner'),
        ('librarian', 'Librarian'),
    ]
    
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    employee_id = models.CharField(max_length=20, unique=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, related_name='staff_members')
    position = models.CharField(max_length=50, choices=POSITION_CHOICES)
    hire_date = models.DateField()
    salary = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.user.full_name} - {self.position}"


class VisitorLog(models.Model):
    """Daily visitor register entries managed by security."""
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='visitor_logs')
    visitor_name = models.CharField(max_length=255)
    visitor_id_number = models.CharField(max_length=100, blank=True)
    purpose = models.CharField(max_length=255)
    host_name = models.CharField(max_length=255, blank=True)
    check_in_time = models.DateTimeField(auto_now_add=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    vehicle_reg = models.CharField(max_length=50, blank=True)
    logged_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='logged_visitors')
    notes = models.TextField(blank=True)
    date = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ['-check_in_time']

    def __str__(self):
        return f"{self.visitor_name} ({self.date})"


class IncidentReport(models.Model):
    """Security incident reporting for HR/admin review."""
    INCIDENT_TYPE_CHOICES = [
        ('theft', 'Theft'),
        ('trespass', 'Trespass'),
        ('fight', 'Fight'),
        ('damage', 'Damage'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('investigating', 'Investigating'),
        ('closed', 'Closed'),
    ]

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='incident_reports')
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='incident_reports')
    incident_type = models.CharField(max_length=20, choices=INCIDENT_TYPE_CHOICES, default='other')
    title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.CharField(max_length=255, blank=True)
    date_of_incident = models.DateTimeField()
    action_taken = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    date_created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_created']

    def __str__(self):
        return f"{self.title} ({self.status})"


class CleaningSchedule(models.Model):
    """Reusable cleaning schedule template created by HR/admin."""
    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]

    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='cleaning_schedules')
    area_name = models.CharField(max_length=255)
    assigned_to = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True, related_name='cleaning_schedules')
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='daily')
    scheduled_time = models.TimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_cleaning_schedules')
    date_created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_created']

    def __str__(self):
        return f"{self.area_name} ({self.frequency})"


class CleaningTask(models.Model):
    """Daily execution task generated from a cleaning schedule."""
    schedule = models.ForeignKey(CleaningSchedule, on_delete=models.CASCADE, related_name='tasks')
    assigned_to = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True, related_name='cleaning_tasks')
    date = models.DateField()
    is_done = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='cleaning_tasks')

    class Meta:
        unique_together = ['schedule', 'date']
        ordering = ['-date', 'schedule__area_name']

    def __str__(self):
        return f"{self.schedule.area_name} - {self.date}"


class Attendance(models.Model):
    """Represents Attendance."""
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='attendance')
    date = models.DateField()
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default='present')  # present, absent, late, half_day
    notes = models.TextField(blank=True)
    
    class Meta:
        """Represents Meta."""
        unique_together = ['staff', 'date']
    
    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.staff.user.full_name} - {self.date} ({self.status})"


class Leave(models.Model):
    """Represents Leave."""
    LEAVE_TYPE_CHOICES = [
        ('annual', 'Annual Leave'),
        ('sick', 'Sick Leave'),
        ('maternity', 'Maternity Leave'),
        ('emergency', 'Emergency Leave'),
        ('unpaid', 'Unpaid Leave'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]
    
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='leaves')
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    days_requested = models.IntegerField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_leaves')
    date_applied = models.DateTimeField(auto_now_add=True)
    date_reviewed = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.staff.user.full_name} - {self.leave_type} ({self.status})"


class Payroll(models.Model):
    """Represents Payroll."""
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='payrolls')
    month = models.CharField(max_length=20)
    year = models.IntegerField()
    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    allowances = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=10, decimal_places=2)
    pay_date = models.DateField(null=True, blank=True)
    is_paid = models.BooleanField(default=False)
    
    class Meta:
        """Represents Meta."""
        unique_together = ['staff', 'month', 'year']
    
    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.staff.user.full_name} - {self.month} {self.year}"


class Meeting(models.Model):
    """Represents Meeting."""
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    organizer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='organized_meetings')
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='meetings')
    meeting_date = models.DateTimeField()
    location = models.CharField(max_length=200, blank=True)
    is_completed = models.BooleanField(default=False)
    
    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.title} - {self.meeting_date}"
