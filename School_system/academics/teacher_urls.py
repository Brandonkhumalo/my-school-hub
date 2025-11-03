from django.urls import path
from . import teacher_views

urlpatterns = [
    path('subjects/', teacher_views.teacher_subjects, name='teacher-subjects'),
    path('subjects/<int:subject_id>/students/', teacher_views.subject_students, name='subject-students'),
    path('subjects/<int:subject_id>/performance/', teacher_views.subject_performance, name='subject-performance'),
    path('marks/add/', teacher_views.add_student_mark, name='add-student-mark'),
    path('attendance/register/', teacher_views.attendance_register, name='attendance-register'),
    path('attendance/mark/', teacher_views.mark_attendance, name='mark-attendance'),
]
