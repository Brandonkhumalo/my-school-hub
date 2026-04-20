import logging

from django.contrib.auth.hashers import make_password
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from .models import (
    CustomUser, School, AuditLog, SchoolSettings, Notification,
    HRPermissionProfile, HRPagePermission,
    AccountantPermissionProfile, AccountantPagePermission,
)
from .serializers import (
    UserSerializer, UserRegistrationSerializer, LoginSerializer, WhatsAppPinVerificationSerializer,
    ChangePasswordSerializer, SetWhatsAppPinSerializer, SchoolSerializer, SchoolRegistrationSerializer,
    ManagedUserSerializer
)
from .token import JWTAuthentication


def _check_rate_limit(request, group='api', rate='10/m'):
    """Returns True if the request is rate-limited."""
    try:
        from ratelimit.utils import is_ratelimited
        return is_ratelimited(request, group=group, key='ip', rate=rate, increment=True)
    except Exception:
        return False


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

    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']

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
    return Response(serializer.errors, status=400)


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
            'total_revenue': StudentPaymentRecord.objects.filter(
                school=school
            ).aggregate(total=models.Sum('amount_paid'))['total'] or 0,
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
    }
    return Response(data)


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
    'subject_grouping_enabled', 'principal_title', 'show_class_teacher',
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

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def verify_report_card(request, token):
    """Public endpoint — decodes a signed token from a QR code and returns basic
    authenticity info (school, student, term, overall grade). Used to verify
    printed report cards are genuine."""
    from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
    from academics.models import Student, Result
    from .models import School

    signer = TimestampSigner(salt='report-card')
    try:
        data = signer.unsign(token, max_age=60 * 60 * 24 * 365 * 5)  # 5-year validity
    except SignatureExpired:
        return Response({'valid': False, 'error': 'Token expired'}, status=status.HTTP_200_OK)
    except BadSignature:
        return Response({'valid': False, 'error': 'Invalid token'}, status=status.HTTP_200_OK)

    try:
        sid, year, term = data.split('|', 2)
        student = Student.objects.select_related('user', 'student_class', 'user__school').get(id=int(sid))
    except Exception:
        return Response({'valid': False, 'error': 'Malformed token'}, status=status.HTTP_200_OK)

    results = Result.objects.filter(
        student=student, academic_year=year, academic_term=term, include_in_report=True,
    )
    total_pct = 0.0
    count = 0
    for r in results:
        if r.max_score:
            total_pct += (r.score / r.max_score) * 100
            count += 1
    avg = round(total_pct / count, 1) if count else 0.0

    return Response({
        'valid': True,
        'student_name': student.user.full_name,
        'student_number': student.user.student_number,
        'school_name': student.user.school.name if student.user.school else '',
        'class_name': student.student_class.name if student.student_class else '',
        'academic_year': year,
        'academic_term': term,
        'overall_average': avg,
        'subject_count': count,
    })


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
