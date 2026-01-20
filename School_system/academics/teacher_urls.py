from django.urls import path
from . import teacher_views, homework_views

urlpatterns = [
    path('subjects/', teacher_views.teacher_subjects, name='teacher-subjects'),
    path('subjects/<int:subject_id>/students/', teacher_views.subject_students, name='subject-students'),
    path('subjects/<int:subject_id>/performance/', teacher_views.subject_performance, name='subject-performance'),
    path('marks/add/', teacher_views.add_student_mark, name='add-student-mark'),
    path('attendance/register/', teacher_views.attendance_register, name='attendance-register'),
    path('attendance/mark/', teacher_views.mark_attendance, name='mark-attendance'),
    
    path('homework/', homework_views.teacher_homework_list, name='teacher-homework-list'),
    path('homework/create/', homework_views.teacher_create_homework, name='teacher-create-homework'),
    path('homework/<int:homework_id>/delete/', homework_views.teacher_delete_homework, name='teacher-delete-homework'),
    path('homework/classes/', homework_views.teacher_classes_for_homework, name='teacher-homework-classes'),
    path('homework/<int:homework_id>/download/', homework_views.download_homework_file, name='download-homework-file'),
]
