import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";

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
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminReportConfig = lazy(() => import("./pages/admin/AdminReportConfig"));
const AdminFees = lazy(() => import("./pages/admin/AdminFees"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSuspensions = lazy(() => import("./pages/admin/AdminSuspensions"));
const AdminPromotions = lazy(() => import("./pages/admin/AdminPromotions"));
const AdminActivities = lazy(() => import("./pages/admin/AdminActivities"));
const AdminLibrary = lazy(() => import("./pages/admin/AdminLibrary"));
const AdminHealth = lazy(() => import("./pages/admin/AdminHealth"));

const AdminDiscipline = lazy(() => import("./pages/admin/AdminDiscipline"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));

// Teacher Pages
const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard"));
const TeacherMarks = lazy(() => import("./pages/teacher/TeacherMarks"));
const TeacherAttendance = lazy(() => import("./pages/teacher/TeacherAttendance"));
const TeacherPerformance = lazy(() => import("./pages/teacher/TeacherPerformance"));
const TeacherMessages = lazy(() => import("./pages/teacher/TeacherMessages"));
const TeacherHomework = lazy(() => import("./pages/teacher/TeacherHomework"));
const TeacherResults = lazy(() => import("./pages/teacher/TeacherResults"));
const TeacherStudents = lazy(() => import("./pages/teacher/TeacherStudents"));
const TeacherClasses = lazy(() => import("./pages/teacher/TeacherClasses"));
const TeacherConferences = lazy(() => import("./pages/teacher/TeacherConferences"));

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
const StudentAttendance = lazy(() => import("./pages/student/StudentAttendance"));
const StudentResults = lazy(() => import("./pages/student/StudentResults"));
const StudentFeeSummary = lazy(() => import("./pages/student/StudentFeeSummary"));
const StudentActivities = lazy(() => import("./pages/student/StudentActivities"));

// Parent Pages
const ParentDashboard = lazy(() => import("./pages/parent/ParentDashboard"));
const ParentChildren = lazy(() => import("./pages/parent/ParentChildren"));
const ParentPerformance = lazy(() => import("./pages/parent/ParentPerformance"));
const ParentWeeklyMessages = lazy(() => import("./pages/parent/ParentWeeklyMessages"));
const ParentFees = lazy(() => import("./pages/parent/ParentFees"));
const ParentMessages = lazy(() => import("./pages/parent/ParentMessages"));
const ParentHomework = lazy(() => import("./pages/parent/ParentHomework"));
const ParentResults = lazy(() => import("./pages/parent/ParentResults"));
const ParentFeeSummary = lazy(() => import("./pages/parent/ParentFeeSummary"));
const ParentConferences = lazy(() => import("./pages/parent/ParentConferences"));

// HR / Staff Pages
const HRDashboard = lazy(() => import("./pages/hr/HRDashboard"));
const HRStaff = lazy(() => import("./pages/hr/HRStaff"));
const HRLeaves = lazy(() => import("./pages/hr/HRLeaves"));
const HRPayroll = lazy(() => import("./pages/hr/HRPayroll"));
const HRAttendance = lazy(() => import("./pages/hr/HRAttendance"));
const HRMeetings = lazy(() => import("./pages/hr/HRMeetings"));

// Shared Profile Page
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage"));

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
        <Route path="/admin" element={<RequireAuth allowedRoles={['admin']}><AdminDashboard /></RequireAuth>} />
        <Route path="/admin/students" element={<RequireAuth allowedRoles={['admin']}><AdminStudents /></RequireAuth>} />
        <Route path="/admin/teachers" element={<RequireAuth allowedRoles={['admin']}><AdminTeachers /></RequireAuth>} />
        <Route path="/admin/parents" element={<RequireAuth allowedRoles={['admin']}><AdminParents /></RequireAuth>} />
        <Route path="/admin/users" element={<RequireAuth allowedRoles={['admin']}><AdminUsers /></RequireAuth>} />
        <Route path="/admin/classes" element={<RequireAuth allowedRoles={['admin']}><AdminClasses /></RequireAuth>} />
        <Route path="/admin/timetable" element={<RequireAuth allowedRoles={['admin']}><AdminTimetable /></RequireAuth>} />
        <Route path="/admin/subjects" element={<RequireAuth allowedRoles={['admin']}><AdminSubjects /></RequireAuth>} />
        <Route path="/admin/results" element={<RequireAuth allowedRoles={['admin']}><AdminResults /></RequireAuth>} />
        <Route path="/admin/invoices" element={<RequireAuth allowedRoles={['admin']}><AdminInvoices /></RequireAuth>} />
        <Route path="/admin/payments" element={<RequireAuth allowedRoles={['admin']}><AdminPayments /></RequireAuth>} />
        <Route path="/admin/announcements" element={<RequireAuth allowedRoles={['admin']}><AdminAnnouncements /></RequireAuth>} />
        <Route path="/admin/complaints" element={<RequireAuth allowedRoles={['admin']}><AdminComplaints /></RequireAuth>} />
        <Route path="/admin/parent-requests" element={<RequireAuth allowedRoles={['admin']}><AdminParentLinkRequests /></RequireAuth>} />
        <Route path="/admin/extras" element={<RequireAuth allowedRoles={['admin']}><AdminExtras /></RequireAuth>} />
        <Route path="/admin/staff" element={<RequireAuth allowedRoles={['admin']}><AdminStaff /></RequireAuth>} />
        <Route path="/admin/settings" element={<RequireAuth allowedRoles={['admin']}><AdminSettings /></RequireAuth>} />
        <Route path="/admin/report-config" element={<RequireAuth allowedRoles={['admin']}><AdminReportConfig /></RequireAuth>} />
        <Route path="/admin/fees" element={<RequireAuth allowedRoles={['admin']}><AdminFees /></RequireAuth>} />
        <Route path="/admin/reports" element={<RequireAuth allowedRoles={['admin']}><AdminReports /></RequireAuth>} />
        <Route path="/admin/suspensions" element={<RequireAuth allowedRoles={['admin']}><AdminSuspensions /></RequireAuth>} />
        <Route path="/admin/promotions" element={<RequireAuth allowedRoles={['admin']}><AdminPromotions /></RequireAuth>} />
        <Route path="/admin/activities" element={<RequireAuth allowedRoles={['admin']}><AdminActivities /></RequireAuth>} />
        <Route path="/admin/library" element={<RequireAuth allowedRoles={['admin']}><AdminLibrary /></RequireAuth>} />
        <Route path="/admin/health" element={<RequireAuth allowedRoles={['admin']}><AdminHealth /></RequireAuth>} />
        <Route path="/admin/discipline" element={<RequireAuth allowedRoles={['admin']}><AdminDiscipline /></RequireAuth>} />
        <Route path="/admin/analytics" element={<RequireAuth allowedRoles={['admin']}><AdminAnalytics /></RequireAuth>} />
        <Route path="/admin/profile" element={<RequireAuth allowedRoles={['admin']}><ProfilePage /></RequireAuth>} />

        {/* Teacher Routes */}
        <Route path="/teacher" element={<RequireAuth allowedRoles={['teacher']}><TeacherDashboard /></RequireAuth>} />
        <Route path="/teacher/marks" element={<RequireAuth allowedRoles={['teacher']}><TeacherMarks /></RequireAuth>} />
        <Route path="/teacher/attendance" element={<RequireAuth allowedRoles={['teacher']}><TeacherAttendance /></RequireAuth>} />
        <Route path="/teacher/performance" element={<RequireAuth allowedRoles={['teacher']}><TeacherPerformance /></RequireAuth>} />
        <Route path="/teacher/homework" element={<RequireAuth allowedRoles={['teacher']}><TeacherHomework /></RequireAuth>} />
        <Route path="/teacher/messages" element={<RequireAuth allowedRoles={['teacher']}><TeacherMessages /></RequireAuth>} />
        <Route path="/teacher/results" element={<RequireAuth allowedRoles={['teacher']}><TeacherResults /></RequireAuth>} />
        <Route path="/teacher/students" element={<RequireAuth allowedRoles={['teacher']}><TeacherStudents /></RequireAuth>} />
        <Route path="/teacher/classes" element={<RequireAuth allowedRoles={['teacher']}><TeacherClasses /></RequireAuth>} />
        <Route path="/teacher/conferences" element={<RequireAuth allowedRoles={['teacher']}><TeacherConferences /></RequireAuth>} />
        <Route path="/teacher/profile" element={<RequireAuth allowedRoles={['teacher']}><ProfilePage /></RequireAuth>} />

        {/* Student Routes */}
        <Route path="/student" element={<RequireAuth allowedRoles={['student']}><StudentDashboard /></RequireAuth>} />
        <Route path="/student/profile" element={<RequireAuth allowedRoles={['student']}><StudentProfile /></RequireAuth>} />
        <Route path="/student/submissions" element={<RequireAuth allowedRoles={['student']}><StudentSubmissions /></RequireAuth>} />
        <Route path="/student/marks" element={<RequireAuth allowedRoles={['student']}><StudentMarks /></RequireAuth>} />
        <Route path="/student/homework" element={<RequireAuth allowedRoles={['student']}><StudentHomework /></RequireAuth>} />
        <Route path="/student/calendar" element={<RequireAuth allowedRoles={['student']}><StudentCalendar /></RequireAuth>} />
        <Route path="/student/timetable" element={<RequireAuth allowedRoles={['student']}><StudentTimetable /></RequireAuth>} />
        <Route path="/student/teachers" element={<RequireAuth allowedRoles={['student']}><StudentTeachers /></RequireAuth>} />
        <Route path="/student/announcements" element={<RequireAuth allowedRoles={['student']}><StudentAnnouncements /></RequireAuth>} />
        <Route path="/student/attendance" element={<RequireAuth allowedRoles={['student']}><StudentAttendance /></RequireAuth>} />
        <Route path="/student/results" element={<RequireAuth allowedRoles={['student']}><StudentResults /></RequireAuth>} />
        <Route path="/student/fees" element={<RequireAuth allowedRoles={['student']}><StudentFeeSummary /></RequireAuth>} />
        <Route path="/student/activities" element={<RequireAuth allowedRoles={['student']}><StudentActivities /></RequireAuth>} />

        {/* Parent Routes */}
        <Route path="/parent" element={<RequireAuth allowedRoles={['parent']}><ParentDashboard /></RequireAuth>} />
        <Route path="/parent/children" element={<RequireAuth allowedRoles={['parent']}><ParentChildren /></RequireAuth>} />
        <Route path="/parent/performance" element={<RequireAuth allowedRoles={['parent']}><ParentPerformance /></RequireAuth>} />
        <Route path="/parent/homework" element={<RequireAuth allowedRoles={['parent']}><ParentHomework /></RequireAuth>} />
        <Route path="/parent/messages" element={<RequireAuth allowedRoles={['parent']}><ParentWeeklyMessages /></RequireAuth>} />
        <Route path="/parent/fees" element={<RequireAuth allowedRoles={['parent']}><ParentFees /></RequireAuth>} />
        <Route path="/parent/chat" element={<RequireAuth allowedRoles={['parent']}><ParentMessages /></RequireAuth>} />
        <Route path="/parent/results" element={<RequireAuth allowedRoles={['parent']}><ParentResults /></RequireAuth>} />
        <Route path="/parent/fees-summary" element={<RequireAuth allowedRoles={['parent']}><ParentFeeSummary /></RequireAuth>} />
        <Route path="/parent/conferences" element={<RequireAuth allowedRoles={['parent']}><ParentConferences /></RequireAuth>} />
        <Route path="/parent/profile" element={<RequireAuth allowedRoles={['parent']}><ProfilePage /></RequireAuth>} />

        {/* HR / Staff Routes */}
        <Route path="/hr" element={<RequireAuth allowedRoles={['hr']}><HRDashboard /></RequireAuth>} />
        <Route path="/hr/staff" element={<RequireAuth allowedRoles={['hr']}><HRStaff /></RequireAuth>} />
        <Route path="/hr/leaves" element={<RequireAuth allowedRoles={['hr']}><HRLeaves /></RequireAuth>} />
        <Route path="/hr/payroll" element={<RequireAuth allowedRoles={['hr']}><HRPayroll /></RequireAuth>} />
        <Route path="/hr/attendance" element={<RequireAuth allowedRoles={['hr']}><HRAttendance /></RequireAuth>} />
        <Route path="/hr/meetings" element={<RequireAuth allowedRoles={['hr']}><HRMeetings /></RequireAuth>} />
        <Route path="/hr/profile" element={<RequireAuth allowedRoles={['hr']}><ProfilePage /></RequireAuth>} />

        {/* Generic profile redirect */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Catch all */}
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
