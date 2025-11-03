from django.urls import path
from . import views

urlpatterns = [
    # Subject endpoints
    path('subjects/', views.SubjectListCreateView.as_view(), name='subject-list-create'),
    path('subjects/<int:pk>/', views.SubjectDetailView.as_view(), name='subject-detail'),
    
    # Class endpoints
    path('classes/', views.ClassListCreateView.as_view(), name='class-list-create'),
    path('classes/<int:pk>/', views.ClassDetailView.as_view(), name='class-detail'),
    
    # Student endpoints
    path('students/', views.StudentListView.as_view(), name='student-list'),
    path('students/<int:pk>/', views.StudentDetailView.as_view(), name='student-detail'),
    path('students/<int:student_id>/performance/', views.student_performance_view, name='student-performance'),
    
    # Teacher endpoints
    path('teachers/', views.TeacherListView.as_view(), name='teacher-list'),
    
    # Parent endpoints
    path('parents/', views.ParentListView.as_view(), name='parent-list'),
    
    # Result endpoints
    path('results/', views.ResultListCreateView.as_view(), name='result-list-create'),
    path('results/<int:pk>/', views.ResultDetailView.as_view(), name='result-detail'),
    
    # Timetable endpoints
    path('timetables/', views.TimetableListView.as_view(), name='timetable-list'),
    
    # Announcement endpoints
    path('announcements/', views.AnnouncementListCreateView.as_view(), name='announcement-list-create'),
    
    # Complaint endpoints
    path('complaints/', views.ComplaintListCreateView.as_view(), name='complaint-list-create'),
    path('complaints/<int:pk>/', views.ComplaintDetailView.as_view(), name='complaint-detail'),
    
    # Suspension endpoints
    path('suspensions/', views.SuspensionListCreateView.as_view(), name='suspension-list-create'),
    
    # Admin Parent-Child Link Management endpoints
    path('parent-link-requests/', views.pending_parent_link_requests, name='pending-parent-link-requests'),
    path('parent-link-requests/<int:link_id>/approve/', views.approve_parent_link_request, name='approve-parent-link-request'),
    path('parent-link-requests/<int:link_id>/decline/', views.decline_parent_link_request, name='decline-parent-link-request'),
]