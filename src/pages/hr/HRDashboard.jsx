import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiService from "../../services/apiService";
import { formatDateTime } from "../../utils/dateFormat";

export default function HRDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiService.getHRDashboardStats()
      .then(setStats)
      .catch(() => setError("Failed to load dashboard stats"))
      .finally(() => setLoading(false));
  }, []);

  const schoolAccommodationType = stats?.school_accommodation_type || "day";
  const cards = stats ? [
    { label: "Total Students", value: stats.total_students, icon: "fa-user-graduate", color: "indigo" },
    ...(schoolAccommodationType !== "boarding"
      ? [{ label: "Day Students", value: stats.day_students ?? 0, icon: "fa-sun", color: "cyan" }]
      : []),
    ...(schoolAccommodationType !== "day"
      ? [{ label: "Boarding Students", value: stats.boarding_students ?? 0, icon: "fa-bed", color: "violet" }]
      : []),
    { label: "Total Staff", value: stats.total_staff, icon: "fa-users", color: "blue" },
    { label: "On Leave Today", value: stats.on_leave, icon: "fa-calendar-minus", color: "yellow" },
    { label: "Pending Leave Requests", value: stats.pending_leave_requests, icon: "fa-clock", color: "red" },
    { label: "Departments", value: stats.departments, icon: "fa-building", color: "green" },
  ] : [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">HR Dashboard</h1>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map((c) => (
              <div key={c.label} className={`bg-white rounded-lg shadow p-5 border-l-4 border-${c.color}-500`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{c.label}</p>
                    <p className="text-3xl font-bold text-gray-800">{c.value}</p>
                  </div>
                  <i className={`fas ${c.icon} text-3xl text-${c.color}-400`}></i>
                </div>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { to: "/hr/students", icon: "fa-user-graduate", label: "Students" },
              { to: "/hr/classes", icon: "fa-school", label: "Classes" },
              { to: "/hr/subjects", icon: "fa-book", label: "Subjects" },
              { to: "/hr/staff", icon: "fa-id-badge", label: "Manage Staff" },
              { to: "/hr/leaves", icon: "fa-calendar-minus", label: "Leave Requests" },
              { to: "/hr/invoices", icon: "fa-file-invoice", label: "Invoices" },
              { to: "/hr/payroll", icon: "fa-money-bill-wave", label: "Payroll" },
              { to: "/hr/attendance", icon: "fa-clipboard-check", label: "Attendance" },
              { to: "/hr/meetings", icon: "fa-handshake", label: "Meetings" },
            ].map((link) => (
              <Link key={link.to} to={link.to}
                className="bg-white rounded-lg shadow p-4 flex items-center gap-3 hover:bg-blue-50 transition">
                <i className={`fas ${link.icon} text-blue-500 text-xl`}></i>
                <span className="font-medium text-gray-700">{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Upcoming meetings */}
          {Array.isArray(stats?.upcoming_meetings) && stats.upcoming_meetings.length > 0 && (
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Upcoming Meetings</h2>
              <ul className="divide-y">
                {stats.upcoming_meetings.map((m) => (
                  <li key={m.id} className="py-2 flex justify-between text-sm">
                    <span className="font-medium text-gray-800">{m.title}</span>
                    <span className="text-gray-500">{formatDateTime(m.scheduled_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
