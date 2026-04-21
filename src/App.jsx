import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import RequireBoardingAccess from "./components/RequireBoardingAccess";

// Layout (loaded eagerly — always needed for the authenticated shell)
import Layout from "./components/Layout";

// Loading fallback shown while lazy chunks download
const PageLoader = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "#0f172a",
      gap: "1.25rem",
    }}
  >
    {/* Animated logo ring */}
    <div style={{ position: "relative", width: 64, height: 64 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "3px solid transparent",
          borderTopColor: "#3b82f6",
          animation: "spin 0.9s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 10,
          borderRadius: "50%",
          background: "#1d4ed8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 20 }}>🎓</span>
      </div>
    </div>
    <div style={{ textAlign: "center" }}>
      <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "1.125rem", fontFamily: "Inter, sans-serif" }}>
        MySchoolHub
      </p>
      <p style={{ color: "#64748b", fontSize: "0.75rem", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
        Loading your portal…
      </p>
    </div>
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
const ForcedTwoFactorSetup = lazy(() => import("./pages/auth/ForcedTwoFactorSetup"));

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
const AdminAssessmentPlans = lazy(() => import("./pages/admin/AdminAssessmentPlans"));
const AdminResults = lazy(() => import("./pages/admin/AdminResults"));
const AdminInvoices = lazy(() => import("./pages/admin/AdminInvoices"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminComplaints = lazy(() => import("./pages/admin/AdminComplaints"));
const AdminParentLinkRequests = lazy(() => import("./pages/admin/AdminParentLinkRequests"));
const AdminExtras = lazy(() => import("./pages/admin/AdminExtras"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminPermissions = lazy(() => import("./pages/admin/AdminPermissions"));
const AdminReportConfig = lazy(() => import("./pages/admin/AdminReportConfig"));
const AdminFees = lazy(() => import("./pages/admin/AdminFees"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSuspensions = lazy(() => import("./pages/admin/AdminSuspensions"));
const AdminPromotions = lazy(() => import("./pages/admin/AdminPromotions"));
const AdminActivities = lazy(() => import("./pages/admin/AdminActivities"));
const AdminLibrary = lazy(() => import("./pages/admin/AdminLibrary"));
const AdminHealth = lazy(() => import("./pages/admin/AdminHealth"));
const AdminBoarding = lazy(() => import("./pages/admin/AdminBoarding"));
const Customization = lazy(() => import("./pages/shared/Customization"));

const AdminDiscipline = lazy(() => import("./pages/admin/AdminDiscipline"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminAuditLog = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminAtRiskStudents = lazy(() => import("./pages/admin/AdminAtRiskStudents"));
const AdminPastStudents = lazy(() => import("./pages/admin/AdminPastStudents"));
const TwoFactorCompliance = lazy(() => import("./pages/admin/TwoFactorCompliance"));
const TwoFactorSettings = lazy(() => import("./pages/profile/TwoFactorSettings"));

// Teacher Pages
const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard"));
const TeacherMarks = lazy(() => import("./pages/teacher/TeacherMarks"));
const TeacherSubjectFeedback = lazy(() => import("./pages/teacher/TeacherSubjectFeedback"));
const TeacherAttendance = lazy(() => import("./pages/teacher/TeacherAttendance"));
const TeacherPerformance = lazy(() => import("./pages/teacher/TeacherPerformance"));
const TeacherMessages = lazy(() => import("./pages/teacher/TeacherMessages"));
const TeacherHomework = lazy(() => import("./pages/teacher/TeacherHomework"));
const TeacherResults = lazy(() => import("./pages/teacher/TeacherResults"));
const TeacherStudents = lazy(() => import("./pages/teacher/TeacherStudents"));
const TeacherClasses = lazy(() => import("./pages/teacher/TeacherClasses"));
const TeacherConferences = lazy(() => import("./pages/teacher/TeacherConferences"));
const TeacherComplaints = lazy(() => import("./pages/teacher/TeacherComplaints"));

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
const StudentLibrary = lazy(() => import("./pages/student/StudentLibrary"));
const StudentBoarding = lazy(() => import("./pages/student/StudentBoarding"));

// Parent Pages
const ParentDashboard = lazy(() => import("./pages/parent/ParentDashboard"));
const ParentChildren = lazy(() => import("./pages/parent/ParentChildren"));
const ParentPerformance = lazy(() => import("./pages/parent/ParentPerformance"));
const ParentFees = lazy(() => import("./pages/parent/ParentFees"));
const ParentMessages = lazy(() => import("./pages/parent/ParentMessages"));
const ParentHomework = lazy(() => import("./pages/parent/ParentHomework"));
const ParentResults = lazy(() => import("./pages/parent/ParentResults"));
const ParentFeeSummary = lazy(() => import("./pages/parent/ParentFeeSummary"));
const ParentConferences = lazy(() => import("./pages/parent/ParentConferences"));
const ParentBoarding = lazy(() => import("./pages/parent/ParentBoarding"));

// HR / Staff Pages
const HRDashboard = lazy(() => import("./pages/hr/HRDashboard"));
const HRStaff = lazy(() => import("./pages/hr/HRStaff"));
const HRLeaves = lazy(() => import("./pages/hr/HRLeaves"));
const HRPayroll = lazy(() => import("./pages/hr/HRPayroll"));
const HRAttendance = lazy(() => import("./pages/hr/HRAttendance"));
const HRMeetings = lazy(() => import("./pages/hr/HRMeetings"));
const HRVisitorLogs = lazy(() => import("./pages/hr/HRVisitorLogs"));
const HRIncidents = lazy(() => import("./pages/hr/HRIncidents"));
const HRCleaningSchedules = lazy(() => import("./pages/hr/HRCleaningSchedules"));
const HRBoarding = lazy(() => import("./pages/hr/HRBoarding"));
const MyLeaves = lazy(() => import("./pages/shared/MyLeaves"));

// Accountant pages
const AccountantDashboard = lazy(() => import("./pages/accountant/AccountantDashboard"));
const AccountantFees = lazy(() => import("./pages/accountant/AccountantFees"));
const AccountantPayments = lazy(() => import("./pages/accountant/AccountantPayments"));
const AccountantInvoices = lazy(() => import("./pages/accountant/AccountantInvoices"));
const AccountantReports = lazy(() => import("./pages/accountant/AccountantReports"));

// Librarian pages
const LibrarianDashboard = lazy(() => import("./pages/librarian/LibrarianDashboard"));
const LibrarianBooks = lazy(() => import("./pages/librarian/LibrarianBooks"));
const LibrarianLoans = lazy(() => import("./pages/librarian/LibrarianLoans"));

// Security pages
const SecurityDashboard = lazy(() => import("./pages/security/SecurityDashboard"));
const SecurityVisitorLog = lazy(() => import("./pages/security/SecurityVisitorLog"));
const SecurityIncidents = lazy(() => import("./pages/security/SecurityIncidents"));
const SecurityAttendance = lazy(() => import("./pages/security/SecurityAttendance"));

// Cleaner pages
const CleanerDashboard = lazy(() => import("./pages/cleaner/CleanerDashboard"));
const CleanerTasks = lazy(() => import("./pages/cleaner/CleanerTasks"));
const CleanerAttendance = lazy(() => import("./pages/cleaner/CleanerAttendance"));

// Shared Profile Page
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage"));

// Sports Director pages
const SportsDashboard = lazy(() => import("./pages/sports/SportsDashboard"));
const ActivityManagement = lazy(() => import("./pages/sports/ActivityManagement"));
const SportsAnalysis = lazy(() => import("./pages/sports/SportsAnalysis"));

// Payment Return Pages
const PaymentSuccess = lazy(() => import("./pages/payment/PaymentSuccess"));
const PaymentFailed = lazy(() => import("./pages/payment/PaymentFailed"));

// 404
const NotFound = lazy(() => import("./pages/notfound/NotFound"));
const Unauthorized = lazy(() => import("./pages/notfound/Unauthorized"));

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
      <Route path="/setup-2fa-required" element={<ForcedTwoFactorSetup />} />

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
        <Route path="/admin/assessment-plans" element={<RequireAuth allowedRoles={['admin']}><AdminAssessmentPlans /></RequireAuth>} />
        <Route path="/admin/results" element={<RequireAuth allowedRoles={['admin']}><AdminResults /></RequireAuth>} />
        <Route path="/admin/invoices" element={<RequireAuth allowedRoles={['admin']}><AdminInvoices /></RequireAuth>} />
        <Route path="/admin/payments" element={<RequireAuth allowedRoles={['admin']}><AdminPayments /></RequireAuth>} />
        <Route path="/admin/sports-analysis" element={<RequireAuth allowedRoles={['admin']}><SportsAnalysis /></RequireAuth>} />
        <Route path="/admin/announcements" element={<RequireAuth allowedRoles={['admin']}><AdminAnnouncements /></RequireAuth>} />
        <Route path="/admin/complaints" element={<RequireAuth allowedRoles={['admin']}><AdminComplaints /></RequireAuth>} />
        <Route path="/admin/parent-requests" element={<RequireAuth allowedRoles={['admin']}><AdminParentLinkRequests /></RequireAuth>} />
        <Route path="/admin/extras" element={<RequireAuth allowedRoles={['admin']}><AdminExtras /></RequireAuth>} />
        <Route path="/admin/staff" element={<RequireAuth allowedRoles={['admin']}><AdminStaff /></RequireAuth>} />
        <Route path="/admin/payroll" element={<RequireAuth allowedRoles={['admin']}><HRPayroll viewMode="payroll" /></RequireAuth>} />
        <Route path="/admin/accounting" element={<RequireAuth allowedRoles={['admin']}><HRPayroll viewMode="accounting" /></RequireAuth>} />
        <Route path="/admin/settings" element={<RequireAuth allowedRoles={['admin']}><AdminSettings /></RequireAuth>} />
        <Route path="/admin/customization" element={<RequireAuth allowedRoles={['admin']}><Customization /></RequireAuth>} />
        <Route path="/admin/permissions" element={<RequireAuth allowedRoles={['admin']}><AdminPermissions /></RequireAuth>} />
        <Route path="/admin/report-config" element={<RequireAuth allowedRoles={['admin']}><AdminReportConfig /></RequireAuth>} />
        <Route path="/admin/fees" element={<RequireAuth allowedRoles={['admin']}><AdminFees /></RequireAuth>} />
        <Route path="/admin/reports" element={<RequireAuth allowedRoles={['admin']}><AdminReports /></RequireAuth>} />
        <Route path="/admin/suspensions" element={<RequireAuth allowedRoles={['admin']}><AdminSuspensions /></RequireAuth>} />
        <Route path="/admin/promotions" element={<RequireAuth allowedRoles={['admin']}><AdminPromotions /></RequireAuth>} />
        <Route path="/admin/activities" element={<RequireAuth allowedRoles={['admin']}><AdminActivities /></RequireAuth>} />
        <Route path="/admin/library" element={<RequireAuth allowedRoles={['admin']}><AdminLibrary /></RequireAuth>} />
        <Route path="/admin/health" element={<RequireAuth allowedRoles={['admin']}><AdminHealth /></RequireAuth>} />
        <Route path="/admin/boarding" element={<RequireAuth allowedRoles={['admin']}><RequireBoardingAccess><AdminBoarding /></RequireBoardingAccess></RequireAuth>} />
        <Route path="/admin/discipline" element={<RequireAuth allowedRoles={['admin']}><AdminDiscipline /></RequireAuth>} />
        <Route path="/admin/analytics" element={<RequireAuth allowedRoles={['admin']}><AdminAnalytics /></RequireAuth>} />
        <Route path="/admin/audit-logs" element={<RequireAuth allowedRoles={['admin']}><AdminAuditLog /></RequireAuth>} />
        <Route path="/admin/at-risk-students" element={<RequireAuth allowedRoles={['admin', 'hr']}><AdminAtRiskStudents /></RequireAuth>} />
        <Route path="/admin/past-students" element={<RequireAuth allowedRoles={['admin']}><AdminPastStudents /></RequireAuth>} />
        <Route path="/admin/2fa-compliance" element={<RequireAuth allowedRoles={['admin']}><TwoFactorCompliance /></RequireAuth>} />
        <Route path="/admin/profile" element={<RequireAuth allowedRoles={['admin']}><ProfilePage /></RequireAuth>} />

        {/* Teacher Routes */}
        <Route path="/teacher" element={<RequireAuth allowedRoles={['teacher']}><TeacherDashboard /></RequireAuth>} />
        <Route path="/teacher/marks" element={<RequireAuth allowedRoles={['teacher']}><TeacherMarks /></RequireAuth>} />
        <Route path="/teacher/report-feedback" element={<RequireAuth allowedRoles={['teacher']}><TeacherSubjectFeedback /></RequireAuth>} />
        <Route path="/teacher/attendance" element={<RequireAuth allowedRoles={['teacher']}><TeacherAttendance /></RequireAuth>} />
        <Route path="/teacher/performance" element={<RequireAuth allowedRoles={['teacher']}><TeacherPerformance /></RequireAuth>} />
        <Route path="/my/leaves" element={<RequireAuth allowedRoles={['teacher','accountant','librarian','security','cleaner']}><MyLeaves /></RequireAuth>} />
        <Route path="/teacher/homework" element={<RequireAuth allowedRoles={['teacher']}><TeacherHomework /></RequireAuth>} />
        <Route path="/teacher/messages" element={<RequireAuth allowedRoles={['teacher']}><TeacherMessages /></RequireAuth>} />
        <Route path="/teacher/results" element={<RequireAuth allowedRoles={['teacher']}><TeacherResults /></RequireAuth>} />
        <Route path="/teacher/students" element={<RequireAuth allowedRoles={['teacher']}><TeacherStudents /></RequireAuth>} />
        <Route path="/teacher/classes" element={<RequireAuth allowedRoles={['teacher']}><TeacherClasses /></RequireAuth>} />
        <Route path="/teacher/conferences" element={<RequireAuth allowedRoles={['teacher']}><TeacherConferences /></RequireAuth>} />
        <Route path="/teacher/complaints" element={<RequireAuth allowedRoles={['teacher']}><TeacherComplaints /></RequireAuth>} />
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
        <Route path="/student/library" element={<RequireAuth allowedRoles={['student']}><StudentLibrary /></RequireAuth>} />
        <Route path="/student/boarding" element={<RequireAuth allowedRoles={['student']}><RequireBoardingAccess><StudentBoarding /></RequireBoardingAccess></RequireAuth>} />

        {/* Parent Routes */}
        <Route path="/parent" element={<RequireAuth allowedRoles={['parent']}><ParentDashboard /></RequireAuth>} />
        <Route path="/parent/children" element={<RequireAuth allowedRoles={['parent']}><ParentChildren /></RequireAuth>} />
        <Route path="/parent/performance" element={<RequireAuth allowedRoles={['parent']}><ParentPerformance /></RequireAuth>} />
        <Route path="/parent/homework" element={<RequireAuth allowedRoles={['parent']}><ParentHomework /></RequireAuth>} />
        <Route path="/parent/fees" element={<RequireAuth allowedRoles={['parent']}><ParentFees /></RequireAuth>} />
        <Route path="/parent/chat" element={<RequireAuth allowedRoles={['parent']}><ParentMessages /></RequireAuth>} />
        <Route path="/parent/results" element={<RequireAuth allowedRoles={['parent']}><ParentResults /></RequireAuth>} />
        <Route path="/parent/fees-summary" element={<RequireAuth allowedRoles={['parent']}><ParentFeeSummary /></RequireAuth>} />
        <Route path="/parent/conferences" element={<RequireAuth allowedRoles={['parent']}><ParentConferences /></RequireAuth>} />
        <Route path="/parent/boarding" element={<RequireAuth allowedRoles={['parent']}><RequireBoardingAccess><ParentBoarding /></RequireBoardingAccess></RequireAuth>} />
        <Route path="/parent/profile" element={<RequireAuth allowedRoles={['parent']}><ProfilePage /></RequireAuth>} />

        {/* HR / Staff Routes */}
        <Route path="/hr" element={<RequireAuth allowedRoles={['hr']}><HRDashboard /></RequireAuth>} />
        <Route path="/hr/students" element={<RequireAuth allowedRoles={['hr']}><AdminStudents /></RequireAuth>} />
        <Route path="/hr/teachers" element={<RequireAuth allowedRoles={['hr']}><AdminTeachers /></RequireAuth>} />
        <Route path="/hr/parents" element={<RequireAuth allowedRoles={['hr']}><AdminParents /></RequireAuth>} />
        <Route path="/hr/parent-requests" element={<RequireAuth allowedRoles={['hr']}><AdminParentLinkRequests /></RequireAuth>} />
        <Route path="/hr/staff" element={<RequireAuth allowedRoles={['hr']}><HRStaff /></RequireAuth>} />
        <Route path="/hr/classes" element={<RequireAuth allowedRoles={['hr']}><AdminClasses /></RequireAuth>} />
        <Route path="/hr/subjects" element={<RequireAuth allowedRoles={['hr']}><AdminSubjects /></RequireAuth>} />
        <Route path="/hr/assessment-plans" element={<RequireAuth allowedRoles={['hr']}><AdminAssessmentPlans /></RequireAuth>} />
        <Route path="/hr/results" element={<RequireAuth allowedRoles={['hr']}><AdminResults /></RequireAuth>} />
        <Route path="/hr/fees" element={<RequireAuth allowedRoles={['hr']}><AdminFees /></RequireAuth>} />
        <Route path="/hr/invoices" element={<RequireAuth allowedRoles={['hr']}><AdminInvoices /></RequireAuth>} />
        <Route path="/hr/payments" element={<RequireAuth allowedRoles={['hr']}><AdminPayments /></RequireAuth>} />
        <Route path="/hr/reports" element={<RequireAuth allowedRoles={['hr']}><AdminReports /></RequireAuth>} />
        <Route path="/hr/leaves" element={<RequireAuth allowedRoles={['hr']}><HRLeaves /></RequireAuth>} />
        <Route path="/hr/payroll" element={<RequireAuth allowedRoles={['hr']}><HRPayroll viewMode="payroll" /></RequireAuth>} />
        <Route path="/hr/accounting" element={<RequireAuth allowedRoles={['hr']}><HRPayroll viewMode="accounting" /></RequireAuth>} />
        <Route path="/hr/attendance" element={<RequireAuth allowedRoles={['hr']}><HRAttendance /></RequireAuth>} />
        <Route path="/hr/meetings" element={<RequireAuth allowedRoles={['hr']}><HRMeetings /></RequireAuth>} />
        <Route path="/hr/users" element={<RequireAuth allowedRoles={['hr']}><AdminUsers /></RequireAuth>} />
        <Route path="/hr/visitor-logs" element={<RequireAuth allowedRoles={['hr']}><HRVisitorLogs /></RequireAuth>} />
        <Route path="/hr/incidents" element={<RequireAuth allowedRoles={['hr']}><HRIncidents /></RequireAuth>} />
        <Route path="/hr/cleaning" element={<RequireAuth allowedRoles={['hr']}><HRCleaningSchedules /></RequireAuth>} />
        <Route path="/hr/boarding" element={<RequireAuth allowedRoles={['hr']}><RequireBoardingAccess><HRBoarding /></RequireBoardingAccess></RequireAuth>} />
        <Route path="/hr/discipline" element={<RequireAuth allowedRoles={['hr']}><AdminDiscipline /></RequireAuth>} />
        <Route path="/hr/promotions" element={<RequireAuth allowedRoles={['hr']}><AdminPromotions /></RequireAuth>} />
        <Route path="/hr/suspensions" element={<RequireAuth allowedRoles={['hr']}><AdminSuspensions /></RequireAuth>} />
        <Route path="/hr/complaints" element={<RequireAuth allowedRoles={['hr']}><AdminComplaints /></RequireAuth>} />
        <Route path="/hr/announcements" element={<RequireAuth allowedRoles={['hr']}><AdminAnnouncements /></RequireAuth>} />
        <Route path="/hr/timetable" element={<RequireAuth allowedRoles={['hr']}><AdminTimetable /></RequireAuth>} />
        <Route path="/hr/report-config" element={<RequireAuth allowedRoles={['hr']}><AdminReportConfig /></RequireAuth>} />
        <Route path="/hr/analytics" element={<RequireAuth allowedRoles={['hr']}><AdminAnalytics /></RequireAuth>} />
        <Route path="/hr/audit-logs" element={<RequireAuth allowedRoles={['hr']}><AdminAuditLog /></RequireAuth>} />
        <Route path="/hr/activities" element={<RequireAuth allowedRoles={['hr']}><AdminActivities /></RequireAuth>} />
        <Route path="/hr/library" element={<RequireAuth allowedRoles={['hr']}><AdminLibrary /></RequireAuth>} />
        <Route path="/hr/health" element={<RequireAuth allowedRoles={['hr']}><AdminHealth /></RequireAuth>} />
        <Route path="/hr/extras" element={<RequireAuth allowedRoles={['hr']}><AdminExtras /></RequireAuth>} />
        <Route path="/hr/settings" element={<RequireAuth allowedRoles={['hr']}><AdminSettings /></RequireAuth>} />
        <Route path="/hr/customization" element={<RequireAuth allowedRoles={['hr']}><Customization /></RequireAuth>} />
        <Route path="/hr/at-risk-students" element={<RequireAuth allowedRoles={['hr']}><AdminAtRiskStudents /></RequireAuth>} />
        <Route path="/hr/past-students" element={<RequireAuth allowedRoles={['hr']}><AdminPastStudents /></RequireAuth>} />
        <Route path="/hr/profile" element={<RequireAuth allowedRoles={['hr']}><ProfilePage /></RequireAuth>} />

        {/* Accountant Routes */}
        <Route path="/accountant" element={<RequireAuth allowedRoles={['accountant']}><AccountantDashboard /></RequireAuth>} />
        <Route path="/accountant/fees" element={<RequireAuth allowedRoles={['accountant']}><AccountantFees /></RequireAuth>} />
        <Route path="/accountant/payments" element={<RequireAuth allowedRoles={['accountant']}><AccountantPayments /></RequireAuth>} />
        <Route path="/accountant/invoices" element={<RequireAuth allowedRoles={['accountant']}><AccountantInvoices /></RequireAuth>} />
        <Route path="/accountant/reports" element={<RequireAuth allowedRoles={['accountant']}><AccountantReports /></RequireAuth>} />
        <Route path="/accountant/payroll" element={<RequireAuth allowedRoles={['accountant']}><HRPayroll viewMode="payroll" /></RequireAuth>} />
        <Route path="/accountant/accounting" element={<RequireAuth allowedRoles={['accountant']}><HRPayroll viewMode="accounting" /></RequireAuth>} />
        <Route path="/accountant/profile" element={<RequireAuth allowedRoles={['accountant']}><ProfilePage /></RequireAuth>} />

        {/* Librarian Routes */}
        <Route path="/librarian" element={<RequireAuth allowedRoles={['librarian']}><LibrarianDashboard /></RequireAuth>} />
        <Route path="/librarian/books" element={<RequireAuth allowedRoles={['librarian']}><LibrarianBooks /></RequireAuth>} />
        <Route path="/librarian/loans" element={<RequireAuth allowedRoles={['librarian']}><LibrarianLoans /></RequireAuth>} />
        <Route path="/librarian/profile" element={<RequireAuth allowedRoles={['librarian']}><ProfilePage /></RequireAuth>} />

        {/* Security Routes */}
        <Route path="/security" element={<RequireAuth allowedRoles={['security']}><SecurityDashboard /></RequireAuth>} />
        <Route path="/security/visitors" element={<RequireAuth allowedRoles={['security']}><SecurityVisitorLog /></RequireAuth>} />
        <Route path="/security/incidents" element={<RequireAuth allowedRoles={['security']}><SecurityIncidents /></RequireAuth>} />
        <Route path="/security/attendance" element={<RequireAuth allowedRoles={['security']}><SecurityAttendance /></RequireAuth>} />
        <Route path="/security/profile" element={<RequireAuth allowedRoles={['security']}><ProfilePage /></RequireAuth>} />

        {/* Sports Director Routes */}
        <Route path="/sports-director" element={<RequireAuth allowedRoles={['admin','hr','sports_director']}><SportsDashboard /></RequireAuth>} />
        <Route path="/sports-director/activities" element={<RequireAuth allowedRoles={['admin','hr','sports_director']}><ActivityManagement /></RequireAuth>} />
        <Route path="/sports-director/analysis" element={<RequireAuth allowedRoles={['admin','hr','sports_director']}><SportsAnalysis /></RequireAuth>} />

        {/* Cleaner Routes */}
        <Route path="/cleaner" element={<RequireAuth allowedRoles={['cleaner']}><CleanerDashboard /></RequireAuth>} />
        <Route path="/cleaner/tasks" element={<RequireAuth allowedRoles={['cleaner']}><CleanerTasks /></RequireAuth>} />
        <Route path="/cleaner/attendance" element={<RequireAuth allowedRoles={['cleaner']}><CleanerAttendance /></RequireAuth>} />
        <Route path="/cleaner/profile" element={<RequireAuth allowedRoles={['cleaner']}><ProfilePage /></RequireAuth>} />

        {/* 2FA Settings — accessible to all authenticated roles */}
        <Route path="/2fa-settings" element={<RequireAuth allowedRoles={['admin','teacher','student','parent','hr','accountant','security','cleaner','librarian']}><TwoFactorSettings /></RequireAuth>} />

        {/* Generic profile redirect */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Catch all */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
