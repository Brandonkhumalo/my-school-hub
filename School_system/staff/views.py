import logging
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from .models import Department, Staff, Attendance, Leave, Payroll, Meeting
from .serializers import (
    DepartmentSerializer, StaffSerializer, CreateStaffSerializer,
    StaffAttendanceSerializer, LeaveSerializer, PayrollSerializer, MeetingSerializer
)


def _is_hr_or_admin(user):
    """Execute is hr or admin."""
    return user.role in ('hr', 'admin', 'superadmin')


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
# Staff Attendance
# ---------------------------------------------------------------

class StaffAttendanceListCreateView(generics.ListCreateAPIView):
    """Represents StaffAttendanceListCreateView."""
    serializer_class = StaffAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        qs = Attendance.objects.filter(staff__user__school=self.request.user.school).select_related('staff__user')
        date = self.request.query_params.get('date')
        if date:
            qs = qs.filter(date=date)
        staff_id = self.request.query_params.get('staff_id')
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        return qs


class StaffAttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Represents StaffAttendanceDetailView."""
    serializer_class = StaffAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return queryset."""
        return Attendance.objects.filter(staff__user__school=self.request.user.school)


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

    new_status = request.data.get('status')
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
        qs = Payroll.objects.filter(staff__user__school=self.request.user.school).select_related('staff__user')
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        if month:
            qs = qs.filter(month=month)
        if year:
            qs = qs.filter(year=year)
        return qs


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
    return Response(summary)


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
    total_staff = Staff.objects.filter(user__school=school, is_active=True).count()
    on_leave = Leave.objects.filter(staff__user__school=school, status='approved').count()
    pending_leaves = Leave.objects.filter(staff__user__school=school, status='pending').count()
    departments = Department.objects.filter(staff_members__user__school=school).distinct().count()
    upcoming_meetings = Meeting.objects.filter(organizer__school=school, is_completed=False).count()

    return Response({
        'total_staff': total_staff,
        'on_leave': on_leave,
        'pending_leave_requests': pending_leaves,
        'departments': departments,
        'upcoming_meetings': upcoming_meetings,
    })
