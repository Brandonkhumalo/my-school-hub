import React from "react";
import { Outlet, NavLink, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import NotificationBell from "./NotificationBell";
import { canStudentUseBoarding, isSchoolBoardingEnabled } from "../utils/boardingAccess";

// ── Sidebar menu definitions (unchanged logic) ────────────────────────────
const ALL_MENU_ITEMS = {
  admin: [
    // section → items
    { section: "OVERVIEW", items: [
      { path: "/admin", icon: "fa-home", title: "Dashboard" },
    ]},
    { section: "PEOPLE", items: [
      { path: "/admin/students",        icon: "fa-user-graduate",       title: "Students" },
      { path: "/admin/teachers",        icon: "fa-chalkboard-teacher",  title: "Teachers" },
      { path: "/admin/parents",         icon: "fa-users",               title: "Parents" },
      { path: "/admin/parent-requests", icon: "fa-link",                title: "Parent Requests" },
      { path: "/admin/users",           icon: "fa-user-cog",            title: "User Management" },
    ]},
    { section: "ACADEMICS", items: [
      { path: "/admin/classes",   icon: "fa-school",         title: "Classes" },
      { path: "/admin/timetable", icon: "fa-calendar-alt",  title: "Timetable" },
      { path: "/admin/subjects",  icon: "fa-book",           title: "Subjects" },
      { path: "/admin/results",   icon: "fa-chart-bar",      title: "Results" },
      { path: "/admin/assessment-plans", icon: "fa-clipboard-list", title: "Assessment Plans" },
      { path: "/admin/at-risk-students", icon: "fa-exclamation-triangle", title: "At-Risk Students" },
    ]},
    { section: "FINANCE", items: [
      { path: "/admin/invoices", icon: "fa-file-invoice", title: "Invoices" },
      { path: "/admin/fees",     icon: "fa-tags",          title: "Fees" },
      { path: "/admin/payments", icon: "fa-credit-card",   title: "Payments" },
      { path: "/admin/reports",  icon: "fa-chart-pie",     title: "Reports" },
    ]},
    { section: "COMMUNICATION", items: [
      { path: "/admin/announcements", icon: "fa-bullhorn",          title: "Announcements" },
      { path: "/admin/complaints",    icon: "fa-exclamation-circle", title: "Complaints" },
    ]},
    { section: "CAMPUS", items: [
      { path: "/admin/boarding",    icon: "fa-bed",            title: "Boarding",       boardingOnly: true },
      { path: "/admin/activities",  icon: "fa-running",        title: "Activities & Sports" },
      { path: "/admin/library",     icon: "fa-book-reader",    title: "Library" },
      { path: "/admin/health",      icon: "fa-heartbeat",      title: "Health Records" },
      { path: "/admin/discipline",  icon: "fa-gavel",          title: "Discipline" },
      { path: "/admin/promotions",  icon: "fa-graduation-cap", title: "Promotions" },
      { path: "/admin/suspensions", icon: "fa-ban",            title: "Suspensions" },
    ]},
    { section: "SYSTEM", items: [
      { path: "/admin/staff",         icon: "fa-id-badge",      title: "Staff / HR" },
      { path: "/admin/permissions",   icon: "fa-user-shield",   title: "Permissions" },
      { path: "/admin/extras",        icon: "fa-cogs",          title: "Extras" },
      { path: "/admin/analytics",     icon: "fa-chart-line",    title: "Analytics" },
      { path: "/admin/audit-logs",    icon: "fa-clipboard-list",title: "Audit Logs" },
      { path: "/admin/report-config", icon: "fa-file-pdf",      title: "Report Card Design" },
      { path: "/admin/settings",      icon: "fa-sliders-h",     title: "School Settings" },
    ]},
  ],
  teacher: [
    { section: null, items: [
      { path: "/teacher",              icon: "fa-home",             title: "Dashboard" },
      { path: "/teacher/marks",        icon: "fa-pen-square",       title: "Add Marks" },
      { path: "/teacher/report-feedback", icon: "fa-comment-dots",  title: "Report Feedback" },
      { path: "/teacher/attendance",   icon: "fa-clipboard-check",  title: "Attendance" },
      { path: "/teacher/performance",  icon: "fa-chart-line",       title: "Performance" },
      { path: "/teacher/homework",     icon: "fa-book-open",        title: "Homework" },
      { path: "/teacher/conferences",  icon: "fa-calendar-check",   title: "Conferences" },
      { path: "/teacher/messages",     icon: "fa-comments",         title: "Messages" },
      { path: "/teacher/complaints",   icon: "fa-exclamation-circle",title: "Complaints" },
    ]},
  ],
  student: [
    { section: null, items: [
      { path: "/student",               icon: "fa-home",               title: "Dashboard" },
      { path: "/student/boarding",      icon: "fa-bed",                title: "Boarding Life", boardingOnly: true, boardingStudentOnly: true },
      { path: "/student/profile",       icon: "fa-user",               title: "Profile" },
      { path: "/student/submissions",   icon: "fa-tasks",              title: "Submissions" },
      { path: "/student/marks",         icon: "fa-chart-line",         title: "Marks" },
      { path: "/student/homework",      icon: "fa-book-open",          title: "Homework" },
      { path: "/student/calendar",      icon: "fa-calendar",           title: "School Calendar" },
      { path: "/student/timetable",     icon: "fa-clock",              title: "Timetable" },
      { path: "/student/teachers",      icon: "fa-chalkboard-teacher", title: "Teachers" },
      { path: "/student/announcements", icon: "fa-bullhorn",           title: "Announcements" },
      { path: "/student/attendance",    icon: "fa-calendar-check",     title: "Attendance" },
      { path: "/student/activities",    icon: "fa-running",            title: "Activities" },
    ]},
  ],
  parent: [
    { section: null, items: [
      { path: "/parent",           icon: "fa-home",           title: "Dashboard" },
      { path: "/parent/boarding",  icon: "fa-bed",            title: "Boarding",           boardingOnly: true },
      { path: "/parent/children",  icon: "fa-child",          title: "My Children" },
      { path: "/parent/performance", icon: "fa-chart-line",   title: "Performance" },
      { path: "/parent/homework",  icon: "fa-book-open",      title: "Homework" },
      { path: "/parent/messages",  icon: "fa-envelope",       title: "Weekly Messages" },
      { path: "/parent/fees",      icon: "fa-credit-card",    title: "School Fees" },
      { path: "/parent/conferences", icon: "fa-calendar-check", title: "Conferences" },
      { path: "/parent/chat",      icon: "fa-comments",       title: "Chat with Teachers" },
    ]},
  ],
  accountant: [
    { section: null, items: [
      { path: "/accountant",          icon: "fa-home",         title: "Dashboard" },
      { path: "/accountant/fees",     icon: "fa-money-bill",   title: "Fees" },
      { path: "/accountant/payments", icon: "fa-credit-card",  title: "Payments" },
      { path: "/accountant/invoices", icon: "fa-file-invoice", title: "Invoices" },
      { path: "/accountant/reports",  icon: "fa-chart-bar",    title: "Reports" },
    ]},
  ],
  librarian: [
    { section: null, items: [
      { path: "/librarian",        icon: "fa-home",          title: "Dashboard" },
      { path: "/librarian/books",  icon: "fa-book",          title: "Books" },
      { path: "/librarian/loans",  icon: "fa-exchange-alt",  title: "Loans" },
    ]},
  ],
  security: [
    { section: null, items: [
      { path: "/security",            icon: "fa-home",              title: "Dashboard" },
      { path: "/security/visitors",   icon: "fa-id-card",           title: "Visitor Log" },
      { path: "/security/incidents",  icon: "fa-exclamation-triangle", title: "Incidents" },
      { path: "/security/attendance", icon: "fa-clipboard-check",   title: "Attendance" },
    ]},
  ],
  cleaner: [
    { section: null, items: [
      { path: "/cleaner",            icon: "fa-home",           title: "Dashboard" },
      { path: "/cleaner/tasks",      icon: "fa-broom",          title: "Tasks" },
      { path: "/cleaner/attendance", icon: "fa-clipboard-check",title: "Attendance" },
    ]},
  ],
  hr: [
    { section: "OVERVIEW", items: [
      { path: "/hr", icon: "fa-home", title: "Dashboard" },
    ]},
    { section: "PEOPLE", items: [
      { path: "/hr/students",    icon: "fa-user-graduate",    title: "Students" },
      { path: "/hr/teachers",    icon: "fa-chalkboard-teacher", title: "Teachers" },
      { path: "/hr/parents",     icon: "fa-users",            title: "Parents" },
      { path: "/hr/parent-requests", icon: "fa-link",         title: "Parent Requests" },
      { path: "/hr/staff",       icon: "fa-users",            title: "Staff" },
      { path: "/hr/users",       icon: "fa-user-cog",         title: "User Management" },
    ]},
    { section: "ACADEMICS", items: [
      { path: "/hr/classes",     icon: "fa-school",           title: "Classes" },
      { path: "/hr/subjects",    icon: "fa-book",             title: "Subjects" },
      { path: "/hr/assessment-plans", icon: "fa-clipboard-list", title: "Assessment Plans" },
      { path: "/hr/results",     icon: "fa-chart-bar",        title: "Results" },
      { path: "/hr/at-risk-students", icon: "fa-exclamation-triangle", title: "At-Risk Students" },
      { path: "/hr/timetable",   icon: "fa-calendar-alt",     title: "Timetable" },
    ]},
    { section: "FINANCE", items: [
      { path: "/hr/fees",        icon: "fa-tags",             title: "Fees" },
      { path: "/hr/invoices",    icon: "fa-file-invoice",     title: "Invoices" },
      { path: "/hr/payments",    icon: "fa-credit-card",      title: "Payments" },
      { path: "/hr/reports",     icon: "fa-chart-pie",        title: "Reports" },
      { path: "/hr/payroll",     icon: "fa-money-bill-wave",  title: "Payroll" },
    ]},
    { section: "HR OPS", items: [
      { path: "/hr/leaves",      icon: "fa-calendar-minus",   title: "Leave Requests" },
      { path: "/hr/attendance",  icon: "fa-clipboard-check",  title: "Attendance" },
      { path: "/hr/meetings",    icon: "fa-handshake",        title: "Meetings" },
    ]},
    { section: "CAMPUS", items: [
      { path: "/hr/boarding",      icon: "fa-bed",               title: "Boarding",  boardingOnly: true },
      { path: "/hr/visitor-logs",  icon: "fa-id-card",           title: "Visitor Logs" },
      { path: "/hr/incidents",     icon: "fa-exclamation-triangle", title: "Incidents" },
      { path: "/hr/cleaning",      icon: "fa-broom",             title: "Cleaning" },
      { path: "/hr/discipline",    icon: "fa-gavel",             title: "Discipline" },
      { path: "/hr/promotions",    icon: "fa-graduation-cap",    title: "Promotions" },
      { path: "/hr/suspensions",   icon: "fa-ban",               title: "Suspensions" },
      { path: "/hr/activities",    icon: "fa-running",           title: "Activities" },
      { path: "/hr/library",       icon: "fa-book-reader",       title: "Library" },
      { path: "/hr/health",        icon: "fa-heartbeat",         title: "Health Records" },
      { path: "/hr/complaints",    icon: "fa-exclamation-circle",title: "Complaints" },
      { path: "/hr/announcements", icon: "fa-bullhorn",          title: "Announcements" },
    ]},
    { section: "SYSTEM", items: [
      { path: "/admin/permissions", icon: "fa-user-shield",        title: "Permissions", requiresRootHrBoss: true },
      { path: "/hr/extras",        icon: "fa-cogs",              title: "Extras" },
      { path: "/hr/analytics",     icon: "fa-chart-line",        title: "Analytics" },
      { path: "/hr/audit-logs",    icon: "fa-clipboard-list",    title: "Audit Logs" },
      { path: "/hr/report-config", icon: "fa-file-pdf",          title: "Report Config" },
      { path: "/hr/settings",      icon: "fa-sliders-h",         title: "Settings" },
    ]},
  ],
};

// Role colour accents for the avatar badge
const ROLE_COLORS = {
  admin:     "bg-blue-600",
  teacher:   "bg-emerald-600",
  student:   "bg-amber-500",
  parent:    "bg-purple-600",
  accountant:"bg-teal-600",
  librarian: "bg-indigo-600",
  security:  "bg-red-600",
  cleaner:   "bg-orange-500",
  hr:        "bg-rose-600",
};

const HR_PATH_TO_PERMISSION_KEY = {
  "/hr": "dashboard",
  "/hr/students": "students",
  "/hr/teachers": "teachers",
  "/hr/parents": "parents",
  "/hr/parent-requests": "parent_requests",
  "/hr/users": "users",
  "/hr/staff": "staff",
  "/hr/classes": "classes",
  "/hr/subjects": "subjects",
  "/hr/assessment-plans": "results",
  "/hr/results": "results",
  "/hr/timetable": "timetable",
  "/hr/fees": "fees",
  "/hr/invoices": "invoices",
  "/hr/payments": "payments",
  "/hr/reports": "reports",
  "/hr/leaves": "leaves",
  "/hr/payroll": "payroll",
  "/hr/attendance": "attendance",
  "/hr/meetings": "meetings",
  "/hr/visitor-logs": "visitor_logs",
  "/hr/incidents": "incidents",
  "/hr/cleaning": "cleaning",
  "/hr/discipline": "discipline",
  "/hr/promotions": "promotions",
  "/hr/suspensions": "suspensions",
  "/hr/activities": "activities",
  "/hr/library": "library",
  "/hr/health": "health",
  "/hr/complaints": "complaints",
  "/hr/announcements": "announcements",
  "/hr/boarding": "boarding",
  "/hr/report-config": "report_config",
  "/hr/settings": "settings",
  "/hr/analytics": "analytics",
  "/hr/audit-logs": "audit_logs",
  "/hr/at-risk-students": "at_risk_students",
  "/hr/extras": "extras",
};

// ── Helper to get initials ────────────────────────────────────────────────
function getInitials(user) {
  const first = user?.first_name?.[0] || "";
  const last  = user?.last_name?.[0]  || "";
  return (first + last).toUpperCase() || "U";
}

// ── Page title from path ──────────────────────────────────────────────────
function getPageTitle(pathname) {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length === 0) return "Home";
  const last = seg[seg.length - 1];
  return last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Main Layout ───────────────────────────────────────────────────────────
function Layout() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const role = user?.role || "student";
  const boardingEnabled = isSchoolBoardingEnabled(user);
  const { canStudentUseBoarding: studentBoarding } = { canStudentUseBoarding: canStudentUseBoarding(user) };
  const isRootHrBoss = Boolean(role === "hr" && user?.hr_is_root_boss);
  const hrPagePermissions = user?.hr_page_permissions || {};

  const sections = (ALL_MENU_ITEMS[role] || ALL_MENU_ITEMS.student).map((sec) => ({
    ...sec,
    items: sec.items.filter((item) => {
      if (item.boardingOnly && !boardingEnabled) return false;
      if (item.boardingStudentOnly && !studentBoarding) return false;
      if (item.requiresRootHrBoss && !isRootHrBoss) return false;
      if (role === "hr" && !isRootHrBoss) {
        const permissionKey = HR_PATH_TO_PERMISSION_KEY[item.path];
        if (!permissionKey) return false;
        const grant = hrPagePermissions?.[permissionKey];
        const canRead = Boolean(grant?.read || grant?.write);
        if (!canRead) return false;
      }
      return true;
    }),
  })).filter((sec) => sec.items.length > 0);

  const pageTitle = getPageTitle(location.pathname);
  const initials  = getInitials(user);
  const roleColor = ROLE_COLORS[role] || "bg-blue-600";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-primary)" }}>

      {/* ── MOBILE OVERLAY ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── SIDEBAR ────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 256,
          background: "var(--sidebar-bg)",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          overflowY: "auto",
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          transform: mobileOpen ? "translateX(0)" : undefined,
          transition: "transform 0.3s ease",
        }}
        className={mobileOpen ? "" : "max-md:-translate-x-full"}
      >
        {/* Brand block */}
        <div style={{ padding: "1.5rem 1.25rem 1rem", borderBottom: "1px solid var(--sidebar-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-graduation-cap text-white text-base" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">MySchoolHub</p>
              <p className="text-xs mt-0.5">
                <span className={`inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-semibold capitalize ${roleColor}`}>
                  {role} Portal
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {sections.map((sec, si) => (
            <div key={si}>
              {sec.section && (
                <p className="sidebar-section-label">{sec.section}</p>
              )}
              {sec.items.map((item, ii) => (
                <NavLink
                  key={ii}
                  to={item.path}
                  end={item.path === `/${role}`}
                  className={({ isActive }) =>
                    `sidebar-nav-link${isActive ? " active" : ""}`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  <i className={`fas ${item.icon} w-4 text-center flex-shrink-0`} />
                  <span className="truncate">{item.title}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "0.75rem 0.75rem 1rem", borderTop: "1px solid var(--sidebar-border)" }}>
          <Link
            to={`/${role}/profile`}
            className="sidebar-nav-link mb-1"
            onClick={() => setMobileOpen(false)}
          >
            <i className="fas fa-user-circle w-4 text-center flex-shrink-0" />
            <span className="truncate">Profile</span>
          </Link>
          <Link
            to="/logout"
            className="sidebar-nav-link"
            onClick={() => setMobileOpen(false)}
          >
            <i className="fas fa-sign-out-alt w-4 text-center flex-shrink-0" />
            <span className="truncate">Logout</span>
          </Link>
        </div>
      </aside>

      {/* ── MAIN COLUMN ────────────────────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: 256, display: "flex", flexDirection: "column", minHeight: "100vh" }}
           className="max-md:ml-0">

        {/* ── TOP NAVBAR ───────────────────────────────────────────── */}
        <header
          style={{
            height: 64,
            background: "var(--navbar-bg)",
            borderBottom: "1px solid var(--navbar-border)",
            boxShadow: "var(--shadow)",
            position: "sticky",
            top: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1.5rem",
          }}
        >
          {/* Left: hamburger + title */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <i className="fas fa-bars" style={{ color: "var(--text-muted)" }} />
            </button>
            <div>
              <h1
                className="text-base font-semibold leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {pageTitle}
              </h1>
              <p className="text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>
                {role.charAt(0).toUpperCase() + role.slice(1)} Portal
              </p>
            </div>
          </div>

          {/* Right: theme toggle + bell + avatar */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid var(--border)",
                background: "var(--bg-surface2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              className="hover:scale-110"
            >
              {theme === "dark" ? (
                <i className="fas fa-sun" style={{ color: "#fbbf24", fontSize: 14 }} />
              ) : (
                <i className="fas fa-moon" style={{ color: "#6366f1", fontSize: 14 }} />
              )}
            </button>

            {/* Notification bell */}
            <NotificationBell />

            {/* Vertical divider */}
            <div style={{ width: 1, height: 28, background: "var(--border)", margin: "0 4px" }} />

            {/* User avatar */}
            <div className="flex items-center gap-2">
              <div
                className={`w-9 h-9 rounded-full ${roleColor} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
              >
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold leading-tight truncate max-w-[120px]"
                   style={{ color: "var(--text-primary)" }}>
                  {user?.full_name || user?.first_name || "User"}
                </p>
                <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                  {role}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ── PAGE CONTENT ─────────────────────────────────────────── */}
        <main style={{ flex: 1, padding: "1.5rem" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
