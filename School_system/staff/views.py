import logging
from datetime import date
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from .models import (
    Department, Staff, Attendance, Leave, Payroll, Meeting,
    VisitorLog, IncidentReport, CleaningSchedule, CleaningTask
)
from .serializers import (
    DepartmentSerializer, StaffSerializer, CreateStaffSerializer,
    StaffAttendanceSerializer, LeaveSerializer, PayrollSerializer, MeetingSerializer,
    VisitorLogSerializer, IncidentReportSerializer, CleaningScheduleSerializer, CleaningTaskSerializer
)


def _is_hr_or_admin(user):
    """Execute is hr or admin."""
    return user.role in ('hr', 'admin', 'superadmin')


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
                'password': getattr(staff, '_generated_password', ''),
            },
            'message': 'Staff member created successfully. Share credentials with the employee.'
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
        if not _is_hr_or_admin(self.request.user):
            return Payroll.objects.none()
        qs = Payroll.objects.filter(staff__user__school=self.request.user.school).select_related('staff__user')
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        if month:
            qs = qs.filter(month=month)
        if year:
            qs = qs.filter(year=year)
        return qs

    def perform_create(self, serializer):
        if not _is_hr_or_admin(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only HR/admin can create payroll entries.')
        serializer.save()


class PayrollDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents PayrollDetailView."""
    serializer_class = PayrollSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        return Payroll.objects.filter(staff__user__school=self.request.user.school)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def payroll_summary_view(request):
    """Monthly payroll summary — total gross, net, staff count."""
    if not _is_hr_or_admin(request.user):
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
