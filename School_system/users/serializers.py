from rest_framework import serializers
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import CustomUser, School, SchoolSettings, ReportCardConfig
from academics.models import Parent
import random
import secrets
import string


class SchoolSerializer(serializers.ModelSerializer):
    """Represents SchoolSerializer."""
    class Meta:
        """Represents Meta."""
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
        """Create and return a new instance."""
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
    """Represents UserSerializer."""
    full_name = serializers.CharField(read_only=True)
    school_name = serializers.SerializerMethodField()
    school_code = serializers.SerializerMethodField()
    
    class Meta:
        """Represents Meta."""
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'phone_number', 'role', 'student_number', 'is_active',
            'date_joined', 'password', 'school_name', 'school_code'
        ]
        read_only_fields = ['id', 'date_joined', 'username', 'email', 'role', 'student_number', 'full_name', 'school_name', 'school_code']
        extra_kwargs = {
            'password': {'write_only': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }
    
    def get_school_name(self, obj):
        """Return school name."""
        return obj.school.name if obj.school else None
    
    def get_school_code(self, obj):
        """Return school code."""
        return obj.school.code if obj.school else None

class UserRegistrationSerializer(serializers.ModelSerializer):
    """Represents UserRegistrationSerializer."""
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        """Represents Meta."""
        model = CustomUser
        fields = [
            'username', 'email', 'password', 'confirm_password', 
            'first_name', 'last_name', 'phone_number', 'role', 'student_number', 'whatsapp_pin'
        ]

    def validate(self, attrs):
        """Validate incoming data."""
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
        """Execute generate student number."""
        while True:
            number = str(random.randint(100000, 999999))  # 6-digit number
            if not CustomUser.objects.filter(student_number=number).exists():
                return number

    def generate_whatsapp_pin(self):
        """Execute generate whatsapp pin."""
        return str(random.randint(1000, 9999))  # 4-digit PIN

    def create(self, validated_data):
        """Create and return a new instance."""
        validated_data.pop('confirm_password')

        role = validated_data.get('role')

        # Generate student_number if role is student
        if role == 'student':
            validated_data['student_number'] = self.generate_student_number()

        # Generate WhatsApp PIN for students and parents
        if role in ['student', 'parent']:
            validated_data['whatsapp_pin'] = self.generate_whatsapp_pin()

        user = CustomUser.objects.create_user(**validated_data)
        
        # Create Parent profile for parent users
        if role == 'parent':
            Parent.objects.create(user=user)
        
        return user
    
class LoginSerializer(serializers.Serializer):
    """Represents LoginSerializer."""
    identifier = serializers.CharField()  # email or student_number
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        """Validate incoming data."""
        identifier = attrs.get('identifier')
        password = attrs.get('password')

        user = None

        # Try to find user by email or username first
        from django.db.models import Q
        try:
            user_obj = CustomUser.objects.get(Q(email=identifier) | Q(username=identifier))
            user = authenticate(username=user_obj.username, password=password)
        except CustomUser.DoesNotExist:
            # If no email/username found, try student_number
            try:
                user_obj = CustomUser.objects.get(student_number=identifier)
                user = authenticate(username=user_obj.username, password=password)
            except CustomUser.DoesNotExist:
                raise serializers.ValidationError("User not found with this email, username, or student number.")

        if user is None:
            raise serializers.ValidationError("Invalid credentials.")

        attrs['user'] = user
        return attrs

class WhatsAppPinVerificationSerializer(serializers.Serializer):
    """Represents WhatsAppPinVerificationSerializer."""
    phone_number = serializers.CharField()
    pin = serializers.CharField(max_length=6)

    def validate(self, attrs):
        """Validate incoming data."""
        phone_number = attrs.get('phone_number')
        pin = attrs.get('pin')

        try:
            user = CustomUser.objects.get(phone_number=phone_number, role__in=['student', 'parent'])
            stored_pin = user.whatsapp_pin or ""
            if check_password(pin, stored_pin):
                attrs['user'] = user
                return attrs
            # Backward compatibility for legacy plaintext pins: verify once, then upgrade.
            if stored_pin == pin:
                user.whatsapp_pin = make_password(pin)
                user.save(update_fields=['whatsapp_pin'])
                attrs['user'] = user
                return attrs
            raise serializers.ValidationError('Invalid PIN.')
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError('Invalid phone number.')


class ChangePasswordSerializer(serializers.Serializer):
    """Represents ChangePasswordSerializer."""
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField()

    def validate(self, attrs):
        """Validate incoming data."""
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("New passwords don't match.")
        return attrs


class SetWhatsAppPinSerializer(serializers.Serializer):
    """Represents SetWhatsAppPinSerializer."""
    pin = serializers.CharField(max_length=6, min_length=4)
    confirm_pin = serializers.CharField(max_length=6, min_length=4)

    def validate(self, attrs):
        """Validate incoming data."""
        if attrs['pin'] != attrs['confirm_pin']:
            raise serializers.ValidationError("PINs don't match.")
        if not attrs['pin'].isdigit():
            raise serializers.ValidationError("PIN must contain only numbers.")
        return attrs


class SchoolSettingsSerializer(serializers.ModelSerializer):
    """Represents SchoolSettingsSerializer."""
    school_name = serializers.CharField(source='school.name', read_only=True)

    class Meta:
        """Represents Meta."""
        model = SchoolSettings
        fields = [
            'id', 'school_name', 'current_academic_year', 'current_term',
            'term_start_date', 'term_end_date',
            'term_1_start', 'term_1_end',
            'term_2_start', 'term_2_end',
            'term_3_start', 'term_3_end',
            'grading_system', 'school_motto',
            'currency', 'timezone', 'max_students_per_class', 'late_fee_percentage',
            'paynow_integration_id', 'paynow_integration_key',
        ]
        read_only_fields = ['id', 'school_name']


class ReportCardConfigSerializer(serializers.ModelSerializer):
    """Represents ReportCardConfigSerializer."""
    logo_url = serializers.SerializerMethodField()
    stamp_url = serializers.SerializerMethodField()

    class Meta:
        """Represents Meta."""
        model = ReportCardConfig
        exclude = ['school']
        read_only_fields = ['id']

    def get_logo_url(self, obj):
        """Return logo url."""
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None

    def get_stamp_url(self, obj):
        """Return stamp url."""
        if obj.stamp_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.stamp_image.url)
            return obj.stamp_image.url
        return None
