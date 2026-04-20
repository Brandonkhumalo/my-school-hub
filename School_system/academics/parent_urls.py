from django.urls import path
from . import parent_views, homework_views, conference_views

urlpatterns = [
    path('children/', parent_views.parent_children_list, name='parent-children-list'),
    path('children/available/', parent_views.available_children_to_confirm, name='available-children'),
    path('children/request/', parent_views.request_child_link, name='request-child-link'),
    path('children/<int:child_id>/confirm/', parent_views.confirm_child, name='confirm-child'),
    path('children/<int:child_id>/stats/', parent_views.child_dashboard_stats, name='child-dashboard-stats'),
    path('children/<int:child_id>/performance/', parent_views.child_performance, name='child-performance'),
    path('children/<int:child_id>/fees/', parent_views.child_fees, name='child-fees'),
    path('students/search/', parent_views.search_students, name='search-students'),
    
    path('homework/', homework_views.parent_homework_list, name='parent-homework-list'),
    path('homework/<int:homework_id>/download/', homework_views.download_homework_file, name='parent-download-homework-file'),

    # Conference bookings
    path('conferences/available/', conference_views.parent_available_conference_slots, name='parent-available-conferences'),
    path('conferences/book/', conference_views.parent_book_conference, name='parent-book-conference'),
    path('conferences/', conference_views.parent_conferences, name='parent-conferences'),
    path('conferences/<int:booking_id>/cancel/', conference_views.parent_cancel_conference, name='parent-cancel-conference'),
]
