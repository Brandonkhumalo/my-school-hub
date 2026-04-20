import secrets
import string
from django.utils import timezone

from rest_framework import serializers
from django.db import transaction
from .models import (
    Department, Staff, Attendance, Leave, Payroll, Meeting,
    VisitorLog, IncidentReport, CleaningSchedule, CleaningTask, PayrollPaymentRequest
)
from users.models import (
    CustomUser,
    HRPermissionProfile, HRPagePermission,
    AccountantPermissionProfile, AccountantPagePermission,
)


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
    user = StaffUserSerializer(required=False)
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

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', None)

        if user_data:
            email = user_data.get('email')
            phone = user_data.get('phone_number')
            if email and CustomUser.objects.filter(email=email).exclude(id=instance.user_id).exists():
                raise serializers.ValidationError({"user": {"email": "A user with this email already exists."}})
            if phone and CustomUser.objects.filter(phone_number=phone).exclude(id=instance.user_id).exists():
                raise serializers.ValidationError({"user": {"phone_number": "A user with this phone number already exists."}})

            for field in ['first_name', 'last_name', 'email', 'phone_number']:
                if field in user_data:
                    value = user_data[field]
                    if field == 'phone_number' and not value:
                        value = None
                    setattr(instance.user, field, value)
            instance.user.save()

        for field in ['department', 'position', 'hire_date', 'salary', 'is_active']:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance


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
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

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
    def _position_to_role(position):
        """Execute position to role."""
        mapping = {
            'teacher': 'teacher',
            'admin': 'admin',
            'hr': 'hr',
            'accountant': 'accountant',
            'principal': 'admin',
            'secretary': 'admin',
            'maintenance': 'hr',
            'security': 'security',
            'cleaner': 'cleaner',
            'librarian': 'librarian',
        }
        return mapping.get(position, 'hr')

    @staticmethod
    def _generate_employee_id():
        """Execute generate employee id."""
        while True:
            eid = 'EMP' + ''.join(secrets.choice(string.digits) for _ in range(5))
            if not Staff.objects.filter(employee_id=eid).exists():
                return eid

    @staticmethod
    def _sync_role_based_permissions(user):
        """New role-based staff users start with no page grants."""
        if user.role == 'hr':
            AccountantPermissionProfile.objects.filter(user=user).delete()
            profile, _ = HRPermissionProfile.objects.get_or_create(
                user=user,
                defaults={'school': user.school, 'is_root_boss': False},
            )
            updates = []
            if profile.school_id != user.school_id:
                profile.school = user.school
                updates.append('school')
            if profile.is_root_boss:
                profile.is_root_boss = False
                updates.append('is_root_boss')
            HRPagePermission.objects.filter(profile=profile).delete()
            if updates:
                profile.save(update_fields=updates + ['updated_at'])
            return

        if user.role == 'accountant':
            HRPermissionProfile.objects.filter(user=user).delete()
            profile, _ = AccountantPermissionProfile.objects.get_or_create(
                user=user,
                defaults={'school': user.school, 'is_root_head': False},
            )
            updates = []
            if profile.school_id != user.school_id:
                profile.school = user.school
                updates.append('school')
            if profile.is_root_head:
                profile.is_root_head = False
                updates.append('is_root_head')
            AccountantPagePermission.objects.filter(profile=profile).delete()
            if updates:
                profile.save(update_fields=updates + ['updated_at'])
            return

        HRPermissionProfile.objects.filter(user=user).delete()
        AccountantPermissionProfile.objects.filter(user=user).delete()

    @transaction.atomic
    def create(self, validated_data):
        """Create and return a new instance."""
        request = self.context.get('request')
        school = request.user.school if request else None

        password = validated_data.pop('password')
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
        self._sync_role_based_permissions(user)

        staff = Staff.objects.create(
            user=user,
            employee_id=self._generate_employee_id(),
            department=validated_data.get('department'),
            position=position,
            hire_date=validated_data['hire_date'],
            salary=validated_data['salary'],
        )

        # Ensure new salary-based staff records are visible in payroll immediately.
        Payroll.objects.get_or_create(
            staff=staff,
            month=timezone.now().strftime('%B'),
            year=timezone.now().year,
            defaults={
                'basic_salary': staff.salary,
                'allowances': 0,
                'deductions': 0,
                'net_salary': staff.salary,
                'is_paid': False,
            }
        )

        return staff


class VisitorLogSerializer(serializers.ModelSerializer):
    logged_by_name = serializers.CharField(source='logged_by.full_name', read_only=True)

    class Meta:
        model = VisitorLog
        fields = [
            'id', 'school', 'visitor_name', 'visitor_id_number', 'purpose',
            'host_name', 'check_in_time', 'check_out_time', 'vehicle_reg',
            'logged_by', 'logged_by_name', 'notes', 'date'
        ]
        read_only_fields = ['id', 'school', 'check_in_time', 'logged_by', 'date']


class IncidentReportSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.CharField(source='reported_by.full_name', read_only=True)

    class Meta:
        model = IncidentReport
        fields = [
            'id', 'school', 'reported_by', 'reported_by_name', 'incident_type',
            'title', 'description', 'location', 'date_of_incident',
            'action_taken', 'status', 'date_created'
        ]
        read_only_fields = ['id', 'school', 'reported_by', 'date_created']


class CleaningScheduleSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.user.full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = CleaningSchedule
        fields = [
            'id', 'school', 'area_name', 'assigned_to', 'assigned_to_name', 'frequency',
            'scheduled_time', 'notes', 'is_active', 'created_by', 'created_by_name', 'date_created'
        ]
        read_only_fields = ['id', 'school', 'created_by', 'date_created']

    def validate_assigned_to(self, value):
        if value and value.position != 'cleaner':
            raise serializers.ValidationError('Assigned staff member must have cleaner position.')
        return value

    def validate(self, attrs):
        assigned_to = attrs.get('assigned_to')
        request = self.context.get('request')
        school = request.user.school if request else None
        if assigned_to and school and assigned_to.user.school_id != school.id:
            raise serializers.ValidationError({'assigned_to': 'Assigned cleaner must belong to your school.'})
        return attrs


class CleaningTaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.user.full_name', read_only=True)
    schedule_area_name = serializers.CharField(source='schedule.area_name', read_only=True)
    schedule_frequency = serializers.CharField(source='schedule.frequency', read_only=True)
    scheduled_time = serializers.TimeField(source='schedule.scheduled_time', read_only=True)

    class Meta:
        model = CleaningTask
        fields = [
            'id', 'school', 'schedule', 'schedule_area_name', 'schedule_frequency',
            'scheduled_time', 'assigned_to', 'assigned_to_name', 'date',
            'is_done', 'completed_at', 'notes'
        ]
        read_only_fields = ['id', 'school', 'completed_at']


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

    def validate_staff(self, value):
        request = self.context.get('request')
        if request and request.user and request.user.school and value.user.school_id != request.user.school_id:
            raise serializers.ValidationError('Selected staff member is outside your school.')
        return value


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


class PayrollPaymentRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)

    class Meta:
        model = PayrollPaymentRequest
        fields = [
            'id',
            'month',
            'year',
            'target_type',
            'staff_ids',
            'status',
            'requested_by',
            'requested_by_name',
            'approved_by',
            'approved_by_name',
            'requested_at',
            'reviewed_at',
            'admin_note',
        ]
        read_only_fields = [
            'status',
            'requested_by',
            'requested_by_name',
            'approved_by',
            'approved_by_name',
            'requested_at',
            'reviewed_at',
        ]
