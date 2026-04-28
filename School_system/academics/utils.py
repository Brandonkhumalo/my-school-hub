import random
from datetime import date
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist

from users.models import AuditLog

User = get_user_model()
MAX_PARENTS_PER_CHILD = 3

def generate_unique_student_number(enrollment_year=None, max_tries=10):
    """
    Generate a unique student number like STU22345
    where:
      - STU = prefix
      - 22 = last two digits of enrollment year
      - 345 = 3 random digits
    """
    if not enrollment_year:
        enrollment_year = date.today().year

    year_suffix = str(enrollment_year)[-2:]  # e.g., 2025 -> "25"

    for _ in range(max_tries):
        random_part = str(random.randint(100, 999))
        student_number = f"STU{year_suffix}{random_part}"
        if not User.objects.filter(student_number=student_number).exists():
            return student_number

    raise ValueError("Could not generate unique student number after multiple attempts")


def generate_unique_staff_number(max_tries=10):
    """
    Generate a unique staff number like STAFF26001
    where:
      - STAFF = prefix
      - 26 = last two digits of current year
      - 001 = 3 random digits
    """
    from datetime import date
    year_suffix = str(date.today().year)[-2:]

    for _ in range(max_tries):
        random_part = str(random.randint(100, 999))
        staff_number = f"STAFF{year_suffix}{random_part}"
        if not User.objects.filter(student_number=staff_number).exists():
            return staff_number

    raise ValueError("Could not generate unique staff number after multiple attempts")


def check_rate_limit(request, group="academics_api", rate="20/m"):
    """Return True when this request should be rate-limited."""
    try:
        from ratelimit.utils import is_ratelimited
        return is_ratelimited(request, group=group, key='ip', rate=rate, increment=True)
    except Exception:
        return False


def parent_belongs_to_school(parent, school_id):
    """True if parent is attached to school through user.school or parent.schools M2M."""
    if not parent or not school_id:
        return False
    return bool(
        parent.user.school_id == school_id or
        parent.schools.filter(id=school_id).exists()
    )


def log_school_audit(*, user, action, model_name, object_id="", object_repr="", changes=None, status_code=None, ip_address=None):
    """Write a best-effort audit trail row for school-scoped actions."""
    try:
        school = getattr(user, "school", None) if user else None
        AuditLog.objects.create(
            user=user,
            school=school,
            action=action,
            model_name=model_name,
            object_id=str(object_id or ""),
            object_repr=(object_repr or "")[:500],
            changes=changes or {},
            ip_address=ip_address,
            response_status=status_code,
        )
    except (ObjectDoesNotExist, Exception):
        # Never break business logic because of audit logging.
        return


def apply_late_penalty(raw_grade, max_score, mode='none', percent=0.0):
    """Return (final_grade, penalty_points) based on school late penalty settings."""
    try:
        raw = float(raw_grade)
    except (TypeError, ValueError):
        raw = 0.0
    try:
        ceiling = max(float(max_score), 0.0)
    except (TypeError, ValueError):
        ceiling = 0.0
    try:
        pct = float(percent)
    except (TypeError, ValueError):
        pct = 0.0
    pct = max(0.0, min(100.0, pct))
    normalized_mode = (mode or 'none').strip().lower()

    if normalized_mode == 'none' or pct == 0 or ceiling == 0:
        return max(0.0, min(raw, ceiling or raw)), 0.0

    if normalized_mode == 'percentage':
        penalty_points = raw * (pct / 100.0)
    else:
        # fixed_percent_of_max and any unknown mode fallback to max-score based penalty.
        penalty_points = ceiling * (pct / 100.0)

    final_grade = max(0.0, raw - penalty_points)
    final_grade = min(final_grade, ceiling if ceiling > 0 else final_grade)
    return round(final_grade, 4), round(penalty_points, 4)
