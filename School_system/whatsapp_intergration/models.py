from django.db import models
from django.conf import settings


class WhatsAppUser(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    phone_number = models.CharField(max_length=20, unique=True)
    whatsapp_id = models.CharField(max_length=100, unique=True)
    is_verified = models.BooleanField(default=False)
    pin_verified = models.BooleanField(default=False)
    registration_date = models.DateTimeField(auto_now_add=True)
    last_interaction = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.phone_number} - {'Verified' if self.is_verified else 'Unverified'}"


class WhatsAppSession(models.Model):
    whatsapp_user = models.ForeignKey(WhatsAppUser, on_delete=models.CASCADE, related_name='sessions')
    session_id = models.CharField(max_length=100, unique=True)
    current_menu = models.CharField(max_length=50, default='main')
    session_data = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    started_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.whatsapp_user.phone_number} - {self.session_id}"


class WhatsAppMessage(models.Model):
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('image', 'Image'),
        ('document', 'Document'),
        ('location', 'Location'),
        ('template', 'Template'),
    ]
    
    DIRECTION_CHOICES = [
        ('incoming', 'Incoming'),
        ('outgoing', 'Outgoing'),
    ]
    
    whatsapp_user = models.ForeignKey(WhatsAppUser, on_delete=models.CASCADE, related_name='messages')
    message_id = models.CharField(max_length=100, unique=True)
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.whatsapp_user.phone_number} - {self.direction} ({self.timestamp})"


class WhatsAppPayment(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('initiated', 'Initiated'),
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    whatsapp_user = models.ForeignKey(WhatsAppUser, on_delete=models.CASCADE, related_name='whatsapp_payments')
    student_fee_id = models.IntegerField()  # Reference to StudentFee
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_reference = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='initiated')
    payment_method = models.CharField(max_length=50, blank=True)
    initiated_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.whatsapp_user.phone_number} - ${self.amount} ({self.status})"


class WhatsAppMenu(models.Model):
    menu_key = models.CharField(max_length=50, unique=True)
    menu_title = models.CharField(max_length=100)
    menu_text = models.TextField()
    parent_menu = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    required_role = models.CharField(max_length=20, blank=True)  # student, parent, etc.
    
    def __str__(self):
        return f"{self.menu_key} - {self.menu_title}"
