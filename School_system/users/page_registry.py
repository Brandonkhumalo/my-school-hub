"""
Registry of pages that admins can hide/show for their school.

Each entry:
  key         — stable identifier stored in SchoolSettings.hidden_pages
  label       — human-readable name shown in the admin UI
  role        — which role's portal the page belongs to
  group       — section heading in the admin toggle UI
  always_on   — cannot be hidden (dashboards, profile, logout, customization)

Keep this list in sync with src/utils/pageRegistry.js on the frontend.
"""

PAGE_REGISTRY = [
    # ── Admin ──────────────────────────────────────────────────────────
    {"key": "admin.dashboard",         "label": "Dashboard",            "role": "admin", "group": "Overview",      "always_on": True},
    {"key": "admin.students",          "label": "Students",             "role": "admin", "group": "People"},
    {"key": "admin.past_students",     "label": "Past Students",        "role": "admin", "group": "People"},
    {"key": "admin.teachers",          "label": "Teachers",             "role": "admin", "group": "People"},
    {"key": "admin.parents",           "label": "Parents",              "role": "admin", "group": "People"},
    {"key": "admin.parent_requests",   "label": "Parent Requests",      "role": "admin", "group": "People"},
    {"key": "admin.users",             "label": "User Management",      "role": "admin", "group": "People"},
    {"key": "admin.classes",           "label": "Classes",              "role": "admin", "group": "Academics"},
    {"key": "admin.timetable",         "label": "Timetable",            "role": "admin", "group": "Academics"},
    {"key": "admin.subjects",          "label": "Subjects",             "role": "admin", "group": "Academics"},
    {"key": "admin.results",           "label": "Results",              "role": "admin", "group": "Academics"},
    {"key": "admin.assessment_plans",  "label": "Assessment Plans",     "role": "admin", "group": "Academics"},
    {"key": "admin.at_risk_students",  "label": "At-Risk Students",     "role": "admin", "group": "Academics"},
    {"key": "admin.invoices",          "label": "Invoices",             "role": "admin", "group": "Finance"},
    {"key": "admin.fees",              "label": "Fees",                 "role": "admin", "group": "Finance"},
    {"key": "admin.payments",          "label": "Payments",             "role": "admin", "group": "Finance"},
    {"key": "admin.payroll",           "label": "Payroll",              "role": "admin", "group": "Finance"},
    {"key": "admin.accounting",        "label": "Accounting",           "role": "admin", "group": "Finance"},
    {"key": "admin.reports",           "label": "Reports",              "role": "admin", "group": "Finance"},
    {"key": "admin.announcements",     "label": "Announcements",        "role": "admin", "group": "Communication"},
    {"key": "admin.complaints",        "label": "Complaints",           "role": "admin", "group": "Communication"},
    {"key": "admin.boarding",          "label": "Boarding",             "role": "admin", "group": "Campus"},
    {"key": "admin.activities",        "label": "Activities & Sports",  "role": "admin", "group": "Campus"},
    {"key": "admin.library",           "label": "Library",              "role": "admin", "group": "Campus"},
    {"key": "admin.health",            "label": "Health Records",       "role": "admin", "group": "Campus"},
    {"key": "admin.discipline",        "label": "Discipline",           "role": "admin", "group": "Campus"},
    {"key": "admin.promotions",        "label": "Promotions",           "role": "admin", "group": "Campus"},
    {"key": "admin.suspensions",       "label": "Suspensions",          "role": "admin", "group": "Campus"},
    {"key": "admin.staff",             "label": "Staff / HR",           "role": "admin", "group": "System"},
    {"key": "admin.permissions",       "label": "Permissions",          "role": "admin", "group": "System"},
    {"key": "admin.bulk_import",       "label": "Bulk Import",          "role": "admin", "group": "System"},
    {"key": "admin.extras",            "label": "Extras",               "role": "admin", "group": "System"},
    {"key": "admin.analytics",         "label": "Analytics",            "role": "admin", "group": "System"},
    {"key": "admin.audit_logs",        "label": "Audit Logs",           "role": "admin", "group": "System"},
    {"key": "admin.report_config",     "label": "Report Card Design",   "role": "admin", "group": "System"},
    {"key": "admin.customization",     "label": "Customization",        "role": "admin", "group": "System", "always_on": True},
    {"key": "admin.settings",          "label": "School Settings",      "role": "admin", "group": "System", "always_on": True},

    # ── Teacher ────────────────────────────────────────────────────────
    {"key": "teacher.dashboard",        "label": "Dashboard",           "role": "teacher", "group": "Teacher", "always_on": True},
    {"key": "teacher.marks",            "label": "Add Marks",           "role": "teacher", "group": "Teacher"},
    {"key": "teacher.report_feedback",  "label": "Report Feedback",     "role": "teacher", "group": "Teacher"},
    {"key": "teacher.attendance",       "label": "Attendance",          "role": "teacher", "group": "Teacher"},
    {"key": "teacher.performance",      "label": "At-Risk Students",    "role": "teacher", "group": "Teacher"},
    {"key": "teacher.homework",         "label": "Homework",            "role": "teacher", "group": "Teacher"},
    {"key": "teacher.assignments",      "label": "Assignments",         "role": "teacher", "group": "Teacher"},
    {"key": "teacher.past_papers",      "label": "Past Exam Papers",    "role": "teacher", "group": "Teacher"},
    {"key": "teacher.generate_tests",   "label": "Generate Tests",      "role": "teacher", "group": "Teacher"},
    {"key": "teacher.test_results",     "label": "Test Results",        "role": "teacher", "group": "Teacher"},
    {"key": "teacher.conferences",      "label": "Conferences",         "role": "teacher", "group": "Teacher"},
    {"key": "teacher.messages",         "label": "Messages",            "role": "teacher", "group": "Teacher"},
    {"key": "teacher.complaints",       "label": "Complaints",          "role": "teacher", "group": "Teacher"},

    # ── Student ────────────────────────────────────────────────────────
    {"key": "student.dashboard",        "label": "Dashboard",           "role": "student", "group": "Student", "always_on": True},
    {"key": "student.boarding",         "label": "Boarding Life",       "role": "student", "group": "Student"},
    {"key": "student.submissions",      "label": "Submissions",         "role": "student", "group": "Student"},
    {"key": "student.marks",            "label": "Marks",               "role": "student", "group": "Student"},
    {"key": "student.results",          "label": "Results",             "role": "student", "group": "Student"},
    {"key": "student.homework",         "label": "Homework",            "role": "student", "group": "Student"},
    {"key": "student.assignments",      "label": "Assignments",         "role": "student", "group": "Student"},
    {"key": "student.past_papers",      "label": "Past Exam Papers",    "role": "student", "group": "Student"},
    {"key": "student.tests",            "label": "Tests",               "role": "student", "group": "Student"},
    {"key": "student.calendar",         "label": "School Calendar",     "role": "student", "group": "Student"},
    {"key": "student.timetable",        "label": "Timetable",           "role": "student", "group": "Student"},
    {"key": "student.teachers",         "label": "Teachers",            "role": "student", "group": "Student"},
    {"key": "student.announcements",    "label": "Announcements",       "role": "student", "group": "Student"},
    {"key": "student.attendance",       "label": "Attendance",          "role": "student", "group": "Student"},
    {"key": "student.activities",       "label": "Activities",          "role": "student", "group": "Student"},
    {"key": "student.library",          "label": "Library",             "role": "student", "group": "Student"},

    # ── Parent ─────────────────────────────────────────────────────────
    {"key": "parent.dashboard",         "label": "Dashboard",           "role": "parent", "group": "Parent", "always_on": True},
    {"key": "parent.boarding",          "label": "Boarding",            "role": "parent", "group": "Parent"},
    {"key": "parent.children",          "label": "My Children",         "role": "parent", "group": "Parent"},
    {"key": "parent.performance",       "label": "Performance",         "role": "parent", "group": "Parent"},
    {"key": "parent.homework",          "label": "Homework",            "role": "parent", "group": "Parent"},
    {"key": "parent.fees",              "label": "School Fees",         "role": "parent", "group": "Parent"},
    {"key": "parent.conferences",       "label": "Conferences",         "role": "parent", "group": "Parent"},
    {"key": "parent.chat",              "label": "Chat with Teachers",  "role": "parent", "group": "Parent"},

    # ── Accountant ─────────────────────────────────────────────────────
    {"key": "accountant.dashboard",     "label": "Dashboard",           "role": "accountant", "group": "Accountant", "always_on": True},
    {"key": "accountant.fees",          "label": "Fees",                "role": "accountant", "group": "Accountant"},
    {"key": "accountant.payments",      "label": "Payments",            "role": "accountant", "group": "Accountant"},
    {"key": "accountant.invoices",      "label": "Invoices",            "role": "accountant", "group": "Accountant"},
    {"key": "accountant.payroll",       "label": "Payroll",             "role": "accountant", "group": "Accountant"},
    {"key": "accountant.accounting",    "label": "Accounting",          "role": "accountant", "group": "Accountant"},
    {"key": "accountant.reports",       "label": "Reports",             "role": "accountant", "group": "Accountant"},

    # ── Librarian ──────────────────────────────────────────────────────
    {"key": "librarian.dashboard",      "label": "Dashboard",           "role": "librarian", "group": "Librarian", "always_on": True},
    {"key": "librarian.books",          "label": "Books",               "role": "librarian", "group": "Librarian"},
    {"key": "librarian.loans",          "label": "Loans",               "role": "librarian", "group": "Librarian"},

    # ── Security ───────────────────────────────────────────────────────
    {"key": "security.dashboard",       "label": "Dashboard",           "role": "security", "group": "Security", "always_on": True},
    {"key": "security.visitors",        "label": "Visitor Log",         "role": "security", "group": "Security"},
    {"key": "security.incidents",       "label": "Incidents",           "role": "security", "group": "Security"},
    {"key": "security.attendance",      "label": "Attendance",          "role": "security", "group": "Security"},

    # ── Cleaner ────────────────────────────────────────────────────────
    {"key": "cleaner.dashboard",        "label": "Dashboard",           "role": "cleaner", "group": "Cleaner", "always_on": True},
    {"key": "cleaner.tasks",            "label": "Tasks",               "role": "cleaner", "group": "Cleaner"},
    {"key": "cleaner.attendance",       "label": "Attendance",          "role": "cleaner", "group": "Cleaner"},

    # ── HR ─────────────────────────────────────────────────────────────
    {"key": "hr.dashboard",             "label": "Dashboard",           "role": "hr", "group": "HR", "always_on": True},
    {"key": "hr.students",              "label": "Students",            "role": "hr", "group": "HR"},
    {"key": "hr.past_students",         "label": "Past Students",       "role": "hr", "group": "HR"},
    {"key": "hr.teachers",              "label": "Teachers",            "role": "hr", "group": "HR"},
    {"key": "hr.parents",               "label": "Parents",             "role": "hr", "group": "HR"},
    {"key": "hr.parent_requests",       "label": "Parent Requests",     "role": "hr", "group": "HR"},
    {"key": "hr.staff",                 "label": "Staff",               "role": "hr", "group": "HR"},
    {"key": "hr.users",                 "label": "User Management",     "role": "hr", "group": "HR"},
    {"key": "hr.classes",               "label": "Classes",             "role": "hr", "group": "HR"},
    {"key": "hr.subjects",              "label": "Subjects",            "role": "hr", "group": "HR"},
    {"key": "hr.assessment_plans",      "label": "Assessment Plans",    "role": "hr", "group": "HR"},
    {"key": "hr.results",               "label": "Results",             "role": "hr", "group": "HR"},
    {"key": "hr.at_risk_students",      "label": "At-Risk Students",    "role": "hr", "group": "HR"},
    {"key": "hr.timetable",             "label": "Timetable",           "role": "hr", "group": "HR"},
    {"key": "hr.fees",                  "label": "Fees",                "role": "hr", "group": "HR"},
    {"key": "hr.invoices",              "label": "Invoices",            "role": "hr", "group": "HR"},
    {"key": "hr.payments",              "label": "Payments",            "role": "hr", "group": "HR"},
    {"key": "hr.reports",               "label": "Reports",             "role": "hr", "group": "HR"},
    {"key": "hr.payroll",               "label": "Payroll",             "role": "hr", "group": "HR"},
    {"key": "hr.accounting",            "label": "Accounting",          "role": "hr", "group": "HR"},
    {"key": "hr.leaves",                "label": "Leave Requests",      "role": "hr", "group": "HR"},
    {"key": "hr.attendance",            "label": "Attendance",          "role": "hr", "group": "HR"},
    {"key": "hr.meetings",              "label": "Meetings",            "role": "hr", "group": "HR"},
    {"key": "hr.boarding",              "label": "Boarding",            "role": "hr", "group": "HR"},
    {"key": "hr.visitor_logs",          "label": "Visitor Logs",        "role": "hr", "group": "HR"},
    {"key": "hr.incidents",             "label": "Incidents",           "role": "hr", "group": "HR"},
    {"key": "hr.cleaning",              "label": "Cleaning",            "role": "hr", "group": "HR"},
    {"key": "hr.discipline",            "label": "Discipline",          "role": "hr", "group": "HR"},
    {"key": "hr.promotions",            "label": "Promotions",          "role": "hr", "group": "HR"},
    {"key": "hr.suspensions",           "label": "Suspensions",         "role": "hr", "group": "HR"},
    {"key": "hr.activities",            "label": "Activities",          "role": "hr", "group": "HR"},
    {"key": "hr.library",               "label": "Library",             "role": "hr", "group": "HR"},
    {"key": "hr.health",                "label": "Health Records",      "role": "hr", "group": "HR"},
    {"key": "hr.complaints",            "label": "Complaints",          "role": "hr", "group": "HR"},
    {"key": "hr.announcements",         "label": "Announcements",       "role": "hr", "group": "HR"},
    {"key": "hr.extras",                "label": "Extras",              "role": "hr", "group": "HR"},
    {"key": "hr.analytics",             "label": "Analytics",           "role": "hr", "group": "HR"},
    {"key": "hr.audit_logs",            "label": "Audit Logs",          "role": "hr", "group": "HR"},
    {"key": "hr.report_config",         "label": "Report Config",       "role": "hr", "group": "HR"},
    {"key": "hr.customization",         "label": "Customization",       "role": "hr", "group": "HR", "always_on": True},
    {"key": "hr.settings",              "label": "Settings",            "role": "hr", "group": "HR", "always_on": True},
]

PAGE_KEYS = {p["key"] for p in PAGE_REGISTRY}
ALWAYS_ON_KEYS = {p["key"] for p in PAGE_REGISTRY if p.get("always_on")}


def validate_hidden_pages(keys):
    """Return the sanitized list: only known keys, never always-on keys."""
    if not isinstance(keys, list):
        return []
    out = []
    seen = set()
    for k in keys:
        if not isinstance(k, str):
            continue
        if k in PAGE_KEYS and k not in ALWAYS_ON_KEYS and k not in seen:
            out.append(k)
            seen.add(k)
    return out
