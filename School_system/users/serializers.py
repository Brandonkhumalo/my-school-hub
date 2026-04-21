from datetime import date
from django.utils import timezone

from rest_framework import serializers
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import (
    CustomUser, School, SchoolSettings, ReportCardConfig, ReportCardTemplate, SubjectGroup,
    HRPermissionProfile, HRPagePermission,
    AccountantPermissionProfile, AccountantPagePermission,
)
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
            'id', 'name', 'code', 'school_type', 'accommodation_type', 'curriculum',
            'address', 'city', 'country', 'phone', 'email',
            'website', 'logo', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'code', 'created_at']


class SchoolRegistrationSerializer(serializers.Serializer):
    """Register a new school with auto-generated admin credentials"""
    school_name = serializers.CharField(max_length=255)
    school_type = serializers.ChoiceField(choices=School.SCHOOL_TYPE_CHOICES, default='secondary')
    accommodation_type = serializers.ChoiceField(choices=School.ACCOMMODATION_TYPE_CHOICES, default='day')
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
            accommodation_type=validated_data.get('accommodation_type', 'day'),
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
    school_accommodation_type = serializers.SerializerMethodField()
    student_residence_type = serializers.SerializerMethodField()
    salary = serializers.SerializerMethodField()
    staff_position = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()
    staff_department_id = serializers.SerializerMethodField()
    staff_hire_date = serializers.SerializerMethodField()
    hr_is_root_boss = serializers.SerializerMethodField()
    hr_page_permissions = serializers.SerializerMethodField()
    accountant_is_root_head = serializers.SerializerMethodField()
    accountant_page_permissions = serializers.SerializerMethodField()
    
    class Meta:
        """Represents Meta."""
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'phone_number', 'gender', 'role', 'student_number', 'is_active',
            'date_joined', 'password', 'school_name', 'school_code',
            'school_accommodation_type', 'student_residence_type',
            'salary', 'staff_position', 'employee_id', 'staff_department_id', 'staff_hire_date',
            'hr_is_root_boss', 'hr_page_permissions',
            'accountant_is_root_head', 'accountant_page_permissions',
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

    def get_school_accommodation_type(self, obj):
        return obj.school.accommodation_type if obj.school else None

    def get_student_residence_type(self, obj):
        if obj.role != 'student':
            return None
        try:
            return obj.student.residence_type
        except Exception:
            return None

    def get_salary(self, obj):
        try:
            return float(obj.staff.salary)
        except Exception:
            return None

    def get_staff_position(self, obj):
        try:
            return obj.staff.position
        except Exception:
            return None

    def get_employee_id(self, obj):
        try:
            return obj.staff.employee_id
        except Exception:
            return None

    def get_staff_department_id(self, obj):
        try:
            return obj.staff.department_id
        except Exception:
            return None

    def get_staff_hire_date(self, obj):
        try:
            return obj.staff.hire_date
        except Exception:
            return None

    def get_hr_is_root_boss(self, obj):
        if obj.role != 'hr':
            return False
        profile = getattr(obj, 'hr_permission_profile', None)
        return bool(profile and profile.is_root_boss)

    def get_hr_page_permissions(self, obj):
        if obj.role != 'hr':
            return {}
        profile = getattr(obj, 'hr_permission_profile', None)
        if not profile:
            return {}
        perms = HRPagePermission.objects.filter(profile=profile)
        return {
            p.page_key: {'read': bool(p.can_read), 'write': bool(p.can_write)}
            for p in perms
        }

    def get_accountant_is_root_head(self, obj):
        if obj.role != 'accountant':
            return False
        profile = getattr(obj, 'accountant_permission_profile', None)
        return bool(profile and profile.is_root_head)

    def get_accountant_page_permissions(self, obj):
        if obj.role != 'accountant':
            return {}
        profile = getattr(obj, 'accountant_permission_profile', None)
        if not profile:
            return {}
        perms = AccountantPagePermission.objects.filter(profile=profile)
        return {
            p.page_key: {'read': bool(p.can_read), 'write': bool(p.can_write)}
            for p in perms
        }


class ManagedUserSerializer(serializers.ModelSerializer):
    """Admin/HR user management serializer with role-aware requirements."""
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    salary = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    hire_date = serializers.DateField(required=False, allow_null=True)
    department = serializers.IntegerField(required=False, allow_null=True)
    staff_position = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'password', 'first_name', 'last_name',
            'phone_number', 'role', 'student_number', 'is_active',
            'salary', 'hire_date', 'department', 'staff_position',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'username': {'required': False, 'allow_blank': True},
            'email': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
            'role': {'required': True},
        }

    STAFF_ROLES = {'teacher', 'admin', 'hr', 'accountant', 'security', 'cleaner', 'librarian'}
    POSITION_MAP = {
        'teacher': {'teacher'},
        'admin': {'admin', 'principal', 'secretary'},
        'hr': {'hr', 'maintenance'},
        'accountant': {'accountant'},
        'security': {'security'},
        'cleaner': {'cleaner'},
        'librarian': {'librarian'},
    }

    @staticmethod
    def _generate_student_number():
        while True:
            number = str(random.randint(100000, 999999))
            if not CustomUser.objects.filter(student_number=number).exists():
                return number

    @staticmethod
    def _generate_employee_id():
        from staff.models import Staff
        while True:
            eid = 'EMP' + ''.join(secrets.choice(string.digits) for _ in range(5))
            if not Staff.objects.filter(employee_id=eid).exists():
                return eid

    @staticmethod
    def _make_username(first_name, last_name):
        base = f"{first_name}.{last_name}".strip('.').lower().replace(' ', '')
        base = base or "user"
        candidate = base
        suffix = 1
        while CustomUser.objects.filter(username=candidate).exists():
            candidate = f"{base}{suffix}"
            suffix += 1
        return candidate

    def _resolve_position(self, role, staff_position):
        if role not in self.STAFF_ROLES:
            return None
        allowed = self.POSITION_MAP.get(role, set())
        if staff_position:
            if staff_position not in allowed:
                raise serializers.ValidationError({'staff_position': f'Invalid position for role {role}.'})
            return staff_position
        return sorted(list(allowed))[0] if allowed else role

    def validate(self, attrs):
        request = self.context.get('request')
        is_create = self.instance is None
        role = attrs.get('role', self.instance.role if self.instance else None)

        if role == 'superadmin':
            raise serializers.ValidationError({'role': 'Cannot create or edit superadmin via user management.'})

        if is_create and not request:
            raise serializers.ValidationError('Request context is required.')
        if is_create and request and not request.user.school:
            raise serializers.ValidationError({'school': 'No school associated with the current user.'})

        salary = attrs.get('salary', None)
        hire_date = attrs.get('hire_date', None)
        if role in self.STAFF_ROLES:
            if is_create and salary is None:
                raise serializers.ValidationError({'salary': 'Salary is required for staff roles.'})
            if is_create and hire_date is None:
                raise serializers.ValidationError({'hire_date': 'Hire date is required for staff roles.'})
        else:
            attrs['salary'] = None
            attrs['hire_date'] = None
            attrs['department'] = None
            attrs['staff_position'] = ''

        if role == 'student':
            student_number = attrs.get('student_number')
            if not student_number and is_create:
                attrs['student_number'] = self._generate_student_number()

        if attrs.get('phone_number') == '':
            attrs['phone_number'] = None
        if attrs.get('student_number') == '':
            attrs['student_number'] = None
        if attrs.get('username') == '':
            attrs['username'] = None

        return attrs

    def _ensure_staff_record(self, user, validated_data):
        from staff.models import Staff, Department, Payroll

        role = user.role
        if role not in self.STAFF_ROLES:
            return

        salary = validated_data.get('salary', None)
        hire_date = validated_data.get('hire_date', None)
        department_id = validated_data.get('department', None)
        staff_position = validated_data.get('staff_position', '')
        position = self._resolve_position(role, staff_position)

        department = None
        if department_id:
            department = Department.objects.filter(id=department_id).first()
            if department is None:
                raise serializers.ValidationError({'department': 'Department not found.'})

        staff = getattr(user, 'staff', None)
        if staff is None:
            if salary is None:
                raise serializers.ValidationError({'salary': 'Salary is required for staff roles.'})
            if hire_date is None:
                hire_date = date.today()
            staff = Staff.objects.create(
                user=user,
                employee_id=self._generate_employee_id(),
                department=department,
                position=position,
                hire_date=hire_date,
                salary=salary,
                is_active=user.is_active,
            )
            # Ensure salary-based users immediately appear in payroll.
            month_name = timezone.now().strftime('%B')
            year = timezone.now().year
            Payroll.objects.get_or_create(
                staff=staff,
                month=month_name,
                year=year,
                defaults={
                    'basic_salary': staff.salary,
                    'allowances': 0,
                    'deductions': 0,
                    'net_salary': staff.salary,
                    'is_paid': False,
                }
            )
            return staff

        if salary is not None:
            staff.salary = salary
        if hire_date is not None:
            staff.hire_date = hire_date
        if department_id is not None:
            staff.department = department
        staff.position = position
        staff.is_active = user.is_active
        staff.save(update_fields=['salary', 'hire_date', 'department', 'position', 'is_active'])
        # Keep current-month payroll aligned with salary for unpaid entries.
        month_name = timezone.now().strftime('%B')
        year = timezone.now().year
        payroll, created = Payroll.objects.get_or_create(
            staff=staff,
            month=month_name,
            year=year,
            defaults={
                'basic_salary': staff.salary,
                'allowances': 0,
                'deductions': 0,
                'net_salary': staff.salary,
                'is_paid': False,
            }
        )
        if not created and not payroll.is_paid and salary is not None:
            payroll.basic_salary = staff.salary
            payroll.net_salary = (staff.salary + payroll.allowances) - payroll.deductions
            payroll.save(update_fields=['basic_salary', 'net_salary'])
        return staff

    @staticmethod
    def _sync_role_based_permissions(user, old_role=None, is_create=False):
        """
        Ensure role-based accounts start with no grants until explicitly assigned.
        Also clears stale grants when switching roles.
        """
        current_role = user.role

        if current_role == 'hr':
            AccountantPermissionProfile.objects.filter(user=user).delete()
            profile, _ = HRPermissionProfile.objects.get_or_create(
                user=user,
                defaults={'school': user.school, 'is_root_boss': False},
            )
            updates = []
            if profile.school_id != user.school_id:
                profile.school = user.school
                updates.append('school')
            should_reset = is_create or old_role != 'hr'
            if should_reset:
                if profile.is_root_boss:
                    profile.is_root_boss = False
                    updates.append('is_root_boss')
                HRPagePermission.objects.filter(profile=profile).delete()
            if updates:
                profile.save(update_fields=updates + ['updated_at'])
            return

        if current_role == 'accountant':
            HRPermissionProfile.objects.filter(user=user).delete()
            profile, _ = AccountantPermissionProfile.objects.get_or_create(
                user=user,
                defaults={'school': user.school, 'is_root_head': False},
            )
            updates = []
            if profile.school_id != user.school_id:
                profile.school = user.school
                updates.append('school')
            should_reset = is_create or old_role != 'accountant'
            if should_reset:
                if profile.is_root_head:
                    profile.is_root_head = False
                    updates.append('is_root_head')
                AccountantPagePermission.objects.filter(profile=profile).delete()
            if updates:
                profile.save(update_fields=updates + ['updated_at'])
            return

        # Non role-based account types should not carry stale role grants.
        HRPermissionProfile.objects.filter(user=user).delete()
        AccountantPermissionProfile.objects.filter(user=user).delete()

    def create(self, validated_data):
        from academics.models import Parent

        request = self.context['request']
        raw_password = validated_data.pop('password', None)
        if not raw_password:
            raise serializers.ValidationError({'password': 'Password is required.'})

        salary = validated_data.pop('salary', None)
        hire_date = validated_data.pop('hire_date', None)
        department = validated_data.pop('department', None)
        staff_position = validated_data.pop('staff_position', '')

        username = validated_data.get('username')
        if not username:
            username = self._make_username(validated_data['first_name'], validated_data['last_name'])
        validated_data['username'] = username
        validated_data['school'] = request.user.school
        validated_data['created_by'] = request.user

        user = CustomUser.objects.create_user(**validated_data)
        user.set_password(raw_password)
        user.save(update_fields=['password'])

        if user.role == 'parent':
            Parent.objects.get_or_create(user=user)

        self._sync_role_based_permissions(user, is_create=True)
        self._ensure_staff_record(user, {
            'salary': salary,
            'hire_date': hire_date,
            'department': department,
            'staff_position': staff_position,
        })
        return user

    def update(self, instance, validated_data):
        from academics.models import Parent

        raw_password = validated_data.pop('password', None)
        salary = validated_data.pop('salary', None)
        hire_date = validated_data.pop('hire_date', None)
        department = validated_data.pop('department', None) if 'department' in validated_data else None
        staff_position = validated_data.pop('staff_position', '')

        old_role = instance.role
        for field in ['email', 'first_name', 'last_name', 'phone_number', 'role', 'student_number', 'is_active']:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        if 'username' in validated_data and validated_data['username']:
            instance.username = validated_data['username']

        if raw_password:
            instance.set_password(raw_password)
        instance.save()

        if instance.role == 'parent' and old_role != 'parent':
            Parent.objects.get_or_create(user=instance)

        self._sync_role_based_permissions(instance, old_role=old_role, is_create=False)
        self._ensure_staff_record(instance, {
            'salary': salary,
            'hire_date': hire_date,
            'department': department,
            'staff_position': staff_position,
        })
        return instance

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
    logo_url = serializers.SerializerMethodField()
    DATE_FIELDS = (
        'term_start_date', 'term_end_date',
        'term_1_start', 'term_1_end',
        'term_2_start', 'term_2_end',
        'term_3_start', 'term_3_end',
    )

    def to_internal_value(self, data):
        # Accept empty-string dates from browser forms by normalizing to null.
        if hasattr(data, 'copy'):
            data = data.copy()
            for field in self.DATE_FIELDS:
                if data.get(field, None) == '':
                    data[field] = None
        return super().to_internal_value(data)

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
            'primary_color', 'logo_url',
        ]
        read_only_fields = ['id', 'school_name', 'logo_url']

    def get_logo_url(self, obj):
        if not obj.logo:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.logo.url)
        return obj.logo.url



class ReportCardConfigSerializer(serializers.ModelSerializer):
    """Represents ReportCardConfigSerializer."""
    logo_url = serializers.SerializerMethodField()
    stamp_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()

    class Meta:
        """Represents Meta."""
        model = ReportCardConfig
        exclude = ['school']
        read_only_fields = ['id']

    def _abs(self, field_file):
        if not field_file:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(field_file.url)
        return field_file.url

    def get_logo_url(self, obj):
        return self._abs(obj.logo)

    def get_stamp_url(self, obj):
        return self._abs(obj.stamp_image)

    def get_banner_url(self, obj):
        return self._abs(obj.banner_image)


class ReportCardTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportCardTemplate
        fields = ['id', 'name', 'description', 'config_json', 'is_builtin', 'created_at']
        read_only_fields = ['id', 'is_builtin', 'created_at']


class SubjectGroupSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = SubjectGroup
        fields = ['id', 'subject', 'subject_name', 'group_type']
        read_only_fields = ['id', 'subject_name']


class TwoFactorSetupVerifySerializer(serializers.Serializer):
    """Verify a TOTP code during 2FA setup"""
    code = serializers.CharField(min_length=6, max_length=6)


class TwoFactorVerifySerializer(serializers.Serializer):
    """Verify OTP or backup code during login"""
    otp_session_token = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=8)
    trust_device = serializers.BooleanField(default=False)


class TwoFactorBackupVerifySerializer(serializers.Serializer):
    """Verify a backup code during login"""
    otp_session_token = serializers.CharField()
    backup_code = serializers.CharField(min_length=8, max_length=8)
    trust_device = serializers.BooleanField(default=False)


class Enforce2FASerializer(serializers.Serializer):
    """Admin endpoint to enforce 2FA for specific roles"""
    enforce = serializers.BooleanField()
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=['admin', 'teacher', 'student', 'parent', 'hr', 'accountant', 'security', 'cleaner', 'librarian']),
        required=False,
        default=list
    )
    grace_period_days = serializers.IntegerField(min_value=0, max_value=90, default=14)
