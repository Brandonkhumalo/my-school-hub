from django.urls import path
from . import views
from . import promotion_views
from . import activity_views
from . import health_views
from . import discipline_views
from . import assessment_plan_views
from . import papers_views

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
    path('students/<int:pk>/transfer/', views.transfer_student, name='student-transfer'),
    path('students/<int:student_id>/performance/', views.student_performance_view, name='student-performance'),
    path('past-students/', views.past_students_search, name='past-students-search'),
    
    # Teacher endpoints
    path('teachers/', views.TeacherListView.as_view(), name='teacher-list'),
    path('teachers/<int:pk>/', views.TeacherDetailView.as_view(), name='teacher-detail'),
    
    # Parent endpoints
    path('parents/', views.ParentListView.as_view(), name='parent-list'),
    path('parents/<int:pk>/', views.ParentDetailView.as_view(), name='parent-detail'),
    
    # Result endpoints
    path('results/', views.ResultListCreateView.as_view(), name='result-list-create'),
    path('results/<int:pk>/', views.ResultDetailView.as_view(), name='result-detail'),
    path('results/class-averages/', views.class_averages_view, name='class-averages'),
    
    # Timetable endpoints
    path('timetables/', views.TimetableListView.as_view(), name='timetable-list'),
    path('timetables/generate/', views.generate_timetable_view, name='timetable-generate'),
    path('timetables/stats/', views.get_timetable_stats, name='timetable-stats'),
    path('timetables/conflicts/', views.timetable_conflict_check, name='timetable-conflicts'),
    
    # Announcement endpoints
    path('announcements/', views.AnnouncementListCreateView.as_view(), name='announcement-list-create'),
    path('announcements/dismiss-all/', views.dismiss_all_announcements, name='announcement-dismiss-all'),
    path('announcements/<int:pk>/dismiss/', views.dismiss_announcement, name='announcement-dismiss'),
    path('announcements/<int:pk>/', views.AnnouncementDetailView.as_view(), name='announcement-detail'),
    
    # Complaint endpoints
    path('complaints/', views.ComplaintListCreateView.as_view(), name='complaint-list-create'),
    path('complaints/<int:pk>/', views.ComplaintDetailView.as_view(), name='complaint-detail'),
    
    # Suspension endpoints
    path('suspensions/', views.SuspensionListCreateView.as_view(), name='suspension-list-create'),
    
    # Admin Parent-Child Link Management endpoints
    path('parent-link-requests/', views.pending_parent_link_requests, name='pending-parent-link-requests'),
    path('parent-link-requests/<int:link_id>/approve/', views.approve_parent_link_request, name='approve-parent-link-request'),
    path('parent-link-requests/<int:link_id>/decline/', views.decline_parent_link_request, name='decline-parent-link-request'),

    # Report card PDF
    path('students/<int:student_id>/report-card/', views.generate_report_card, name='report-card'),

    # Report card publishing
    path('reports/generate/', views.generate_reports_for_teachers, name='generate-reports-for-teachers'),
    path('reports/publish/', views.publish_reports, name='publish-reports'),
    path('reports/publish-all/', views.publish_all_reports, name='publish-all-reports'),
    path('reports/published/', views.list_published_reports, name='list-published-reports'),
    path('reports/approval-requests/', views.list_report_approval_requests, name='list-report-approval-requests'),
    path('reports/delivery-exclusions/', views.set_report_delivery_exclusion, name='set-report-delivery-exclusion'),
    path('reports/approval-requests/<int:request_id>/review/', views.review_report_approval_request, name='review-report-approval-request'),

    # Grade predictions
    path('students/<int:student_id>/grade-prediction/', views.student_grade_prediction, name='grade-prediction'),

    # Bulk CSV import
    path('bulk-import/catalog/', views.bulk_import_parameter_catalog, name='bulk-import-catalog'),
    path('bulk-import/validate/', views.bulk_import_validate, name='bulk-import-validate'),
    path('bulk-import/commit/', views.bulk_import_commit, name='bulk-import-commit'),
    path('bulk-import/history/', views.bulk_import_history, name='bulk-import-history'),
    path('bulk-import/history/<int:job_id>/rollback/', views.bulk_import_rollback, name='bulk-import-rollback'),
    path('students/bulk-import/', views.bulk_import_students, name='bulk-import-students'),
    path('results/bulk-import/', views.bulk_import_results, name='bulk-import-results'),

    # Subject-Teacher assignment endpoints
    path('subjects/<int:subject_id>/teachers/', views.subject_teachers, name='subject-teachers'),
    path('subjects/<int:subject_id>/assign-teacher/', views.assign_teacher_to_subject, name='assign-teacher'),
    path('subjects/<int:subject_id>/remove-teacher/<int:teacher_id>/', views.remove_teacher_from_subject, name='remove-teacher'),

    # Promotion endpoints
    path('promotions/preview/', promotion_views.promotion_preview, name='promotion-preview'),
    path('promotions/', promotion_views.process_promotions, name='process-promotions'),
    path('promotions/history/', promotion_views.promotion_history, name='promotion-history'),

    # Activity & Sports endpoints
    path('activities/', activity_views.activity_list_create, name='activity-list-create'),
    path('activities/<int:activity_id>/', activity_views.activity_detail, name='activity-detail'),
    path('activities/<int:activity_id>/enrollments/', activity_views.activity_enrollments, name='activity-enrollments'),
    path('activities/<int:activity_id>/enrollments/<int:enrollment_id>/review/', activity_views.review_activity_enrollment, name='activity-enrollment-review'),
    path('activities/<int:activity_id>/enroll/', activity_views.enroll_student, name='activity-enroll'),
    path('activities/<int:activity_id>/unenroll/<int:student_id>/', activity_views.unenroll_student, name='activity-unenroll'),
    path('activities/<int:activity_id>/suspend/<int:student_id>/', activity_views.suspend_student_activity, name='activity-suspend'),
    path('activities/<int:activity_id>/events/', activity_views.activity_events, name='activity-events'),
    path('activities/<int:activity_id>/events/<int:event_id>/squad/', activity_views.event_squad, name='event-squad'),
    path('activities/<int:activity_id>/events/<int:event_id>/attendance/', activity_views.event_training_attendance, name='event-attendance'),
    path('activities/analytics/', activity_views.sports_analytics, name='sports-analytics'),
    path('sports-houses/', activity_views.sports_houses, name='sports-houses'),

    # Accolades endpoints
    path('accolades/', activity_views.accolade_list_create, name='accolade-list-create'),
    path('accolades/award/', activity_views.award_accolade, name='accolade-award'),
    path('accolades/leaderboard/', activity_views.accolade_leaderboard, name='accolade-leaderboard'),

    # Health Records
    path('health/<int:student_id>/', health_views.health_record_view, name='health-record'),
    path('clinic-visits/', health_views.clinic_visits_view, name='clinic-visits'),

    # Disciplinary Records
    path('discipline/', discipline_views.discipline_list_create, name='discipline-list-create'),
    path('discipline/<int:record_id>/', discipline_views.discipline_update, name='discipline-update'),
    path('discipline/student/<int:student_id>/', discipline_views.discipline_by_student, name='discipline-by-student'),
    path('discipline/<int:record_id>/resolve/', discipline_views.discipline_resolve, name='discipline-resolve'),
    path('attendance/permissions/', views.attendance_permissions, name='attendance-permissions'),
    path('attendance/period-tracking-start-date/', views.attendance_period_tracking_start_date, name='attendance-period-tracking-start-date'),
    path('attendance/class/<int:attendance_id>/edit/', views.edit_class_attendance, name='edit-class-attendance'),
    path('attendance/subject/<int:attendance_id>/edit/', views.edit_subject_attendance, name='edit-subject-attendance'),

    # At-Risk Students (Admin)
    path('admin/at-risk-students/', views.admin_at_risk_students, name='admin-at-risk-students'),

    # Assessment Plans (admin CRUD + role-specific reads)
    path('assessment-plans/', assessment_plan_views.assessment_plans_list_create, name='assessment-plans-list-create'),
    path('assessment-plans/<int:pk>/', assessment_plan_views.assessment_plan_detail, name='assessment-plan-detail'),
    path('assessment-plans/for-teacher/', assessment_plan_views.plan_for_teacher, name='assessment-plan-for-teacher'),
    path('assessment-plans/for-student/', assessment_plan_views.plans_for_student, name='assessment-plans-for-student'),
    path('assessment-plans/for-parent/', assessment_plan_views.plans_for_parent, name='assessment-plans-for-parent'),

    # Past exam papers (file storage handled by go-services)
    path('past-papers/', papers_views.past_papers_list_create, name='past-papers-list-create'),
    path('past-papers/<int:pk>/', papers_views.past_paper_detail, name='past-paper-detail'),
    path('past-papers/<int:pk>/extract/', papers_views.past_paper_extract, name='past-paper-extract'),
]
