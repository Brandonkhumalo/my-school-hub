from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import authenticate
from django.db import transaction
import secrets
import string
import os

from .models import CustomUser, School
from .token import JWTAuthentication


SUPERADMIN_SECRET_KEY = os.environ.get('SUPERADMIN_SECRET_KEY', 'TISHANYQ_DEV_2025')


def check_superadmin(user):
    return user.is_authenticated and user.role == 'superadmin'


@api_view(['POST'])
@permission_classes([AllowAny])
def superadmin_register(request):
    email = request.data.get('email')
    password = request.data.get('password')
    full_name = request.data.get('full_name', '')
    secret_key = request.data.get('secret_key')
    
    if not all([email, password, full_name, secret_key]):
        return Response({'error': 'All fields are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    if secret_key != SUPERADMIN_SECRET_KEY:
        return Response({'error': 'Invalid secret key'}, status=status.HTTP_403_FORBIDDEN)
    
    if CustomUser.objects.filter(email=email).exists():
        return Response({'error': 'Email already registered'}, status=status.HTTP_400_BAD_REQUEST)
    
    username = email.split('@')[0] + '_superadmin'
    if CustomUser.objects.filter(username=username).exists():
        username = username + '_' + ''.join(secrets.choice(string.digits) for _ in range(4))
    
    name_parts = full_name.split(' ', 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ''
    
    user = CustomUser.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role='superadmin'
    )
    
    return Response({
        'message': 'Superadmin registered successfully',
        'user': {
            'id': user.id,
            'email': user.email,
            'full_name': f"{user.first_name} {user.last_name}".strip()
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def superadmin_login(request):
    email = request.data.get('email')
    password = request.data.get('password')
    
    if not email or not password:
        return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = CustomUser.objects.get(email=email)
    except CustomUser.DoesNotExist:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if user.role != 'superadmin':
        return Response({'error': 'Access denied. Not a superadmin.'}, status=status.HTTP_403_FORBIDDEN)
    
    if not user.check_password(password):
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    
    payload = {'user_id': user.id, 'role': user.role}
    access_token = JWTAuthentication.generate_token(payload)
    refresh_token = JWTAuthentication.generate_refresh_token(payload)
    
    return Response({
        'access': access_token,
        'refresh': refresh_token,
        'user': {
            'id': user.id,
            'email': user.email,
            'full_name': f"{user.first_name} {user.last_name}".strip() or user.email,
            'role': user.role
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def superadmin_stats(request):
    if request.user.role != 'superadmin':
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
    
    schools_count = School.objects.count()
    admins_count = CustomUser.objects.filter(role='admin').count()
    
    return Response({
        'schools': schools_count,
        'admins': admins_count
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_school_with_admin(request):
    if request.user.role != 'superadmin':
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
    
    school_name = request.data.get('school_name')
    school_location = request.data.get('school_location')
    school_type = request.data.get('school_type', 'secondary')
    curriculum = request.data.get('curriculum', 'ZIMSEC')
    admin_email = request.data.get('admin_email')
    admin_phone = request.data.get('admin_phone')
    admin_password = request.data.get('admin_password')
    
    if not all([school_name, school_location, admin_email, admin_phone, admin_password]):
        return Response({'error': 'All fields are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    if School.objects.filter(name__iexact=school_name).exists():
        return Response({'error': 'School with this name already exists'}, status=status.HTTP_400_BAD_REQUEST)
    
    if CustomUser.objects.filter(email=admin_email).exists():
        return Response({'error': 'Admin email already registered'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            school = School.objects.create(
                name=school_name,
                city=school_location,
                school_type=school_type,
                curriculum=curriculum
            )
            
            admin_username = school_name.lower().replace(' ', '_')[:20] + '_admin'
            if CustomUser.objects.filter(username=admin_username).exists():
                admin_username = admin_username + '_' + school.code[-4:]
            
            admin_user = CustomUser.objects.create_user(
                username=admin_username,
                email=admin_email,
                password=admin_password,
                phone_number=admin_phone,
                first_name=school_name,
                last_name='Admin',
                role='admin',
                school=school,
                created_by=request.user
            )
            
            school.admin_password = admin_password
            school.save()
            
            return Response({
                'message': 'School and admin created successfully',
                'school_name': school.name,
                'school_code': school.code,
                'admin_username': admin_user.username,
                'admin_email': admin_user.email,
                'admin_password': admin_password
            }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_schools_with_admins(request):
    if request.user.role != 'superadmin':
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
    
    schools = School.objects.all().order_by('-created_at')
    
    schools_data = []
    for school in schools:
        admin = CustomUser.objects.filter(school=school, role='admin').first()
        
        schools_data.append({
            'id': school.id,
            'name': school.name,
            'code': school.code,
            'city': school.city,
            'school_type': school.get_school_type_display() if hasattr(school, 'get_school_type_display') else school.school_type,
            'curriculum': school.curriculum,
            'admin_username': admin.username if admin else 'N/A',
            'admin_email': admin.email if admin else 'N/A',
            'admin_phone': admin.phone_number if admin else 'N/A',
            'admin_password': school.admin_password or 'Not stored',
            'created_at': school.created_at.isoformat() if school.created_at else None
        })
    
    return Response({'schools': schools_data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_admin_password(request, school_id):
    if request.user.role != 'superadmin':
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
    
    new_password = request.data.get('new_password')
    
    if not new_password or len(new_password) < 6:
        return Response({'error': 'Password must be at least 6 characters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        school = School.objects.get(id=school_id)
    except School.DoesNotExist:
        return Response({'error': 'School not found'}, status=status.HTTP_404_NOT_FOUND)
    
    admin = CustomUser.objects.filter(school=school, role='admin').first()
    
    if not admin:
        return Response({'error': 'No admin found for this school'}, status=status.HTTP_404_NOT_FOUND)
    
    admin.set_password(new_password)
    admin.save()
    
    school.admin_password = new_password
    school.save()
    
    return Response({
        'message': 'Password reset successfully',
        'new_password': new_password
    })
