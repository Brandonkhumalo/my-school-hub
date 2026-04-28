import csv
import hmac
import io
import logging
import os
import secrets
import string
import sys
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
import django
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from academics.models import Class, Parent, ParentChildLink, Student
from finances.models import Invoice, StudentPaymentRecord
from users.models import AuditLog, CustomUser, Notification, School, SchoolSettings
from users.token import JWTAuthentication

logger = logging.getLogger(__name__)

MAX_PAGE_SIZE = 200


def _paginate_queryset(request, qs, default_page_size=50):
    try:
        page = max(1, int(request.GET.get("page", 1)))
    except Exception:
        page = 1
    try:
        page_size = int(request.GET.get("page_size", default_page_size))
    except Exception:
        page_size = default_page_size
    page_size = max(1, min(MAX_PAGE_SIZE, page_size))

    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    return qs[start:end], {
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size,
        "has_next": end < total,
        "has_prev": page > 1,
    }


def _get_superadmin_secret_key():
    return (os.environ.get("SUPERADMIN_SECRET_KEY") or "").strip()


def _check_rate_limit(request, group="superadmin_api", rate="20/m"):
    try:
        from ratelimit.utils import is_ratelimited
        return is_ratelimited(request, group=group, key="ip", rate=rate, increment=True)
    except Exception:
        return False


def _is_superadmin(user):
    return user.is_authenticated and user.role == "superadmin"


def _audit(request, action, model_name, object_id="", object_repr="", changes=None, response_status=200, school=None):
    try:
        AuditLog.objects.create(
            user=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
            school=school,
            action=action,
            model_name=model_name,
            object_id=str(object_id or ""),
            object_repr=(object_repr or "")[:500],
            changes=changes or {},
            ip_address=request.META.get("REMOTE_ADDR"),
            response_status=response_status,
        )
    except Exception:
        logger.warning("Superadmin audit log failed", exc_info=True)


def _school_setup_status(school):
    try:
        settings_obj = SchoolSettings.objects.filter(school=school).first()
    except Exception:
        settings_obj = None
    classes_count = Class.objects.filter(school=school).count()
    has_logo = bool((settings_obj.logo if settings_obj else None) or school.logo)
    has_academic_period = bool(
        settings_obj and (
            settings_obj.term_start_date or settings_obj.term_1_start or settings_obj.current_term
        )
    )
    return {
        "has_logo": has_logo,
        "has_academic_period": has_academic_period,
        "has_classes": classes_count > 0,
        "classes_count": classes_count,
        "is_setup_complete": has_logo and has_academic_period and classes_count > 0,
        "two_factor_enforced": bool(settings_obj.enforce_2fa) if settings_obj else False,
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def superadmin_register(request):
    if CustomUser.objects.filter(role="superadmin").exists():
        return Response({"error": "Superadmin registration is disabled."}, status=status.HTTP_403_FORBIDDEN)

    email = (request.data.get("email") or "").strip()
    password = request.data.get("password")
    full_name = (request.data.get("full_name") or "").strip()
    secret_key = request.data.get("secret_key")

    if not all([email, password, full_name, secret_key]):
        return Response({"error": "All fields are required"}, status=status.HTTP_400_BAD_REQUEST)

    configured_secret = _get_superadmin_secret_key()
    if not configured_secret:
        logger.error("SUPERADMIN_SECRET_KEY is not configured; refusing superadmin registration.")
        return Response(
            {"error": "Superadmin registration is unavailable. Server secret is not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if not hmac.compare_digest(str(secret_key), configured_secret):
        return Response({"error": "Invalid secret key"}, status=status.HTTP_403_FORBIDDEN)

    if CustomUser.objects.filter(email=email).exists():
        return Response({"error": "Email already registered"}, status=status.HTTP_400_BAD_REQUEST)

    username = email.split("@")[0] + "_superadmin"
    if CustomUser.objects.filter(username=username).exists():
        username = username + "_" + "".join(secrets.choice(string.digits) for _ in range(4))

    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    user = CustomUser.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role="superadmin",
    )

    return Response(
        {
            "message": "Superadmin registered successfully",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": f"{user.first_name} {user.last_name}".strip(),
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def superadmin_login(request):
    if _check_rate_limit(request, group="superadmin_login", rate="10/m"):
        return Response({"error": "Too many requests. Please try again shortly."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    email = (request.data.get("email") or "").strip()
    password = request.data.get("password")
    if not email or not password:
        return Response({"error": "Email and password are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = CustomUser.objects.get(Q(email=email) | Q(username=email))
    except CustomUser.DoesNotExist:
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

    if user.role != "superadmin":
        return Response({"error": "Access denied. Not a superadmin."}, status=status.HTTP_403_FORBIDDEN)

    if user.is_account_locked():
        return Response({"error": "Account temporarily locked due to failed login attempts."}, status=status.HTTP_423_LOCKED)

    if not user.check_password(password):
        user.register_failed_login_attempt()
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

    user.clear_login_failures()
    payload = {"user_id": user.id, "role": user.role}
    access_token = JWTAuthentication.generate_token(payload)
    refresh_token = JWTAuthentication.generate_refresh_token(payload)

    _audit(
        request,
        action="LOGIN",
        model_name="CustomUser",
        object_id=user.id,
        object_repr=f"Superadmin login: {user.email}",
        response_status=200,
        school=None,
    )

    return Response(
        {
            "access": access_token,
            "refresh": refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": f"{user.first_name} {user.last_name}".strip() or user.email,
                "role": user.role,
            },
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_stats(request):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    now = timezone.now()
    twelve_months_ago = now - timedelta(days=365)

    schools_qs = School.objects.all()
    created_monthly = (
        schools_qs.filter(created_at__gte=twelve_months_ago)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )
    schools_growth = [
        {"month": row["month"].strftime("%Y-%m") if row["month"] else "", "count": row["count"]}
        for row in created_monthly
    ]

    by_type = schools_qs.values("school_type").annotate(count=Count("id")).order_by("school_type")
    by_curriculum = schools_qs.values("curriculum").annotate(count=Count("id")).order_by("curriculum")

    total_revenue = StudentPaymentRecord.objects.aggregate(total=Sum("amount_paid"))["total"] or Decimal("0")
    outstanding = Invoice.objects.filter(is_paid=False).aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
    locked_admins = CustomUser.objects.filter(role="admin", account_locked_until__gt=now).count()
    generated_test_activity = (
        AuditLog.objects.select_related("user", "school")
        .filter(model_name__in=["GeneratedTest", "TestAttempt"])
        .order_by("-timestamp")[:12]
    )

    return Response(
        {
            "schools": schools_qs.count(),
            "admins": CustomUser.objects.filter(role="admin").count(),
            "total_students": Student.objects.count(),
            "total_teachers": CustomUser.objects.filter(role="teacher").count(),
            "total_parents": CustomUser.objects.filter(role="parent").count(),
            "total_hr": CustomUser.objects.filter(role="hr").count(),
            "total_accountants": CustomUser.objects.filter(role="accountant").count(),
            "total_security": CustomUser.objects.filter(role="security").count(),
            "total_librarians": CustomUser.objects.filter(role="librarian").count(),
            "total_cleaners": CustomUser.objects.filter(role="cleaner").count(),
            "schools_active": schools_qs.filter(is_suspended=False).count(),
            "schools_suspended": schools_qs.filter(is_suspended=True).count(),
            "schools_by_type": list(by_type),
            "schools_by_curriculum": list(by_curriculum),
            "schools_created_monthly": schools_growth,
            "platform_revenue_collected": str(total_revenue),
            "platform_outstanding_fees": str(outstanding),
            "locked_admin_accounts": locked_admins,
            "recent_generated_test_activity": [
                {
                    "id": row.id,
                    "timestamp": row.timestamp.isoformat() if row.timestamp else None,
                    "action": row.action,
                    "model_name": row.model_name,
                    "object_id": row.object_id,
                    "object_repr": row.object_repr,
                    "school_name": row.school.name if row.school else None,
                    "user_email": row.user.email if row.user else None,
                }
                for row in generated_test_activity
            ],
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_school_with_admin(request):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    school_name = request.data.get("school_name")
    school_location = request.data.get("school_location")
    school_type = request.data.get("school_type", "secondary")
    accommodation_type = request.data.get("accommodation_type", "day")
    curriculum = request.data.get("curriculum", "zimsec")
    admin_email = request.data.get("admin_email")
    admin_phone = request.data.get("admin_phone")
    admin_password = request.data.get("admin_password")
    student_limit = request.data.get("student_limit")

    if not all([school_name, school_location, admin_email, admin_phone, admin_password, student_limit]):
        return Response({"error": "All fields are required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        student_limit = int(student_limit)
        if student_limit < 1:
            raise ValueError
    except Exception:
        return Response({"error": "student_limit must be a positive number"}, status=status.HTTP_400_BAD_REQUEST)
    if School.objects.filter(name__iexact=school_name).exists():
        return Response({"error": "School with this name already exists"}, status=status.HTTP_400_BAD_REQUEST)
    if CustomUser.objects.filter(email=admin_email).exists():
        return Response({"error": "Admin email already registered"}, status=status.HTTP_400_BAD_REQUEST)

    valid_accommodation = {choice[0] for choice in School.ACCOMMODATION_TYPE_CHOICES}
    if accommodation_type not in valid_accommodation:
        return Response({"error": "Invalid accommodation type"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            school = School.objects.create(
                name=school_name,
                code=School.generate_school_code(),
                city=school_location,
                school_type=school_type,
                accommodation_type=accommodation_type,
                curriculum=curriculum,
                student_limit=student_limit,
            )

            admin_username = school_name.lower().replace(" ", "_")[:20] + "_admin"
            if CustomUser.objects.filter(username=admin_username).exists():
                admin_username = admin_username + "_" + school.code[-4:]

            admin_user = CustomUser.objects.create_user(
                username=admin_username,
                email=admin_email,
                password=admin_password,
                phone_number=admin_phone,
                first_name=school_name,
                last_name="Admin",
                role="admin",
                school=school,
                created_by=request.user,
            )

            _audit(
                request,
                action="CREATE",
                model_name="School",
                object_id=school.id,
                object_repr=f"Created school {school.name}",
                changes={
                    "school_code": school.code,
                    "admin_user_id": admin_user.id,
                    "admin_email": admin_user.email,
                    "student_limit": student_limit,
                },
                response_status=201,
                school=None,
            )

            return Response(
                {
                    "message": "School and admin created successfully",
                    "school_name": school.name,
                    "school_code": school.code,
                    "admin_username": admin_user.username,
                    "admin_email": admin_user.email,
                    "student_limit": school.student_limit,
                },
                status=status.HTTP_201_CREATED,
            )
    except Exception as exc:
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_schools_with_admins(request):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    schools = School.objects.all().order_by("-created_at")
    schools_data = []
    for school in schools:
        admin = CustomUser.objects.filter(school=school, role="admin").order_by("-last_login").first()
        schools_data.append(
            {
                "id": school.id,
                "name": school.name,
                "code": school.code,
                "city": school.city,
                "school_type": school.get_school_type_display() if hasattr(school, "get_school_type_display") else school.school_type,
                "accommodation_type": school.accommodation_type,
                "accommodation_type_display": school.get_accommodation_type_display(),
                "curriculum": school.curriculum,
                "student_limit": school.student_limit,
                "is_suspended": school.is_suspended,
                "admin_username": admin.username if admin else "N/A",
                "admin_email": admin.email if admin else "N/A",
                "admin_phone": admin.phone_number if admin else "N/A",
                "admin_last_login": admin.last_login.isoformat() if admin and admin.last_login else None,
                "created_at": school.created_at.isoformat() if school.created_at else None,
            }
        )
    return Response({"schools": schools_data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def school_detail_panel(request, school_id):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
    try:
        school = School.objects.get(id=school_id)
    except School.DoesNotExist:
        return Response({"error": "School not found"}, status=status.HTTP_404_NOT_FOUND)

    admin_user = CustomUser.objects.filter(school=school, role="admin").order_by("-last_login").first()
    setup_status = _school_setup_status(school)
    locked_users = CustomUser.objects.filter(school=school, account_locked_until__gt=timezone.now()).order_by("role", "email")

    revenue = StudentPaymentRecord.objects.filter(school=school).aggregate(total=Sum("amount_paid"))["total"] or Decimal("0")
    outstanding = Invoice.objects.filter(school=school, is_paid=False).aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
    audit_entries = AuditLog.objects.filter(school=school).order_by("-timestamp")[:10]

    return Response(
        {
            "school": {
                "id": school.id,
                "name": school.name,
                "code": school.code,
                "created_at": school.created_at.isoformat() if school.created_at else None,
                "is_suspended": school.is_suspended,
            },
            "counts": {
                "students": Student.objects.filter(user__school=school).count(),
                "active_students": Student.objects.filter(user__school=school, user__is_active=True).count(),
                "pending_activation_students": Student.objects.filter(
                    user__school=school, pending_activation_due_to_limit=True
                ).count(),
                "teachers": CustomUser.objects.filter(school=school, role="teacher").count(),
                "hr": CustomUser.objects.filter(school=school, role="hr").count(),
                "accountants": CustomUser.objects.filter(school=school, role="accountant").count(),
                "security": CustomUser.objects.filter(school=school, role="security").count(),
                "librarians": CustomUser.objects.filter(school=school, role="librarian").count(),
                "cleaners": CustomUser.objects.filter(school=school, role="cleaner").count(),
                "parents": Parent.objects.filter(schools=school).distinct().count(),
                "staff": CustomUser.objects.filter(school=school, role__in=["admin", "hr", "accountant", "security", "cleaner", "librarian"]).count(),
            },
            "capacity": {
                "student_limit": school.student_limit,
            },
            "finance": {
                "revenue_collected": str(revenue),
                "outstanding_fees": str(outstanding),
            },
            "admin_last_login": admin_user.last_login.isoformat() if admin_user and admin_user.last_login else None,
            "setup": setup_status,
            "locked_accounts": [
                {
                    "id": u.id,
                    "name": f"{u.first_name} {u.last_name}".strip() or u.email,
                    "email": u.email,
                    "role": u.role,
                    "failed_login_attempts": u.failed_login_attempts,
                    "account_locked_until": u.account_locked_until.isoformat() if u.account_locked_until else None,
                }
                for u in locked_users
            ],
            "recent_audit_logs": [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "action": log.action,
                    "model_name": log.model_name,
                    "object_repr": log.object_repr,
                    "user_email": log.user.email if log.user else None,
                }
                for log in audit_entries
            ],
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reset_admin_password(request, school_id):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    new_password = request.data.get("new_password")
    if not new_password or len(new_password) < 6:
        return Response({"error": "Password must be at least 6 characters"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        school = School.objects.get(id=school_id)
    except School.DoesNotExist:
        return Response({"error": "School not found"}, status=status.HTTP_404_NOT_FOUND)

    admin = CustomUser.objects.filter(school=school, role="admin").first()
    if not admin:
        return Response({"error": "No admin found for this school"}, status=status.HTTP_404_NOT_FOUND)

    admin.set_password(new_password)
    admin.save(update_fields=["password"])
    _audit(
        request,
        action="UPDATE",
        model_name="CustomUser",
        object_id=admin.id,
        object_repr=f"Reset admin password for school {school.name}",
        changes={"school_id": school.id, "admin_user_id": admin.id},
        response_status=200,
        school=None,
    )
    return Response({"message": "Password reset successfully"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def suspend_school(request, school_id):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    suspend = bool(request.data.get("suspend", True))
    reason = request.data.get("reason", "")
    try:
        school = School.objects.get(id=school_id)
    except School.DoesNotExist:
        return Response({"error": "School not found"}, status=status.HTTP_404_NOT_FOUND)

    school.is_suspended = suspend
    if suspend:
        school.suspension_reason = reason
        school.suspended_at = timezone.now()
    else:
        school.suspension_reason = None
        school.suspended_at = None
    school.save(update_fields=["is_suspended", "suspension_reason", "suspended_at"])

    _audit(
        request,
        action="SUSPEND" if suspend else "UPDATE",
        model_name="School",
        object_id=school.id,
        object_repr=f"{'Suspended' if suspend else 'Activated'} school {school.name}",
        changes={"is_suspended": school.is_suspended, "reason": reason or ""},
        response_status=200,
        school=None,
    )
    return Response({"message": f"School {'suspended' if suspend else 'activated'} successfully", "is_suspended": school.is_suspended})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_school(request, school_id):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    confirmation = request.data.get("confirmation", "")
    try:
        school = School.objects.get(id=school_id)
    except School.DoesNotExist:
        return Response({"error": "School not found"}, status=status.HTTP_404_NOT_FOUND)
    if confirmation != school.name:
        return Response({"error": "Confirmation text does not match school name"}, status=status.HTTP_400_BAD_REQUEST)

    school_name = school.name
    school_id_value = school.id
    school.delete()
    _audit(
        request,
        action="DELETE",
        model_name="School",
        object_id=school_id_value,
        object_repr=f"Deleted school {school_name}",
        changes={"school_name": school_name},
        response_status=200,
        school=None,
    )
    return Response({"message": f'School "{school_name}" and all its data have been permanently deleted'})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_school_profile(request, school_id):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
    try:
        school = School.objects.get(id=school_id)
    except School.DoesNotExist:
        return Response({"error": "School not found"}, status=status.HTTP_404_NOT_FOUND)

    allowed_fields = {"school_type", "accommodation_type", "curriculum", "city", "name", "student_limit"}
    incoming = {k: v for k, v in request.data.items() if k in allowed_fields}

    if "accommodation_type" in incoming:
        valid = {choice[0] for choice in School.ACCOMMODATION_TYPE_CHOICES}
        if incoming["accommodation_type"] not in valid:
            return Response({"error": "Invalid accommodation type"}, status=status.HTTP_400_BAD_REQUEST)
    if "school_type" in incoming:
        valid = {choice[0] for choice in School.SCHOOL_TYPE_CHOICES}
        if incoming["school_type"] not in valid:
            return Response({"error": "Invalid school type"}, status=status.HTTP_400_BAD_REQUEST)
    if "curriculum" in incoming:
        valid = {choice[0] for choice in School.CURRICULUM_CHOICES}
        if incoming["curriculum"] not in valid:
            return Response({"error": "Invalid curriculum"}, status=status.HTTP_400_BAD_REQUEST)
    if "student_limit" in incoming:
        try:
            incoming["student_limit"] = int(incoming["student_limit"])
            if incoming["student_limit"] < 1:
                raise ValueError
        except Exception:
            return Response({"error": "student_limit must be a positive number"}, status=status.HTTP_400_BAD_REQUEST)

    for field, value in incoming.items():
        setattr(school, field, value)
    school.save(update_fields=list(incoming.keys()) + ["updated_at"] if incoming else ["updated_at"])

    activated_count = 0
    if "student_limit" in incoming:
        active_students = Student.objects.filter(user__school=school, user__is_active=True).count()
        free_slots = max(0, school.student_limit - active_students)
        if free_slots > 0:
            pending_students = list(
                Student.objects.filter(
                    user__school=school,
                    pending_activation_due_to_limit=True,
                    user__is_active=False,
                ).select_related("user").order_by("id")[:free_slots]
            )
            pending_ids = [student.id for student in pending_students]
            if pending_ids:
                Student.objects.filter(id__in=pending_ids).update(pending_activation_due_to_limit=False)
                CustomUser.objects.filter(student__id__in=pending_ids).update(is_active=True)
                activated_count = len(pending_ids)

    if activated_count > 0:
        admin_users = CustomUser.objects.filter(school=school, role="admin", is_active=True)
        note_message = (
            f"{activated_count} student account(s) were automatically activated "
            "after your student limit was increased."
        )
        Notification.objects.bulk_create(
            [
                Notification(
                    user=admin_user,
                    title="Student Limit Increased",
                    message=note_message,
                    notification_type="student_limit",
                    link="/admin/settings",
                )
                for admin_user in admin_users
            ]
        )

    _audit(
        request,
        action="UPDATE",
        model_name="School",
        object_id=school.id,
        object_repr=f"Updated school {school.name}",
        changes=incoming,
        response_status=200,
        school=None,
    )
    return Response(
        {
            "message": "School updated successfully",
            "school": {
                "id": school.id,
                "name": school.name,
                "school_type": school.school_type,
                "school_type_display": school.get_school_type_display(),
                "accommodation_type": school.accommodation_type,
                "accommodation_type_display": school.get_accommodation_type_display(),
                "curriculum": school.curriculum,
                "city": school.city,
                "student_limit": school.student_limit,
            },
            "activated_students": activated_count,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_audit_logs(request):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    qs = AuditLog.objects.select_related("user", "school").all().order_by("-timestamp")
    school_id = request.GET.get("school_id")
    action = request.GET.get("action")
    model_name = request.GET.get("model_name")
    user_id = request.GET.get("user_id")
    user_q = request.GET.get("user_q")
    school_q = request.GET.get("school_q")
    date_from = request.GET.get("date_from")
    date_to = request.GET.get("date_to")
    if school_id:
        qs = qs.filter(school_id=school_id)
    if action:
        qs = qs.filter(action=action)
    if model_name:
        qs = qs.filter(model_name=model_name)
    if user_id:
        qs = qs.filter(user_id=user_id)
    if user_q:
        qs = qs.filter(
            Q(user__email__icontains=user_q) |
            Q(user__first_name__icontains=user_q) |
            Q(user__last_name__icontains=user_q)
        )
    if school_q:
        qs = qs.filter(school__name__icontains=school_q)
    if date_from:
        qs = qs.filter(timestamp__date__gte=date_from)
    if date_to:
        qs = qs.filter(timestamp__date__lte=date_to)

    page_qs, page_meta = _paginate_queryset(request, qs, default_page_size=50)
    payload = [
        {
            "id": log.id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "action": log.action,
            "model_name": log.model_name,
            "object_id": log.object_id,
            "object_repr": log.object_repr,
            "user_email": log.user.email if log.user else None,
            "school_id": log.school_id,
            "school_name": log.school.name if log.school else "Platform",
            "ip_address": log.ip_address,
            "response_status": log.response_status,
        }
        for log in page_qs
    ]
    return Response({"results": payload, **page_meta})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_audit_logs_export(request):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    qs = AuditLog.objects.select_related("user", "school").all().order_by("-timestamp")
    school_id = request.GET.get("school_id")
    action = request.GET.get("action")
    model_name = request.GET.get("model_name")
    user_id = request.GET.get("user_id")
    user_q = request.GET.get("user_q")
    school_q = request.GET.get("school_q")
    date_from = request.GET.get("date_from")
    date_to = request.GET.get("date_to")
    if school_id:
        qs = qs.filter(school_id=school_id)
    if action:
        qs = qs.filter(action=action)
    if model_name:
        qs = qs.filter(model_name=model_name)
    if user_id:
        qs = qs.filter(user_id=user_id)
    if user_q:
        qs = qs.filter(
            Q(user__email__icontains=user_q) |
            Q(user__first_name__icontains=user_q) |
            Q(user__last_name__icontains=user_q)
        )
    if school_q:
        qs = qs.filter(school__name__icontains=school_q)
    if date_from:
        qs = qs.filter(timestamp__date__gte=date_from)
    if date_to:
        qs = qs.filter(timestamp__date__lte=date_to)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["timestamp", "action", "model_name", "object_id", "object_repr", "user_email", "school_name", "ip_address", "status"])
    for log in qs[:5000]:
        writer.writerow([
            log.timestamp.isoformat() if log.timestamp else "",
            log.action,
            log.model_name,
            log.object_id,
            log.object_repr,
            log.user.email if log.user else "",
            log.school.name if log.school else "Platform",
            log.ip_address or "",
            log.response_status or "",
        ])

    resp = HttpResponse(buffer.getvalue(), content_type="text/csv")
    resp["Content-Disposition"] = 'attachment; filename="superadmin_audit_logs.csv"'
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_locked_accounts(request):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    now = timezone.now()
    qs = CustomUser.objects.filter(account_locked_until__gt=now).select_related("school").order_by("account_locked_until")
    school_id = request.GET.get("school_id")
    role = request.GET.get("role")
    query = request.GET.get("q")
    if school_id:
        qs = qs.filter(school_id=school_id)
    if role:
        qs = qs.filter(role=role)
    if query:
        qs = qs.filter(
            Q(email__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(school__name__icontains=query)
        )

    page_qs, page_meta = _paginate_queryset(request, qs, default_page_size=50)
    results = [
        {
            "id": u.id,
            "name": f"{u.first_name} {u.last_name}".strip() or u.email,
            "email": u.email,
            "role": u.role,
            "school_id": u.school_id,
            "school_name": u.school.name if u.school else None,
            "failed_login_attempts": u.failed_login_attempts,
            "account_locked_until": u.account_locked_until.isoformat() if u.account_locked_until else None,
            "last_failed_login_at": u.last_failed_login_at.isoformat() if u.last_failed_login_at else None,
        }
        for u in page_qs
    ]
    return Response({"results": results, **page_meta})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def superadmin_unlock_account(request, user_id):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
    try:
        target_user = CustomUser.objects.get(id=user_id)
    except CustomUser.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    target_user.clear_login_failures()
    _audit(
        request,
        action="UPDATE",
        model_name="CustomUser",
        object_id=target_user.id,
        object_repr=f"Superadmin unlocked account for {target_user.email}",
        changes={"failed_login_attempts": 0, "account_locked_until": None},
        response_status=200,
        school=None,
    )
    return Response({"message": "User login lockout cleared successfully."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_system_health(request):
    if not _is_superadmin(request.user):
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    from django.db import connection
    from users.models import BlacklistedToken

    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        db_ok = False

    celery_configured = bool(getattr(settings, "CELERY_BROKER_URL", None))
    secret_set = bool(_get_superadmin_secret_key())

    return Response(
        {
            "database_ok": db_ok,
            "python_version": sys.version.split(" ")[0],
            "django_version": django.get_version(),
            "debug": bool(getattr(settings, "DEBUG", False)),
            "superadmin_secret_key_set": secret_set,
            "celery_configured": celery_configured,
            "blacklisted_tokens": BlacklistedToken.objects.count(),
        }
    )
