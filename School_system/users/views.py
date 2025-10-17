from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db import models
from .models import CustomUser
from .serializers import (
    UserSerializer, UserRegistrationSerializer, LoginSerializer, WhatsAppPinVerificationSerializer,
    ChangePasswordSerializer, SetWhatsAppPinSerializer
)
from .token import JWTAuthentication

class UserRegistrationView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        user_data = UserSerializer(user).data

        extra_fields = {}
        if user.student_number:
            extra_fields['student_number'] = user.student_number
        if user.whatsapp_pin:
            extra_fields['whatsapp_pin'] = user.whatsapp_pin

        payload = {"user_id": str(user.id)}

        access_token = JWTAuthentication.generate_token(payload=payload)

        return Response({
            'user': {**user_data, **extra_fields},
            'token': access_token,
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)
    
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']

        user_data = UserSerializer(user).data
        if user.student_number:
            user_data['student_number'] = user.student_number
        if user.whatsapp_pin:
            user_data['whatsapp_pin'] = user.whatsapp_pin

        payload = {"user_id": str(user.id)}

        access_token = JWTAuthentication.generate_token(payload=payload)

        return Response({
            'user': user_data,
            'token': access_token,
            'message': f'{user.role.capitalize()} login successful'
        })
    return Response(serializer.errors, status=400)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def whatsapp_pin_verification(request):
    serializer = WhatsAppPinVerificationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        payload = {"user_id": str(user.id)}

        access_token = JWTAuthentication.generate_token(payload=payload)
        
        return Response({
            'user': UserSerializer(user).data,
            'token': access_token,
            'message': 'WhatsApp PIN verification successful'
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    try:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            from .models import BlacklistedToken
            BlacklistedToken.objects.create(token=token)
        return Response({'message': 'Logout successful'})
    except Exception as e:
        return Response({'message': 'Error during logout'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def profile_view(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def update_profile_view(request):
    serializer = UserSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data)
    if serializer.is_valid():
        user = request.user
        if user.check_password(serializer.validated_data['old_password']):
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({'message': 'Password changed successfully'})
        else:
            return Response({'error': 'Old password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def set_whatsapp_pin_view(request):
    serializer = SetWhatsAppPinSerializer(data=request.data)
    if serializer.is_valid():
        request.user.whatsapp_pin = serializer.validated_data['whatsapp_pin']
        request.user.save()
        return Response({'message': 'WhatsApp PIN set successfully'})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserListView(generics.ListAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = CustomUser.objects.all()
        role = self.request.query_params.get('role', None)
        if role:
            queryset = queryset.filter(role=role)
        return queryset


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats_view(request):
    """Get dashboard statistics for admin"""
    from academics.models import Class, Subject, Result
    from finances.models import Invoice, Payment
    
    stats = {
        'total_students': CustomUser.objects.filter(role='student', is_active=True).count(),
        'total_teachers': CustomUser.objects.filter(role='teacher', is_active=True).count(),
        'total_parents': CustomUser.objects.filter(role='parent', is_active=True).count(),
        'total_staff': CustomUser.objects.filter(role__in=['admin', 'hr', 'accountant'], is_active=True).count(),
        'total_classes': Class.objects.count(),
        'total_subjects': Subject.objects.count(),
        'pending_invoices': Invoice.objects.filter(is_paid=False).count(),
        'total_revenue': Payment.objects.filter(payment_status='completed').aggregate(
            total=models.Sum('amount')
        )['total'] or 0,
    }
    
    return Response(stats)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_user_view(request, user_id):
    """Delete a user (admin only)"""
    if request.user.role != 'admin':
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        user = CustomUser.objects.get(id=user_id)
        user.delete()
        return Response({'message': 'User deleted successfully'})
    except CustomUser.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
