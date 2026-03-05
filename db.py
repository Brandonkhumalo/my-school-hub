"""
db.py — Dump every table in the database to stdout.
Run from the project root:
    python db.py
"""

import os
import sys
import django

# ── Django bootstrap ──────────────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "School_system"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "School_system.settings")
django.setup()

# ── Models ────────────────────────────────────────────────────────────────────
from users.models import School, CustomUser, SchoolSettings, AuditLog, BlacklistedToken
from academics.models import (
    Subject, Class, Student, Teacher, Parent, ParentChildLink,
    Result, Timetable, Announcement, Complaint, Suspension,
    SchoolEvent, Assignment, AssignmentSubmission,
    WeeklyMessage, Attendance as StudentAttendance,
    ParentTeacherMessage, Homework,
)
from finances.models import (
    FeeType, StudentFee, Payment, Invoice,
    StudentPaymentRecord, PaymentTransaction,
    FinancialReport, SchoolFees, AdditionalFee,
)
from staff.models import Department, Staff, Attendance as StaffAttendance, Leave, Payroll, Meeting
from whatsapp_intergration.models import (
    WhatsAppUser, WhatsAppSession, WhatsAppMessage, WhatsAppPayment, WhatsAppMenu,
)

# ── Helpers ───────────────────────────────────────────────────────────────────
SEP = "-" * 72

def dump(label, queryset):
    items = list(queryset)
    print(f"\n{'=' * 72}")
    print(f"  {label}  ({len(items)} record{'s' if len(items) != 1 else ''})")
    print('=' * 72)
    if not items:
        print("  (empty)")
        return
    for obj in items:
        print(f"  [{obj.pk}]  {obj}")
    print(SEP)


# ── Users app ─────────────────────────────────────────────────────────────────
dump("SCHOOLS",           School.objects.all())
dump("USERS",             CustomUser.objects.all())
dump("SCHOOL SETTINGS",   SchoolSettings.objects.all())
dump("AUDIT LOGS",        AuditLog.objects.all()[:50])   # cap at 50 to avoid flood
dump("BLACKLISTED TOKENS",BlacklistedToken.objects.all())

# ── Academics app ─────────────────────────────────────────────────────────────
# Use all_with_deleted() for soft-delete managers so nothing is hidden
dump("SUBJECTS",           Subject.objects.all_with_deleted())
dump("CLASSES",            Class.objects.all())
dump("STUDENTS",           Student.objects.all())
dump("TEACHERS",           Teacher.objects.all())
dump("PARENTS",            Parent.objects.all())
dump("PARENT-CHILD LINKS", ParentChildLink.objects.all())
dump("RESULTS",            Result.objects.all())
dump("TIMETABLES",         Timetable.objects.all())
dump("ANNOUNCEMENTS",      Announcement.objects.all())
dump("COMPLAINTS",         Complaint.objects.all())
dump("SUSPENSIONS",        Suspension.objects.all())
dump("SCHOOL EVENTS",      SchoolEvent.objects.all())
dump("ASSIGNMENTS",        Assignment.objects.all())
dump("ASSIGNMENT SUBMISSIONS", AssignmentSubmission.objects.all())
dump("WEEKLY MESSAGES",    WeeklyMessage.objects.all())
dump("STUDENT ATTENDANCE", StudentAttendance.objects.all())
dump("PARENT-TEACHER MESSAGES", ParentTeacherMessage.objects.all())
dump("HOMEWORK",           Homework.objects.all())

# ── Finances app ──────────────────────────────────────────────────────────────
dump("FEE TYPES",            FeeType.objects.all())
dump("STUDENT FEES",         StudentFee.objects.all())
dump("PAYMENTS",             Payment.objects.all())
dump("INVOICES",             Invoice.objects.all())
dump("STUDENT PAYMENT RECORDS", StudentPaymentRecord.objects.all())
dump("PAYMENT TRANSACTIONS", PaymentTransaction.objects.all())
dump("FINANCIAL REPORTS",    FinancialReport.objects.all())
dump("SCHOOL FEES CONFIG",   SchoolFees.objects.all())
dump("ADDITIONAL FEES",      AdditionalFee.objects.all())

# ── Staff app ─────────────────────────────────────────────────────────────────
dump("DEPARTMENTS",      Department.objects.all())
dump("STAFF",            Staff.objects.all())
dump("STAFF ATTENDANCE", StaffAttendance.objects.all())
dump("LEAVE REQUESTS",   Leave.objects.all())
dump("PAYROLL",          Payroll.objects.all())
dump("MEETINGS",         Meeting.objects.all())

# ── WhatsApp app ──────────────────────────────────────────────────────────────
dump("WHATSAPP USERS",    WhatsAppUser.objects.all())
dump("WHATSAPP SESSIONS", WhatsAppSession.objects.all())
dump("WHATSAPP MESSAGES", WhatsAppMessage.objects.all())
dump("WHATSAPP PAYMENTS", WhatsAppPayment.objects.all())
dump("WHATSAPP MENUS",    WhatsAppMenu.objects.all())

print(f"\n{'=' * 72}")
print("  Done.")
print('=' * 72)