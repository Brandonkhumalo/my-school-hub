import logging

from django.db import models
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from .models import CustomUser, School, AuditLog, SchoolSettings, Notification
from .serializers import (
    UserSerializer, UserRegistrationSerializer, LoginSerializer, WhatsAppPinVerificationSerializer,
    ChangePasswordSerializer, SetWhatsAppPinSerializer, SchoolSerializer, SchoolRegistrationSerializer
)
from .token import JWTAuthentication


def _check_rate_limit(request, group='api', rate='10/m'):
    """Returns True if the request is rate-limited."""
    try:
        from ratelimit.utils import is_ratelimited
        return is_ratelimited(request, group=group, key='ip', rate=rate, increment=True)
    except Exception:
        return False


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
        if user.whatsapp_pin:
            user_data['whatsapp_pin'] = user.whatsapp_pin

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
        user = self.request.user
        if user.school:
            queryset = CustomUser.objects.filter(school=user.school)
        else:
            queryset = CustomUser.objects.none()
        role = self.request.query_params.get('role', None)
        if role:
            queryset = queryset.filter(role=role)
        return queryset


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats_view(request):
    from academics.models import Class, Subject
    from finances.models import Invoice, StudentPaymentRecord

    school = request.user.school

    if school:
        stats = {
            'total_students': CustomUser.objects.filter(role='student', is_active=True, school=school).count(),
            'total_teachers': CustomUser.objects.filter(role='teacher', is_active=True, school=school).count(),
            'total_parents': CustomUser.objects.filter(
                role='parent', is_active=True
            ).filter(
                # Count parents linked to this school via schools M2M, direct FK, or children
                models.Q(school=school) |
                models.Q(parent__schools=school) |
                models.Q(parent__children__user__school=school)
            ).distinct().count(),
            'total_staff': CustomUser.objects.filter(role__in=['admin', 'hr', 'accountant'], is_active=True, school=school).count(),
            'total_classes': Class.objects.filter(school=school).count(),
            'total_subjects': Subject.objects.filter(school=school).count(),
            'pending_invoices': Invoice.objects.filter(is_paid=False, student__user__school=school).count(),
            'total_revenue': StudentPaymentRecord.objects.filter(
                school=school
            ).aggregate(total=models.Sum('amount_paid'))['total'] or 0,
            'school_type': school.school_type,
            'school_name': school.name,
        }
    else:
        stats = {
            'total_students': 0, 'total_teachers': 0, 'total_parents': 0,
            'total_staff': 0, 'total_classes': 0, 'total_subjects': 0,
            'pending_invoices': 0, 'total_revenue': 0,
        }

    return Response(stats)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_user_view(request, user_id):
    if request.user.role != 'admin':
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
        logs = AuditLog.objects.filter(school=school).select_related('user')[:200]
    else:
        logs = AuditLog.objects.none()

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
    from finances.models import StudentFee
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

    # Fee collection
    total_fees_due = StudentFee.objects.filter(student__user__school=school).aggregate(total=Sum('amount_due'))['total'] or 0
    total_fees_paid = StudentFee.objects.filter(student__user__school=school).aggregate(total=Sum('amount_paid'))['total'] or 0
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
