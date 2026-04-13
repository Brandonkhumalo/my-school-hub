"""
Gateway-aware authentication backend.

When the Go API Gateway sits in front of Django, it handles JWT validation,
blacklist checks, and user lookups. It passes the authenticated user's info
via trusted headers:
    X-Gateway-Auth: true
    X-User-ID: <int>
    X-User-Role: <string>
    X-User-School-ID: <int>

This authentication class reads those headers and resolves the Django User
object with a single DB query (cached in-process per request).

If X-Gateway-Auth is not present, it falls back to the original
JWTAuthentication so Django can also run standalone without the gateway.
"""

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import get_user_model

User = get_user_model()


class GatewayAuthentication(BaseAuthentication):
    """
    Checks for X-Gateway-Auth header first (set by Go gateway).
    Falls back to standard JWT auth if not behind gateway.
    """

    def authenticate(self, request):
        # If request came through the Go gateway
        """Execute authenticate."""
        if request.META.get('HTTP_X_GATEWAY_AUTH') == 'true':
            user_id = request.META.get('HTTP_X_USER_ID')
            if not user_id:
                return None

            try:
                user = User.objects.get(id=int(user_id))
                return (user, None)
            except (User.DoesNotExist, ValueError):
                raise AuthenticationFailed("User from gateway header not found.")

        # Not behind gateway — fall back to JWT
        from .token import JWTAuthentication
        jwt_auth = JWTAuthentication()
        return jwt_auth.authenticate(request)
