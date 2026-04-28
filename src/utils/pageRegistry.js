// Maps each togglable page to its stable registry key.
// Must stay in sync with School_system/users/page_registry.py.

// Path → registry key. Paths not listed here are treated as always-on
// (dashboards, profile, logout, customization, settings, 2FA, /my/leaves).
export const PATH_TO_PAGE_KEY = {
  // Admin
  "/admin/students": "admin.students",
  "/admin/past-students": "admin.past_students",
  "/admin/teachers": "admin.teachers",
  "/admin/parents": "admin.parents",
  "/admin/parent-requests": "admin.parent_requests",
  "/admin/users": "admin.users",
  "/admin/classes": "admin.classes",
  "/admin/timetable": "admin.timetable",
  "/admin/subjects": "admin.subjects",
  "/admin/results": "admin.results",
  "/admin/assessment-plans": "admin.assessment_plans",
  "/admin/at-risk-students": "admin.at_risk_students",
  "/admin/invoices": "admin.invoices",
  "/admin/fees": "admin.fees",
  "/admin/payments": "admin.payments",
  "/admin/payroll": "admin.payroll",
  "/admin/accounting": "admin.accounting",
  "/admin/reports": "admin.reports",
  "/admin/announcements": "admin.announcements",
  "/admin/complaints": "admin.complaints",
  "/admin/boarding": "admin.boarding",
  "/admin/activities": "admin.activities",
  "/admin/library": "admin.library",
  "/admin/health": "admin.health",
  "/admin/discipline": "admin.discipline",
  "/admin/promotions": "admin.promotions",
  "/admin/suspensions": "admin.suspensions",
  "/admin/staff": "admin.staff",
  "/admin/permissions": "admin.permissions",
  "/admin/bulk-import": "admin.bulk_import",
  "/admin/extras": "admin.extras",
  "/admin/analytics": "admin.analytics",
  "/admin/audit-logs": "admin.audit_logs",
  "/admin/report-config": "admin.report_config",

  // Teacher
  "/teacher/marks": "teacher.marks",
  "/teacher/report-feedback": "teacher.report_feedback",
  "/teacher/attendance": "teacher.attendance",
  "/teacher/performance": "teacher.performance",
  "/teacher/homework": "teacher.homework",
  "/teacher/assignments": "teacher.assignments",
  "/teacher/past-papers": "teacher.past_papers",
  "/teacher/generate-tests": "teacher.generate_tests",
  "/teacher/test-results": "teacher.test_results",
  "/teacher/conferences": "teacher.conferences",
  "/teacher/messages": "teacher.messages",
  "/teacher/complaints": "teacher.complaints",

  // Student
  "/student/boarding": "student.boarding",
  "/student/submissions": "student.submissions",
  "/student/marks": "student.marks",
  "/student/results": "student.results",
  "/student/homework": "student.homework",
  "/student/assignments": "student.assignments",
  "/student/past-papers": "student.past_papers",
  "/student/tests": "student.tests",
  "/student/calendar": "student.calendar",
  "/student/timetable": "student.timetable",
  "/student/teachers": "student.teachers",
  "/student/announcements": "student.announcements",
  "/student/attendance": "student.attendance",
  "/student/activities": "student.activities",
  "/student/library": "student.library",

  // Parent
  "/parent/boarding": "parent.boarding",
  "/parent/children": "parent.children",
  "/parent/performance": "parent.performance",
  "/parent/homework": "parent.homework",
  "/parent/fees": "parent.fees",
  "/parent/conferences": "parent.conferences",
  "/parent/chat": "parent.chat",

  // Accountant
  "/accountant/fees": "accountant.fees",
  "/accountant/payments": "accountant.payments",
  "/accountant/invoices": "accountant.invoices",
  "/accountant/payroll": "accountant.payroll",
  "/accountant/accounting": "accountant.accounting",
  "/accountant/reports": "accountant.reports",

  // Librarian
  "/librarian/books": "librarian.books",
  "/librarian/loans": "librarian.loans",

  // Security
  "/security/visitors": "security.visitors",
  "/security/incidents": "security.incidents",
  "/security/attendance": "security.attendance",

  // Cleaner
  "/cleaner/tasks": "cleaner.tasks",
  "/cleaner/attendance": "cleaner.attendance",

  // HR
  "/hr/students": "hr.students",
  "/hr/past-students": "hr.past_students",
  "/hr/teachers": "hr.teachers",
  "/hr/parents": "hr.parents",
  "/hr/parent-requests": "hr.parent_requests",
  "/hr/staff": "hr.staff",
  "/hr/users": "hr.users",
  "/hr/classes": "hr.classes",
  "/hr/subjects": "hr.subjects",
  "/hr/assessment-plans": "hr.assessment_plans",
  "/hr/results": "hr.results",
  "/hr/at-risk-students": "hr.at_risk_students",
  "/hr/timetable": "hr.timetable",
  "/hr/fees": "hr.fees",
  "/hr/invoices": "hr.invoices",
  "/hr/payments": "hr.payments",
  "/hr/reports": "hr.reports",
  "/hr/payroll": "hr.payroll",
  "/hr/accounting": "hr.accounting",
  "/hr/leaves": "hr.leaves",
  "/hr/attendance": "hr.attendance",
  "/hr/meetings": "hr.meetings",
  "/hr/boarding": "hr.boarding",
  "/hr/visitor-logs": "hr.visitor_logs",
  "/hr/incidents": "hr.incidents",
  "/hr/cleaning": "hr.cleaning",
  "/hr/discipline": "hr.discipline",
  "/hr/promotions": "hr.promotions",
  "/hr/suspensions": "hr.suspensions",
  "/hr/activities": "hr.activities",
  "/hr/library": "hr.library",
  "/hr/health": "hr.health",
  "/hr/complaints": "hr.complaints",
  "/hr/announcements": "hr.announcements",
  "/hr/extras": "hr.extras",
  "/hr/analytics": "hr.analytics",
  "/hr/audit-logs": "hr.audit_logs",
  "/hr/report-config": "hr.report_config",
};

export function getPageKeyForPath(path) {
  if (!path) return null;
  if (PATH_TO_PAGE_KEY[path]) return PATH_TO_PAGE_KEY[path];
  // Fall back to longest-matching prefix (handles detail routes).
  const keys = Object.keys(PATH_TO_PAGE_KEY);
  let match = null;
  for (const p of keys) {
    if (path.startsWith(p + "/") && (!match || p.length > match.length)) {
      match = p;
    }
  }
  return match ? PATH_TO_PAGE_KEY[match] : null;
}

export function isPathHidden(path, hiddenPages) {
  if (!hiddenPages || hiddenPages.length === 0) return false;
  const key = getPageKeyForPath(path);
  if (!key) return false;
  return hiddenPages.includes(key);
}
