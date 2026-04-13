import secrets
import string

from rest_framework import serializers
from django.db import transaction
from .models import Department, Staff, Attendance, Leave, Payroll, Meeting
from users.models import CustomUser


class DepartmentSerializer(serializers.ModelSerializer):
    """Represents DepartmentSerializer."""
    head_name = serializers.SerializerMethodField()
    staff_count = serializers.SerializerMethodField()

    class Meta:
        """Represents Meta."""
        model = Department
        fields = ['id', 'name', 'description', 'head', 'head_name', 'staff_count']

    def get_head_name(self, obj):
        """Return head name."""
        return obj.head.full_name if obj.head else None

    def get_staff_count(self, obj):
        """Return staff count."""
        return obj.staff_members.count()


class StaffUserSerializer(serializers.ModelSerializer):
    """Represents StaffUserSerializer."""
    class Meta:
        """Represents Meta."""
        model = CustomUser
        fields = ['id', 'first_name', 'last_name', 'email', 'phone_number', 'role']
        read_only_fields = ['id']


class StaffSerializer(serializers.ModelSerializer):
    """Represents StaffSerializer."""
    user = StaffUserSerializer(read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        """Represents Meta."""
        model = Staff
        fields = [
            'id', 'user', 'full_name', 'employee_id', 'department', 'department_name',
            'position', 'hire_date', 'salary', 'is_active',
        ]

    def get_full_name(self, obj):
        """Return full name."""
        return obj.user.full_name


class CreateStaffSerializer(serializers.Serializer):
    """Create a new staff member (also creates the CustomUser account)."""
    first_name = serializers.CharField(max_length=255)
    last_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    position = serializers.ChoiceField(choices=Staff.POSITION_CHOICES)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)
    hire_date = serializers.DateField()
    salary = serializers.DecimalField(max_digits=10, decimal_places=2)

    def validate_email(self, value):
        """Validate email."""
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def validate_phone_number(self, value):
        """Validate phone number."""
        if value and CustomUser.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError('A user with this phone number already exists.')
        return value

    @staticmethod
    def _generate_password(length=12):
        """Execute generate password."""
        chars = string.ascii_letters + string.digits + '!@#$%'
        return ''.join(secrets.choice(chars) for _ in range(length))

    @staticmethod
    def _position_to_role(position):
        """Execute position to role."""
        mapping = {
            'teacher': 'teacher',
            'admin': 'admin',
            'hr': 'hr',
            'accountant': 'accountant',
            'principal': 'admin',
            'secretary': 'admin',
            'maintenance': 'admin',
            'security': 'admin',
        }
        return mapping.get(position, 'hr')

    @staticmethod
    def _generate_employee_id():
        """Execute generate employee id."""
        while True:
            eid = 'EMP' + ''.join(secrets.choice(string.digits) for _ in range(5))
            if not Staff.objects.filter(employee_id=eid).exists():
                return eid

    @transaction.atomic
    def create(self, validated_data):
        """Create and return a new instance."""
        request = self.context.get('request')
        school = request.user.school if request else None

        password = self._generate_password()
        position = validated_data['position']
        role = self._position_to_role(position)

        first = validated_data['first_name']
        last = validated_data['last_name']
        base_username = f"{first.lower()}.{last.lower()}".replace(' ', '')
        username = base_username
        counter = 1
        while CustomUser.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        user = CustomUser.objects.create_user(
            username=username,
            email=validated_data['email'],
            password=password,
            first_name=first,
            last_name=last,
            phone_number=validated_data.get('phone_number') or None,
            role=role,
            school=school,
            created_by=request.user if request else None,
        )

        staff = Staff.objects.create(
            user=user,
            employee_id=self._generate_employee_id(),
            department=validated_data.get('department'),
            position=position,
            hire_date=validated_data['hire_date'],
            salary=validated_data['salary'],
        )

        # Attach generated password for display (not stored)
        staff._generated_password = password
        return staff


class StaffAttendanceSerializer(serializers.ModelSerializer):
    """Represents StaffAttendanceSerializer."""
    staff_name = serializers.CharField(source='staff.user.full_name', read_only=True)
    employee_id = serializers.CharField(source='staff.employee_id', read_only=True)

    class Meta:
        """Represents Meta."""
        model = Attendance
        fields = ['id', 'staff', 'staff_name', 'employee_id', 'date', 'check_in_time', 'check_out_time', 'status', 'notes']


class LeaveSerializer(serializers.ModelSerializer):
    """Represents LeaveSerializer."""
    staff_name = serializers.CharField(source='staff.user.full_name', read_only=True)
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        """Represents Meta."""
        model = Leave
        fields = [
            'id', 'staff', 'staff_name', 'leave_type', 'start_date', 'end_date',
            'days_requested', 'reason', 'status', 'approved_by', 'approved_by_name',
            'date_applied', 'date_reviewed',
        ]
        read_only_fields = ['id', 'staff', 'status', 'approved_by', 'date_applied', 'date_reviewed']

    def get_approved_by_name(self, obj):
        """Return approved by name."""
        return obj.approved_by.full_name if obj.approved_by else None


class PayrollSerializer(serializers.ModelSerializer):
    """Represents PayrollSerializer."""
    staff_name = serializers.CharField(source='staff.user.full_name', read_only=True)
    employee_id = serializers.CharField(source='staff.employee_id', read_only=True)
    position = serializers.CharField(source='staff.position', read_only=True)

    class Meta:
        """Represents Meta."""
        model = Payroll
        fields = [
            'id', 'staff', 'staff_name', 'employee_id', 'position',
            'month', 'year', 'basic_salary', 'allowances', 'deductions',
            'net_salary', 'pay_date', 'is_paid',
        ]

    def validate(self, attrs):
        """Validate incoming data."""
        net = attrs.get('basic_salary', 0) + attrs.get('allowances', 0) - attrs.get('deductions', 0)
        if 'net_salary' not in attrs or attrs['net_salary'] != net:
            attrs['net_salary'] = net
        return attrs


class MeetingSerializer(serializers.ModelSerializer):
    """Represents MeetingSerializer."""
    organizer_name = serializers.CharField(source='organizer.full_name', read_only=True)
    participant_count = serializers.SerializerMethodField()

    class Meta:
        """Represents Meta."""
        model = Meeting
        fields = [
            'id', 'title', 'description', 'organizer', 'organizer_name',
            'participants', 'participant_count', 'meeting_date', 'location', 'is_completed',
        ]

    def get_participant_count(self, obj):
        """Return participant count."""
        return obj.participants.count()
