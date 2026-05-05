import logging

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)
import time
import datetime as dt

from .models import (
    CustomUser, School, AuditLog, SchoolSettings, Notification,
    HRPermissionProfile, HRPagePermission,
    AccountantPermissionProfile, AccountantPagePermission,
    TwoFactorAuthConfig, TrustedDevice, TwoFactorBackupCode,
)
from .utils.otp import (
    generate_secret, get_qr_code, verify_totp,
    generate_backup_codes, hash_backup_code, verify_backup_code,
    create_backup_codes_list, parse_user_agent,
)
from .serializers import (
    UserSerializer, UserRegistrationSerializer, WhatsAppPinVerificationSerializer,
    ChangePasswordSerializer, SetWhatsAppPinSerializer, SchoolSerializer, SchoolRegistrationSerializer,
    ManagedUserSerializer
)
from .token import JWTAuthentication
from academics.models import Student


def _check_rate_limit(request, group='api', rate='10/m'):
    """Returns True if the request is rate-limited."""
    try:
        from ratelimit.utils import is_ratelimited
        return is_ratelimited(request, group=group, key='ip', rate=rate, increment=True)
    except Exception:
        return False


def _lockout_threshold():
    return max(1, int(getattr(settings, 'LOGIN_LOCKOUT_THRESHOLD', 5)))


def _lockout_minutes():
    return max(1, int(getattr(settings, 'LOGIN_LOCKOUT_MINUTES', 15)))


def _find_user_for_identifier(identifier):
    if not identifier:
        return None
    ident = str(identifier).strip()
    if not ident:
        return None

    user = CustomUser.objects.filter(Q(email__iexact=ident) | Q(username__iexact=ident)).first()
    if user:
        return user
    return CustomUser.objects.filter(student_number__iexact=ident).first()


def _account_locked_response(user):
    locked_until = user.account_locked_until
    remaining_seconds = None
    if locked_until:
        remaining_seconds = max(0, int((locked_until - timezone.now()).total_seconds()))
    return Response(
        {
            'error': 'account_locked',
            'message': 'This account is temporarily locked due to failed login attempts.',
            'locked_until': locked_until.isoformat() if locked_until else None,
            'remaining_seconds': remaining_seconds,
        },
        status=status.HTTP_423_LOCKED,
    )


HR_PAGE_CATALOG = [
    {'key': key, 'label': label}
    for key, label in HRPagePermission.PAGE_CHOICES
]

ACCOUNTANT_PAGE_CATALOG = [
    {'key': key, 'label': label}
    for key, label in AccountantPagePermission.PAGE_CHOICES
]


def _hr_profile_for_user(hr_user):
    profile, _ = HRPermissionProfile.objects.get_or_create(
        user=hr_user,
        defaults={'school': hr_user.school},
    )
    if hr_user.school_id and profile.school_id != hr_user.school_id:
        profile.school = hr_user.school
        profile.save(update_fields=['school'])
    return profile


def _accountant_profile_for_user(acct_user):
    profile, _ = AccountantPermissionProfile.objects.get_or_create(
        user=acct_user,
        defaults={'school': acct_user.school},
    )
    if acct_user.school_id and profile.school_id != acct_user.school_id:
        profile.school = acct_user.school
        profile.save(update_fields=['school'])
    return profile


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

        access_token = JWTAuthentication.generate_token(payload={"user_id": str(user.id)})

        return Response({
            'user': {**user_data, **extra_fields},
            'token': access_token,
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    # Rate limit: 5 attempts per minute per IP
    if _check_rate_limit(request, group='login', rate='5/m'):
        return Response(
            {'error': 'Too many login attempts. Please wait a minute before trying again.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    identifier = (request.data.get('identifier') or '').strip()
    password = request.data.get('password') or ''
    if not identifier or not password:
        return Response({'error': 'Identifier and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    user_candidate = _find_user_for_identifier(identifier)
    if user_candidate and user_candidate.is_account_locked():
        return _account_locked_response(user_candidate)

    user = None
    if user_candidate:
        user = authenticate(username=user_candidate.username, password=password)

    if user is None:
        if user_candidate and user_candidate.role == 'student' and not user_candidate.is_active:
            password_matches = False
            try:
                password_matches = user_candidate.check_password(password)
            except Exception:
                password_matches = False
            if password_matches:
                pending_record = Student.objects.filter(
                    user=user_candidate,
                    pending_activation_due_to_limit=True
                ).exists()
                if pending_record:
                    return Response(
                        {
                            'error': 'student_limit_reached',
                            'message': (
                                'Your account is saved but not yet active because your school has reached '
                                'its student limit. Please ask your school administrator to contact Tishanyq Digital.'
                            ),
                        },
                        status=status.HTTP_403_FORBIDDEN
                    )

        if user_candidate:
            user_candidate.register_failed_login_attempt(
                threshold=_lockout_threshold(),
                lockout_minutes=_lockout_minutes(),
            )
            user_candidate.refresh_from_db(fields=['account_locked_until'])
            if user_candidate.is_account_locked():
                return _account_locked_response(user_candidate)
        return Response({'error': 'Invalid credentials.'}, status=status.HTTP_400_BAD_REQUEST)

    user.clear_login_failures()

    if user.role == 'parent' and user.school:
        try:
            settings_obj = user.school.settings
        except SchoolSettings.DoesNotExist:
            settings_obj = None
        if settings_obj and settings_obj.parent_login_blocked:
            return Response({
                'error': 'parent_login_blocked',
                'message': settings_obj.parent_login_block_message or 'Parent login is currently disabled.',
                'unblock_at': settings_obj.parent_login_blocked_until,
            }, status=403)

    if user.school and user.school.is_suspended:
        if user.role == 'admin':
            return Response({
                'error': 'school_suspended_admin',
                'message': 'Your school has been suspended. Please contact Tishanyq Digital for assistance.',
                'contact': {
                    'phone': ['+263 78 160 3382', '+263 78 221 6826'],
                    'email': 'sales@tishanyq.co.zw'
                }
            }, status=403)
        else:
            return Response({
                'error': 'school_suspended',
                'message': 'Your school has been suspended. Please contact your school administrator.'
            }, status=403)

    # Check if user has 2FA enabled
    try:
        two_fa_config = user.two_factor_config
        if two_fa_config.is_enabled:
            # Check if this device/IP is trusted
            ip = request.META.get('REMOTE_ADDR')
            is_trusted = TrustedDevice.objects.filter(
                user=user, ip_address=ip, verified=True
            ).exists()

            if not is_trusted:
                # Generate a short-lived session token for OTP verification
                import jwt as _jwt
                from django.conf import settings as _settings
                otp_payload = {"user_id": str(user.id), "type": "otp_session", "exp": int(time.time()) + 300}
                otp_token = _jwt.encode(otp_payload, key=_settings.SECRET_KEY, algorithm='HS256')
                return Response({
                    "requires_2fa": True,
                    "otp_session_token": otp_token,
                    "message": "2FA verification required"
                }, status=202)
    except AttributeError:
        pass  # No 2FA config means 2FA not set up

    # Also check school-level enforcement
    try:
        school_settings = user.school.settings
        if school_settings.enforce_2fa and user.role in (school_settings.enforce_2fa_for_roles or []):
            deadline = None
            if school_settings.enforce_2fa_started_at:
                deadline = school_settings.enforce_2fa_started_at + dt.timedelta(days=school_settings.enforce_2fa_grace_period_days)

            has_2fa = hasattr(user, 'two_factor_config') and user.two_factor_config.is_enabled
            if not has_2fa:
                if deadline and timezone.now() > deadline:
                    # Deadline passed but no 2FA — log them in but force setup
                    user_data = UserSerializer(user).data
                    if user.student_number:
                        user_data['student_number'] = user.student_number
                    access_token = JWTAuthentication.generate_token(payload={"user_id": str(user.id)})
                    try:
                        AuditLog.objects.create(
                            user=user, school=user.school, action='LOGIN',
                            model_name='CustomUser', object_id=str(user.id),
                            object_repr=f'Login (2FA setup required): {user.email}',
                            ip_address=request.META.get('REMOTE_ADDR'), response_status=200,
                        )
                    except Exception:
                        pass
                    return Response({
                        'user': user_data,
                        'token': access_token,
                        'message': f'{user.role.capitalize()} login successful',
                        'requires_2fa_setup': True,
                    })
                else:
                    # Allow login but return warning
                    warning_date = deadline.strftime('%d %B %Y') if deadline else None
                    user_data = UserSerializer(user).data
                    if user.student_number:
                        user_data['student_number'] = user.student_number
                    access_token = JWTAuthentication.generate_token(payload={"user_id": str(user.id)})
                    try:
                        AuditLog.objects.create(
                            user=user, school=user.school, action='LOGIN',
                            model_name='CustomUser', object_id=str(user.id),
                            object_repr=f'Login: {user.email}',
                            ip_address=request.META.get('REMOTE_ADDR'), response_status=200,
                        )
                    except Exception:
                        pass
                    return Response({
                        'user': user_data, 'token': access_token,
                        'message': f'{user.role.capitalize()} login successful',
                        '2fa_warning': True,
                        '2fa_deadline': warning_date
                    })
    except Exception:
        pass

    user_data = UserSerializer(user).data
    if user.student_number:
        user_data['student_number'] = user.student_number

    access_token = JWTAuthentication.generate_token(payload={"user_id": str(user.id)})

    # Log the login event
    try:
        AuditLog.objects.create(
            user=user,
            school=user.school,
            action='LOGIN',
            model_name='CustomUser',
            object_id=str(user.id),
            object_repr=f'Login: {user.email}',
            ip_address=request.META.get('REMOTE_ADDR'),
            response_status=200,
        )
    except Exception:
        logger.warning("Audit log creation failed", exc_info=True)

    return Response({
        'user': user_data,
        'token': access_token,
        'message': f'{user.role.capitalize()} login successful'
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def whatsapp_pin_verification(request):
    if _check_rate_limit(request, group='whatsapp_login', rate='5/m'):
        return Response({'error': 'Too many attempts. Please wait.'}, status=429)

    serializer = WhatsAppPinVerificationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        access_token = JWTAuthentication.generate_token(payload={"user_id": str(user.id)})

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
        try:
            AuditLog.objects.create(
                user=request.user,
                school=request.user.school,
                action='LOGOUT',
                model_name='CustomUser',
                object_id=str(request.user.id),
                object_repr=f'Logout: {request.user.email}',
                ip_address=request.META.get('REMOTE_ADDR'),
                response_status=200,
            )
        except Exception:
            logger.warning("Audit log creation failed", exc_info=True)
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
            new_password = serializer.validated_data['new_password']
            if not new_password or len(new_password) < 8:
                return Response({'error': 'New password must be at least 8 characters'}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(new_password)
            user.save()
            return Response({'message': 'Password changed successfully'})
        else:
            return Response({'error': 'Old password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def parent_forgot_password_view(request):
    """
    Reset password for a parent account after verifying:
    - parent login identifier (username or email)
    - parent's phone number
    - linked child's student number
    """
    if _check_rate_limit(request, group='parent_forgot_password', rate='5/m'):
        return Response(
            {'error': 'Too many attempts. Please wait a minute and try again.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    identifier = (request.data.get('identifier') or '').strip()
    phone_number = (request.data.get('phone_number') or '').strip()
    student_number = (request.data.get('student_number') or '').strip()
    new_password = request.data.get('new_password') or ''
    confirm_password = request.data.get('confirm_password') or ''

    if not all([identifier, phone_number, student_number, new_password, confirm_password]):
        return Response({'error': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if new_password != confirm_password:
        return Response({'error': "Passwords don't match."}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    normalized_phone = ''.join(ch for ch in phone_number if ch.isdigit() or ch == '+')

    try:
        parent_user = CustomUser.objects.filter(
            role='parent'
        ).filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()
        if not parent_user:
            return Response({'error': 'Unable to verify parent credentials.'}, status=status.HTTP_400_BAD_REQUEST)

        user_phone = (parent_user.phone_number or '').strip()
        normalized_user_phone = ''.join(ch for ch in user_phone if ch.isdigit() or ch == '+')
        if not normalized_user_phone or normalized_user_phone != normalized_phone:
            return Response({'error': 'Unable to verify parent credentials.'}, status=status.HTTP_400_BAD_REQUEST)

        from academics.models import ParentChildLink
        is_linked = ParentChildLink.objects.filter(
            parent=parent_user.parent,
            is_confirmed=True,
            student__user__student_number__iexact=student_number,
        ).exists()
        if not is_linked:
            return Response({'error': 'Unable to verify parent credentials.'}, status=status.HTTP_400_BAD_REQUEST)

        parent_user.set_password(new_password)
        parent_user.save(update_fields=['password'])
        return Response({'message': 'Password reset successful. You can now log in.'})
    except Exception:
        logger.warning("Parent forgot-password verification failed", exc_info=True)
        return Response({'error': 'Unable to verify parent credentials.'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def student_forgot_password_view(request):
    """
    Reset password for a student account using student number.
    """
    if _check_rate_limit(request, group='student_forgot_password', rate='5/m'):
        return Response(
            {'error': 'Too many attempts. Please wait a minute and try again.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    student_number = (request.data.get('student_number') or '').strip()
    new_password = request.data.get('new_password') or ''
    confirm_password = request.data.get('confirm_password') or ''

    if not all([student_number, new_password, confirm_password]):
        return Response({'error': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if new_password != confirm_password:
        return Response({'error': "Passwords don't match."}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    student_user = CustomUser.objects.filter(
        role='student',
        student_number__iexact=student_number
    ).first()
    if not student_user:
        return Response({'error': 'Student not found.'}, status=status.HTTP_400_BAD_REQUEST)

    student_user.set_password(new_password)
    student_user.save(update_fields=['password'])
    return Response({'message': 'Student password reset successful. You can now log in.'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def set_whatsapp_pin_view(request):
    serializer = SetWhatsAppPinSerializer(data=request.data)
    if serializer.is_valid():
        request.user.whatsapp_pin = make_password(serializer.validated_data['pin'])
        request.user.save(update_fields=['whatsapp_pin'])
        return Response({'message': 'WhatsApp PIN set successfully'})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserListView(generics.ListCreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ManagedUserSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ('admin', 'hr', 'superadmin') and user.school:
            queryset = CustomUser.objects.filter(school=user.school)
        else:
            queryset = CustomUser.objects.none()
        role = self.request.query_params.get('role', None)
        if role:
            queryset = queryset.filter(role=role)
        return queryset

    def create(self, request, *args, **kwargs):
        if request.user.role not in ('admin', 'hr', 'superadmin'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        if not request.user.school:
            return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role not in ('admin', 'hr', 'superadmin') or not user.school:
            return CustomUser.objects.none()
        return CustomUser.objects.filter(school=user.school)

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return ManagedUserSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        if request.user.role not in ('admin', 'hr', 'superadmin'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats_view(request):
    from academics.models import Class, Subject, Parent, Student
    from finances.models import Invoice, StudentPaymentRecord

    school = request.user.school

    if school:
        student_qs = Student.objects.filter(user__school=school, user__is_active=True)
        total_students = student_qs.count()
        boarding_students = student_qs.filter(residence_type='boarding').count()
        day_students = student_qs.filter(residence_type='day').count()
        stats = {
            'total_students': total_students,
            'boarding_students': boarding_students,
            'day_students': day_students,
            'total_teachers': CustomUser.objects.filter(role='teacher', is_active=True, school=school).count(),
            # Include parents created by admin and self-registered parents linked to this school.
            'total_parents': Parent.objects.filter(
                Q(user__school=school) |
                Q(schools=school) |
                Q(children__user__school=school)
            ).distinct().count(),
            'total_staff': CustomUser.objects.filter(
                role__in=['admin', 'hr', 'accountant', 'security', 'cleaner', 'librarian'],
                is_active=True,
                school=school
            ).count(),
            'total_classes': Class.objects.filter(school=school).count(),
            'total_subjects': Subject.objects.filter(school=school).count(),
            'pending_invoices': Invoice.objects.filter(is_paid=False, student__user__school=school).count(),
            # Use payment records as primary source, but fall back to paid invoices
            # when legacy/snapshot data has invoice payments without synced records.
            'total_revenue': max(
                StudentPaymentRecord.objects.filter(
                    school=school
                ).aggregate(total=models.Sum('amount_paid'))['total'] or 0,
                Invoice.objects.filter(
                    student__user__school=school,
                    is_paid=True,
                ).aggregate(total=models.Sum('amount_paid'))['total'] or 0,
            ),
            'school_type': school.school_type,
            'school_accommodation_type': school.accommodation_type,
            'school_name': school.name,
        }
    else:
        stats = {
            'total_students': 0, 'total_teachers': 0, 'total_parents': 0,
            'total_staff': 0, 'total_classes': 0, 'total_subjects': 0,
            'boarding_students': 0, 'day_students': 0,
            'pending_invoices': 0, 'total_revenue': 0,
        }

    return Response(stats)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_user_view(request, user_id):
    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = CustomUser.objects.get(id=user_id, school=school)
        user.delete()
        return Response({'message': 'User deleted successfully'})
    except CustomUser.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def unlock_user_login_view(request, user_id):
    if request.user.role not in ('admin', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target_user = CustomUser.objects.get(id=user_id, school=school)
    except CustomUser.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    target_user.clear_login_failures()

    try:
        AuditLog.objects.create(
            user=request.user,
            school=request.user.school,
            action='UPDATE',
            model_name='CustomUser',
            object_id=str(target_user.id),
            object_repr=f'Login lockout cleared for: {target_user.email}',
            ip_address=request.META.get('REMOTE_ADDR'),
            response_status=200,
        )
    except Exception:
        logger.warning("Audit log creation failed", exc_info=True)

    return Response({'message': 'User login lockout cleared successfully.'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def hr_permissions_view(request):
    """Admin-facing endpoint to manage HR employee page permissions."""
    if request.user.role not in ('admin', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)

    hr_users = CustomUser.objects.filter(
        school=school,
        role='hr',
        is_active=True,
    ).order_by('first_name', 'last_name')

    users_payload = []
    for hr_user in hr_users:
        profile = _hr_profile_for_user(hr_user)
        perms = HRPagePermission.objects.filter(profile=profile)
        perm_map = {
            p.page_key: {'read': bool(p.can_read), 'write': bool(p.can_write)}
            for p in perms
        }
        users_payload.append({
            'id': hr_user.id,
            'full_name': hr_user.full_name,
            'email': hr_user.email,
            'is_root_boss': bool(profile.is_root_boss),
            'permissions': perm_map,
        })

    return Response({
        'pages': HR_PAGE_CATALOG,
        'hr_users': users_payload,
    })


@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def hr_permission_update_view(request, user_id):
    """Update one HR employee permissions and root boss flag."""
    if request.user.role not in ('admin', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        hr_user = CustomUser.objects.get(id=user_id, school=school, role='hr')
    except CustomUser.DoesNotExist:
        return Response({'error': 'HR user not found'}, status=status.HTTP_404_NOT_FOUND)

    is_root_boss = bool(request.data.get('is_root_boss', False))
    raw_permissions = request.data.get('permissions', {}) or {}
    valid_page_keys = {key for key, _ in HRPagePermission.PAGE_CHOICES}

    with transaction.atomic():
        profile = _hr_profile_for_user(hr_user)
        profile.is_root_boss = is_root_boss
        profile.save(update_fields=['is_root_boss', 'updated_at'])

        HRPagePermission.objects.filter(profile=profile).delete()

        to_create = []
        for page_key, grant in raw_permissions.items():
            if page_key not in valid_page_keys:
                continue
            can_read = bool((grant or {}).get('read', False))
            can_write = bool((grant or {}).get('write', False))
            if can_write:
                can_read = True
            to_create.append(HRPagePermission(
                profile=profile,
                page_key=page_key,
                can_read=can_read,
                can_write=can_write,
            ))

        if to_create:
            HRPagePermission.objects.bulk_create(to_create)

    return Response({'message': 'HR permissions updated successfully'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def accountant_permissions_view(request):
    """Admin-facing endpoint to manage accountant page permissions."""
    if request.user.role not in ('admin', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)

    acct_users = CustomUser.objects.filter(
        school=school,
        role='accountant',
        is_active=True,
    ).order_by('first_name', 'last_name')

    users_payload = []
    for acct_user in acct_users:
        profile = _accountant_profile_for_user(acct_user)
        perms = AccountantPagePermission.objects.filter(profile=profile)
        perm_map = {
            p.page_key: {'read': bool(p.can_read), 'write': bool(p.can_write)}
            for p in perms
        }
        users_payload.append({
            'id': acct_user.id,
            'full_name': acct_user.full_name,
            'email': acct_user.email,
            'is_root_head': bool(profile.is_root_head),
            'permissions': perm_map,
        })

    return Response({
        'pages': ACCOUNTANT_PAGE_CATALOG,
        'accountant_users': users_payload,
    })


@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def accountant_permission_update_view(request, user_id):
    """Update one accountant's permissions and head flag."""
    if request.user.role not in ('admin', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        acct_user = CustomUser.objects.get(id=user_id, school=school, role='accountant')
    except CustomUser.DoesNotExist:
        return Response({'error': 'Accountant not found'}, status=status.HTTP_404_NOT_FOUND)

    is_root_head = bool(request.data.get('is_root_head', False))
    raw_permissions = request.data.get('permissions', {}) or {}
    valid_page_keys = {key for key, _ in AccountantPagePermission.PAGE_CHOICES}

    with transaction.atomic():
        profile = _accountant_profile_for_user(acct_user)
        profile.is_root_head = is_root_head
        profile.save(update_fields=['is_root_head', 'updated_at'])

        AccountantPagePermission.objects.filter(profile=profile).delete()

        to_create = []
        for page_key, grant in raw_permissions.items():
            if page_key not in valid_page_keys:
                continue
            can_read = bool((grant or {}).get('read', False))
            can_write = bool((grant or {}).get('write', False))
            if can_write:
                can_read = True
            to_create.append(AccountantPagePermission(
                profile=profile,
                page_key=page_key,
                can_read=can_read,
                can_write=can_write,
            ))

        if to_create:
            AccountantPagePermission.objects.bulk_create(to_create)

    return Response({'message': 'Accountant permissions updated successfully'})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_school(request):
    serializer = SchoolRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        result = serializer.save()
        return Response({
            'message': 'School registered successfully',
            'school': SchoolSerializer(result['school']).data,
            'admin_credentials': {
                'username': result['admin_user'].username,
                'password': result['admin_password'],
                'email': result['admin_user'].email
            },
            'important': 'Please save these admin credentials securely. The password cannot be recovered.'
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def search_schools(request):
    query = request.query_params.get('q', '').strip()
    if len(query) < 2:
        return Response({'error': 'Search query must be at least 2 characters'}, status=status.HTTP_400_BAD_REQUEST)

    schools = School.objects.filter(
        Q(name__icontains=query) | Q(code__icontains=query), is_active=True
    )[:10]

    return Response({'schools': SchoolSerializer(schools, many=True).data, 'count': schools.count()})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_schools(request):
    if request.user.role != 'superadmin':
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    schools = School.objects.all().order_by('-created_at')
    return Response(SchoolSerializer(schools, many=True).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_school_details(request, school_id):
    try:
        school = School.objects.get(id=school_id)
        return Response(SchoolSerializer(school).data)
    except School.DoesNotExist:
        return Response({'error': 'School not found'}, status=status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------
# School Settings
# ---------------------------------------------------------------

@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
def school_settings_view(request):
    """Get or update school settings (admin only)."""
    if request.user.role not in ('admin', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)

    settings_obj, _ = SchoolSettings.objects.get_or_create(school=school)

    from .serializers import SchoolSettingsSerializer
    if request.method == 'GET':
        return Response(SchoolSettingsSerializer(settings_obj).data)

    serializer = SchoolSettingsSerializer(settings_obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def current_academic_period_view(request):
    """Return all school settings for the user's school. Accessible by all authenticated users.
    PayNow credentials are excluded for non-admin users."""
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)

    settings_obj, _ = SchoolSettings.objects.get_or_create(school=school)
    data = {
        'school_name': school.name,
        'current_academic_year': settings_obj.current_academic_year,
        'current_term': settings_obj.current_term,
        'term_1_start': settings_obj.term_1_start,
        'term_1_end': settings_obj.term_1_end,
        'term_2_start': settings_obj.term_2_start,
        'term_2_end': settings_obj.term_2_end,
        'term_3_start': settings_obj.term_3_start,
        'term_3_end': settings_obj.term_3_end,
        'grading_system': settings_obj.grading_system,
        'school_motto': settings_obj.school_motto,
        'currency': settings_obj.currency,
        'timezone': settings_obj.timezone,
        'max_students_per_class': settings_obj.max_students_per_class,
        'late_fee_percentage': settings_obj.late_fee_percentage,
        'primary_color': settings_obj.primary_color,
        'secondary_color': settings_obj.secondary_color,
        'font_family': settings_obj.font_family,
        'welcome_message': settings_obj.welcome_message,
        'logo_url': request.build_absolute_uri(settings_obj.logo.url) if settings_obj.logo else None,
        'hidden_pages': settings_obj.hidden_pages or [],
    }
    return Response(data)


# ---------------------------------------------------------------
# Dashboard Customization
# ---------------------------------------------------------------

@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
def school_customization_view(request):
    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)
        
    settings_obj, _ = SchoolSettings.objects.get_or_create(school=school)
    
    def _serialize():
        return {
            'school_name': school.name,
            'primary_color': settings_obj.primary_color,
            'secondary_color': settings_obj.secondary_color,
            'font_family': settings_obj.font_family,
            'school_motto': settings_obj.school_motto,
            'welcome_message': settings_obj.welcome_message,
            'logo_url': request.build_absolute_uri(settings_obj.logo.url) if settings_obj.logo else None,
            'hidden_pages': settings_obj.hidden_pages or [],
            'parent_login_blocked': settings_obj.parent_login_blocked,
            'parent_login_blocked_until': settings_obj.parent_login_blocked_until,
            'parent_login_block_message': settings_obj.parent_login_block_message,
            'late_assignment_penalty_mode': settings_obj.late_assignment_penalty_mode,
            'late_assignment_penalty_percent': settings_obj.late_assignment_penalty_percent,
        }

    if request.method == 'GET':
        return Response(_serialize())

    # PUT
    from .page_registry import validate_hidden_pages

    updatable = ['primary_color', 'secondary_color', 'font_family', 'school_motto', 'welcome_message']
    # Only admin / superadmin can toggle page visibility and parent login (not HR).
    privileged = request.user.role in ('admin', 'superadmin')
    changed = []

    for field in updatable:
        val = request.data.get(field)
        if val is not None:
            setattr(settings_obj, field, val)
            changed.append(field)

    if privileged:
        if 'late_assignment_penalty_mode' in request.data:
            mode = request.data.get('late_assignment_penalty_mode')
            valid_modes = {choice[0] for choice in SchoolSettings.LATE_PENALTY_MODE_CHOICES}
            if mode not in valid_modes:
                return Response(
                    {'error': f'late_assignment_penalty_mode must be one of {sorted(valid_modes)}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            settings_obj.late_assignment_penalty_mode = mode
            changed.append('late_assignment_penalty_mode')

        if 'late_assignment_penalty_percent' in request.data:
            try:
                pct = float(request.data.get('late_assignment_penalty_percent'))
            except (TypeError, ValueError):
                return Response(
                    {'error': 'late_assignment_penalty_percent must be a number'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if pct < 0 or pct > 100:
                return Response(
                    {'error': 'late_assignment_penalty_percent must be between 0 and 100'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            settings_obj.late_assignment_penalty_percent = pct
            changed.append('late_assignment_penalty_percent')

        if 'hidden_pages' in request.data:
            settings_obj.hidden_pages = validate_hidden_pages(request.data.get('hidden_pages'))
            changed.append('hidden_pages')

        if 'parent_login_blocked' in request.data:
            blocked = bool(request.data.get('parent_login_blocked'))
            if blocked:
                message = (request.data.get('parent_login_block_message') or '').strip()
                if not message:
                    return Response(
                        {'error': 'parent_login_block_message is required when blocking parent logins'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                settings_obj.parent_login_blocked = True
                settings_obj.parent_login_block_message = message
                changed += ['parent_login_blocked', 'parent_login_block_message']
                if 'parent_login_blocked_until' in request.data:
                    raw = request.data.get('parent_login_blocked_until')
                    if raw in (None, ''):
                        settings_obj.parent_login_blocked_until = None
                    else:
                        from django.utils.dateparse import parse_datetime
                        parsed = parse_datetime(raw)
                        settings_obj.parent_login_blocked_until = parsed
                    changed.append('parent_login_blocked_until')
            else:
                settings_obj.parent_login_blocked = False
                settings_obj.parent_login_blocked_until = None
                changed += ['parent_login_blocked', 'parent_login_blocked_until']

    if changed:
        settings_obj.save(update_fields=list(set(changed)))

        try:
            AuditLog.objects.create(
                user=request.user, school=school, action='UPDATE',
                model_name='SchoolSettings', object_id=str(settings_obj.id),
                object_repr=f'Customization updated: {", ".join(sorted(set(changed)))}',
                ip_address=request.META.get('REMOTE_ADDR'), response_status=200,
            )
        except Exception:
            pass

    return Response(_serialize())


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def available_pages_view(request):
    """Return the full page registry so admins can pick which pages to hide."""
    if request.user.role not in ('admin', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    from .page_registry import PAGE_REGISTRY
    return Response({'pages': PAGE_REGISTRY})

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def school_customization_upload_logo(request):
    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)

    settings_obj, _ = SchoolSettings.objects.get_or_create(school=school)
    
    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)

    settings_obj.logo = file
    settings_obj.save(update_fields=['logo'])
    
    return Response({
        'primary_color': settings_obj.primary_color,
        'logo_url': request.build_absolute_uri(settings_obj.logo.url) if settings_obj.logo else None,
    })


# ---------------------------------------------------------------
# Report Card Config
# ---------------------------------------------------------------

@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
def report_card_config_view(request):
    """Get or update report card configuration (admin/hr)."""
    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)

    from .models import ReportCardConfig
    from .serializers import ReportCardConfigSerializer
    config, _ = ReportCardConfig.objects.get_or_create(school=school)

    if request.method == 'GET':
        return Response(ReportCardConfigSerializer(config, context={'request': request}).data)

    serializer = ReportCardConfigSerializer(config, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def report_card_upload_image(request):
    """Upload logo or stamp image for report card config."""
    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)

    from .models import ReportCardConfig
    from .serializers import ReportCardConfigSerializer
    config, _ = ReportCardConfig.objects.get_or_create(school=school)

    field = request.data.get('field')  # 'logo', 'stamp_image', or 'banner_image'
    file = request.FILES.get('file')

    if field not in ('logo', 'stamp_image', 'banner_image') or not file:
        return Response({'error': 'field must be logo/stamp_image/banner_image and file is required'},
                        status=status.HTTP_400_BAD_REQUEST)

    setattr(config, field, file)
    config.save(update_fields=[field])
    return Response(ReportCardConfigSerializer(config, context={'request': request}).data)


# ---------------------------------------------------------------
# Report Card Templates (shareable across tenants)
# ---------------------------------------------------------------

REPORT_CARD_CONFIG_FIELDS = [
    'logo_position', 'primary_color', 'secondary_color',
    'gradient_start_color', 'gradient_end_color', 'header_style',
    'font_family', 'font_size_scale', 'page_size', 'page_orientation',
    'one_page_fit', 'template_preset',
    'show_grading_key', 'show_attendance', 'show_attendance_breakdown',
    'show_overall_average', 'show_position', 'show_class_average',
    'show_previous_term', 'show_effort_grade', 'show_subject_chart',
    'show_promotion_status', 'show_fees_status', 'show_qr_code',
    'subject_grouping_enabled', 'principal_name', 'principal_title', 'show_class_teacher',
    'teacher_comments_default', 'principal_comments_default', 'comment_char_limit',
    'show_next_term_dates', 'custom_footer_text', 'show_grade_remark',
    'show_exam_types', 'highlight_pass_fail', 'watermark_text',
    'border_style', 'show_conduct_section', 'show_activities_section',
]


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def report_card_templates_view(request):
    """List all shareable templates, or save current school config as a new template."""
    from .models import ReportCardTemplate, ReportCardConfig
    from .serializers import ReportCardTemplateSerializer

    if request.method == 'GET':
        templates = ReportCardTemplate.objects.all()
        return Response(ReportCardTemplateSerializer(templates, many=True).data)

    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    name = (request.data.get('name') or '').strip()
    description = (request.data.get('description') or '').strip()
    if not name:
        return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)
    if ReportCardTemplate.objects.filter(name=name).exists():
        return Response({'error': 'A template with that name already exists'}, status=status.HTTP_400_BAD_REQUEST)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)
    config, _ = ReportCardConfig.objects.get_or_create(school=school)
    snapshot = {f: getattr(config, f) for f in REPORT_CARD_CONFIG_FIELDS}

    template = ReportCardTemplate.objects.create(
        name=name, description=description, config_json=snapshot,
        is_builtin=False, created_by=request.user,
    )
    return Response(ReportCardTemplateSerializer(template).data, status=status.HTTP_201_CREATED)


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def report_card_template_detail_view(request, template_id):
    """POST = apply template to current school; DELETE = remove (non-builtin only)."""
    from .models import ReportCardTemplate, ReportCardConfig
    from .serializers import ReportCardConfigSerializer

    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    try:
        template = ReportCardTemplate.objects.get(id=template_id)
    except ReportCardTemplate.DoesNotExist:
        return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if template.is_builtin:
            return Response({'error': 'Built-in templates cannot be deleted'}, status=status.HTTP_403_FORBIDDEN)
        template.delete()
        return Response({'message': 'Template deleted'}, status=status.HTTP_204_NO_CONTENT)

    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)
    config, _ = ReportCardConfig.objects.get_or_create(school=school)

    for field, value in (template.config_json or {}).items():
        if field in REPORT_CARD_CONFIG_FIELDS and hasattr(config, field):
            setattr(config, field, value)
    config.template_preset = template.name
    config.save()
    return Response(ReportCardConfigSerializer(config, context={'request': request}).data)


# ---------------------------------------------------------------
# Subject groups (for report card grouping by Core / Electives / Languages)
# ---------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def subject_groups_view(request):
    from .models import SubjectGroup
    from .serializers import SubjectGroupSerializer

    school = request.user.school
    if not school:
        return Response({'error': 'No school'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        groups = SubjectGroup.objects.filter(school=school).select_related('subject')
        return Response(SubjectGroupSerializer(groups, many=True).data)

    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    subject_id = request.data.get('subject')
    group_type = request.data.get('group_type', 'core')
    if not subject_id:
        return Response({'error': 'subject required'}, status=status.HTTP_400_BAD_REQUEST)
    group, _ = SubjectGroup.objects.update_or_create(
        school=school, subject_id=subject_id,
        defaults={'group_type': group_type},
    )
    return Response(SubjectGroupSerializer(group).data)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def subject_group_detail_view(request, group_id):
    from .models import SubjectGroup
    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    SubjectGroup.objects.filter(id=group_id, school=request.user.school).delete()
    return Response({'message': 'Deleted'}, status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------
# Report card QR verification (public)
# ---------------------------------------------------------------

def _is_html_request(request):
    accept = (request.headers.get('Accept') or '').lower()
    if 'application/json' in accept and 'text/html' not in accept:
        return False
    return request.query_params.get('format') != 'json'


def _parse_report_token_payload(payload):
    """
    Supported payload formats:
      - v2|<school_id>|<student_id>|<year>|<term>
      - <student_id>|<year>|<term> (legacy)
    """
    parts = payload.split('|')
    if len(parts) >= 5 and parts[0] == 'v2':
        _, school_id, student_id, year, term = parts[:5]
        return int(school_id), int(student_id), year, term
    if len(parts) >= 3:
        student_id, year, term = parts[:3]
        return None, int(student_id), year, term
    raise ValueError('Malformed token payload')


def _report_verify_response(request, payload, http_status=status.HTTP_200_OK):
    if _is_html_request(request):
        from django.http import HttpResponse
        from django.utils.html import escape

        title = 'Report Verification'
        body = f"<h2>{escape(payload.get('error', 'Verification failed'))}</h2>"
        if payload.get('valid'):
            title = 'Verified Report Card'
            report_url = escape(payload.get('report_url', ''))
            school_name = escape(payload.get('school_name', ''))
            student_name = escape(payload.get('student_name', ''))
            year = escape(payload.get('academic_year', ''))
            term = escape(payload.get('academic_term', ''))
            avg = escape(str(payload.get('overall_average', 0)))
            body = (
                "<h1 style='margin:0 0 8px;color:#0f5132;'>Authentic School Report Card</h1>"
                f"<p style='margin:0 0 16px;color:#555;'>{school_name} has verified this report for "
                f"<strong>{student_name}</strong> ({term} {year}).</p>"
                "<div style='margin:0 0 16px;padding:12px;background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;'>"
                f"<strong>Overall Average:</strong> {avg}%"
                "</div>"
                f"<p style='margin:0 0 14px;'><a href='{report_url}?download=1' "
                "style='display:inline-block;padding:10px 14px;background:#0d6efd;color:#fff;text-decoration:none;border-radius:6px;'>"
                "Open Report PDF</a></p>"
                f"<iframe title='Report PDF' src='{report_url}?download=1' "
                "style='width:100%;height:72vh;border:1px solid #ddd;border-radius:8px;'></iframe>"
            )

        html = (
            "<!doctype html><html><head><meta charset='utf-8'/>"
            "<meta name='viewport' content='width=device-width, initial-scale=1'/>"
            f"<title>{escape(title)}</title>"
            "</head><body style='font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:16px;'>"
            "<div style='max-width:900px;margin:0 auto;background:#fff;padding:20px;border-radius:12px;"
            "box-shadow:0 10px 25px rgba(0,0,0,0.06);'>"
            f"{body}"
            "</div></body></html>"
        )
        return HttpResponse(html, status=http_status)
    return Response(payload, status=http_status)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def verify_report_card(request, token):
    """Public endpoint for report-card QR verification and public PDF display."""
    from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
    from django.db.models import Case, When, F, CharField
    from django.http import HttpResponse
    from academics.models import Student, Result
    from academics.views import _build_report_card_pdf

    signer = TimestampSigner(salt='report-card')
    try:
        payload = signer.unsign(token, max_age=60 * 60 * 24 * 365 * 5)  # 5-year validity
    except SignatureExpired:
        return _report_verify_response(request, {'valid': False, 'error': 'Token expired'})
    except BadSignature:
        return _report_verify_response(request, {'valid': False, 'error': 'Invalid token'})

    try:
        school_id_from_token, student_id, year, term = _parse_report_token_payload(payload)
        student = Student.objects.select_related('user', 'student_class', 'user__school').get(id=student_id)
    except Exception:
        return _report_verify_response(request, {'valid': False, 'error': 'Malformed token'})

    if (
        school_id_from_token is not None
        and student.user.school_id != school_id_from_token
    ):
        return _report_verify_response(
            request,
            {'valid': False, 'error': 'School mismatch in token'},
        )

    results = Result.objects.filter(
        student=student, academic_year=year, include_in_report=True,
    ).annotate(
        effective_term=Case(
            When(report_term='', then=F('academic_term')),
            default=F('report_term'),
            output_field=CharField(),
        )
    ).filter(effective_term=term)
    total_pct = 0.0
    count = 0
    for r in results:
        if r.max_score:
            total_pct += (r.score / r.max_score) * 100
            count += 1
    avg = round(total_pct / count, 1) if count else 0.0

    report_url = request.build_absolute_uri(request.path)
    response_payload = {
        'valid': True,
        'student_name': student.user.full_name,
        'student_number': student.user.student_number,
        'school_name': student.user.school.name if student.user.school else '',
        'class_name': student.student_class.name if student.student_class else '',
        'academic_year': year,
        'academic_term': term,
        'overall_average': avg,
        'subject_count': count,
        'report_url': report_url,
    }

    if request.query_params.get('download') == '1':
        pdf_results = Result.objects.filter(
            student=student, academic_year=year, include_in_report=True,
        ).annotate(
            effective_term=Case(
                When(report_term='', then=F('academic_term')),
                default=F('report_term'),
                output_field=CharField(),
            )
        ).filter(effective_term=term).select_related('subject').order_by('subject__name')
        buffer = _build_report_card_pdf(
            student=student,
            results=pdf_results,
            school=student.user.school,
            year=year,
            term=term,
        )
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = (
            f'inline; filename="verified_report_{student.user.student_number}_{term}_{year}.pdf"'
        )
        return response

    return _report_verify_response(request, response_payload)


# ---------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def audit_logs_view(request):
    """List audit logs for the current school (admin/superadmin only)."""
    if request.user.role not in ('admin', 'superadmin'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    if school:
        logs = AuditLog.objects.filter(school=school).select_related('user')
    else:
        logs = AuditLog.objects.none()

    user_id = request.query_params.get('user_id')
    action = request.query_params.get('action')
    model_name = request.query_params.get('model')
    from_date = request.query_params.get('from')
    to_date = request.query_params.get('to')

    if user_id:
        logs = logs.filter(user_id=user_id)
    if action:
        logs = logs.filter(action__iexact=action.strip())
    if model_name:
        logs = logs.filter(model_name__icontains=model_name.strip())
    if from_date:
        logs = logs.filter(timestamp__date__gte=from_date)
    if to_date:
        logs = logs.filter(timestamp__date__lte=to_date)

    logs = logs.order_by('-timestamp')[:500]

    data = [
        {
            'id': log.id,
            'user': log.user.full_name if log.user else 'System',
            'user_role': log.user.role if log.user else '',
            'action': log.action,
            'model': log.model_name,
            'object_id': log.object_id,
            'object_repr': log.object_repr,
            'ip_address': log.ip_address,
            'response_status': log.response_status,
            'timestamp': log.timestamp.isoformat(),
        }
        for log in logs
    ]
    return Response({'results': data, 'count': len(data)})


# ---------------------------------------------------------------
# Global Search
# ---------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def global_search_view(request):
    """Search across students, teachers, subjects, classes."""
    from academics.models import Student, Teacher, Subject, Class
    from django.db import connection

    q = request.query_params.get('q', '').strip()
    search_type = request.query_params.get('type', 'all')

    if len(q) < 2:
        return Response({'error': 'Query must be at least 2 characters'}, status=400)

    school = request.user.school
    results = {}

    is_postgres = 'postgresql' in connection.vendor

    if search_type in ('all', 'student'):
        if is_postgres:
            from django.contrib.postgres.search import SearchVector, SearchQuery
            students = Student.objects.filter(user__school=school).annotate(
                search=SearchVector('user__first_name', 'user__last_name', 'user__student_number', 'user__email')
            ).filter(search=SearchQuery(q))
        else:
            students = Student.objects.filter(
                user__school=school
            ).filter(
                Q(user__first_name__icontains=q) | Q(user__last_name__icontains=q) |
                Q(user__student_number__icontains=q) | Q(user__email__icontains=q)
            )
        results['students'] = [
            {'id': s.id, 'name': s.user.full_name, 'student_number': s.user.student_number, 'class': s.student_class.name if s.student_class else ''}
            for s in students[:10]
        ]

    if search_type in ('all', 'teacher'):
        teachers = Teacher.objects.filter(user__school=school).filter(
            Q(user__first_name__icontains=q) | Q(user__last_name__icontains=q) | Q(user__email__icontains=q)
        )
        results['teachers'] = [
            {'id': t.id, 'name': t.user.full_name, 'email': t.user.email}
            for t in teachers[:10]
        ]

    if search_type in ('all', 'subject'):
        subjects = Subject.objects.filter(school=school).filter(
            Q(name__icontains=q) | Q(code__icontains=q)
        )
        results['subjects'] = [
            {'id': s.id, 'name': s.name, 'code': s.code}
            for s in subjects[:10]
        ]

    if search_type in ('all', 'class'):
        classes = Class.objects.filter(school=school).filter(name__icontains=q)
        results['classes'] = [
            {'id': c.id, 'name': c.name, 'grade_level': c.grade_level}
            for c in classes[:10]
        ]

    return Response(results)


# ─────────────────────────────────────────────────────────────────────────────
# Contact form (public — no auth required)
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def contact_form_view(request):
    """
    Public contact form submission from myschoolhub.co.zw/contact.
    Sends the enquiry to the Destination inbox via Resend.
    """
    name    = request.data.get('name', '').strip()
    email   = request.data.get('email', '').strip()
    phone   = request.data.get('phone', '').strip()
    school  = request.data.get('school', '').strip()
    role    = request.data.get('role', '').strip()
    message = request.data.get('message', '').strip()

    if not name or not email or not message:
        return Response(
            {'error': 'Name, email, and message are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from email_service import send_contact_form_email
    sent = send_contact_form_email(
        name=name, email=email, phone=phone,
        school=school, role=role, message=message,
    )

    if sent:
        logger.info("Contact form email sent from %s (%s)", name, email)
        return Response({'message': 'Your enquiry has been sent successfully.'})
    else:
        logger.error("Contact form email failed for %s", email)
        # Still return 200 so the user gets feedback — the enquiry details are logged
        return Response({'message': 'Your enquiry has been received.'})


# ---------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def notification_list_view(request):
    """List notifications for the current user (newest first)."""
    notifications = Notification.objects.filter(user=request.user).order_by('-date_created')[:50]
    data = [
        {
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'notification_type': n.notification_type,
            'is_read': n.is_read,
            'link': n.link,
            'date_created': n.date_created.isoformat(),
        }
        for n in notifications
    ]
    return Response({'results': data, 'count': len(data)})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def notification_mark_read_view(request, notification_id):
    """Mark a single notification as read."""
    try:
        notification = Notification.objects.get(id=notification_id, user=request.user)
        notification.is_read = True
        notification.save()
        return Response({'message': 'Notification marked as read'})
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def notification_mark_all_read_view(request):
    """Mark all notifications as read for the current user."""
    count = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({'message': f'{count} notifications marked as read'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def notification_unread_count_view(request):
    """Return the count of unread notifications."""
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return Response({'unread_count': count})


# ---------------------------------------------------------------
# Admin Analytics
# ---------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def admin_analytics(request):
    """Admin analytics dashboard data"""
    if request.user.role != 'admin':
        return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    from academics.models import Student, Teacher, Class, Result, Attendance, Subject
    from finances.models import StudentPaymentRecord
    from django.db.models import Sum
    from datetime import timedelta

    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)

    total_students = Student.objects.filter(user__school=school).count()
    total_teachers = Teacher.objects.filter(user__school=school).count()
    total_classes = Class.objects.filter(school=school).count()
    total_subjects = Subject.objects.filter(school=school, is_deleted=False).count()

    # Attendance (last 30 days)
    recent_attendance = Attendance.objects.filter(student__user__school=school, date__gte=thirty_days_ago.date())
    total_records = recent_attendance.count()
    present_count = recent_attendance.filter(status__in=['present', 'late']).count()
    attendance_rate = round((present_count / total_records * 100), 1) if total_records > 0 else 0

    # Attendance by day (last 7 days)
    attendance_by_day = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date()
        day_records = Attendance.objects.filter(student__user__school=school, date=day)
        total = day_records.count()
        present = day_records.filter(status__in=['present', 'late']).count()
        attendance_by_day.append({
            'date': day.isoformat(),
            'total': total,
            'present': present,
            'rate': round((present / total * 100), 1) if total > 0 else 0,
        })

    # Fee collection (same data source as dashboard card to keep values aligned)
    record_qs = StudentPaymentRecord.objects.filter(school=school)
    total_fees_due = record_qs.aggregate(total=Sum('total_amount_due'))['total'] or 0
    total_fees_paid = record_qs.aggregate(total=Sum('amount_paid'))['total'] or 0
    collection_rate = round((float(total_fees_paid) / float(total_fees_due) * 100), 1) if total_fees_due > 0 else 0

    # Subject performance
    subject_performance = []
    for subject in Subject.objects.filter(school=school, is_deleted=False)[:15]:
        results = Result.objects.filter(subject=subject, student__user__school=school)
        if results.exists():
            avg = 0
            count = 0
            for r in results:
                if r.max_score > 0:
                    avg += (r.score / r.max_score * 100)
                    count += 1
            subject_performance.append({
                'name': subject.name,
                'code': subject.code,
                'average': round(avg / count, 1) if count > 0 else 0,
                'student_count': results.values('student').distinct().count(),
            })
    subject_performance.sort(key=lambda x: x['average'], reverse=True)

    # Class distribution
    class_distribution = [{'name': c.name, 'student_count': c.students.count()} for c in Class.objects.filter(school=school)]

    return Response({
        'overview': {
            'total_students': total_students,
            'total_teachers': total_teachers,
            'total_classes': total_classes,
            'total_subjects': total_subjects,
            'attendance_rate': attendance_rate,
            'fee_collection_rate': collection_rate,
            'total_fees_due': float(total_fees_due),
            'total_fees_paid': float(total_fees_paid),
        },
        'attendance_by_day': attendance_by_day,
        'subject_performance': subject_performance,
        'class_distribution': class_distribution,
    })


# ---------------------------------------------------------------
# Two-Factor Authentication (TOTP)
# ---------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def two_fa_status_view(request):
    """GET: Return 2FA status + school enforcement info for current user"""
    try:
        config = request.user.two_factor_config
        is_enabled = config.is_enabled
        has_backup_codes = len([c for c in config.backup_codes if not c.get('used')]) > 0
    except AttributeError:
        is_enabled = False
        has_backup_codes = False

    trusted_count = TrustedDevice.objects.filter(user=request.user, verified=True).count()

    # School enforcement info
    enforce_info = {}
    try:
        school_settings = request.user.school.settings
        if school_settings.enforce_2fa:
            deadline = None
            if school_settings.enforce_2fa_started_at:
                deadline = school_settings.enforce_2fa_started_at + dt.timedelta(days=school_settings.enforce_2fa_grace_period_days)
            enforce_info = {
                'is_enforced': request.user.role in (school_settings.enforce_2fa_for_roles or []),
                'deadline': deadline.isoformat() if deadline else None,
                'grace_days': school_settings.enforce_2fa_grace_period_days,
            }
    except Exception:
        pass

    return Response({
        'is_enabled': is_enabled,
        'has_backup_codes': has_backup_codes,
        'trusted_devices_count': trusted_count,
        'enforcement': enforce_info,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def two_fa_setup_view(request):
    """POST: Generate a new TOTP secret + QR code. Does NOT enable 2FA yet."""
    user = request.user
    secret = generate_secret()
    qr_code = get_qr_code(secret, user.email, organization_name='My School Hub')

    # Store secret temporarily in the config (not enabled yet)
    config, _ = TwoFactorAuthConfig.objects.get_or_create(user=user)
    config.secret_key = secret
    config.is_enabled = False
    config.save(update_fields=['secret_key', 'is_enabled'])

    return Response({
        'secret': secret,
        'qr_code': qr_code,
        'message': 'Scan the QR code with your authenticator app, then call verify-setup with the 6-digit code.'
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def two_fa_verify_setup_view(request):
    """POST: Verify the first TOTP code to confirm setup, enable 2FA, return backup codes."""
    from .serializers import TwoFactorSetupVerifySerializer
    serializer = TwoFactorSetupVerifySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    code = serializer.validated_data['code']
    try:
        config = request.user.two_factor_config
    except AttributeError:
        return Response({'error': 'Setup not initiated. Call /2fa/setup/ first.'}, status=400)

    if not config.secret_key:
        return Response({'error': 'Setup not initiated. Call /2fa/setup/ first.'}, status=400)

    if not verify_totp(config.secret_key, code):
        return Response({'error': 'Invalid code. Please try again.'}, status=400)

    # Generate backup codes
    plain_codes = generate_backup_codes(10)
    hashed = [{'code_hash': hash_backup_code(c), 'used': False} for c in plain_codes]

    config.is_enabled = True
    config.backup_codes = hashed
    config.backup_codes_used = []
    config.last_verified_at = timezone.now()
    config.last_ip_address = request.META.get('REMOTE_ADDR')
    config.save()

    try:
        AuditLog.objects.create(
            user=request.user, school=request.user.school, action='UPDATE',
            model_name='TwoFactorAuthConfig', object_id=str(config.pk),
            object_repr=f'2FA enabled: {request.user.email}',
            ip_address=request.META.get('REMOTE_ADDR'), response_status=200,
        )
    except Exception:
        pass

    return Response({
        'message': '2FA enabled successfully.',
        'backup_codes': plain_codes,
        'warning': 'Save these backup codes in a safe place. They will not be shown again.'
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def two_fa_verify_otp_view(request):
    """POST: Verify TOTP code during login using otp_session_token."""
    if _check_rate_limit(request, group='2fa_verify', rate='5/m'):
        return Response({'error': 'Too many attempts. Please wait.'}, status=429)

    from .serializers import TwoFactorVerifySerializer
    serializer = TwoFactorVerifySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    otp_token = serializer.validated_data['otp_session_token']
    code = serializer.validated_data['code']
    trust_device = serializer.validated_data.get('trust_device', False)

    # Decode the session token
    try:
        payload = JWTAuthentication.decode_token(otp_token)
        if payload.get('type') != 'otp_session':
            raise ValueError('Invalid token type')
        user_id = payload.get('user_id')
        user = CustomUser.objects.get(id=user_id)
    except Exception:
        return Response({'error': 'Invalid or expired session token.'}, status=401)

    try:
        config = user.two_factor_config
    except AttributeError:
        return Response({'error': '2FA not configured.'}, status=400)

    if not verify_totp(config.secret_key, code):
        return Response({'error': 'Invalid code.'}, status=400)

    config.last_verified_at = timezone.now()
    config.last_ip_address = request.META.get('REMOTE_ADDR')
    config.save(update_fields=['last_verified_at', 'last_ip_address'])

    if trust_device:
        ip = request.META.get('REMOTE_ADDR', '')
        ua = request.META.get('HTTP_USER_AGENT', '')
        device_name = parse_user_agent(ua)
        TrustedDevice.objects.update_or_create(
            user=user, ip_address=ip,
            defaults={'user_agent': ua[:500], 'device_name': device_name, 'verified': True}
        )

    access_token = JWTAuthentication.generate_token(payload={"user_id": str(user.id)})
    user_data = UserSerializer(user).data
    if user.student_number:
        user_data['student_number'] = user.student_number

    try:
        AuditLog.objects.create(
            user=user, school=user.school, action='LOGIN',
            model_name='CustomUser', object_id=str(user.id),
            object_repr=f'Login (2FA verified): {user.email}',
            ip_address=request.META.get('REMOTE_ADDR'), response_status=200,
        )
    except Exception:
        pass

    return Response({
        'user': user_data,
        'token': access_token,
        'message': f'{user.role.capitalize()} login successful'
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def two_fa_verify_backup_view(request):
    """POST: Verify a backup code during login."""
    if _check_rate_limit(request, group='2fa_backup', rate='3/m'):
        return Response({'error': 'Too many attempts. Please wait.'}, status=429)

    from .serializers import TwoFactorBackupVerifySerializer
    serializer = TwoFactorBackupVerifySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    otp_token = serializer.validated_data['otp_session_token']
    backup_code = serializer.validated_data['backup_code'].upper()
    trust_device = serializer.validated_data.get('trust_device', False)

    try:
        payload = JWTAuthentication.decode_token(otp_token)
        if payload.get('type') != 'otp_session':
            raise ValueError('Invalid token type')
        user_id = payload.get('user_id')
        user = CustomUser.objects.get(id=user_id)
    except Exception:
        return Response({'error': 'Invalid or expired session token.'}, status=401)

    try:
        config = user.two_factor_config
    except AttributeError:
        return Response({'error': '2FA not configured.'}, status=400)

    # Find and verify the backup code
    matched_idx = None
    for i, code_obj in enumerate(config.backup_codes):
        if not code_obj.get('used') and verify_backup_code(code_obj['code_hash'], backup_code):
            matched_idx = i
            break

    if matched_idx is None:
        return Response({'error': 'Invalid or already-used backup code.'}, status=400)

    # Mark as used
    config.backup_codes[matched_idx]['used'] = True
    config.save(update_fields=['backup_codes'])

    # Create audit trail
    try:
        TwoFactorBackupCode.objects.create(
            user=user, code_index=matched_idx,
            used_ip_address=request.META.get('REMOTE_ADDR', '0.0.0.0'),
            used_device=parse_user_agent(request.META.get('HTTP_USER_AGENT', ''))
        )
    except Exception:
        pass

    if trust_device:
        ip = request.META.get('REMOTE_ADDR', '')
        ua = request.META.get('HTTP_USER_AGENT', '')
        TrustedDevice.objects.update_or_create(
            user=user, ip_address=ip,
            defaults={'user_agent': ua[:500], 'device_name': parse_user_agent(ua), 'verified': True}
        )

    access_token = JWTAuthentication.generate_token(payload={"user_id": str(user.id)})
    user_data = UserSerializer(user).data
    if user.student_number:
        user_data['student_number'] = user.student_number

    remaining = sum(1 for c in config.backup_codes if not c.get('used'))

    try:
        AuditLog.objects.create(
            user=user, school=user.school, action='LOGIN',
            model_name='CustomUser', object_id=str(user.id),
            object_repr=f'Login via backup code: {user.email}',
            ip_address=request.META.get('REMOTE_ADDR'), response_status=200,
        )
    except Exception:
        pass

    return Response({
        'user': user_data,
        'token': access_token,
        'message': f'{user.role.capitalize()} login successful',
        'backup_codes_remaining': remaining,
        'warning': f'{remaining} backup code(s) remaining.' if remaining <= 3 else None
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def two_fa_disable_view(request):
    """POST: Disable 2FA for current user. Requires current password."""
    password = request.data.get('password', '')
    if not request.user.check_password(password):
        return Response({'error': 'Incorrect password.'}, status=400)

    try:
        config = request.user.two_factor_config
        config.is_enabled = False
        config.secret_key = ''
        config.backup_codes = []
        config.backup_codes_used = []
        config.save()
    except AttributeError:
        return Response({'error': '2FA was not enabled.'}, status=400)

    TrustedDevice.objects.filter(user=request.user).delete()

    try:
        AuditLog.objects.create(
            user=request.user, school=request.user.school, action='UPDATE',
            model_name='TwoFactorAuthConfig', object_id=str(config.pk),
            object_repr=f'2FA disabled: {request.user.email}',
            ip_address=request.META.get('REMOTE_ADDR'), response_status=200,
        )
    except Exception:
        pass

    return Response({'message': '2FA disabled successfully.'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def two_fa_regenerate_backup_codes_view(request):
    """POST: Regenerate backup codes (invalidates old ones)."""
    try:
        config = request.user.two_factor_config
        if not config.is_enabled:
            return Response({'error': '2FA is not enabled.'}, status=400)
    except AttributeError:
        return Response({'error': '2FA is not enabled.'}, status=400)

    plain_codes = generate_backup_codes(10)
    hashed = [{'code_hash': hash_backup_code(c), 'used': False} for c in plain_codes]
    config.backup_codes = hashed
    config.backup_codes_used = []
    config.save(update_fields=['backup_codes', 'backup_codes_used'])

    return Response({
        'backup_codes': plain_codes,
        'message': 'New backup codes generated. Save them in a safe place.'
    })


@api_view(['GET', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def two_fa_trusted_devices_view(request):
    """GET: List trusted devices. DELETE: Revoke all or a specific trusted device."""
    if request.method == 'GET':
        devices = TrustedDevice.objects.filter(user=request.user, verified=True).order_by('-last_seen')
        data = [{
            'id': d.id,
            'device_name': d.device_name or 'Unknown Device',
            'ip_address': d.ip_address,
            'first_seen': d.first_seen.isoformat(),
            'last_seen': d.last_seen.isoformat(),
        } for d in devices]
        return Response({'devices': data})
    else:  # DELETE
        device_id = request.data.get('device_id')
        if device_id:
            TrustedDevice.objects.filter(user=request.user, id=device_id).delete()
            return Response({'message': 'Device removed.'})
        else:
            TrustedDevice.objects.filter(user=request.user).delete()
            return Response({'message': 'All trusted devices removed.'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def enforce_two_fa_view(request):
    """POST: Admin-only endpoint to enable/disable 2FA enforcement for specific roles."""
    if request.user.role != 'admin':
        return Response({'error': 'Admin access required.'}, status=403)

    from .serializers import Enforce2FASerializer
    serializer = Enforce2FASerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    enforce = serializer.validated_data['enforce']
    roles = serializer.validated_data.get('roles', [])
    grace_period_days = serializer.validated_data.get('grace_period_days', 14)

    try:
        school_settings = request.user.school.settings
    except Exception:
        return Response({'error': 'School settings not found.'}, status=400)

    school_settings.enforce_2fa = enforce
    if enforce:
        school_settings.enforce_2fa_for_roles = roles
        school_settings.enforce_2fa_grace_period_days = grace_period_days
        school_settings.enforce_2fa_started_at = timezone.now()
    else:
        school_settings.enforce_2fa_for_roles = []
        school_settings.enforce_2fa_started_at = None
    school_settings.save()

    # Compliance stats
    total_affected = 0
    compliant = 0
    if enforce and roles:
        affected_users = CustomUser.objects.filter(school=request.user.school, role__in=roles)
        total_affected = affected_users.count()
        compliant = affected_users.filter(two_factor_config__is_enabled=True).count()

    action_label = 'UPDATE'
    action_repr = f'2FA enforcement {"activated" if enforce else "disabled"}: roles={roles}'
    try:
        AuditLog.objects.create(
            user=request.user, school=request.user.school, action=action_label,
            model_name='SchoolSettings', object_id=str(school_settings.pk),
            object_repr=action_repr,
            ip_address=request.META.get('REMOTE_ADDR'), response_status=200,
        )
    except Exception:
        pass

    deadline = None
    if enforce and school_settings.enforce_2fa_started_at:
        deadline = (school_settings.enforce_2fa_started_at + dt.timedelta(days=grace_period_days)).isoformat()

    return Response({
        'message': f'2FA enforcement {"activated" if enforce else "disabled"} successfully.',
        'enforce': enforce,
        'roles': roles,
        'grace_period_days': grace_period_days,
        'deadline': deadline,
        'compliance': {
            'total_affected': total_affected,
            'compliant': compliant,
            'non_compliant': total_affected - compliant,
        } if enforce else None
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def two_fa_compliance_view(request):
    """GET: Admin-only compliance dashboard data."""
    if request.user.role != 'admin':
        return Response({'error': 'Admin access required.'}, status=403)

    try:
        school_settings = request.user.school.settings
    except Exception:
        return Response({'error': 'School settings not found.'}, status=400)

    enforced_roles = school_settings.enforce_2fa_for_roles or []
    school = request.user.school

    compliance_by_role = []
    all_users = CustomUser.objects.filter(school=school).select_related('two_factor_config')

    for role in enforced_roles:
        role_users = [u for u in all_users if u.role == role]
        total = len(role_users)
        enabled = sum(1 for u in role_users if hasattr(u, 'two_factor_config') and u.two_factor_config.is_enabled)
        non_compliant_users = [
            {'id': u.id, 'name': u.get_full_name() or u.email, 'email': u.email}
            for u in role_users
            if not (hasattr(u, 'two_factor_config') and u.two_factor_config.is_enabled)
        ]
        compliance_by_role.append({
            'role': role,
            'total': total,
            'compliant': enabled,
            'non_compliant': total - enabled,
            'percentage': round((enabled / total * 100) if total > 0 else 0, 1),
            'non_compliant_users': non_compliant_users,
        })

    deadline = None
    if school_settings.enforce_2fa_started_at:
        deadline = (school_settings.enforce_2fa_started_at + dt.timedelta(days=school_settings.enforce_2fa_grace_period_days)).isoformat()

    return Response({
        'enforce_2fa': school_settings.enforce_2fa,
        'enforced_roles': enforced_roles,
        'grace_period_days': school_settings.enforce_2fa_grace_period_days,
        'started_at': school_settings.enforce_2fa_started_at.isoformat() if school_settings.enforce_2fa_started_at else None,
        'deadline': deadline,
        'compliance_by_role': compliance_by_role,
    })
