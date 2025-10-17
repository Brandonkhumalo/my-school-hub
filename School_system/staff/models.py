from django.db import models
from django.conf import settings


class Department(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    head = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='headed_departments')
    
    def __str__(self):
        return self.name


class Staff(models.Model):
    POSITION_CHOICES = [
        ('teacher', 'Teacher'),
        ('admin', 'Administrator'),
        ('hr', 'HR Personnel'),
        ('accountant', 'Accountant'),
        ('principal', 'Principal'),
        ('secretary', 'Secretary'),
        ('maintenance', 'Maintenance'),
        ('security', 'Security'),
    ]
    
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    employee_id = models.CharField(max_length=20, unique=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, related_name='staff_members')
    position = models.CharField(max_length=50, choices=POSITION_CHOICES)
    hire_date = models.DateField()
    salary = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.user.full_name} - {self.position}"


class Attendance(models.Model):
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='attendance')
    date = models.DateField()
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default='present')  # present, absent, late, half_day
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['staff', 'date']
    
    def __str__(self):
        return f"{self.staff.user.full_name} - {self.date} ({self.status})"


class Leave(models.Model):
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
        return f"{self.staff.user.full_name} - {self.leave_type} ({self.status})"


class Payroll(models.Model):
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
        unique_together = ['staff', 'month', 'year']
    
    def __str__(self):
        return f"{self.staff.user.full_name} - {self.month} {self.year}"


class Meeting(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    organizer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='organized_meetings')
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='meetings')
    meeting_date = models.DateTimeField()
    location = models.CharField(max_length=200, blank=True)
    is_completed = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.title} - {self.meeting_date}"
