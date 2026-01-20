from django.urls import path
from . import student_views, homework_views

urlpatterns = [
    path('profile/', student_views.student_profile, name='student-profile'),
    path('dashboard/stats/', student_views.student_dashboard_stats, name='student-dashboard-stats'),
    path('submissions/', student_views.student_submissions, name='student-submissions'),
    path('marks/', student_views.student_marks, name='student-marks'),
    path('calendar/', student_views.school_calendar, name='school-calendar'),
    path('timetable/', student_views.student_timetable, name='student-timetable'),
    path('teachers/', student_views.student_teachers, name='student-teachers'),
    path('announcements/', student_views.student_announcements, name='student-announcements'),
    
    path('homework/', homework_views.student_homework_list, name='student-homework-list'),
    path('homework/<int:homework_id>/download/', homework_views.student_download_homework_file, name='student-download-homework'),
]
