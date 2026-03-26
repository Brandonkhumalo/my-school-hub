from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView


@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    return Response({
        'message': 'My School Hub API',
        'version': '1.0',
        'docs': '/api/v1/docs/',
        'schema': '/api/v1/schema/',
        'endpoints': {
            'authentication': '/api/v1/auth/',
            'academics': '/api/v1/academics/',
            'finances': '/api/v1/finances/',
            'staff': '/api/v1/staff/',
            'admin': '/django-admin/'
        }
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check for ALB / docker HEALTHCHECK / monitoring."""
    from django.db import connection
    try:
        connection.ensure_connection()
        db_ok = True
    except Exception:
        db_ok = False
    status_code = 200 if db_ok else 503
    return Response({'status': 'healthy' if db_ok else 'unhealthy', 'database': db_ok}, status=status_code)


urlpatterns = [
    # Health check (ALB target group, docker HEALTHCHECK)
    path('health/', health_check, name='health-check'),

    # Django Admin interface (at /django-admin/ to avoid collision with React /admin/ routes)
    path('django-admin/', admin.site.urls),

    # API Root
    path('api/v1/', api_root, name='api-root'),
    path('', api_root, name='home'),

    # OpenAPI / Swagger
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Authentication and User Management
    path('api/v1/auth/', include('users.urls')),

    # Academic Management
    path('api/v1/academics/', include('academics.urls')),

    # Financial Management
    path('api/v1/finances/', include('finances.urls')),

    # Staff / HR Management
    path('api/v1/staff/', include('staff.urls')),

    # WhatsApp Integration (temporarily disabled)
    # path('api/v1/whatsapp/', include('whatsapp_intergration.urls')),

    # Library Management
    path('api/v1/library/', include('library.urls')),

    # Student Portal
    path('api/v1/students/', include('academics.student_urls')),

    # Parent Portal
    path('api/v1/parents/', include('academics.parent_urls')),

    # Teacher Portal
    path('api/v1/teachers/', include('academics.teacher_urls')),

    # Messaging System (Parent-Teacher Communication)
    path('api/v1/', include('academics.messaging_urls')),

]

# Serve uploaded media files in all environments
# (Railway uses ephemeral storage — for persistent files use Railway Volumes or S3)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
