from django.urls import path
from . import student_views, homework_views, activity_views, health_views

urlpatterns = [
    path('profile/', student_views.student_profile, name='student-profile'),
    path('dashboard/stats/', student_views.student_dashboard_stats, name='student-dashboard-stats'),
    path('submissions/', student_views.student_submissions, name='student-submissions'),
    path('marks/', student_views.student_marks, name='student-marks'),
    path('calendar/', student_views.school_calendar, name='school-calendar'),
    path('timetable/', student_views.student_timetable, name='student-timetable'),
    path('teachers/', student_views.student_teachers, name='student-teachers'),
    path('announcements/', student_views.student_announcements, name='student-announcements'),
    
    path('attendance/', student_views.student_attendance, name='student-attendance'),
    path('assignments/', student_views.student_assignments, name='student-assignments'),
    path('assignments/<int:assignment_id>/submit/', student_views.student_assignment_submission, name='student-assignment-submit'),
    path('tests/', student_views.student_tests, name='student-tests'),
    path('tests/<int:test_id>/start/', student_views.student_start_test, name='student-test-start'),
    path('attempts/<int:attempt_id>/', student_views.student_attempt_detail, name='student-attempt-detail'),
    path('attempts/<int:attempt_id>/submit/', student_views.student_submit_attempt, name='student-attempt-submit'),

    path('homework/', homework_views.student_homework_list, name='student-homework-list'),
    path('homework/<int:homework_id>/download/', homework_views.student_download_homework_file, name='student-download-homework'),

    # Student activities & accolades
    path('activities/', activity_views.student_activities, name='student-activities'),
    path('accolades/', activity_views.student_accolades, name='student-accolades'),

    # Student health record (own)
    path('health/', health_views.student_own_health, name='student-health'),
]
