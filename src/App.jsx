import React from "react";
import { Routes, Route } from "react-router-dom";

// Layout
import Layout from "./components/Layout";

// Dashboards
import AdminDashboard from "./pages/admin/AdminDashboard";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import ParentDashboard from "./pages/parent/ParentDashboard";

// Admin Pages
import AdminStudents from "./pages/admin/AdminStudents";
import AdminTeachers from "./pages/admin/AdminTeachers";
import AdminParents from "./pages/admin/AdminParents";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminClasses from "./pages/admin/AdminClasses";
import AdminTimetable from "./pages/admin/AdminTimetable";
import AdminSubjects from "./pages/admin/AdminSubjects";
import AdminResults from "./pages/admin/AdminResults";
import AdminInvoices from "./pages/admin/AdminInvoices";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminComplaints from "./pages/admin/AdminComplaints";

// Auth Pages
import LoginPage from "./pages/auth/Login";
import Logout from "./pages/auth/Logout";

// 404
import NotFound from "./pages/notfound/NotFound";

function App() {
  return (
    <Routes>
      {/* Auth pages */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/logout" element={<Logout />} />

      {/* Protected pages */}
      <Route element={<Layout />}>
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<AdminStudents />} />
        <Route path="/admin/teachers" element={<AdminTeachers />} />
        <Route path="/admin/parents" element={<AdminParents />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/classes" element={<AdminClasses />} />
        <Route path="/admin/timetable" element={<AdminTimetable />} />
        <Route path="/admin/subjects" element={<AdminSubjects />} />
        <Route path="/admin/results" element={<AdminResults />} />
        <Route path="/admin/invoices" element={<AdminInvoices />} />
        <Route path="/admin/payments" element={<AdminPayments />} />
        <Route path="/admin/announcements" element={<AdminAnnouncements />} />
        <Route path="/admin/complaints" element={<AdminComplaints />} />

        {/* Other Role Dashboards */}
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/parent" element={<ParentDashboard />} />

        {/* Catch all */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
