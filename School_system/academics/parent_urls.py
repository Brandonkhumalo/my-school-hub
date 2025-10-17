from django.urls import path
from . import parent_views

urlpatterns = [
    path('children/', parent_views.parent_children_list, name='parent-children-list'),
    path('children/available/', parent_views.available_children_to_confirm, name='available-children'),
    path('children/<int:child_id>/confirm/', parent_views.confirm_child, name='confirm-child'),
    path('children/<int:child_id>/stats/', parent_views.child_dashboard_stats, name='child-dashboard-stats'),
    path('children/<int:child_id>/performance/', parent_views.child_performance, name='child-performance'),
    path('children/<int:child_id>/messages/', parent_views.child_weekly_messages, name='child-weekly-messages'),
    path('children/<int:child_id>/fees/', parent_views.child_fees, name='child-fees'),
    path('messages/', parent_views.all_weekly_messages, name='all-weekly-messages'),
]
