from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('parent', 'Parent'), 
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
        ('hr', 'HR'),
        ('accountant', 'Accountant'),
    ]
    
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    email=models.EmailField()
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    student_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    whatsapp_pin = models.CharField(max_length=6, null=True, blank=True)

class BlacklistedToken(models.Model):
    token = models.TextField(unique=True)
    blacklisted_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Blacklisted token at {self.blacklisted_at}"