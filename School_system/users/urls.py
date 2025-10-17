from django.urls import path
from . import views

urlpatterns = [
    # Authentication endpoints
    path('register/', views.UserRegistrationView.as_view(), name='user-register'),
    path('login/', views.login_view, name='login'),
    path('login/whatsapp/', views.whatsapp_pin_verification, name='whatsapp-login'),
    path('logout/', views.logout_view, name='logout'),
    
    # Profile endpoints
    path('profile/', views.profile_view, name='profile'),
    path('profile/update/', views.update_profile_view, name='update-profile'),
    path('profile/change-password/', views.change_password_view, name='change-password'),
    path('profile/set-whatsapp-pin/', views.set_whatsapp_pin_view, name='set-whatsapp-pin'),
    
    # User management
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('users/<int:user_id>/delete/', views.delete_user_view, name='delete-user'),
    
    # Dashboard
    path('dashboard/stats/', views.dashboard_stats_view, name='dashboard-stats'),
]