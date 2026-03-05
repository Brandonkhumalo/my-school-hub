import json
import logging

logger = logging.getLogger(__name__)

AUDIT_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}
SKIP_PATHS = {'/admin/', '/api/v1/schema/', '/api/v1/docs/', '/media/', '/static/'}


def _get_client_ip(request):
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
        self.get_response = get_response

    def __call__(self, request):
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
