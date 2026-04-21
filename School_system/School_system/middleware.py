import json
import logging

logger = logging.getLogger(__name__)

AUDIT_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}
SKIP_PATHS = {'/admin/', '/api/v1/schema/', '/api/v1/docs/', '/media/', '/static/'}

HR_ALWAYS_ALLOWED_PREFIXES = (
    '/api/v1/auth/profile/',
    '/api/v1/auth/logout/',
    '/api/v1/auth/notifications/',
    '/api/v1/auth/school/current-period/',
    '/api/v1/auth/change-password/',
)

# Map API path prefixes to HR page keys for permission enforcement.
HR_API_PAGE_PREFIXES = (
    ('/api/v1/auth/audit-logs/', 'audit_logs'),
    ('/api/v1/auth/analytics/', 'analytics'),
    ('/api/v1/academics/students/', 'students'),
    ('/api/v1/academics/teachers/', 'teachers'),
    ('/api/v1/academics/parents/', 'parents'),
    ('/api/v1/academics/parent-link-requests/', 'parent_requests'),
    ('/api/v1/auth/users/', 'users'),
    ('/api/v1/staff/create/', 'staff'),
    ('/api/v1/staff/', 'staff'),
    ('/api/v1/academics/classes/', 'classes'),
    ('/api/v1/academics/subjects/', 'subjects'),
    ('/api/v1/academics/results/', 'results'),
    ('/api/v1/academics/assessment-plans/', 'results'),
    ('/api/v1/academics/admin/at-risk-students/', 'at_risk_students'),
    ('/api/v1/academics/timetables/', 'timetable'),
    ('/api/v1/finances/school-fees/', 'fees'),
    ('/api/v1/finances/student-fees/', 'fees'),
    ('/api/v1/finances/fee-types/', 'fees'),
    ('/api/v1/finances/additional-fees/', 'fees'),
    ('/api/v1/finances/invoices/', 'invoices'),
    ('/api/v1/finances/payment-records/class-report/', 'reports'),
    ('/api/v1/finances/transport-payment-status/', 'reports'),
    ('/api/v1/finances/reports/', 'reports'),
    ('/api/v1/finances/payment-records/', 'payments'),
    ('/api/v1/finances/payments/', 'payments'),
    ('/api/v1/staff/leaves/', 'leaves'),
    ('/api/v1/staff/payroll/', 'payroll'),
    ('/api/v1/staff/attendance/', 'attendance'),
    ('/api/v1/staff/meetings/', 'meetings'),
    ('/api/v1/staff/visitors/', 'visitor_logs'),
    ('/api/v1/staff/incidents/', 'incidents'),
    ('/api/v1/staff/cleaning-', 'cleaning'),
    ('/api/v1/academics/discipline/', 'discipline'),
    ('/api/v1/academics/promotions/', 'promotions'),
    ('/api/v1/academics/suspensions/', 'suspensions'),
    ('/api/v1/academics/activities/', 'activities'),
    ('/api/v1/library/', 'library'),
    ('/api/v1/academics/health/', 'health'),
    ('/api/v1/academics/clinic-visits/', 'health'),
    ('/api/v1/academics/complaints/', 'complaints'),
    ('/api/v1/academics/announcements/', 'announcements'),
    ('/api/v1/boarding/', 'boarding'),
    ('/api/v1/auth/school/report-config/', 'report_config'),
    ('/api/v1/auth/school/settings/', 'settings'),
    ('/api/v1/auth/dashboard/stats/', 'dashboard'),
)


def _get_client_ip(request):
    """Execute get client ip."""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class AuditMiddleware:
    """
    Logs write operations (POST/PUT/PATCH/DELETE) to the AuditLog model.
    Skipped for admin UI, schema, and static/media paths.
    """

    def __init__(self, get_response):
        """Initialize instance state."""
        self.get_response = get_response

    def __call__(self, request):
        """Execute call."""
        response = self.get_response(request)

        if request.method not in AUDIT_METHODS:
            return response

        path = request.path
        if any(path.startswith(skip) for skip in SKIP_PATHS):
            return response

        # Only log authenticated requests
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return response

        try:
            # Determine action from HTTP method
            action_map = {
                'POST': 'CREATE',
                'PUT': 'UPDATE',
                'PATCH': 'UPDATE',
                'DELETE': 'DELETE',
            }
            action = action_map.get(request.method, request.method)

            # Try to extract body for change tracking (skip file uploads)
            changes = {}
            content_type = request.content_type or ''
            if 'application/json' in content_type:
                try:
                    body = request.body
                    if body:
                        data = json.loads(body)
                        # Remove sensitive fields
                        for sensitive in ('password', 'whatsapp_pin', 'token', 'secret'):
                            data.pop(sensitive, None)
                        changes = data
                except Exception:
                    pass

            # Extract model name from URL path (/api/v1/academics/students/ → Student)
            parts = [p for p in path.split('/') if p]
            model_name = parts[-2] if len(parts) >= 2 else parts[-1] if parts else 'unknown'

            # Determine object_id (last numeric segment)
            object_id = ''
            for segment in reversed(parts):
                if segment.isdigit():
                    object_id = segment
                    break

            from users.models import AuditLog
            AuditLog.objects.create(
                user=user,
                school=getattr(user, 'school', None),
                action=action,
                model_name=model_name,
                object_id=object_id,
                object_repr=path,
                changes=changes,
                ip_address=_get_client_ip(request),
                response_status=response.status_code,
            )
        except Exception as exc:
            logger.warning('AuditMiddleware failed: %s', exc)

        return response


ACCOUNTANT_ALWAYS_ALLOWED_PREFIXES = (
    '/api/v1/auth/profile/',
    '/api/v1/auth/logout/',
    '/api/v1/auth/notifications/',
    '/api/v1/auth/school/current-period/',
    '/api/v1/auth/change-password/',
    '/api/v1/auth/dashboard/stats/',
)

ACCOUNTANT_API_PAGE_PREFIXES = (
    ('/api/v1/finances/school-fees/', 'fees'),
    ('/api/v1/finances/student-fees/', 'fees'),
    ('/api/v1/finances/fee-types/', 'fees'),
    ('/api/v1/finances/additional-fees/', 'fees'),
    ('/api/v1/finances/invoices/', 'invoices'),
    ('/api/v1/finances/payment-records/class-report/', 'reports'),
    ('/api/v1/finances/reports/', 'reports'),
    ('/api/v1/finances/payment-records/', 'payments'),
    ('/api/v1/finances/payments/', 'payments'),
    # Canonical endpoint for school expense submission/approval.
    ('/api/v1/finances/expenses/', 'expenses'),
    # Legacy alias kept for backward compatibility.
    ('/api/v1/finances/school-expenses/', 'expenses'),
    ('/api/v1/staff/payroll/', 'payroll'),
)


def _hr_page_key_for_path(path):
    for prefix, page_key in HR_API_PAGE_PREFIXES:
        if path.startswith(prefix):
            return page_key
    return None


class HRAccessControlMiddleware:
    """
    Enforces HR page-level read/write permissions.
    Root HR Head gets admin-equivalent access for the request.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        path = request.path or ''

        if not user or not user.is_authenticated or not path.startswith('/api/v1/'):
            return self.get_response(request)

        if user.role != 'hr':
            return self.get_response(request)

        if any(path.startswith(prefix) for prefix in HR_ALWAYS_ALLOWED_PREFIXES):
            return self.get_response(request)

        # Lazy import to avoid app loading side effects.
        from users.models import HRPermissionProfile, HRPagePermission

        profile = HRPermissionProfile.objects.filter(user=user).first()
        if profile and profile.is_root_boss:
            # Root HR acts as admin for permission checks in this request lifecycle.
            request.user._original_role = 'hr'
            request.user.role = 'admin'
            request.is_root_hr_boss = True
            return self.get_response(request)

        page_key = _hr_page_key_for_path(path)
        if not page_key:
            return self._deny()

        permission = HRPagePermission.objects.filter(
            profile__user=user,
            page_key=page_key,
        ).first()
        if not permission:
            return self._deny()

        is_read_method = request.method in ('GET', 'HEAD', 'OPTIONS')
        if is_read_method and permission.can_read:
            return self.get_response(request)
        if (not is_read_method) and permission.can_write:
            return self.get_response(request)
        return self._deny()

    @staticmethod
    def _deny():
        from django.http import JsonResponse
        return JsonResponse(
            {'error': 'Permission denied for this HR account.'},
            status=403
        )


def _accountant_page_key_for_path(path):
    for prefix, page_key in ACCOUNTANT_API_PAGE_PREFIXES:
        if path.startswith(prefix):
            return page_key
    return None


class AccountantAccessControlMiddleware:
    """
    Enforces Accountant page-level read/write permissions.
    Accountant Head gets full access across accounting endpoints.
    Non-head accountants are limited to pages admin has granted them.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        path = request.path or ''

        if not user or not user.is_authenticated or not path.startswith('/api/v1/'):
            return self.get_response(request)

        if user.role != 'accountant':
            return self.get_response(request)

        if any(path.startswith(prefix) for prefix in ACCOUNTANT_ALWAYS_ALLOWED_PREFIXES):
            return self.get_response(request)

        from users.models import AccountantPermissionProfile, AccountantPagePermission

        profile = AccountantPermissionProfile.objects.filter(user=user).first()
        if profile and profile.is_root_head:
            request.is_accountant_head = True
            return self.get_response(request)

        page_key = _accountant_page_key_for_path(path)
        if not page_key:
            # Paths outside the accountant page map are denied for non-head accountants.
            return self._deny()

        permission = AccountantPagePermission.objects.filter(
            profile__user=user,
            page_key=page_key,
        ).first()
        if not permission:
            return self._deny()

        is_read_method = request.method in ('GET', 'HEAD', 'OPTIONS')
        if is_read_method and permission.can_read:
            return self.get_response(request)
        if (not is_read_method) and permission.can_write:
            return self.get_response(request)
        return self._deny()

    @staticmethod
    def _deny():
        from django.http import JsonResponse
        return JsonResponse(
            {'error': 'Permission denied for this accountant account.'},
            status=403
        )
