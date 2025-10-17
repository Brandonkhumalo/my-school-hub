from django.urls import path
from . import views

urlpatterns = [
    # WhatsApp User Management
    path('users/', views.WhatsAppUserListView.as_view(), name='whatsapp-user-list'),
    
    # WhatsApp Session Management
    path('sessions/', views.WhatsAppSessionListView.as_view(), name='whatsapp-session-list'),
    
    # WhatsApp Message Management
    path('messages/', views.WhatsAppMessageListView.as_view(), name='whatsapp-message-list'),
    path('messages/send/', views.send_message_view, name='whatsapp-send-message'),
    
    # WhatsApp Payment Management
    path('payments/', views.WhatsAppPaymentListView.as_view(), name='whatsapp-payment-list'),
    
    # WhatsApp Menu Management
    path('menus/', views.WhatsAppMenuListCreateView.as_view(), name='whatsapp-menu-list-create'),
    
    # Webhook endpoint
    path('webhook/', views.whatsapp_webhook, name='whatsapp-webhook'),
]