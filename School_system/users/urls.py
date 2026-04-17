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
    path('forgot-password/parent/', views.parent_forgot_password_view, name='parent-forgot-password'),
    path('profile/set-whatsapp-pin/', views.set_whatsapp_pin_view, name='set-whatsapp-pin'),

    # User management
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('users/<int:user_id>/delete/', views.delete_user_view, name='delete-user'),
    path('permissions/hr/', views.hr_permissions_view, name='hr-permissions'),
    path('permissions/hr/<int:user_id>/', views.hr_permission_update_view, name='hr-permission-update'),

    # Dashboard
    path('dashboard/stats/', views.dashboard_stats_view, name='dashboard-stats'),

    # Analytics
    path('analytics/', views.admin_analytics, name='admin-analytics'),

    # School management (SaaS multi-tenant)
    path('schools/register/', views.register_school, name='register-school'),
    path('schools/search/', views.search_schools, name='search-schools'),
    path('schools/', views.list_schools, name='list-schools'),
    path('schools/<int:school_id>/', views.get_school_details, name='school-details'),

    # School settings
    path('school/settings/', views.school_settings_view, name='school-settings'),
    path('school/current-period/', views.current_academic_period_view, name='current-academic-period'),
    path('school/report-config/', views.report_card_config_view, name='report-card-config'),
    path('school/report-config/upload/', views.report_card_upload_image, name='report-card-upload'),
    path('school/report-templates/', views.report_card_templates_view, name='report-card-templates'),
    path('school/report-templates/<int:template_id>/', views.report_card_template_detail_view, name='report-card-template-detail'),
    path('school/subject-groups/', views.subject_groups_view, name='subject-groups'),
    path('school/subject-groups/<int:group_id>/', views.subject_group_detail_view, name='subject-group-detail'),
    path('reports/verify/<str:token>/', views.verify_report_card, name='verify-report-card'),

    # Audit logs
    path('audit-logs/', views.audit_logs_view, name='audit-logs'),

    # Global search
    path('search/', views.global_search_view, name='global-search'),

    # Public contact form
    path('contact/', views.contact_form_view, name='contact-form'),

    # Notifications
    path('notifications/', views.notification_list_view, name='notification-list'),
    path('notifications/<int:notification_id>/read/', views.notification_mark_read_view, name='notification-mark-read'),
    path('notifications/read-all/', views.notification_mark_all_read_view, name='notification-mark-all-read'),
    path('notifications/unread-count/', views.notification_unread_count_view, name='notification-unread-count'),

    # Superadmin endpoints (Tishanyq Developer Portal)
    path('superadmin/register/', superadmin_views.superadmin_register, name='superadmin-register'),
    path('superadmin/login/', superadmin_views.superadmin_login, name='superadmin-login'),
    path('superadmin/stats/', superadmin_views.superadmin_stats, name='superadmin-stats'),
    path('superadmin/create-school/', superadmin_views.create_school_with_admin, name='superadmin-create-school'),
    path('superadmin/schools/', superadmin_views.list_schools_with_admins, name='superadmin-schools'),
    path('superadmin/schools/<int:school_id>/update/', superadmin_views.update_school_profile, name='superadmin-update-school-profile'),
    path('superadmin/schools/<int:school_id>/reset-password/', superadmin_views.reset_admin_password, name='superadmin-reset-password'),
    path('superadmin/schools/<int:school_id>/suspend/', superadmin_views.suspend_school, name='superadmin-suspend-school'),
]
