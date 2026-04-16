import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import DashboardCard from "../../components/DashboardCard";
import apiService from "../../services/apiService";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentClasses, setRecentClasses] = useState([]);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, classesData] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.fetchClasses(),
      ]);
      setStats(statsData);
      setRecentClasses(classesData.slice(0, 5));
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;

  // ── Quick Actions ────────────────────────────────────────────
  const quickActions = [
    { to: "/admin/students",  icon: "fa-user-plus",      label: "Add Student",      sub: "Register new student",  accent: "#3b82f6", bg: "#eff6ff" },
    { to: "/admin/teachers",  icon: "fa-user-tie",       label: "Add Teacher",      sub: "Add new teacher",        accent: "#22c55e", bg: "#f0fdf4" },
    { to: "/admin/users",     icon: "fa-user-friends",   label: "Add Parent",       sub: "Register parent",        accent: "#a855f7", bg: "#faf5ff" },
    { to: "/admin/classes",   icon: "fa-school",         label: "Manage Classes",   sub: "View & edit classes",    accent: "#f97316", bg: "#fff7ed" },
    { to: "/admin/timetable", icon: "fa-calendar-alt",   label: "Timetable",        sub: "Manage class schedules", accent: "#14b8a6", bg: "#f0fdfa" },
    { to: "/admin/results",   icon: "fa-chart-bar",      label: "Results",          sub: "View student results",   accent: "#ef4444", bg: "#fef2f2" },
  ];

  // ── Management Links ─────────────────────────────────────────
  const mgmtLinks = [
    { to: "/admin/students",  icon: "fa-user-graduate",      label: "View All Students",  color: "#3b82f6" },
    { to: "/admin/teachers",  icon: "fa-chalkboard-teacher", label: "View All Teachers",  color: "#22c55e" },
    { to: "/admin/users",     icon: "fa-users",              label: "View All Parents",   color: "#a855f7" },
    { to: "/admin/timetable", icon: "fa-calendar-alt",       label: "Class Schedules",    color: "#f97316" },
    { to: "/admin/results",   icon: "fa-chart-bar",          label: "Class Performance",  color: "#ef4444" },
    { to: "/admin/payments",  icon: "fa-credit-card",        label: "Fee Payments",       color: "#22c55e" },
  ];

  return (
    <div>
      <Header title="Admin Dashboard" subtitle={`Welcome back, ${user?.full_name || user?.first_name || "Admin"}`} />

      {/* ── Stat Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-7">
        <DashboardCard
          title="Total Students"
          value={stats?.total_students ?? 0}
          icon="fas fa-user-graduate"
          gradient="from-blue-500 to-blue-700"
        />
        <DashboardCard
          title="Total Teachers"
          value={stats?.total_teachers ?? 0}
          icon="fas fa-chalkboard-teacher"
          gradient="from-emerald-500 to-emerald-700"
        />
        <DashboardCard
          title="Total Parents"
          value={stats?.total_parents ?? 0}
          icon="fas fa-users"
          gradient="from-purple-500 to-purple-700"
        />
        <DashboardCard
          title="Total Classes"
          value={stats?.total_classes ?? 0}
          icon="fas fa-school"
          gradient="from-orange-500 to-orange-700"
        />
      </div>

      {/* ── Row 2: Quick Actions + Financial ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">

        {/* Quick Actions */}
        <div
          className="portal-card p-6"
          style={{ borderRadius: "1rem" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((qa) => (
              <Link
                key={qa.to}
                to={qa.to}
                className="flex items-center gap-3 p-3.5 rounded-xl transition hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  background: qa.bg,
                  border: `1px solid ${qa.accent}22`,
                  textDecoration: "none",
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${qa.accent}20` }}
                >
                  <i className={`fas ${qa.icon} text-sm`} style={{ color: qa.accent }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#0f172a" }}>{qa.label}</p>
                  <p className="text-xs truncate" style={{ color: "#64748b" }}>{qa.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Financial Overview */}
        <div
          className="portal-card p-6"
          style={{ borderRadius: "1rem" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Financial Overview
          </p>
          <div className="space-y-3 mb-5">
            {/* Total Revenue */}
            <div
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <i className="fas fa-money-bill-wave text-emerald-600 text-sm" />
                </span>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Total Revenue</span>
              </div>
              <span className="font-bold text-emerald-600 text-base">
                ${stats?.total_revenue?.toLocaleString() || "0"}
              </span>
            </div>

            {/* Pending Invoices */}
            <div
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <i className="fas fa-file-invoice text-orange-500 text-sm" />
                </span>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Pending Invoices</span>
              </div>
              <span className="font-bold text-orange-500 text-base">
                {stats?.pending_invoices || 0}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/admin/payments"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", textDecoration: "none" }}
            >
              <i className="fas fa-credit-card text-xs" /> Payments
            </Link>
            <Link
              to="/admin/invoices"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", textDecoration: "none" }}
            >
              <i className="fas fa-file-invoice text-xs" /> Invoices
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 3: Recent Classes + Management Links ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent Classes */}
        <div
          className="portal-card p-6"
          style={{ borderRadius: "1rem" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Recent Classes
            </p>
            <Link to="/admin/classes" className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition">
              View All →
            </Link>
          </div>
          <div className="space-y-2">
            {recentClasses.length > 0 ? recentClasses.map((cls) => (
              <div
                key={cls.id}
                className="flex items-center justify-between p-3 rounded-xl transition hover:opacity-80"
                style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                    <i className="fas fa-chalkboard text-white text-sm" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{cls.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {cls.student_count || 0} students
                    </p>
                  </div>
                </div>
                <Link to="/admin/classes" style={{ color: "var(--text-muted)" }} className="hover:text-blue-500 transition">
                  <i className="fas fa-arrow-right text-sm" />
                </Link>
              </div>
            )) : (
              <div className="text-center py-8">
                <i className="fas fa-chalkboard text-3xl mb-3" style={{ color: "var(--border)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No classes yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Management Links */}
        <div
          className="portal-card p-6"
          style={{ borderRadius: "1rem" }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            Management Links
          </p>
          <div className="space-y-2">
            {mgmtLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center justify-between p-3.5 rounded-xl transition hover:-translate-x-0.5"
                style={{
                  background: "var(--bg-surface2)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                }}
              >
                <div className="flex items-center gap-3">
                  <i className={`fas ${link.icon} text-sm w-5 text-center`} style={{ color: link.color }} />
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{link.label}</span>
                </div>
                <i className="fas fa-chevron-right text-xs" style={{ color: "var(--text-muted)" }} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
