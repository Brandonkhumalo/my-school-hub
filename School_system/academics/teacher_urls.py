from django.urls import path
from . import teacher_views, homework_views, conference_views

urlpatterns = [
    path('subjects/', teacher_views.teacher_subjects, name='teacher-subjects'),
    path('subjects/<int:subject_id>/students/', teacher_views.subject_students, name='subject-students'),
    path('subjects/<int:subject_id>/performance/', teacher_views.subject_performance, name='subject-performance'),
    path('subjects/<int:subject_id>/students-risk/', teacher_views.subject_students_risk, name='subject-students-risk'),
    path('marks/add/', teacher_views.add_student_mark, name='add-student-mark'),
    path('results/for-report/', teacher_views.results_for_report, name='results-for-report'),
    path('results/report-settings/', teacher_views.update_report_settings, name='update-report-settings'),
    path('attendance/class/register/', teacher_views.class_attendance_register, name='class-attendance-register'),
    path('attendance/class/mark/', teacher_views.mark_class_attendance, name='mark-class-attendance'),
    path('attendance/subject/register/', teacher_views.subject_attendance_register, name='subject-attendance-register'),
    path('attendance/subject/mark/', teacher_views.mark_subject_attendance, name='mark-subject-attendance'),
    path('classes/', teacher_views.teacher_classes, name='teacher-classes'),
    path('classes/<int:class_id>/subjects/', teacher_views.teacher_class_subjects, name='teacher-class-subjects'),
    
    path('assignments/<int:assignment_id>/submissions/', teacher_views.assignment_submissions, name='assignment-submissions'),
    path('submissions/<int:submission_id>/grade/', teacher_views.grade_submission, name='grade-submission'),

    path('homework/', homework_views.teacher_homework_list, name='teacher-homework-list'),
    path('homework/create/', homework_views.teacher_create_homework, name='teacher-create-homework'),
    path('homework/<int:homework_id>/update/', homework_views.teacher_update_homework, name='teacher-update-homework'),
    path('homework/<int:homework_id>/delete/', homework_views.teacher_delete_homework, name='teacher-delete-homework'),
    path('homework/classes/', homework_views.teacher_classes_for_homework, name='teacher-homework-classes'),
    path('homework/<int:homework_id>/download/', homework_views.download_homework_file, name='download-homework-file'),

    # Subject feedback (per-subject teacher comment + effort grade for report cards)
    path('subject-feedback/', teacher_views.subject_feedback_list, name='subject-feedback-list'),
    path('subject-feedback/save/', teacher_views.subject_feedback_upsert, name='subject-feedback-save'),
    path('report-feedback/config/', teacher_views.report_feedback_config, name='report-feedback-config'),
    path('report-feedback/submit/', teacher_views.submit_report_feedback_for_signoff, name='report-feedback-submit'),
    path('report-feedback/status/', teacher_views.report_feedback_submission_status, name='report-feedback-status'),

    # Conference slots
    path('conference-slots/', conference_views.teacher_conference_slots, name='teacher-conference-slots'),
    path('conference-slots/<int:slot_id>/', conference_views.teacher_delete_conference_slot, name='teacher-delete-conference-slot'),
]
