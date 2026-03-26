from django.urls import path
from . import teacher_views, homework_views, conference_views

urlpatterns = [
    path('subjects/', teacher_views.teacher_subjects, name='teacher-subjects'),
    path('subjects/<int:subject_id>/students/', teacher_views.subject_students, name='subject-students'),
    path('subjects/<int:subject_id>/performance/', teacher_views.subject_performance, name='subject-performance'),
    path('marks/add/', teacher_views.add_student_mark, name='add-student-mark'),
    path('attendance/register/', teacher_views.attendance_register, name='attendance-register'),
    path('attendance/mark/', teacher_views.mark_attendance, name='mark-attendance'),
    path('classes/', teacher_views.teacher_classes, name='teacher-classes'),
    
    path('assignments/<int:assignment_id>/submissions/', teacher_views.assignment_submissions, name='assignment-submissions'),
    path('submissions/<int:submission_id>/grade/', teacher_views.grade_submission, name='grade-submission'),

    path('homework/', homework_views.teacher_homework_list, name='teacher-homework-list'),
    path('homework/create/', homework_views.teacher_create_homework, name='teacher-create-homework'),
    path('homework/<int:homework_id>/delete/', homework_views.teacher_delete_homework, name='teacher-delete-homework'),
    path('homework/classes/', homework_views.teacher_classes_for_homework, name='teacher-homework-classes'),
    path('homework/<int:homework_id>/download/', homework_views.download_homework_file, name='download-homework-file'),

    # Conference slots
    path('conference-slots/', conference_views.teacher_conference_slots, name='teacher-conference-slots'),
    path('conference-slots/<int:slot_id>/', conference_views.teacher_delete_conference_slot, name='teacher-delete-conference-slot'),
]
