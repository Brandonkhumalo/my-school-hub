import React from "react";
import { Routes, Route } from "react-router-dom";

// Landing Page
import Index from "./pages/Index";

// Layout
import Layout from "./components/Layout";

// Dashboards
import AdminDashboard from "./pages/admin/AdminDashboard";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import ParentDashboard from "./pages/parent/ParentDashboard";

// Teacher Pages
import TeacherMarks from "./pages/teacher/TeacherMarks";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";
import TeacherPerformance from "./pages/teacher/TeacherPerformance";

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

// Student Pages
import StudentProfile from "./pages/student/StudentProfile";
import StudentSubmissions from "./pages/student/StudentSubmissions";
import StudentMarks from "./pages/student/StudentMarks";
import StudentCalendar from "./pages/student/StudentCalendar";
import StudentTimetable from "./pages/student/StudentTimetable";
import StudentTeachers from "./pages/student/StudentTeachers";
import StudentAnnouncements from "./pages/student/StudentAnnouncements";

// Parent Pages
import ParentChildren from "./pages/parent/ParentChildren";
import ParentPerformance from "./pages/parent/ParentPerformance";
import ParentWeeklyMessages from "./pages/parent/ParentWeeklyMessages";
import ParentFees from "./pages/parent/ParentFees";

// Auth Pages
import LoginPage from "./pages/auth/Login";
import AdminLogin from "./pages/auth/AdminLogin";
import ParentRegister from "./pages/auth/ParentRegister";
import Logout from "./pages/auth/Logout";

// 404
import NotFound from "./pages/notfound/NotFound";

function App() {
  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<Index />} />
      
      {/* Auth pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/register/parent" element={<ParentRegister />} />
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

        {/* Teacher Routes */}
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/marks" element={<TeacherMarks />} />
        <Route path="/teacher/attendance" element={<TeacherAttendance />} />
        <Route path="/teacher/performance" element={<TeacherPerformance />} />

        {/* Student Routes */}
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/profile" element={<StudentProfile />} />
        <Route path="/student/submissions" element={<StudentSubmissions />} />
        <Route path="/student/marks" element={<StudentMarks />} />
        <Route path="/student/calendar" element={<StudentCalendar />} />
        <Route path="/student/timetable" element={<StudentTimetable />} />
        <Route path="/student/teachers" element={<StudentTeachers />} />
        <Route path="/student/announcements" element={<StudentAnnouncements />} />

        {/* Parent Routes */}
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/parent/children" element={<ParentChildren />} />
        <Route path="/parent/performance" element={<ParentPerformance />} />
        <Route path="/parent/messages" element={<ParentWeeklyMessages />} />
        <Route path="/parent/fees" element={<ParentFees />} />

        {/* Catch all */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
