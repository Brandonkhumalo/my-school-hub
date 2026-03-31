// Production: Django backend hosted on Railway
const API_BASE_URL = "https://myschoolhub.co.zw/api/v1";

function getToken() {
  return localStorage.getItem('token');
}

function getRefreshToken() {
  return localStorage.getItem('refresh_token');
}

// Handle 401 — clear auth and redirect to login
function handleAuthExpired() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  // Only redirect if not already on login/register/public pages
  const publicPaths = ['/', '/login', '/admin/login', '/register', '/about', '/contact', '/payment'];
  if (!publicPaths.some(p => window.location.pathname.startsWith(p))) {
    window.location.href = '/login';
  }
}

async function requestFile(endpoint, useAuth = true) {
  const headers = {};
  if (useAuth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
  if (response.status === 401) { handleAuthExpired(); throw new Error("Session expired"); }
  if (!response.ok) throw new Error("File request failed");
  return response.blob();
}

async function requestMultipart(endpoint, method = "POST", formData) {
  const token = getToken();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { method, headers, body: formData });
  if (response.status === 401) { handleAuthExpired(); throw new Error("Session expired"); }
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return response.json();
}

async function request(endpoint, method = "GET", body = null, useAuth = true) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (useAuth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // Handle expired token — redirect to login
    if (response.status === 401 && useAuth) {
      handleAuthExpired();
      throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) {
      let errorData = null;
      try {
        const errorText = await response.text();
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || "API request failed" };
        }
      } catch {
        errorData = { error: "API request failed" };
      }
      // Extract DRF validation errors (e.g. {"email": ["Already registered"]})
      let errorMessage = errorData.error || errorData.message || errorData.detail;
      if (!errorMessage && typeof errorData === 'object') {
        const messages = Object.entries(errorData)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('; ');
        errorMessage = messages || "API request failed";
      }
      const error = new Error(errorMessage || "API request failed");
      error.response = { data: errorData, status: response.status };
      throw error;
    }
    const data = await response.json();

    // Handle paginated responses - extract results array
    if (data && typeof data === 'object' && 'results' in data) {
      return data.results;
    }

    return data;
  } catch (error) {
    console.error("API Service Error:", error.message);
    throw error;
  }
}

const apiService = {
  login: (credentials) => {
    const loginData = {
      identifier: credentials.username,
      password: credentials.password
    };
    return request("/auth/login/", "POST", loginData, false);
  },
  register: (userData) => request("/auth/register/", "POST", userData, false),
  registerUser: (userData) => request("/auth/register/", "POST", userData, false),
  logout: () => request("/auth/logout/", "POST"),

  getProfile: () => request("/auth/profile/", "GET"),
  updateProfile: (data) => request("/auth/profile/update/", "PUT", data),
  changePassword: (data) => request("/auth/profile/change-password/", "POST", data),
  setWhatsAppPin: (data) => request("/auth/profile/set-whatsapp-pin/", "POST", data),

  fetchUsers: () => request("/auth/users/", "GET"),
  deleteUser: (userId) => request(`/auth/users/${userId}/delete/`, "DELETE"),

  getDashboardStats: () => request("/auth/dashboard/stats/", "GET"),

  fetchSubjects: () => request("/academics/subjects/", "GET"),
  createSubject: (data) => request("/academics/subjects/", "POST", data),
  updateSubject: (id, data) => request(`/academics/subjects/${id}/`, "PATCH", data),
  deleteSubject: (id) => request(`/academics/subjects/${id}/`, "DELETE"),

  fetchClasses: () => request("/academics/classes/", "GET"),
  createClass: (data) => request("/academics/classes/", "POST", data),
  updateClass: (id, data) => request(`/academics/classes/${id}/`, "PATCH", data),
  deleteClass: (id) => request(`/academics/classes/${id}/`, "DELETE"),

  fetchStudents: () => request("/academics/students/", "GET"),
  fetchStudentsByClass: (classId) => request(`/academics/students/?class=${classId}`, "GET"),
  fetchStudentById: (id) => request(`/academics/students/${id}/`, "GET"),
  fetchStudentPerformance: (studentId) => request(`/academics/students/${studentId}/performance/`, "GET"),
  createStudent: (data) => request("/academics/students/", "POST", data),

  fetchTeachers: () => request("/academics/teachers/", "GET"),
  createTeacher: (data) => request("/academics/teachers/", "POST", data),

  fetchParents: () => request("/academics/parents/", "GET"),
  createParent: (data) => request("/academics/parents/", "POST", data),

  fetchResults: () => request("/academics/results/", "GET"),
  fetchClassAverages: () => request("/academics/results/class-averages/", "GET"),
  createResult: (data) => request("/academics/results/", "POST", data),

  fetchTimetable: () => request("/academics/timetables/", "GET"),
  fetchTimetables: () => request("/academics/timetables/", "GET"),

  fetchAnnouncements: () => request("/academics/announcements/", "GET"),
  createAnnouncement: (data) => request("/academics/announcements/", "POST", data),

  fetchComplaints: () => request("/academics/complaints/", "GET"),
  createComplaint: (data) => request("/academics/complaints/", "POST", data),

  fetchSuspensions: () => request("/academics/suspensions/", "GET"),
  createSuspension: (data) => request("/academics/suspensions/", "POST", data),

  fetchFeeTypes: () => request("/finances/fee-types/", "GET"),
  createFeeType: (data) => request("/finances/fee-types/", "POST", data),

  fetchFees: () => request("/finances/student-fees/", "GET"),
  createFee: (data) => request("/finances/student-fees/", "POST", data),

  fetchPayments: () => request("/finances/payments/", "GET"),
  createPayment: (data) => request("/finances/payments/", "POST", data),

  fetchInvoices: () => request("/finances/invoices/", "GET"),
  createInvoice: (data) => request("/finances/invoices/", "POST", data),

  fetchReports: () => request("/finances/reports/", "GET"),
  createReport: (data) => request("/finances/reports/", "POST", data),

  fetchStudentSummary: (studentId) => request(`/finances/students/${studentId}/summary/`, "GET"),

  fetchTeacherClasses: () => request("/academics/classes/", "GET"),
  getTeacherClasses: () => request("/teachers/classes/", "GET"),
  fetchTeacherStudents: () => request("/academics/students/", "GET"),
  fetchTeacherResults: () => request("/academics/results/", "GET"),
  getResultsForReport: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/teachers/results/for-report/?${q}`, "GET");
  },
  updateReportSettings: (data) => request("/teachers/results/report-settings/", "PATCH", data),

  fetchParentChildren: () => request("/academics/students/", "GET"),
  fetchParentResults: () => request("/academics/results/", "GET"),
  fetchParentFeeSummary: () => request("/finances/student-fees/", "GET"),

  getStudentProfile: () => request("/students/profile/", "GET"),
  getStudentDashboardStats: () => request("/students/dashboard/stats/", "GET"),
  getStudentSubmissions: () => request("/students/submissions/", "GET"),
  getStudentMarks: () => request("/students/marks/", "GET"),
  getSchoolCalendar: () => request("/students/calendar/", "GET"),
  getStudentTimetable: () => request("/students/timetable/", "GET"),
  getStudentTeachers: () => request("/students/teachers/", "GET"),
  getStudentAnnouncements: () => request("/students/announcements/", "GET"),

  getParentChildren: () => request("/parents/children/", "GET"),
  getAvailableChildren: () => request("/parents/children/available/", "GET"),
  searchStudents: (params) => {
    const queryParams = new URLSearchParams();
    if (params.student_number) queryParams.append('student_number', params.student_number);
    if (params.first_name) queryParams.append('first_name', params.first_name);
    if (params.last_name) queryParams.append('last_name', params.last_name);
    if (params.school_id) queryParams.append('school_id', params.school_id);
    return request(`/parents/students/search/?${queryParams.toString()}`, "GET");
  },
  requestChildLink: (studentId) => request("/parents/children/request/", "POST", { student_id: studentId }),
  confirmChild: (childId) => request(`/parents/children/${childId}/confirm/`, "POST"),
  getParentDashboardStats: (childId) => request(`/parents/children/${childId}/stats/`, "GET"),
  getChildPerformance: (childId) => request(`/parents/children/${childId}/performance/`, "GET"),
  getParentWeeklyMessages: (childId = null) => {
    if (childId) {
      return request(`/parents/children/${childId}/messages/`, "GET");
    }
    return request("/parents/messages/", "GET");
  },
  getChildFees: (childId) => request(`/parents/children/${childId}/fees/`, "GET"),

  // Teacher endpoints
  getTeacherSubjects: () => request("/teachers/subjects/", "GET"),
  getSubjectStudents: (subjectId) => request(`/teachers/subjects/${subjectId}/students/`, "GET"),
  getSubjectPerformance: (subjectId) => request(`/teachers/subjects/${subjectId}/performance/`, "GET"),
  addStudentMark: (data) => request("/teachers/marks/add/", "POST", data),
  getAttendanceRegister: (date, classId) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (classId) params.append('class_id', classId);
    return request(`/teachers/attendance/register/?${params.toString()}`, "GET");
  },
  markAttendance: (data) => request("/teachers/attendance/mark/", "POST", data),

  // Admin Parent-Child Link Management endpoints
  getPendingParentLinkRequests: () => request("/academics/parent-link-requests/", "GET"),
  approveParentLinkRequest: (linkId) => request(`/academics/parent-link-requests/${linkId}/approve/`, "POST"),
  declineParentLinkRequest: (linkId) => request(`/academics/parent-link-requests/${linkId}/decline/`, "DELETE"),

  // Messaging endpoints
  getMessages: () => request("/messages/", "GET"),
  getConversation: (userId) => request(`/messages/conversation/${userId}/`, "GET"),
  sendMessage: (data) => request("/messages/send/", "POST", data),
  markMessageAsRead: (messageId) => request(`/messages/${messageId}/read/`, "POST"),
  getUnreadCount: () => request("/messages/unread-count/", "GET"),
  searchTeachers: (query = '') => request(`/teachers/search/?q=${query}`, "GET"),
  searchParents: (query = '') => request(`/parents/search/?q=${query}`, "GET"),
  getStudentParents: (studentId) => request(`/students/${studentId}/parents/`, "GET"),

  // Homework endpoints
  getTeacherHomework: () => request("/teachers/homework/", "GET"),
  getTeacherHomeworkClasses: () => request("/teachers/homework/classes/", "GET"),
  createHomework: async (formData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/teachers/homework/create/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to create homework");
    }
    return response.json();
  },
  deleteHomework: (homeworkId) => request(`/teachers/homework/${homeworkId}/delete/`, "DELETE"),
  downloadHomework: (homeworkId) => `${API_BASE_URL}/teachers/homework/${homeworkId}/download/`,

  getParentHomework: () => request("/parents/homework/", "GET"),
  downloadParentHomework: (homeworkId) => `${API_BASE_URL}/parents/homework/${homeworkId}/download/`,

  getStudentHomework: () => request("/students/homework/", "GET"),
  downloadStudentHomework: (homeworkId) => `${API_BASE_URL}/students/homework/${homeworkId}/download/`,

  // School Fees endpoints
  getSchoolFees: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/finances/school-fees/${query ? '?' + query : ''}`, "GET");
  },
  createSchoolFees: (data) => request("/finances/school-fees/", "POST", data),
  updateSchoolFees: (id, data) => request(`/finances/school-fees/${id}/`, "PUT", data),
  deleteSchoolFees: (id) => request(`/finances/school-fees/${id}/`, "DELETE"),
  getMySchoolFees: () => request("/finances/school-fees/my-fees/", "GET"),
  getAllGrades: () => request("/finances/grades/", "GET"),

  // Payment Records endpoints
  getPaymentRecords: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/finances/payment-records/${query ? '?' + query : ''}`, "GET");
  },
  createPaymentRecord: (data) => request("/finances/payment-records/", "POST", data),
  getPaymentRecordDetail: (id) => request(`/finances/payment-records/${id}/`, "GET"),
  updatePaymentRecord: (id, data) => request(`/finances/payment-records/${id}/`, "PATCH", data),
  deletePaymentRecord: (id) => request(`/finances/payment-records/${id}/`, "DELETE"),
  addPaymentToRecord: (data) => request("/finances/payment-records/add-payment/", "POST", data),
  updatePaymentStatus: (recordId, status) => request(`/finances/payment-records/${recordId}/update-status/`, "POST", { status }),
  getClassFeesReport: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/finances/payment-records/class-report/${query ? '?' + query : ''}`, "GET");
  },
  getStudentsForPayment: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/finances/payment-records/students/${query ? '?' + query : ''}`, "GET");
  },

  // Invoice endpoints
  getInvoices: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/finances/invoices/${query ? '?' + query : ''}`, "GET");
  },
  getInvoicesByClass: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/finances/invoices/by-class/${query ? '?' + query : ''}`, "GET");
  },
  getInvoiceDetail: (id) => request(`/finances/invoices/${id}/detail/`, "GET"),
  getParentInvoices: () => request("/finances/invoices/parent/", "GET"),

  // Additional Fees endpoints
  getAdditionalFees: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/finances/additional-fees/${query ? '?' + query : ''}`, "GET");
  },
  createAdditionalFee: (data) => request("/finances/additional-fees/", "POST", data),
  updateAdditionalFee: (id, data) => request(`/finances/additional-fees/${id}/`, "PATCH", data),
  deleteAdditionalFee: (id) => request(`/finances/additional-fees/${id}/`, "DELETE"),

  // Daily Transaction Report
  getDailyTransactionReport: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/finances/reports/daily/${query ? '?' + query : ''}`, "GET");
  },

  // Timetable generation endpoints
  generateTimetable: (data = {}) => request("/academics/timetables/generate/", "POST", data),
  getTimetableStats: () => request("/academics/timetables/stats/", "GET"),

  // School management (SaaS multi-tenant)
  registerSchool: (data) => request("/auth/schools/register/", "POST", data, false),
  searchSchools: (query) => request(`/auth/schools/search/?q=${encodeURIComponent(query)}`, "GET", null, false),
  getSchools: () => request("/auth/schools/", "GET"),
  getSchoolDetails: (schoolId) => request(`/auth/schools/${schoolId}/`, "GET"),

  // Timetable conflict detection
  getTimetableConflicts: () => request("/academics/timetables/conflicts/", "GET"),

  // Report card (returns PDF blob, optional year & term query params)
  downloadReportCard: (studentId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return requestFile(`/academics/students/${studentId}/report-card/${q ? '?' + q : ''}`);
  },

  // Grade predictions
  getStudentGradePredictions: (studentId) => request(`/academics/students/${studentId}/grade-prediction/`, "GET"),

  // Bulk CSV imports
  bulkImportStudents: (formData) => requestMultipart("/academics/students/bulk-import/", "POST", formData),
  bulkImportResults: (formData) => requestMultipart("/academics/results/bulk-import/", "POST", formData),
  bulkImportFees: (formData) => requestMultipart("/finances/fees/bulk-import/", "POST", formData),

  // Student attendance (student's own)
  getStudentAttendance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/students/attendance/${q ? '?' + q : ''}`, "GET");
  },

  // Assignment submissions (student)
  getMySubmission: (assignmentId) => request(`/students/assignments/${assignmentId}/submit/`, "GET"),
  submitAssignment: (assignmentId, formData) =>
    requestMultipart(`/students/assignments/${assignmentId}/submit/`, "POST", formData),

  // Assignment submissions (teacher)
  getAssignmentSubmissions: (assignmentId) => request(`/teachers/assignments/${assignmentId}/submissions/`, "GET"),
  gradeSubmission: (submissionId, data) => request(`/teachers/submissions/${submissionId}/grade/`, "POST", data),

  // PayNow Zimbabwe payments
  initiatePaynowPayment: (data) => request("/finances/payments/paynow/initiate/", "POST", data),
  checkPaynowStatus: (pollUrl) => request(`/finances/payments/paynow/status/?poll_url=${encodeURIComponent(pollUrl)}`, "GET"),

  // School settings (admin)
  getSchoolSettings: () => request("/auth/school/settings/", "GET"),
  updateSchoolSettings: (data) => request("/auth/school/settings/", "PUT", data),

  // Report card config (admin)
  getReportCardConfig: () => request("/auth/school/report-config/", "GET"),
  updateReportCardConfig: (data) => request("/auth/school/report-config/", "PUT", data),
  uploadReportCardImage: (field, file) => {
    const formData = new FormData();
    formData.append('field', field);
    formData.append('file', file);
    return requestMultipart("/auth/school/report-config/upload/", "POST", formData);
  },

  // Audit logs (admin)
  getAuditLogs: () => request("/auth/audit-logs/", "GET"),

  // Global search
  globalSearch: (q) => request(`/auth/search/?q=${encodeURIComponent(q)}`, "GET"),

  // ── Staff / HR ────────────────────────────────────────────────────────────
  getHRDashboardStats: () => request("/staff/dashboard/", "GET"),
  getDepartments: () => request("/staff/departments/", "GET"),
  createDepartment: (data) => request("/staff/departments/", "POST", data),
  updateDepartment: (id, data) => request(`/staff/departments/${id}/`, "PATCH", data),
  deleteDepartment: (id) => request(`/staff/departments/${id}/`, "DELETE"),

  getStaffList: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/${q ? '?' + q : ''}`, "GET");
  },
  getStaffDetail: (id) => request(`/staff/${id}/`, "GET"),
  createStaff: (data) => request("/staff/create/", "POST", data),
  updateStaff: (id, data) => request(`/staff/${id}/`, "PATCH", data),
  deleteStaff: (id) => request(`/staff/${id}/`, "DELETE"),

  getStaffAttendance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/attendance/${q ? '?' + q : ''}`, "GET");
  },
  markStaffAttendance: (data) => request("/staff/attendance/", "POST", data),

  getLeaves: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/leaves/${q ? '?' + q : ''}`, "GET");
  },
  applyLeave: (data) => request("/staff/leaves/", "POST", data),
  reviewLeave: (id, data) => request(`/staff/leaves/${id}/review/`, "POST", data),

  getPayroll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/payroll/${q ? '?' + q : ''}`, "GET");
  },
  createPayrollEntry: (data) => request("/staff/payroll/", "POST", data),
  getPayrollSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/payroll/summary/${q ? '?' + q : ''}`, "GET");
  },

  getMeetings: () => request("/staff/meetings/", "GET"),
  createMeeting: (data) => request("/staff/meetings/", "POST", data),
  updateMeeting: (id, data) => request(`/staff/meetings/${id}/`, "PATCH", data),
  deleteMeeting: (id) => request(`/staff/meetings/${id}/`, "DELETE"),

  // Promotion endpoints
  getPromotionPreview: (classId, academicYear) => request(`/academics/promotions/preview/?class_id=${classId}&academic_year=${encodeURIComponent(academicYear)}`, "GET"),
  processPromotions: (data) => request("/academics/promotions/", "POST", data),
  getPromotionHistory: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/academics/promotions/history/${q ? '?' + q : ''}`, "GET");
  },

  // Activities endpoints
  getActivities: () => request("/academics/activities/", "GET"),
  createActivity: (data) => request("/academics/activities/", "POST", data),
  updateActivity: (id, data) => request(`/academics/activities/${id}/`, "PUT", data),
  deleteActivity: (id) => request(`/academics/activities/${id}/`, "DELETE"),
  getActivityEnrollments: (id) => request(`/academics/activities/${id}/enrollments/`, "GET"),
  enrollStudent: (activityId, data) => request(`/academics/activities/${activityId}/enroll/`, "POST", data),
  unenrollStudent: (activityId, studentId) => request(`/academics/activities/${activityId}/unenroll/${studentId}/`, "DELETE"),
  getActivityEvents: (id) => request(`/academics/activities/${id}/events/`, "GET"),
  createActivityEvent: (id, data) => request(`/academics/activities/${id}/events/`, "POST", data),
  getStudentActivities: () => request("/students/activities/", "GET"),
  getAccolades: () => request("/academics/accolades/", "GET"),
  createAccolade: (data) => request("/academics/accolades/", "POST", data),
  awardAccolade: (data) => request("/academics/accolades/award/", "POST", data),
  getStudentAccolades: () => request("/students/accolades/", "GET"),
  getAccoladeLeaderboard: () => request("/academics/accolades/leaderboard/", "GET"),

  // Subject-Teacher assignment
  getSubjectTeachers: (subjectId) => request(`/academics/subjects/${subjectId}/teachers/`, "GET"),
  assignTeacherToSubject: (subjectId, teacherId) => request(`/academics/subjects/${subjectId}/assign-teacher/`, "POST", { teacher_id: teacherId }),
  removeTeacherFromSubject: (subjectId, teacherId) => request(`/academics/subjects/${subjectId}/remove-teacher/${teacherId}/`, "DELETE"),

  // Library endpoints
  getBooks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/library/books/${q ? '?' + q : ''}`, "GET");
  },
  createBook: (data) => request("/library/books/", "POST", data),
  updateBook: (id, data) => request(`/library/books/${id}/`, "PUT", data),
  deleteBook: (id) => request(`/library/books/${id}/`, "DELETE"),
  issueBook: (bookId, data) => request(`/library/books/${bookId}/issue/`, "POST", data),
  getLoans: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/library/loans/${q ? '?' + q : ''}`, "GET");
  },
  returnBook: (loanId) => request(`/library/loans/${loanId}/return/`, "POST"),
  getOverdueLoans: () => request("/library/loans/overdue/", "GET"),
  getLibraryStats: () => request("/library/stats/", "GET"),

  // Health endpoints
  getStudentHealthRecord: (studentId) => request(`/academics/health/${studentId}/`, "GET"),
  updateHealthRecord: (studentId, data) => request(`/academics/health/${studentId}/`, "PUT", data),
  createHealthRecord: (studentId, data) => request(`/academics/health/${studentId}/`, "POST", data),
  getClinicVisits: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/academics/clinic-visits/${q ? '?' + q : ''}`, "GET");
  },
  createClinicVisit: (data) => request("/academics/clinic-visits/", "POST", data),
  getMyHealthRecord: () => request("/students/health/", "GET"),

  // Notifications
  getNotifications: () => request("/auth/notifications/", "GET"),
  markNotificationRead: (id) => request(`/auth/notifications/${id}/read/`, "POST"),
  markAllNotificationsRead: () => request("/auth/notifications/read-all/", "POST"),
  getUnreadNotificationCount: () => request("/auth/notifications/unread-count/", "GET"),

  // Conference scheduling (teacher)
  getTeacherConferenceSlots: () => request("/teachers/conference-slots/", "GET"),
  createConferenceSlots: (data) => request("/teachers/conference-slots/", "POST", data),
  deleteConferenceSlot: (id) => request(`/teachers/conference-slots/${id}/`, "DELETE"),

  // Conference scheduling (parent)
  getAvailableConferenceSlots: (teacherId) => request(`/parents/conferences/available/?teacher_id=${teacherId}`, "GET"),
  bookConference: (data) => request("/parents/conferences/book/", "POST", data),
  getParentConferences: () => request("/parents/conferences/", "GET"),
  cancelConference: (id) => request(`/parents/conferences/${id}/cancel/`, "POST"),

  // Disciplinary records
  getDisciplinaryRecords: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/academics/discipline/${q ? '?' + q : ''}`, "GET");
  },
  createDisciplinaryRecord: (data) => request("/academics/discipline/", "POST", data),
  updateDisciplinaryRecord: (id, data) => request(`/academics/discipline/${id}/`, "PUT", data),
  getStudentDisciplinaryRecords: (studentId) => request(`/academics/discipline/student/${studentId}/`, "GET"),
  resolveDisciplinaryRecord: (id) => request(`/academics/discipline/${id}/resolve/`, "POST"),

  // Admin Analytics
  getAdminAnalytics: () => request("/auth/analytics/", "GET"),
};

export default apiService;
