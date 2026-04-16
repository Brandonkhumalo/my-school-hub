from django.urls import path
from . import views

urlpatterns = [
    # HR Dashboard
    path('dashboard/', views.hr_dashboard_stats_view, name='hr-dashboard'),

    # Departments
    path('departments/', views.DepartmentListCreateView.as_view(), name='department-list-create'),
    path('departments/<int:pk>/', views.DepartmentDetailView.as_view(), name='department-detail'),

    # Staff management (admin creates HR/accountant accounts here)
    path('', views.StaffListView.as_view(), name='staff-list'),
    path('create/', views.create_staff_view, name='staff-create'),
    path('<int:pk>/', views.StaffDetailView.as_view(), name='staff-detail'),

    # Staff Attendance
    path('attendance/', views.StaffAttendanceListCreateView.as_view(), name='staff-attendance-list'),
    path('attendance/<int:pk>/', views.StaffAttendanceDetailView.as_view(), name='staff-attendance-detail'),

    # Leave requests
    path('leaves/', views.LeaveListCreateView.as_view(), name='leave-list-create'),
    path('leaves/<int:leave_id>/review/', views.review_leave_view, name='leave-review'),

    # Payroll
    path('payroll/', views.PayrollListCreateView.as_view(), name='payroll-list-create'),
    path('payroll/<int:pk>/', views.PayrollDetailView.as_view(), name='payroll-detail'),
    path('payroll/summary/', views.payroll_summary_view, name='payroll-summary'),

    # Meetings
    path('meetings/', views.MeetingListCreateView.as_view(), name='meeting-list-create'),
    path('meetings/<int:pk>/', views.MeetingDetailView.as_view(), name='meeting-detail'),

    # Security: visitors and incidents
    path('visitors/', views.VisitorLogListCreateView.as_view(), name='visitor-log-list-create'),
    path('visitors/<int:pk>/checkout/', views.visitor_checkout_view, name='visitor-checkout'),
    path('incidents/', views.IncidentReportListCreateView.as_view(), name='incident-report-list-create'),
    path('incidents/<int:pk>/', views.IncidentReportDetailView.as_view(), name='incident-report-detail'),

    # Cleaning schedules/tasks
    path('cleaning-schedules/', views.CleaningScheduleListCreateView.as_view(), name='cleaning-schedule-list-create'),
    path('cleaning-schedules/<int:pk>/', views.CleaningScheduleDetailView.as_view(), name='cleaning-schedule-detail'),
    path('cleaning-tasks/', views.CleaningTaskListView.as_view(), name='cleaning-task-list'),
    path('cleaning-tasks/<int:pk>/complete/', views.complete_cleaning_task_view, name='cleaning-task-complete'),
]
