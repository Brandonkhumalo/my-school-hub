from django.urls import path
from . import views
from . import superadmin_views

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
    
    # School management (SaaS multi-tenant)
    path('schools/register/', views.register_school, name='register-school'),
    path('schools/search/', views.search_schools, name='search-schools'),
    path('schools/', views.list_schools, name='list-schools'),
    path('schools/<int:school_id>/', views.get_school_details, name='school-details'),
    
    # Superadmin endpoints (Tishanyq Developer Portal)
    path('superadmin/register/', superadmin_views.superadmin_register, name='superadmin-register'),
    path('superadmin/login/', superadmin_views.superadmin_login, name='superadmin-login'),
    path('superadmin/stats/', superadmin_views.superadmin_stats, name='superadmin-stats'),
    path('superadmin/create-school/', superadmin_views.create_school_with_admin, name='superadmin-create-school'),
    path('superadmin/schools/', superadmin_views.list_schools_with_admins, name='superadmin-schools'),
    path('superadmin/schools/<int:school_id>/reset-password/', superadmin_views.reset_admin_password, name='superadmin-reset-password'),
    path('superadmin/schools/<int:school_id>/suspend/', superadmin_views.suspend_school, name='superadmin-suspend-school'),
]