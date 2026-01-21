from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import CustomUser, School
import random
import secrets
import string


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = [
            'id', 'name', 'code', 'school_type', 'curriculum',
            'address', 'city', 'country', 'phone', 'email',
            'website', 'logo', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'code', 'created_at']


class SchoolRegistrationSerializer(serializers.Serializer):
    """Register a new school with auto-generated admin credentials"""
    school_name = serializers.CharField(max_length=255)
    school_type = serializers.ChoiceField(choices=School.SCHOOL_TYPE_CHOICES, default='secondary')
    curriculum = serializers.ChoiceField(choices=School.CURRICULUM_CHOICES, default='zimsec')
    address = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    
    admin_first_name = serializers.CharField(max_length=255)
    admin_last_name = serializers.CharField(max_length=255)
    admin_email = serializers.EmailField()
    admin_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    
    def generate_password(self, length=12):
        """Generate a secure random password"""
        chars = string.ascii_letters + string.digits + "!@#$%"
        return ''.join(secrets.choice(chars) for _ in range(length))
    
    def create(self, validated_data):
        school_code = School.generate_school_code()
        
        school = School.objects.create(
            name=validated_data['school_name'],
            code=school_code,
            school_type=validated_data.get('school_type', 'secondary'),
            curriculum=validated_data.get('curriculum', 'zimsec'),
            address=validated_data.get('address', ''),
            city=validated_data.get('city', ''),
            phone=validated_data.get('phone', ''),
            email=validated_data.get('email', '')
        )
        
        admin_password = self.generate_password()
        admin_username = f"admin_{school_code.lower()}"
        
        admin_user = CustomUser.objects.create_user(
            username=admin_username,
            email=validated_data['admin_email'],
            password=admin_password,
            first_name=validated_data['admin_first_name'],
            last_name=validated_data['admin_last_name'],
            phone_number=validated_data.get('admin_phone', ''),
            role='admin',
            school=school
        )
        
        return {
            'school': school,
            'admin_user': admin_user,
            'admin_password': admin_password
        }


class UserSerializer(serializers.ModelSerializer):
    school_name = serializers.SerializerMethodField()
    school_code = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone_number', 'role', 'student_number', 'is_active',
            'date_joined', 'password', 'school_name', 'school_code'
        ]
        read_only_fields = ['id', 'date_joined', 'username', 'email', 'role', 'student_number', 'school_name', 'school_code']
        extra_kwargs = {
            'password': {'write_only': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }
    
    def get_school_name(self, obj):
        return obj.school.name if obj.school else None
    
    def get_school_code(self, obj):
        return obj.school.code if obj.school else None

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'username', 'email', 'password', 'confirm_password', 
            'first_name', 'last_name', 'phone_number', 'role', 'student_number', 'whatsapp_pin'
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords don't match.")
        
        # Security: Only allow parent role for self-registration
        # Other roles (admin, teacher, student) must be created by admin
        role = attrs.get('role', 'parent')
        if role != 'parent':
            raise serializers.ValidationError("Only parent registration is allowed. Contact administrator for other roles.")
        
        # Ensure role is set to parent
        attrs['role'] = 'parent'
        
        return attrs

    def generate_student_number(self):
        while True:
            number = str(random.randint(100000, 999999))  # 6-digit number
            if not CustomUser.objects.filter(student_number=number).exists():
                return number

    def generate_whatsapp_pin(self):
        return str(random.randint(1000, 9999))  # 4-digit PIN

    def create(self, validated_data):
        validated_data.pop('confirm_password')

        role = validated_data.get('role')

        # Generate student_number if role is student
        if role == 'student':
            validated_data['student_number'] = self.generate_student_number()

        # Generate WhatsApp PIN for students and parents
        if role in ['student', 'parent']:
            validated_data['whatsapp_pin'] = self.generate_whatsapp_pin()

        user = CustomUser.objects.create_user(**validated_data)
        return user
    
class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()  # email or student_number
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs.get('identifier')
        password = attrs.get('password')

        user = None

        # Try to find user by email first
        try:
            user_obj = CustomUser.objects.get(email=identifier)
            user = authenticate(username=user_obj.username, password=password)
        except CustomUser.DoesNotExist:
            # If no email found, try student_number
            try:
                user_obj = CustomUser.objects.get(student_number=identifier)
                user = authenticate(username=user_obj.username, password=password)
            except CustomUser.DoesNotExist:
                raise serializers.ValidationError("User not found with this email or student number.")

        if user is None:
            raise serializers.ValidationError("Invalid credentials.")

        attrs['user'] = user
        return attrs

class WhatsAppPinVerificationSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    pin = serializers.CharField(max_length=6)

    def validate(self, attrs):
        phone_number = attrs.get('phone_number')
        pin = attrs.get('pin')

        try:
            user = CustomUser.objects.get(phone_number=phone_number, role__in=['student', 'parent'])
            if user.whatsapp_pin == pin:
                attrs['user'] = user
                return attrs
            else:
                raise serializers.ValidationError('Invalid PIN.')
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError('Invalid phone number.')


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField()

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("New passwords don't match.")
        return attrs


class SetWhatsAppPinSerializer(serializers.Serializer):
    pin = serializers.CharField(max_length=6, min_length=4)
    confirm_pin = serializers.CharField(max_length=6, min_length=4)

    def validate(self, attrs):
        if attrs['pin'] != attrs['confirm_pin']:
            raise serializers.ValidationError("PINs don't match.")
        if not attrs['pin'].isdigit():
            raise serializers.ValidationError("PIN must contain only numbers.")
        return attrs