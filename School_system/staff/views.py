import logging
from datetime import date
from django.utils import timezone
from django.db.models import Q
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from .models import (
    Department, Staff, Attendance, Leave, Payroll, PayrollPaymentRequest, Meeting,
    VisitorLog, IncidentReport, CleaningSchedule, CleaningTask
)
from .serializers import (
    DepartmentSerializer, StaffSerializer, CreateStaffSerializer,
    StaffAttendanceSerializer, LeaveSerializer, PayrollSerializer, MeetingSerializer,
    VisitorLogSerializer, IncidentReportSerializer, CleaningScheduleSerializer, CleaningTaskSerializer,
    PayrollPaymentRequestSerializer
)
from users.models import Notification, CustomUser, HRPermissionProfile


def _is_hr_or_admin(user):
    """Execute is hr or admin."""
    return user.role in ('hr', 'admin', 'superadmin')


def _can_view_payroll(user):
    """Payroll visibility for HR/admin and finance viewers."""
    return user.role in ('hr', 'admin', 'superadmin', 'accountant')


def _can_manage_payroll(user):
    """Payroll write permissions."""
    return user.role in ('hr', 'admin', 'superadmin')


def _can_mark_payroll_paid(user):
    return user.role in ('hr', 'admin', 'superadmin', 'accountant')


def _can_signoff_payroll(user, request):
    if user.role not in ('admin', 'superadmin'):
        return False
    # Root HR head is represented as admin in middleware for request lifecycle;
    # keep final fund sign-off restricted to real admin/superadmin accounts.
    if getattr(request, 'is_root_hr_boss', False):
        return False
    return True


def _notify_admin_and_root_hr_boss(school, title, message, link=''):
    if not school:
        return
    root_hr_ids = HRPermissionProfile.objects.filter(
        school=school,
        is_root_boss=True,
    ).values_list('user_id', flat=True)
    recipients = CustomUser.objects.filter(
        school=school,
        is_active=True,
    ).filter(
        Q(role='admin') | Q(id__in=root_hr_ids)
    ).distinct()
    payload = [
        Notification(
            user=user,
            title=title,
            message=message,
            notification_type='general',
            link=link or '',
        )
        for user in recipients
    ]
    if payload:
        Notification.objects.bulk_create(payload)


def _notify_staff_paid(payroll_entries, month, year):
    notifications = []
    for entry in payroll_entries:
        notifications.append(
            Notification(
                user=entry.staff.user,
                title='Salary Paid',
                message=f"Your salary for {month} {year} has been paid.",
                notification_type='general',
                link='/my/leaves',
            )
        )
    if notifications:
        Notification.objects.bulk_create(notifications)


def _is_security_or_admin_hr(user):
    return user.role in ('security', 'hr', 'admin', 'superadmin')


def _is_cleaner_or_admin_hr(user):
    return user.role in ('cleaner', 'hr', 'admin', 'superadmin')


def _task_applies_to_date(schedule, target_date):
    if schedule.frequency == 'daily':
        return True
    if schedule.frequency == 'weekly':
        return schedule.date_created.weekday() == target_date.weekday()
    if schedule.frequency == 'monthly':
        return schedule.date_created.day == target_date.day
    return False


def _ensure_cleaning_task(schedule, target_date):
    assigned_to = schedule.assigned_to
    school = schedule.school
    task, _ = CleaningTask.objects.get_or_create(
        schedule=schedule,
        date=target_date,
        defaults={
            'assigned_to': assigned_to,
            'school': school,
        }
    )
    return task


# ---------------------------------------------------------------
# Departments
# ---------------------------------------------------------------

class DepartmentListCreateView(generics.ListCreateAPIView):
    """Represents DepartmentListCreateView."""
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        return Department.objects.filter(
            staff_members__user__school=self.request.user.school
        ).distinct()

    def perform_create(self, serializer):
        """Execute perform create."""
        serializer.save()


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents DepartmentDetailView."""
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        return Department.objects.filter(
            staff_members__user__school=self.request.user.school
        ).distinct()


# ---------------------------------------------------------------
# Staff
# ---------------------------------------------------------------

class StaffListView(generics.ListAPIView):
    """Represents StaffListView."""
    serializer_class = StaffSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        qs = Staff.objects.filter(user__school=user.school).select_related('user', 'department')
        position = self.request.query_params.get('position')
        if position:
            qs = qs.filter(position=position)
        dept = self.request.query_params.get('department')
        if dept:
            qs = qs.filter(department_id=dept)
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        staff_data = StaffSerializer(queryset, many=True).data
        for item in staff_data:
            item['has_staff_profile'] = True

        include_directory = str(request.query_params.get('include_directory', '')).lower() in ('1', 'true', 'yes')
        if not include_directory:
            return Response(staff_data)

        school = request.user.school
        if not school:
            return Response(staff_data)

        employee_roles = ('teacher', 'admin', 'hr', 'accountant', 'security', 'cleaner', 'librarian')
        linked_user_ids = set(queryset.values_list('user_id', flat=True))
        missing_users = CustomUser.objects.filter(
            school=school,
            role__in=employee_roles,
        ).exclude(id__in=linked_user_ids).order_by('first_name', 'last_name', 'id')

        position_filter = request.query_params.get('position')
        if position_filter:
            missing_users = missing_users.filter(role=position_filter)

        dept_filter = request.query_params.get('department')
        if dept_filter:
            missing_users = CustomUser.objects.none()

        for user in missing_users:
            staff_data.append({
                'id': f'user-{user.id}',
                'user': {
                    'id': user.id,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'phone_number': user.phone_number,
                    'role': user.role,
                },
                'full_name': user.full_name,
                'employee_id': None,
                'department': None,
                'department_name': None,
                'position': user.role,
                'hire_date': user.date_joined.date() if user.date_joined else None,
                'salary': None,
                'is_active': bool(user.is_active),
                'has_staff_profile': False,
            })

        return Response(staff_data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_staff_view(request):
    """Admin creates a new staff member (also creates their user account)."""
    if not _is_hr_or_admin(request.user):
        return Response({'error': 'Only admin or HR can create staff.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = CreateStaffSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        staff = serializer.save()
        return Response({
            'staff': StaffSerializer(staff).data,
            'credentials': {
                'username': staff.user.username,
                'email': staff.user.email,
            },
            'message': 'Staff member created successfully.'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StaffDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents StaffDetailView."""
    serializer_class = StaffSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        return Staff.objects.filter(user__school=self.request.user.school).select_related('user', 'department')


# ---------------------------------------------------------------
# Security: Visitor Logs
# ---------------------------------------------------------------

class VisitorLogListCreateView(generics.ListCreateAPIView):
    serializer_class = VisitorLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        school = user.school
        if not school or not _is_security_or_admin_hr(user):
            return VisitorLog.objects.none()

        qs = VisitorLog.objects.filter(school=school).select_related('logged_by')
        q_date = self.request.query_params.get('date')
        if q_date:
            qs = qs.filter(date=q_date)
        visitor_name = self.request.query_params.get('visitor_name')
        if visitor_name:
            qs = qs.filter(visitor_name__icontains=visitor_name.strip())
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not _is_security_or_admin_hr(user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only security, HR, or admin can create visitor logs.')
        serializer.save(school=user.school, logged_by=user)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def visitor_checkout_view(request, pk):
    if not _is_security_or_admin_hr(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    try:
        visitor = VisitorLog.objects.get(id=pk, school=school)
    except VisitorLog.DoesNotExist:
        return Response({'error': 'Visitor log not found.'}, status=status.HTTP_404_NOT_FOUND)

    if visitor.check_out_time:
        return Response({'error': 'Visitor already checked out.'}, status=status.HTTP_400_BAD_REQUEST)

    visitor.check_out_time = timezone.now()
    notes = request.data.get('notes')
    if notes is not None:
        visitor.notes = notes
    visitor.save(update_fields=['check_out_time', 'notes'])
    return Response(VisitorLogSerializer(visitor).data)


# ---------------------------------------------------------------
# Security: Incident Reports
# ---------------------------------------------------------------

class IncidentReportListCreateView(generics.ListCreateAPIView):
    serializer_class = IncidentReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        school = user.school
        if not school or not _is_security_or_admin_hr(user):
            return IncidentReport.objects.none()

        qs = IncidentReport.objects.filter(school=school).select_related('reported_by')
        if user.role == 'security':
            qs = qs.filter(reported_by=user)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        incident_type = self.request.query_params.get('incident_type')
        if incident_type:
            qs = qs.filter(incident_type=incident_type)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not _is_security_or_admin_hr(user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only security, HR, or admin can create incident reports.')
        serializer.save(school=user.school, reported_by=user)


class IncidentReportDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = IncidentReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        school = user.school
        if not school or not _is_security_or_admin_hr(user):
            return IncidentReport.objects.none()

        qs = IncidentReport.objects.filter(school=school).select_related('reported_by')
        if user.role == 'security':
            qs = qs.filter(reported_by=user)
        return qs

    def update(self, request, *args, **kwargs):
        if request.user.role not in ('hr', 'admin', 'superadmin'):
            return Response({'error': 'Only HR/admin can update incidents.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


# ---------------------------------------------------------------
# Cleaning Schedules and Tasks
# ---------------------------------------------------------------

class CleaningScheduleListCreateView(generics.ListCreateAPIView):
    serializer_class = CleaningScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        school = user.school
        if not school or not _is_cleaner_or_admin_hr(user):
            return CleaningSchedule.objects.none()

        qs = CleaningSchedule.objects.filter(school=school).select_related('assigned_to__user', 'created_by')
        if user.role == 'cleaner':
            qs = qs.filter(assigned_to__user=user)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not _is_hr_or_admin(user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only HR/admin can create cleaning schedules.')
        schedule = serializer.save(school=user.school, created_by=user)
        _ensure_cleaning_task(schedule, date.today())


class CleaningScheduleDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CleaningScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        school = user.school
        if not school or not _is_cleaner_or_admin_hr(user):
            return CleaningSchedule.objects.none()

        qs = CleaningSchedule.objects.filter(school=school).select_related('assigned_to__user', 'created_by')
        if user.role == 'cleaner':
            qs = qs.filter(assigned_to__user=user)
        return qs

    def update(self, request, *args, **kwargs):
        if not _is_hr_or_admin(request.user):
            return Response({'error': 'Only HR/admin can update cleaning schedules.'}, status=status.HTTP_403_FORBIDDEN)
        response = super().update(request, *args, **kwargs)
        schedule = self.get_object()
        _ensure_cleaning_task(schedule, date.today())
        return response


class CleaningTaskListView(generics.ListAPIView):
    serializer_class = CleaningTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        school = user.school
        if not school or not _is_cleaner_or_admin_hr(user):
            return CleaningTask.objects.none()

        q_date = self.request.query_params.get('date')
        try:
            target_date = date.fromisoformat(q_date) if q_date else date.today()
        except ValueError:
            target_date = date.today()

        schedules = CleaningSchedule.objects.filter(school=school, is_active=True).select_related('assigned_to')
        if user.role == 'cleaner':
            schedules = schedules.filter(assigned_to__user=user)

        for schedule in schedules:
            if _task_applies_to_date(schedule, target_date):
                _ensure_cleaning_task(schedule, target_date)

        qs = CleaningTask.objects.filter(school=school, date=target_date).select_related(
            'schedule', 'assigned_to__user'
        )
        if user.role == 'cleaner':
            qs = qs.filter(assigned_to__user=user)
        return qs


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def complete_cleaning_task_view(request, pk):
    user = request.user
    if not _is_cleaner_or_admin_hr(user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    school = user.school
    try:
        task = CleaningTask.objects.select_related('assigned_to__user').get(id=pk, school=school)
    except CleaningTask.DoesNotExist:
        return Response({'error': 'Task not found.'}, status=status.HTTP_404_NOT_FOUND)

    if user.role == 'cleaner' and (not task.assigned_to or task.assigned_to.user_id != user.id):
        return Response({'error': 'You can only complete your assigned tasks.'}, status=status.HTTP_403_FORBIDDEN)

    is_done = request.data.get('is_done', True)
    task.is_done = bool(is_done)
    task.completed_at = timezone.now() if task.is_done else None
    if 'notes' in request.data:
        task.notes = request.data.get('notes', '')
    task.save(update_fields=['is_done', 'completed_at', 'notes'])
    return Response(CleaningTaskSerializer(task).data)


# ---------------------------------------------------------------
# Staff Attendance
# ---------------------------------------------------------------

class StaffAttendanceListCreateView(generics.ListCreateAPIView):
    """Represents StaffAttendanceListCreateView."""
    serializer_class = StaffAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        qs = Attendance.objects.filter(staff__user__school=user.school).select_related('staff__user')
        if user.role not in ('hr', 'admin', 'superadmin'):
            try:
                staff_profile = Staff.objects.get(user=user)
                qs = qs.filter(staff=staff_profile)
            except Staff.DoesNotExist:
                return Attendance.objects.none()
        date = self.request.query_params.get('date')
        if date:
            qs = qs.filter(date=date)
        staff_id = self.request.query_params.get('staff_id')
        if staff_id and user.role in ('hr', 'admin', 'superadmin'):
            qs = qs.filter(staff_id=staff_id)
        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in ('hr', 'admin', 'superadmin'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only HR/admin can create attendance records.')
        serializer.save()


class StaffAttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents StaffAttendanceDetailView."""
    serializer_class = StaffAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        qs = Attendance.objects.filter(staff__user__school=user.school)
        if user.role not in ('hr', 'admin', 'superadmin'):
            try:
                staff_profile = Staff.objects.get(user=user)
                qs = qs.filter(staff=staff_profile)
            except Staff.DoesNotExist:
                return Attendance.objects.none()
        return qs


# ---------------------------------------------------------------
# Leave Requests
# ---------------------------------------------------------------

class LeaveListCreateView(generics.ListCreateAPIView):
    """Represents LeaveListCreateView."""
    serializer_class = LeaveSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        qs = Leave.objects.filter(staff__user__school=user.school).select_related('staff__user', 'approved_by')

        # HR/Admin sees all; staff see only their own
        if user.role not in ('hr', 'admin', 'superadmin'):
            try:
                staff = Staff.objects.get(user=user)
                qs = qs.filter(staff=staff)
            except Staff.DoesNotExist:
                return Leave.objects.none()

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        """Execute perform create."""
        try:
            staff = Staff.objects.get(user=self.request.user)
        except Staff.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('No staff profile associated with your account.')
        serializer.save(staff=staff)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def review_leave_view(request, leave_id):
    """Admin/HR approves or rejects a leave request."""
    if not _is_hr_or_admin(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        leave = Leave.objects.get(id=leave_id, staff__user__school=request.user.school)
    except Leave.DoesNotExist:
        return Response({'error': 'Leave request not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Accept either `status` (approved/rejected) or legacy `action` (approve/reject)
    new_status = request.data.get('status')
    action = request.data.get('action')
    if not new_status and action:
        action_map = {'approve': 'approved', 'reject': 'rejected'}
        new_status = action_map.get(str(action).strip().lower())
    if new_status not in ('approved', 'rejected'):
        return Response({'error': "Status must be 'approved' or 'rejected'."}, status=status.HTTP_400_BAD_REQUEST)

    leave.status = new_status
    leave.approved_by = request.user
    leave.date_reviewed = timezone.now()
    leave.save()

    return Response(LeaveSerializer(leave).data)


# ---------------------------------------------------------------
# Payroll
# ---------------------------------------------------------------

class PayrollListCreateView(generics.ListCreateAPIView):
    """Represents PayrollListCreateView."""
    serializer_class = PayrollSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        if not _can_view_payroll(self.request.user):
            return Payroll.objects.none()
        qs = Payroll.objects.filter(staff__user__school=self.request.user.school).select_related('staff__user')
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        search = self.request.query_params.get('search')
        if month:
            qs = qs.filter(month=month)
        if year:
            qs = qs.filter(year=year)
        if search:
            qs = qs.filter(
                Q(staff__user__first_name__icontains=search) |
                Q(staff__user__last_name__icontains=search) |
                Q(staff__employee_id__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        """Check permissions before serializer validation."""
        if not _can_manage_payroll(request.user):
            return Response(
                {'error': 'Only HR/admin can create payroll entries.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        if not _can_manage_payroll(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only HR/admin can create payroll entries.')
        entry = serializer.save()
        _notify_admin_and_root_hr_boss(
            school=self.request.user.school,
            title='Payroll Entry Added',
            message=f"{self.request.user.full_name} added payroll for {entry.staff.user.full_name} ({entry.month} {entry.year}).",
            link='/hr/accounting',
        )


class PayrollDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents PayrollDetailView."""
    serializer_class = PayrollSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        if not _can_view_payroll(self.request.user):
            return Payroll.objects.none()
        return Payroll.objects.filter(staff__user__school=self.request.user.school)

    def update(self, request, *args, **kwargs):
        if not _can_manage_payroll(request.user):
            return Response({'error': 'Only HR/admin can edit payroll entries.'}, status=status.HTTP_403_FORBIDDEN)
        response = super().update(request, *args, **kwargs)
        obj = self.get_object()
        _notify_admin_and_root_hr_boss(
            school=request.user.school,
            title='Payroll Entry Updated',
            message=f"{request.user.full_name} updated payroll for {obj.staff.user.full_name} ({obj.month} {obj.year}).",
            link='/hr/accounting',
        )
        return response

    def destroy(self, request, *args, **kwargs):
        if not _can_manage_payroll(request.user):
            return Response({'error': 'Only HR/admin can delete payroll entries.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self.get_object()
        response = super().destroy(request, *args, **kwargs)
        _notify_admin_and_root_hr_boss(
            school=request.user.school,
            title='Payroll Entry Deleted',
            message=f"{request.user.full_name} deleted payroll for {obj.staff.user.full_name} ({obj.month} {obj.year}).",
            link='/hr/accounting',
        )
        return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def payroll_summary_view(request):
    """Monthly payroll summary — total gross, net, staff count."""
    if not _can_view_payroll(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from django.db.models import Sum, Count
    month = request.query_params.get('month')
    year = request.query_params.get('year')

    qs = Payroll.objects.filter(staff__user__school=request.user.school)
    if month:
        qs = qs.filter(month=month)
    if year:
        qs = qs.filter(year=year)

    summary = qs.aggregate(
        total_basic=Sum('basic_salary'),
        total_allowances=Sum('allowances'),
        total_deductions=Sum('deductions'),
        total_net=Sum('net_salary'),
        staff_count=Count('id'),
    )
    summary['paid_count'] = qs.filter(is_paid=True).count()
    summary['unpaid_count'] = qs.filter(is_paid=False).count()
    summary['total_paid'] = qs.filter(is_paid=True).aggregate(total=Sum('net_salary'))['total'] or 0
    summary['total_pending'] = qs.filter(is_paid=False).aggregate(total=Sum('net_salary'))['total'] or 0
    # Backward-compatible aliases used by the frontend HR payroll screen.
    summary['total_gross'] = summary.get('total_net') or 0
    return Response(summary)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def payroll_generate_view(request):
    """Bulk-create Payroll entries for the given month/year from Staff.salary.

    Skips staff that already have an entry for the period. Staff without a
    salary recorded on their profile are skipped with a warning in the response.
    """
    if not _is_hr_or_admin(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    month = request.data.get('month')
    year = request.data.get('year')
    if not month or not year:
        return Response({'error': 'month and year are required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        year = int(year)
    except (TypeError, ValueError):
        return Response({'error': 'year must be a number.'}, status=status.HTTP_400_BAD_REQUEST)

    existing = set(
        Payroll.objects.filter(
            staff__user__school=request.user.school, month=month, year=year,
        ).values_list('staff_id', flat=True)
    )

    created = 0
    skipped_no_salary = 0
    for staff in Staff.objects.filter(user__school=request.user.school, is_active=True):
        if staff.id in existing:
            continue
        if not staff.salary or staff.salary <= 0:
            skipped_no_salary += 1
            continue
        Payroll.objects.create(
            staff=staff,
            month=month,
            year=year,
            basic_salary=staff.salary,
            allowances=0,
            deductions=0,
            net_salary=staff.salary,
            is_paid=False,
        )
        created += 1

    return Response({
        'created': created,
        'skipped_existing': len(existing),
        'skipped_no_salary': skipped_no_salary,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def payroll_mark_paid_view(request):
    """Create a payroll payment request for admin sign-off."""
    if not _can_mark_payroll_paid(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    month = request.data.get('month')
    year = request.data.get('year')
    staff_ids = request.data.get('staff_ids') or []

    if not month or not year:
        return Response({'error': 'month and year are required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        year = int(year)
    except (TypeError, ValueError):
        return Response({'error': 'year must be a number.'}, status=status.HTTP_400_BAD_REQUEST)
    if staff_ids and not isinstance(staff_ids, list):
        return Response({'error': 'staff_ids must be a list.'}, status=status.HTTP_400_BAD_REQUEST)

    qs = Payroll.objects.filter(
        staff__user__school=request.user.school,
        month=month,
        year=year,
        is_paid=False,
    )
    if staff_ids:
        qs = qs.filter(staff_id__in=staff_ids)
    touched = qs.count()
    if touched == 0:
        return Response({'error': 'No unpaid payroll records matched your selection.'}, status=status.HTTP_400_BAD_REQUEST)

    request_obj = PayrollPaymentRequest.objects.create(
        school=request.user.school,
        month=month,
        year=year,
        target_type='selected' if staff_ids else 'all',
        staff_ids=staff_ids,
        requested_by=request.user,
        status='pending',
    )

    target_desc = 'selected staff' if request_obj.target_type == 'selected' else 'all staff'
    _notify_admin_and_root_hr_boss(
        school=request.user.school,
        title='Payroll Payment Request',
        message=f"{request.user.full_name} requested payroll sign-off for {target_desc} ({month} {year}).",
        link='/hr/accounting',
    )

    return Response({
        'request_id': request_obj.id,
        'status': request_obj.status,
        'matched_records': touched,
        'month': month,
        'year': year,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def payroll_payment_requests_view(request):
    """List payroll payment sign-off requests."""
    if not _can_view_payroll(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    qs = PayrollPaymentRequest.objects.filter(school=request.user.school).select_related('requested_by', 'approved_by')
    req_status = request.query_params.get('status')
    if req_status:
        qs = qs.filter(status=req_status)
    month = request.query_params.get('month')
    if month:
        qs = qs.filter(month=month)
    year = request.query_params.get('year')
    if year:
        qs = qs.filter(year=year)
    serializer = PayrollPaymentRequestSerializer(qs[:100], many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def payroll_payment_request_review_view(request, request_id):
    """Admin final sign-off/rejection for payroll payment request."""
    if not _can_signoff_payroll(request.user, request):
        return Response({'error': 'Only admin can give final payroll sign-off.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        pay_req = PayrollPaymentRequest.objects.get(id=request_id, school=request.user.school)
    except PayrollPaymentRequest.DoesNotExist:
        return Response({'error': 'Payroll payment request not found.'}, status=status.HTTP_404_NOT_FOUND)

    if pay_req.status != 'pending':
        return Response({'error': 'This request has already been reviewed.'}, status=status.HTTP_400_BAD_REQUEST)

    decision = (request.data.get('status') or '').strip().lower()
    note = (request.data.get('admin_note') or '').strip()
    if decision not in ('approved', 'rejected'):
        return Response({'error': "status must be 'approved' or 'rejected'."}, status=status.HTTP_400_BAD_REQUEST)

    pay_req.status = decision
    pay_req.approved_by = request.user
    pay_req.reviewed_at = timezone.now()
    pay_req.admin_note = note
    pay_req.save(update_fields=['status', 'approved_by', 'reviewed_at', 'admin_note'])

    updated = 0
    if decision == 'approved':
        qs = Payroll.objects.filter(
            staff__user__school=request.user.school,
            month=pay_req.month,
            year=pay_req.year,
            is_paid=False,
        ).select_related('staff__user')
        if pay_req.target_type == 'selected':
            qs = qs.filter(staff_id__in=(pay_req.staff_ids or []))
        entries = list(qs)
        updated = len(entries)
        if updated:
            qs.update(is_paid=True, pay_date=timezone.localdate())
            _notify_staff_paid(entries, pay_req.month, pay_req.year)

    _notify_admin_and_root_hr_boss(
        school=request.user.school,
        title=f"Payroll Request {decision.title()}",
        message=f"{request.user.full_name} {decision} payroll request #{pay_req.id} for {pay_req.month} {pay_req.year}.",
        link='/hr/accounting',
    )

    return Response({
        'request_id': pay_req.id,
        'status': pay_req.status,
        'updated': updated,
        'month': pay_req.month,
        'year': pay_req.year,
    })


# ---------------------------------------------------------------
# Meetings
# ---------------------------------------------------------------

class MeetingListCreateView(generics.ListCreateAPIView):
    """Represents MeetingListCreateView."""
    serializer_class = MeetingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        user = self.request.user
        return Meeting.objects.filter(
            organizer__school=user.school
        ).prefetch_related('participants').select_related('organizer')

    def perform_create(self, serializer):
        """Execute perform create."""
        serializer.save(organizer=self.request.user)


class MeetingDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents MeetingDetailView."""
    serializer_class = MeetingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        return Meeting.objects.filter(organizer__school=self.request.user.school)


# ---------------------------------------------------------------
# HR Dashboard Stats
# ---------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def hr_dashboard_stats_view(request):
    """Summary stats for the HR dashboard."""
    if not _is_hr_or_admin(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    from academics.models import Student
    total_staff = Staff.objects.filter(user__school=school, is_active=True).count()
    student_qs = Student.objects.filter(user__school=school, user__is_active=True)
    total_students = student_qs.count()
    boarding_students = student_qs.filter(residence_type='boarding').count()
    day_students = student_qs.filter(residence_type='day').count()
    on_leave = Leave.objects.filter(staff__user__school=school, status='approved').count()
    pending_leaves = Leave.objects.filter(staff__user__school=school, status='pending').count()
    departments = Department.objects.filter(staff_members__user__school=school).distinct().count()
    upcoming_meetings = Meeting.objects.filter(organizer__school=school, is_completed=False).count()

    return Response({
        'total_students': total_students,
        'boarding_students': boarding_students,
        'day_students': day_students,
        'total_staff': total_staff,
        'on_leave': on_leave,
        'pending_leave_requests': pending_leaves,
        'departments': departments,
        'upcoming_meetings': upcoming_meetings,
        'school_accommodation_type': getattr(school, 'accommodation_type', 'day'),
    })
