from django.contrib import admin
from django.urls import path, include
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    """API Root endpoint with available endpoints"""
    return Response({
        'message': 'School Management System API',
        'version': '1.0',
        'endpoints': {
            'authentication': '/api/auth/',
            'academics': '/api/academics/',
            'finances': '/api/finances/',
            'whatsapp': '/api/whatsapp/',
            'admin': '/admin/'
        },
        'documentation': 'Contact administrator for API documentation'
    })


urlpatterns = [
    # Admin interface
    path('admin/', admin.site.urls),
    
    # API Root
    path('api/', api_root, name='api-root'),
    path('', api_root, name='home'),
    
    # Authentication and User Management
    path('api/auth/', include('users.urls')),
    
    # Academic Management
    path('api/academics/', include('academics.urls')),
    
    # Financial Management
    path('api/finances/', include('finances.urls')),
    
    # WhatsApp Integration (temporarily disabled)
    # path('api/whatsapp/', include('whatsapp_intergration.urls')),
    
    # Student Portal
    path('api/students/', include('academics.student_urls')),
    
    # Parent Portal
    path('api/parents/', include('academics.parent_urls')),
]
