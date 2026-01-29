from django.contrib.auth.models import AbstractUser
from django.db import models
import secrets
import string


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
    email=models.EmailField()
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    student_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    whatsapp_pin = models.CharField(max_length=6, null=True, blank=True)
    school = models.ForeignKey(School, on_delete=models.CASCADE, null=True, blank=True, related_name='users')
    created_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_users')

class BlacklistedToken(models.Model):
    token = models.TextField(unique=True)
    blacklisted_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Blacklisted token at {self.blacklisted_at}"