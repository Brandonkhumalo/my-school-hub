from django.urls import path
from . import homework_views

urlpatterns = [
    path('homework/', homework_views.teacher_homework_list, name='teacher-homework-list'),
    path('homework/create/', homework_views.teacher_create_homework, name='teacher-create-homework'),
    path('homework/<int:homework_id>/delete/', homework_views.teacher_delete_homework, name='teacher-delete-homework'),
    path('homework/classes/', homework_views.teacher_classes_for_homework, name='teacher-homework-classes'),
    path('homework/<int:homework_id>/download/', homework_views.download_homework_file, name='download-homework-file'),
]

parent_urlpatterns = [
    path('homework/', homework_views.parent_homework_list, name='parent-homework-list'),
    path('homework/<int:homework_id>/download/', homework_views.download_homework_file, name='parent-download-homework-file'),
]
