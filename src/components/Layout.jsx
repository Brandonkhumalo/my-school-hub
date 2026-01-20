import React from "react";
import { Outlet, NavLink, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  
  // Determine user role - ALWAYS use the authenticated user's role, not the path
  // This prevents showing admin menu when users visit 404 pages
  const role = user?.role || 'student';

  // Define role-based menu items
  const menuItems = {
    admin: [
      { path: '/admin', icon: 'fa-home', title: 'Dashboard' },
      { path: '/admin/students', icon: 'fa-user-graduate', title: 'Students' },
      { path: '/admin/teachers', icon: 'fa-chalkboard-teacher', title: 'Teachers' },
      { path: '/admin/parents', icon: 'fa-users', title: 'Parents' },
      { path: '/admin/parent-requests', icon: 'fa-link', title: 'Parent Link Requests' },
      { path: '/admin/classes', icon: 'fa-school', title: 'Classes' },
      { path: '/admin/timetable', icon: 'fa-calendar-alt', title: 'Timetable' },
      { path: '/admin/subjects', icon: 'fa-book', title: 'Subjects' },
      { path: '/admin/results', icon: 'fa-chart-bar', title: 'Results' },
      { path: '/admin/invoices', icon: 'fa-file-invoice', title: 'Invoices' },
      { path: '/admin/announcements', icon: 'fa-bullhorn', title: 'Announcements' },
      { path: '/admin/complaints', icon: 'fa-exclamation-circle', title: 'Complaints' },
      { path: '/admin/users', icon: 'fa-user-cog', title: 'User Management' },
    ],
    teacher: [
      { path: '/teacher', icon: 'fa-home', title: 'Dashboard' },
      { path: '/teacher/marks', icon: 'fa-pen-square', title: 'Add Marks' },
      { path: '/teacher/attendance', icon: 'fa-clipboard-check', title: 'Attendance' },
      { path: '/teacher/performance', icon: 'fa-chart-line', title: 'Performance' },
      { path: '/teacher/messages', icon: 'fa-comments', title: 'Messages' },
    ],
    student: [
      { path: '/student', icon: 'fa-home', title: 'Dashboard' },
      { path: '/student/profile', icon: 'fa-user', title: 'Profile' },
      { path: '/student/submissions', icon: 'fa-tasks', title: 'Submissions' },
      { path: '/student/marks', icon: 'fa-chart-line', title: 'Marks' },
      { path: '/student/calendar', icon: 'fa-calendar', title: 'School Calendar' },
      { path: '/student/timetable', icon: 'fa-clock', title: 'Timetable' },
      { path: '/student/teachers', icon: 'fa-chalkboard-teacher', title: 'Teachers' },
      { path: '/student/announcements', icon: 'fa-bullhorn', title: 'Announcements' },
    ],
    parent: [
      { path: '/parent', icon: 'fa-home', title: 'Dashboard' },
      { path: '/parent/children', icon: 'fa-child', title: 'My Children' },
      { path: '/parent/performance', icon: 'fa-chart-line', title: 'Performance' },
      { path: '/parent/messages', icon: 'fa-envelope', title: 'Weekly Messages' },
      { path: '/parent/fees', icon: 'fa-credit-card', title: 'School Fees' },
      { path: '/parent/chat', icon: 'fa-comments', title: 'Chat with Teachers' },
    ],
    accountant: [
      { path: '/accountant', icon: 'fa-home', title: 'Dashboard' },
    ],
    hr: [
      { path: '/hr', icon: 'fa-home', title: 'Dashboard' },
    ],
  };

  // Use the user's role menu items, never default to admin for security
  const items = menuItems[role] || menuItems.student;

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Fixed Sidebar */}
      <aside className="w-64 bg-blue-900 text-white fixed top-0 left-0 h-screen overflow-y-auto z-10">
        <div className="p-4">
          <div className="flex items-center justify-center mb-6">
            <i className="fas fa-school text-3xl mr-3"></i>
            <div>
              <h2 className="text-xl font-bold">School System</h2>
              <p className="text-sm text-blue-300 capitalize">{role}</p>
            </div>
          </div>

          <nav className="space-y-1">
            {items.map((item, index) => (
              <NavLink
                key={index}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded transition ${
                    isActive ? 'bg-blue-800 text-white' : 'text-blue-100 hover:bg-blue-800'
                  }`
                }
              >
                <i className={`fas ${item.icon} mr-3 w-5`}></i>
                {item.title}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 pt-6 border-t border-blue-800">
            {role !== 'parent' && (
              <Link
                to="/profile"
                className="flex items-center px-3 py-2 rounded text-blue-100 hover:bg-blue-800 transition mb-2"
              >
                <i className="fas fa-user-circle mr-3 w-5"></i>
                Profile
              </Link>
            )}
            <Link
              to="/logout"
              className="flex items-center px-3 py-2 rounded text-blue-100 hover:bg-blue-800 transition"
            >
              <i className="fas fa-sign-out-alt mr-3 w-5"></i>
              Logout
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content - with left margin to account for fixed sidebar */}
      <main className="flex-1 ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
