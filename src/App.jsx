import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

// Layout (loaded eagerly — always needed for the authenticated shell)
import Layout from "./components/Layout";

// Loading fallback shown while lazy chunks download
const PageLoader = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
    <div>Loading...</div>
  </div>
);

// Landing Pages
const Index = lazy(() => import("./pages/Index"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const ContactUs = lazy(() => import("./pages/ContactUs"));

// Auth Pages
const LoginPage = lazy(() => import("./pages/auth/Login"));
const AdminLogin = lazy(() => import("./pages/auth/AdminLogin"));
const ParentRegister = lazy(() => import("./pages/auth/ParentRegister"));
const Logout = lazy(() => import("./pages/auth/Logout"));

// Tishanyq Admin Pages
const TishanyqLogin = lazy(() => import("./pages/tishanyq/TishanyqLogin"));
const TishanyqRegister = lazy(() => import("./pages/tishanyq/TishanyqRegister"));
const TishanyqDashboard = lazy(() => import("./pages/tishanyq/TishanyqDashboard"));
const TishanyqHome = lazy(() => import("./pages/tishanyq/TishanyqHome"));
const CreateSchool = lazy(() => import("./pages/tishanyq/CreateSchool"));
const SchoolsList = lazy(() => import("./pages/tishanyq/SchoolsList"));

// Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminStudents = lazy(() => import("./pages/admin/AdminStudents"));
const AdminTeachers = lazy(() => import("./pages/admin/AdminTeachers"));
const AdminParents = lazy(() => import("./pages/admin/AdminParents"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminClasses = lazy(() => import("./pages/admin/AdminClasses"));
const AdminTimetable = lazy(() => import("./pages/admin/AdminTimetable"));
const AdminSubjects = lazy(() => import("./pages/admin/AdminSubjects"));
const AdminResults = lazy(() => import("./pages/admin/AdminResults"));
const AdminInvoices = lazy(() => import("./pages/admin/AdminInvoices"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminComplaints = lazy(() => import("./pages/admin/AdminComplaints"));
const AdminParentLinkRequests = lazy(() => import("./pages/admin/AdminParentLinkRequests"));
const AdminExtras = lazy(() => import("./pages/admin/AdminExtras"));

// Teacher Pages
const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard"));
const TeacherMarks = lazy(() => import("./pages/teacher/TeacherMarks"));
const TeacherAttendance = lazy(() => import("./pages/teacher/TeacherAttendance"));
const TeacherPerformance = lazy(() => import("./pages/teacher/TeacherPerformance"));
const TeacherMessages = lazy(() => import("./pages/teacher/TeacherMessages"));
const TeacherHomework = lazy(() => import("./pages/teacher/TeacherHomework"));

// Student Pages
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const StudentProfile = lazy(() => import("./pages/student/StudentProfile"));
const StudentSubmissions = lazy(() => import("./pages/student/StudentSubmissions"));
const StudentMarks = lazy(() => import("./pages/student/StudentMarks"));
const StudentHomework = lazy(() => import("./pages/student/StudentHomework"));
const StudentCalendar = lazy(() => import("./pages/student/StudentCalendar"));
const StudentTimetable = lazy(() => import("./pages/student/StudentTimetable"));
const StudentTeachers = lazy(() => import("./pages/student/StudentTeachers"));
const StudentAnnouncements = lazy(() => import("./pages/student/StudentAnnouncements"));

// Parent Pages
const ParentDashboard = lazy(() => import("./pages/parent/ParentDashboard"));
const ParentChildren = lazy(() => import("./pages/parent/ParentChildren"));
const ParentPerformance = lazy(() => import("./pages/parent/ParentPerformance"));
const ParentWeeklyMessages = lazy(() => import("./pages/parent/ParentWeeklyMessages"));
const ParentFees = lazy(() => import("./pages/parent/ParentFees"));
const ParentMessages = lazy(() => import("./pages/parent/ParentMessages"));
const ParentHomework = lazy(() => import("./pages/parent/ParentHomework"));

// HR / Staff Pages
const HRDashboard = lazy(() => import("./pages/hr/HRDashboard"));
const HRStaff = lazy(() => import("./pages/hr/HRStaff"));
const HRLeaves = lazy(() => import("./pages/hr/HRLeaves"));
const HRPayroll = lazy(() => import("./pages/hr/HRPayroll"));
const HRAttendance = lazy(() => import("./pages/hr/HRAttendance"));
const HRMeetings = lazy(() => import("./pages/hr/HRMeetings"));

// New Admin Pages
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

// New Student Pages
const StudentAttendance = lazy(() => import("./pages/student/StudentAttendance"));

// Payment Return Pages
const PaymentSuccess = lazy(() => import("./pages/payment/PaymentSuccess"));
const PaymentFailed = lazy(() => import("./pages/payment/PaymentFailed"));

// 404
const NotFound = lazy(() => import("./pages/notfound/NotFound"));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
      {/* Landing page */}
      <Route path="/" element={<Index />} />
      <Route path="/about" element={<AboutUs />} />
      <Route path="/contact" element={<ContactUs />} />
      
      {/* Auth pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/register/parent" element={<ParentRegister />} />
      <Route path="/logout" element={<Logout />} />

      {/* Payment return pages — no auth required (PayNow redirects here) */}
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/failed" element={<PaymentFailed />} />

      {/* Tishanyq Admin Portal */}
      <Route path="/tishanyq/admin/login" element={<TishanyqLogin />} />
      <Route path="/tishanyq/admin/register" element={<TishanyqRegister />} />
      <Route path="/tishanyq/admin" element={<TishanyqDashboard />}>
        <Route path="dashboard" element={<TishanyqHome />} />
        <Route path="create-school" element={<CreateSchool />} />
        <Route path="schools" element={<SchoolsList />} />
      </Route>

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
        <Route path="/admin/parent-requests" element={<AdminParentLinkRequests />} />
        <Route path="/admin/extras" element={<AdminExtras />} />
        <Route path="/admin/staff" element={<AdminStaff />} />
        <Route path="/admin/settings" element={<AdminSettings />} />

        {/* Teacher Routes */}
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/marks" element={<TeacherMarks />} />
        <Route path="/teacher/attendance" element={<TeacherAttendance />} />
        <Route path="/teacher/performance" element={<TeacherPerformance />} />
        <Route path="/teacher/homework" element={<TeacherHomework />} />
        <Route path="/teacher/messages" element={<TeacherMessages />} />

        {/* Student Routes */}
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/profile" element={<StudentProfile />} />
        <Route path="/student/submissions" element={<StudentSubmissions />} />
        <Route path="/student/marks" element={<StudentMarks />} />
        <Route path="/student/homework" element={<StudentHomework />} />
        <Route path="/student/calendar" element={<StudentCalendar />} />
        <Route path="/student/timetable" element={<StudentTimetable />} />
        <Route path="/student/teachers" element={<StudentTeachers />} />
        <Route path="/student/announcements" element={<StudentAnnouncements />} />
        <Route path="/student/attendance" element={<StudentAttendance />} />

        {/* Parent Routes */}
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/parent/children" element={<ParentChildren />} />
        <Route path="/parent/performance" element={<ParentPerformance />} />
        <Route path="/parent/homework" element={<ParentHomework />} />
        <Route path="/parent/messages" element={<ParentWeeklyMessages />} />
        <Route path="/parent/fees" element={<ParentFees />} />
        <Route path="/parent/chat" element={<ParentMessages />} />

        {/* HR / Staff Routes */}
        <Route path="/hr" element={<HRDashboard />} />
        <Route path="/hr/staff" element={<HRStaff />} />
        <Route path="/hr/leaves" element={<HRLeaves />} />
        <Route path="/hr/payroll" element={<HRPayroll />} />
        <Route path="/hr/attendance" element={<HRAttendance />} />
        <Route path="/hr/meetings" element={<HRMeetings />} />

        {/* Catch all */}
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
