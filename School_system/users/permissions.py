from rest_framework import permissions

class IsSportsDirector(permissions.BasePermission):
    """
    Allows access only to sports directors.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'sports_director')

class IsAdminOrHROrSportsDirector(permissions.BasePermission):
    """
    Allows access to admin, hr, or sports directors.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ('admin', 'hr', 'sports_director', 'superadmin')
        )
