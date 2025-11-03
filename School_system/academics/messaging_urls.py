from django.urls import path
from . import messaging_views

urlpatterns = [
    # Get all messages
    path('messages/', messaging_views.get_messages, name='get-messages'),
    
    # Get conversation with specific user
    path('messages/conversation/<int:user_id>/', messaging_views.get_conversation, name='get-conversation'),
    
    # Send a message
    path('messages/send/', messaging_views.send_message, name='send-message'),
    
    # Mark message as read
    path('messages/<int:message_id>/read/', messaging_views.mark_as_read, name='mark-message-read'),
    
    # Get unread count
    path('messages/unread-count/', messaging_views.get_unread_count, name='unread-count'),
    
    # Teacher search (for parents)
    path('teachers/search/', messaging_views.search_teachers, name='search-teachers'),
    
    # Get student's parents (for teachers)
    path('students/<int:student_id>/parents/', messaging_views.get_student_parents, name='get-student-parents'),
]
