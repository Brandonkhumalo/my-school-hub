import { getCachedResponse, setCachedResponse, addToSyncQueue } from '../utils/offlineDB.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function getToken() {
  return localStorage.getItem('token');
}

function getUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.id || user?.user_id || null;
  } catch {
    return null;
  }
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

  const isGet = method.toUpperCase() === "GET";
  const isMutation = ["POST", "PUT", "PATCH"].includes(method.toUpperCase());

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

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }

    const data = await response.json();

    // Handle DRF paginated responses by following `next` links so routes receive full datasets.
    if (data && typeof data === "object" && "results" in data) {
      const isPaginated =
        Array.isArray(data.results) &&
        ("next" in data || "previous" in data || "count" in data);

      if (isGet && isPaginated && data.next) {
        const allResults = [...data.results];
        const visitedUrls = new Set([`${API_BASE_URL}${endpoint}`]);
        let nextUrl = data.next;

        while (nextUrl) {
          if (visitedUrls.has(nextUrl)) {
            throw new Error("Pagination loop detected while fetching records.");
          }
          visitedUrls.add(nextUrl);

          const nextResponse = await fetch(nextUrl, { method: "GET", headers });

          if (nextResponse.status === 401 && useAuth) {
            handleAuthExpired();
            throw new Error("Session expired. Please log in again.");
          }

          if (!nextResponse.ok) {
            throw new Error("API request failed while fetching paginated data.");
          }

          const nextData = await nextResponse.json();
          if (!nextData || typeof nextData !== "object" || !Array.isArray(nextData.results)) {
            break;
          }

          allResults.push(...nextData.results);
          nextUrl = nextData.next;
        }

        if (isGet && useAuth) {
          const uid = getUserId();
          if (uid) setCachedResponse(uid, endpoint, allResults).catch(() => {});
        }
        return allResults;
      }

      if (isGet && useAuth) {
        const uid = getUserId();
        if (uid) setCachedResponse(uid, endpoint, data.results).catch(() => {});
      }
      return data.results;
    }

    if (isGet && useAuth) {
      const uid = getUserId();
      if (uid) setCachedResponse(uid, endpoint, data).catch(() => {});
    }
    return data;
  } catch (error) {
    // Offline or network error — serve from cache / queue writes
    if (!navigator.onLine || error instanceof TypeError) {
      if (isGet && useAuth) {
        const uid = getUserId();
        if (uid) {
          const cached = await getCachedResponse(uid, endpoint);
          if (cached) return cached.data;
        }
      }
      if (isMutation && useAuth) {
        await addToSyncQueue(endpoint, method, body);
        return { queued: true };
      }
    }
    console.error("API Service Error:", error.message);
    throw error;
  }
}

async function requestAllPages(endpoint, useAuth = true) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (useAuth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const allResults = [];
  const visitedUrls = new Set();
  let nextUrl = `${API_BASE_URL}${endpoint}`;

  while (nextUrl) {
    if (visitedUrls.has(nextUrl)) {
      throw new Error("Pagination loop detected while fetching all records.");
    }
    visitedUrls.add(nextUrl);

    const response = await fetch(nextUrl, {
      method: "GET",
      headers,
    });

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

      let errorMessage = errorData.error || errorData.message || errorData.detail;
      if (!errorMessage && typeof errorData === "object") {
        const messages = Object.entries(errorData)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(", ") : val}`)
          .join("; ");
        errorMessage = messages || "API request failed";
      }

      const error = new Error(errorMessage || "API request failed");
      error.response = { data: errorData, status: response.status };
      throw error;
    }

    const data = await response.json();

    if (data && typeof data === "object" && Array.isArray(data.results)) {
      allResults.push(...data.results);
      nextUrl = data.next;
      continue;
    }

    return data;
  }

  return allResults;
}

const apiService = {
  login: (credentials) => {
    const loginData = {
      identifier: credentials.username,
      password: credentials.password
    };
    return request("/auth/login/", "POST", loginData, false);
  },
  parentForgotPassword: (data) => request("/auth/forgot-password/parent/", "POST", data, false),
  register: (userData) => request("/auth/register/", "POST", userData, false),
  registerUser: (userData) => request("/auth/register/", "POST", userData, false),
  logout: () => request("/auth/logout/", "POST"),

  getProfile: () => request("/auth/profile/", "GET"),
  updateProfile: (data) => request("/auth/profile/update/", "PUT", data),
  changePassword: (data) => request("/auth/profile/change-password/", "POST", data),
  setWhatsAppPin: (data) => request("/auth/profile/set-whatsapp-pin/", "POST", data),

  fetchUsers: () => request("/auth/users/", "GET"),
  createManagedUser: (userData) => request("/auth/users/", "POST", userData),
  updateManagedUser: (userId, userData) => request(`/auth/users/${userId}/`, "PATCH", userData),
  deleteUser: (userId) => request(`/auth/users/${userId}/delete/`, "DELETE"),
  unlockUserLogin: (userId) => request(`/auth/users/${userId}/unlock-login/`, "POST"),
  getHRPermissions: () => request("/auth/permissions/hr/", "GET"),
  updateHRPermissions: (userId, data) => request(`/auth/permissions/hr/${userId}/`, "PUT", data),
  getAccountantPermissions: () => request("/auth/permissions/accountant/", "GET"),
  updateAccountantPermissions: (userId, data) => request(`/auth/permissions/accountant/${userId}/`, "PUT", data),

  getDashboardStats: () => request("/auth/dashboard/stats/", "GET"),

  fetchSubjects: () => request("/academics/subjects/", "GET"),
  // Backward-compatible aliases used by older admin pages
  getSubjects: () => request("/academics/subjects/", "GET"),
  createSubject: (data) => request("/academics/subjects/", "POST", data),
  updateSubject: (id, data) => request(`/academics/subjects/${id}/`, "PATCH", data),
  deleteSubject: (id) => request(`/academics/subjects/${id}/`, "DELETE"),

  fetchClasses: () => request("/academics/classes/", "GET"),
  // Backward-compatible aliases used by older admin pages
  getClasses: () => request("/academics/classes/", "GET"),
  createClass: (data) => request("/academics/classes/", "POST", data),
  updateClass: (id, data) => request(`/academics/classes/${id}/`, "PATCH", data),
  deleteClass: (id) => request(`/academics/classes/${id}/`, "DELETE"),

  fetchStudents: () => requestAllPages("/academics/students/"),
  searchAcademicStudents: (q) => request(`/academics/students/?q=${encodeURIComponent(q)}`, "GET"),
  fetchStudentsByClass: (classId) => requestAllPages(`/academics/students/?class=${classId}`),
  fetchStudentById: (id) => request(`/academics/students/${id}/`, "GET"),
  fetchStudentPerformance: (studentId) => request(`/academics/students/${studentId}/performance/`, "GET"),
  createStudent: (data) => request("/academics/students/", "POST", data),
  updateStudent: (id, data) => request(`/academics/students/${id}/`, "PATCH", data),
  transferStudent: (id, data) => request(`/academics/students/${id}/transfer/`, "POST", data),
  searchPastStudents: (q) => request(`/academics/past-students/?q=${encodeURIComponent(q)}`, "GET"),

  fetchTeachers: () => request("/academics/teachers/", "GET"),
  createTeacher: (data) => request("/academics/teachers/", "POST", data),
  updateTeacher: (id, data) => request(`/academics/teachers/${id}/`, "PATCH", data),

  fetchParents: () => request("/academics/parents/", "GET"),
  createParent: (data) => request("/academics/parents/", "POST", data),
  updateParent: (id, data) => request(`/academics/parents/${id}/`, "PATCH", data),

  fetchResults: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/academics/results/${qs ? `?${qs}` : ""}`, "GET");
  },
  fetchClassAverages: () => request("/academics/results/class-averages/", "GET"),
  createResult: (data) => request("/academics/results/", "POST", data),

  fetchTimetable: () => request("/academics/timetables/", "GET"),
  fetchTimetables: () => request("/academics/timetables/", "GET"),

  fetchAnnouncements: () => request("/academics/announcements/", "GET"),
  createAnnouncement: (data) => request("/academics/announcements/", "POST", data),
  deleteAnnouncement: (announcementId) => request(`/academics/announcements/${announcementId}/`, "DELETE"),
  dismissAnnouncement: (announcementId) => request(`/academics/announcements/${announcementId}/dismiss/`, "POST"),
  dismissAllAnnouncements: () => request("/academics/announcements/dismiss-all/", "POST"),

  fetchComplaints: () => request("/academics/complaints/", "GET"),
  createComplaint: (data) => request("/academics/complaints/", "POST", data),
  getComplaintDetail: (id) => request(`/academics/complaints/${id}/`, "GET"),
  updateComplaint: (id, data) => request(`/academics/complaints/${id}/`, "PATCH", data),

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
  getTeacherClassSubjects: (classId) => request(`/teachers/classes/${classId}/subjects/`, "GET"),
  fetchTeacherStudents: () => requestAllPages("/academics/students/"),
  fetchTeacherResults: () => request("/academics/results/", "GET"),
  getResultsForReport: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/teachers/results/for-report/?${q}`, "GET");
  },
  updateReportSettings: (data) => request("/teachers/results/report-settings/", "PATCH", data),

  // Report card publishing
  generateReportsForTeachers: (data) => request("/academics/reports/generate/", "POST", data),
  publishReports: (data) => request("/academics/reports/publish/", "POST", data),
  publishAllReports: (data) => request("/academics/reports/publish-all/", "POST", data),
  getPublishedReports: () => request("/academics/reports/published/", "GET"),
  getReportApprovalRequests: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/academics/reports/approval-requests/${q ? `?${q}` : ''}`, "GET");
  },
  setReportDeliveryExclusion: (data) => request("/academics/reports/delivery-exclusions/", "POST", data),
  reviewReportApprovalRequest: (requestId, data) =>
    request(`/academics/reports/approval-requests/${requestId}/review/`, "POST", data),

  fetchParentChildren: () => requestAllPages("/academics/students/"),
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
  getChildFees: (childId) => request(`/parents/children/${childId}/fees/`, "GET"),

  // Teacher endpoints
  getTeacherSubjects: () => request("/teachers/subjects/", "GET"),
  getSubjectStudents: (subjectId) => request(`/teachers/subjects/${subjectId}/students/`, "GET"),
  getSubjectPerformance: (subjectId) => request(`/teachers/subjects/${subjectId}/performance/`, "GET"),
  getSubjectStudentsAtRisk: (subjectId, search = '', atRisk = 'all', sortBy = 'risk_score') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (atRisk !== 'all') params.append('at_risk', atRisk);
    if (sortBy) params.append('sort_by', sortBy);
    return request(`/teachers/subjects/${subjectId}/students-risk/?${params.toString()}`, "GET");
  },
  getTeacherStudentMarksBreakdown: (studentId, subjectId) =>
    request(`/teachers/students/${studentId}/marks-breakdown/?subject=${encodeURIComponent(subjectId)}`, "GET"),
  addStudentMark: (data) => request("/teachers/marks/add/", "POST", data),
  // Class attendance (class teacher only)
  getClassAttendanceRegister: (date) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    return request(`/teachers/attendance/class/register/?${params.toString()}`, "GET");
  },
  markClassAttendance: (data) => request("/teachers/attendance/class/mark/", "POST", data),

  // Subject attendance (per subject per class)
  getSubjectAttendanceRegister: (date, classId, subjectId, periodNumber = null, periodLabel = '') => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (classId) params.append('class_id', classId);
    if (subjectId) params.append('subject_id', subjectId);
    if (periodNumber !== null && periodNumber !== undefined && periodNumber !== '') params.append('period_number', periodNumber);
    if (periodLabel) params.append('period_label', periodLabel);
    return request(`/teachers/attendance/subject/register/?${params.toString()}`, "GET");
  },
  markSubjectAttendance: (data) => request("/teachers/attendance/subject/mark/", "POST", data),
  setAttendancePeriodTrackingStartDate: (startDate) =>
    request("/academics/attendance/period-tracking-start-date/", "POST", { start_date: startDate }),
  getAttendancePermissions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/academics/attendance/permissions/${qs ? `?${qs}` : ''}`, "GET");
  },
  createAttendancePermission: (data) => request("/academics/attendance/permissions/", "POST", data),
  editClassAttendance: (attendanceId, data) =>
    request(`/academics/attendance/class/${attendanceId}/edit/`, "PATCH", data),
  editSubjectAttendance: (attendanceId, data) =>
    request(`/academics/attendance/subject/${attendanceId}/edit/`, "PATCH", data),

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

  // Admin conversation review
  adminListConversations: () => request("/admin/conversations/", "GET"),
  adminGetConversation: (teacherId, parentId) =>
    request(`/admin/conversations/${teacherId}/${parentId}/`, "GET"),

  // Assessment Plans (admin/HR-boss configures; teacher/parent/student read)
  listAssessmentPlans: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/academics/assessment-plans/${qs ? `?${qs}` : ''}`, "GET");
  },
  createAssessmentPlan: (data) => request(`/academics/assessment-plans/`, "POST", data),
  updateAssessmentPlan: (planId, data) => request(`/academics/assessment-plans/${planId}/`, "PATCH", data),
  deleteAssessmentPlan: (planId) => request(`/academics/assessment-plans/${planId}/`, "DELETE"),
  getAssessmentPlanForTeacher: (subjectId, year, term, classId = "") => {
    const qs = new URLSearchParams();
    qs.set("subject", subjectId);
    qs.set("year", year);
    qs.set("term", term);
    if (classId) qs.set("class_id", classId);
    return request(`/academics/assessment-plans/for-teacher/?${qs.toString()}`, "GET");
  },
  getAssessmentPlansForStudent: (year = '', term = '') => {
    const qs = new URLSearchParams();
    if (year) qs.set('year', year);
    if (term) qs.set('term', term);
    const suffix = qs.toString() ? `?${qs}` : '';
    return request(`/academics/assessment-plans/for-student/${suffix}`, "GET");
  },
  getAssessmentPlansForParent: (childId = '', year = '', term = '') => {
    const qs = new URLSearchParams();
    if (childId) qs.set('child', childId);
    if (year) qs.set('year', year);
    if (term) qs.set('term', term);
    const suffix = qs.toString() ? `?${qs}` : '';
    return request(`/academics/assessment-plans/for-parent/${suffix}`, "GET");
  },

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
  updateHomework: async (homeworkId, formData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/teachers/homework/${homeworkId}/update/`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to update homework");
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
  getTransportPaymentStatus: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/finances/transport-payment-status/${query ? '?' + query : ''}`, "GET");
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
  updateParentTransportPreference: (childId, data) => request(`/finances/transport-preferences/${childId}/`, "PUT", data),

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
  getBulkImportCatalog: () => request("/academics/bulk-import/catalog/", "GET"),
  validateBulkImport: (formData) => requestMultipart("/academics/bulk-import/validate/", "POST", formData),
  commitBulkImport: (formData) => requestMultipart("/academics/bulk-import/commit/", "POST", formData),
  getBulkImportHistory: () => request("/academics/bulk-import/history/", "GET"),
  rollbackBulkImport: (jobId) => request(`/academics/bulk-import/history/${jobId}/rollback/`, "POST", {}),
  bulkImportStudents: (formData) => requestMultipart("/academics/students/bulk-import/", "POST", formData),
  bulkImportResults: (formData) => requestMultipart("/academics/results/bulk-import/", "POST", formData),
  bulkImportFees: (formData) => requestMultipart("/finances/fees/bulk-import/", "POST", formData),

  // Student attendance (student's own)
  getStudentAttendance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/students/attendance/${q ? '?' + q : ''}`, "GET");
  },

  // Assignment submissions (student)
  getStudentAssignments: () => request("/students/assignments/", "GET"),
  getMySubmission: (assignmentId) => request(`/students/assignments/${assignmentId}/submit/`, "GET"),
  submitAssignment: (assignmentId, formData) =>
    requestMultipart(`/students/assignments/${assignmentId}/submit/`, "POST", formData),

  // Assignment submissions (teacher)
  getTeacherAssignments: () => request("/teachers/assignments/", "GET"),
  createTeacherAssignment: (data) => request("/teachers/assignments/", "POST", data),
  getTeacherAssignment: (assignmentId) => request(`/teachers/assignments/${assignmentId}/`, "GET"),
  updateTeacherAssignment: (assignmentId, data) => request(`/teachers/assignments/${assignmentId}/`, "PATCH", data),
  deleteTeacherAssignment: (assignmentId) => request(`/teachers/assignments/${assignmentId}/`, "DELETE"),
  getAssignmentSubmissions: (assignmentId) => request(`/teachers/assignments/${assignmentId}/submissions/`, "GET"),
  gradeSubmission: (submissionId, data) => request(`/teachers/submissions/${submissionId}/grade/`, "POST", data),
  uploadAssignmentAttachmentFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestMultipart("/services/papers/upload", "POST", formData);
  },

  // PayNow Zimbabwe payments
  initiatePaynowPayment: (data) => request("/finances/payments/paynow/initiate/", "POST", data),
  checkPaynowStatus: (pollUrl) => request(`/finances/payments/paynow/status/?poll_url=${encodeURIComponent(pollUrl)}`, "GET"),

  // School settings (admin)
  getSchoolSettings: () => request("/auth/school/settings/", "GET"),
  updateSchoolSettings: (data) => request("/auth/school/settings/", "PUT", data),

  // Current academic period (all authenticated users)
  getCurrentAcademicPeriod: () => request("/auth/school/current-period/", "GET"),

  // Dashboard Customization
  getSchoolCustomization: () => request("/auth/school/customization/", "GET"),
  updateSchoolCustomization: (data) => request("/auth/school/customization/", "PUT", data),
  uploadSchoolLogo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestMultipart("/auth/school/customization/logo/", "POST", formData);
  },

  // Page visibility registry (admin customization)
  getAvailablePages: () => request("/auth/school/available-pages/", "GET"),

  // Past exam papers — file lives on go-services, metadata in Django.
  // Step 1: upload the file to go-services (returns file_key + size + page_count)
  uploadPastPaperFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestMultipart("/services/papers/upload", "POST", formData);
  },
  // Step 2: persist metadata in Django, referencing the file_key from step 1
  createPastPaper: (data) => request("/academics/past-papers/", "POST", data),
  listPastPapers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/academics/past-papers/${qs ? '?' + qs : ''}`, "GET");
  },
  getPastPaper: (id) => request(`/academics/past-papers/${id}/`, "GET"),
  deletePastPaper: (id) => request(`/academics/past-papers/${id}/`, "DELETE"),
  extractPastPaperQuestions: (id) => request(`/academics/past-papers/${id}/extract/`, "POST"),
  // Fetch the raw file as a Blob so the caller can render it inline / trigger download.
  // (A plain <a href> link would not include the Authorization header.)
  downloadPastPaperFile: (fileKey) =>
    requestFile(`/services/papers/file?key=${encodeURIComponent(fileKey)}`),

  // Generated tests (teacher)
  generateTestFromPaper: (data) => request("/teachers/tests/generate-from-paper/", "POST", data),
  listTeacherTests: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/teachers/tests/${qs ? `?${qs}` : ""}`, "GET");
  },
  getTeacherTest: (testId) => request(`/teachers/tests/${testId}/`, "GET"),
  updateTeacherTest: (testId, data) => request(`/teachers/tests/${testId}/`, "PATCH", data),
  replaceTeacherTestQuestions: (testId, questions) =>
    request(`/teachers/tests/${testId}/questions/`, "POST", { action: "replace", questions }),
  upsertTeacherTestQuestion: (testId, question) =>
    request(`/teachers/tests/${testId}/questions/`, "POST", { action: "upsert", question }),
  deleteTeacherTestQuestion: (testId, questionId) =>
    request(`/teachers/tests/${testId}/questions/`, "POST", { action: "delete", question_id: questionId }),
  publishTeacherTest: (testId) => request(`/teachers/tests/${testId}/publish/`, "POST", {}),
  getTeacherTestAttempts: (testId) => request(`/teachers/tests/${testId}/attempts/`, "GET"),
  getTeacherAttemptDetail: (attemptId) => request(`/teachers/attempts/${attemptId}/grade/`, "GET"),
  gradeTeacherTestAttempt: (attemptId, data) => request(`/teachers/attempts/${attemptId}/grade/`, "POST", data),
  finalizeTeacherTest: (testId) => request(`/teachers/tests/${testId}/finalize/`, "POST", {}),

  // Generated tests (student)
  getStudentTests: () => request("/students/tests/", "GET"),
  startStudentTest: (testId) => request(`/students/tests/${testId}/start/`, "POST", {}),
  getStudentAttemptDetail: (attemptId) => request(`/students/attempts/${attemptId}/`, "GET"),
  submitStudentAttempt: (attemptId, data) => request(`/students/attempts/${attemptId}/submit/`, "POST", data),

  // Report card config (admin)
  getReportCardConfig: () => request("/auth/school/report-config/", "GET"),
  updateReportCardConfig: (data) => request("/auth/school/report-config/", "PUT", data),
  uploadReportCardImage: (field, file) => {
    const formData = new FormData();
    formData.append('field', field);
    formData.append('file', file);
    return requestMultipart("/auth/school/report-config/upload/", "POST", formData);
  },

  // Report card templates (shareable across tenants)
  getReportCardTemplates: () => request("/auth/school/report-templates/", "GET"),
  saveReportCardTemplate: (data) => request("/auth/school/report-templates/", "POST", data),
  applyReportCardTemplate: (id) => request(`/auth/school/report-templates/${id}/`, "POST"),
  deleteReportCardTemplate: (id) => request(`/auth/school/report-templates/${id}/`, "DELETE"),

  // Subject groups (used for grouped report card sections)
  getSubjectGroups: () => request("/auth/school/subject-groups/", "GET"),
  saveSubjectGroup: (data) => request("/auth/school/subject-groups/", "POST", data),
  deleteSubjectGroup: (id) => request(`/auth/school/subject-groups/${id}/`, "DELETE"),

  // Per-subject teacher feedback (comment + effort grade)
  getSubjectFeedback: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/teachers/subject-feedback/${q ? '?' + q : ''}`, "GET");
  },
  saveSubjectFeedback: (data) => request("/teachers/subject-feedback/save/", "POST", data),
  getTeacherReportFeedbackConfig: () => request("/teachers/report-feedback/config/", "GET"),
  submitReportFeedbackForSignoff: (data) => request("/teachers/report-feedback/submit/", "POST", data),
  getReportFeedbackSubmissionStatus: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/teachers/report-feedback/status/${q ? `?${q}` : ''}`, "GET");
  },

  // Audit logs (admin)
  getAuditLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/auth/audit-logs/${q ? '?' + q : ''}`, "GET");
  },

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
  generatePayroll: (data) => request("/staff/payroll/generate/", "POST", data),
  markPayrollPaid: (data) => request("/staff/payroll/mark-paid/", "POST", data),
  getPayrollPaymentRequests: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/payroll/payment-requests/${q ? '?' + q : ''}`, "GET");
  },
  reviewPayrollPaymentRequest: (requestId, data) => request(`/staff/payroll/payment-requests/${requestId}/review/`, "POST", data),
  createPayrollEntry: (data) => request("/staff/payroll/", "POST", data),
  getPayrollSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/payroll/summary/${q ? '?' + q : ''}`, "GET");
  },
  getFinanceSummary: () => request("/finances/summary/", "GET"),
  getSchoolExpenses: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/finances/expenses/${q ? '?' + q : ''}`, "GET");
  },
  createSchoolExpense: (data) => request("/finances/expenses/", "POST", data),
  approveSchoolExpense: (expenseId, data) => request(`/finances/expenses/${expenseId}/approve/`, "POST", data),

  getMeetings: () => request("/staff/meetings/", "GET"),
  createMeeting: (data) => request("/staff/meetings/", "POST", data),
  updateMeeting: (id, data) => request(`/staff/meetings/${id}/`, "PATCH", data),
  deleteMeeting: (id) => request(`/staff/meetings/${id}/`, "DELETE"),

  // Security operations
  getVisitorLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/visitors/${q ? '?' + q : ''}`, "GET");
  },
  logVisitor: (data) => request("/staff/visitors/", "POST", data),
  checkOutVisitor: (id, data = {}) => request(`/staff/visitors/${id}/checkout/`, "PATCH", data),

  getIncidentReports: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/incidents/${q ? '?' + q : ''}`, "GET");
  },
  createIncidentReport: (data) => request("/staff/incidents/", "POST", data),
  getIncidentReportDetail: (id) => request(`/staff/incidents/${id}/`, "GET"),
  updateIncidentReport: (id, data) => request(`/staff/incidents/${id}/`, "PATCH", data),

  // Cleaning schedules and tasks
  getCleaningSchedules: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/cleaning-schedules/${q ? '?' + q : ''}`, "GET");
  },
  createCleaningSchedule: (data) => request("/staff/cleaning-schedules/", "POST", data),
  updateCleaningSchedule: (id, data) => request(`/staff/cleaning-schedules/${id}/`, "PATCH", data),

  getCleaningTasks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/staff/cleaning-tasks/${q ? '?' + q : ''}`, "GET");
  },
  completeCleaningTask: (id, data = {}) => request(`/staff/cleaning-tasks/${id}/complete/`, "PATCH", data),

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
  enrollStudent: (activityId, data = {}) => request(`/academics/activities/${activityId}/enroll/`, "POST", data),
  reviewActivityEnrollment: (activityId, enrollmentId, data) => request(`/academics/activities/${activityId}/enrollments/${enrollmentId}/review/`, "POST", data),
  unenrollStudent: (activityId, studentId) => request(`/academics/activities/${activityId}/unenroll/${studentId}/`, "DELETE"),
  suspendStudentActivity: (activityId, studentId, data) => request(`/academics/activities/${activityId}/suspend/${studentId}/`, "POST", data),
  getSportsAnalytics: () => request("/academics/activities/analytics/"),
  getActivityEvents: (id) => request(`/academics/activities/${id}/events/`, "GET"),
  createActivityEvent: (id, data) => request(`/academics/activities/${id}/events/`, "POST", data),
  getEventSquad: (activityId, eventId) => request(`/academics/activities/${activityId}/events/${eventId}/squad/`, "GET"),
  updateMatchSquad: (activityId, eventId, data) => request(`/academics/activities/${activityId}/events/${eventId}/squad/`, "POST", data),
  logTrainingAttendance: (activityId, eventId, data) => request(`/academics/activities/${activityId}/events/${eventId}/attendance/`, "POST", data),
  getSportsHouses: () => request("/academics/sports-houses/", "GET"),
  createSportsHouse: (data) => request("/academics/sports-houses/", "POST", data),
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
  getSubjectClassAssignments: (subjectId) => request(`/academics/subjects/${subjectId}/class-assignments/`, "GET"),
  assignSubjectToClasses: (subjectId, data) => request(`/academics/subjects/${subjectId}/assign-classes/`, "POST", data),
  removeSubjectClassAssignment: (subjectId, assignmentId) => request(`/academics/subjects/${subjectId}/class-assignments/${assignmentId}/`, "DELETE"),

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
  getLoanRequests: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/library/loan-requests/${q ? '?' + q : ''}`, "GET");
  },
  createLoanRequest: (data) => request("/library/loan-requests/", "POST", data),
  reviewLoanRequest: (requestId, data) => request(`/library/loan-requests/${requestId}/review/`, "POST", data),
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

  // Boarding endpoints
  getBoardingSummary: () => request("/boarding/summary/", "GET"),
  getBoardingMealMenus: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/meals/menus/${q ? '?' + q : ''}`, "GET");
  },
  createBoardingMealMenu: (data) => request("/boarding/meals/menus/", "POST", data),
  getBoardingMealAttendance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/meals/attendance/${q ? '?' + q : ''}`, "GET");
  },
  saveBoardingMealAttendance: (data) => request("/boarding/meals/attendance/", "POST", data),
  getDietaryFlag: (studentId) => request(`/boarding/students/${studentId}/dietary/`, "GET"),
  updateDietaryFlag: (studentId, data) => request(`/boarding/students/${studentId}/dietary/`, "PUT", data),

  getDormitories: () => request("/boarding/dormitories/", "GET"),
  createDormitory: (data) => request("/boarding/dormitories/", "POST", data),
  getDormAssignments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/dorm-assignments/${q ? '?' + q : ''}`, "GET");
  },
  createDormAssignment: (data) => request("/boarding/dorm-assignments/", "POST", data),
  getDormRollCalls: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/dorm-attendance/${q ? '?' + q : ''}`, "GET");
  },
  createDormRollCall: (data) => request("/boarding/dorm-attendance/", "POST", data),
  getLightsOutRecords: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/lights-out/${q ? '?' + q : ''}`, "GET");
  },
  createLightsOutRecord: (data) => request("/boarding/lights-out/", "POST", data),

  getExeatRequests: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/exeat/requests/${q ? '?' + q : ''}`, "GET");
  },
  createExeatRequest: (data) => request("/boarding/exeat/requests/", "POST", data),
  decideExeatRequest: (id, data) => request(`/boarding/exeat/requests/${id}/decision/`, "POST", data),
  getExeatLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/exeat/logs/${q ? '?' + q : ''}`, "GET");
  },
  createExeatLog: (data) => request("/boarding/exeat/logs/", "POST", data),

  getSickbayVisits: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/sickbay/visits/${q ? '?' + q : ''}`, "GET");
  },
  createSickbayVisit: (data) => request("/boarding/sickbay/visits/", "POST", data),
  getMedicationSchedules: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/medications/${q ? '?' + q : ''}`, "GET");
  },
  createMedicationSchedule: (data) => request("/boarding/medications/", "POST", data),

  getTuckWallets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/tuck/wallets/${q ? '?' + q : ''}`, "GET");
  },
  getTuckTransactions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/tuck/transactions/${q ? '?' + q : ''}`, "GET");
  },
  createTuckTransaction: (data) => request("/boarding/tuck/transactions/", "POST", data),
  getTuckLowBalance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/tuck/low-balance/${q ? '?' + q : ''}`, "GET");
  },

  getLaundrySchedules: () => request("/boarding/laundry/schedules/", "GET"),
  createLaundrySchedule: (data) => request("/boarding/laundry/schedules/", "POST", data),
  getLostItems: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/laundry/lost-items/${q ? '?' + q : ''}`, "GET");
  },
  createLostItem: (data) => request("/boarding/laundry/lost-items/", "POST", data),

  getPrepAttendance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/prep-attendance/${q ? '?' + q : ''}`, "GET");
  },
  createPrepAttendance: (data) => request("/boarding/prep-attendance/", "POST", data),
  getDormInspections: () => request("/boarding/dorm-inspections/", "GET"),
  createDormInspection: (data) => request("/boarding/dorm-inspections/", "POST", data),
  getWellnessCheckins: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/boarding/wellness-checkins/${q ? '?' + q : ''}`, "GET");
  },
  createWellnessCheckin: (data) => request("/boarding/wellness-checkins/", "POST", data),

  // 2FA
  twoFactorStatus: () => request('/auth/2fa/status/', 'GET'),
  twoFactorSetup: () => request('/auth/2fa/setup/', 'POST'),
  twoFactorVerifySetup: (data) => request('/auth/2fa/verify-setup/', 'POST', data),
  twoFactorVerifyOtp: (data) => request('/auth/2fa/verify-otp/', 'POST', data, false),
  twoFactorVerifyBackup: (data) => request('/auth/2fa/verify-backup/', 'POST', data, false),
  twoFactorDisable: (data) => request('/auth/2fa/disable/', 'POST', data),
  twoFactorRegenerateBackupCodes: () => request('/auth/2fa/regenerate-backup-codes/', 'POST'),
  twoFactorTrustedDevices: () => request('/auth/2fa/trusted-devices/', 'GET'),
  twoFactorRevokeTrustedDevice: (deviceId) => request('/auth/2fa/trusted-devices/', 'DELETE', deviceId ? { device_id: deviceId } : {}),
  enforce2FA: (data) => request('/auth/school/enforce-2fa/', 'POST', data),
  twoFactorCompliance: () => request('/auth/2fa/compliance/', 'GET'),

  // Admin Analytics
  getAdminAnalytics: () => request("/auth/analytics/", "GET"),

  // At-Risk Students (Admin)
  getAdminAtRiskStudents: (view = 'overall', search = '', subjectId = null, classId = null, sortBy = 'risk_score') => {
    const params = new URLSearchParams();
    if (view) params.append('view', view);
    if (search) params.append('search', search);
    if (subjectId) params.append('subject_id', subjectId);
    if (classId) params.append('class_id', classId);
    if (sortBy) params.append('sort_by', sortBy);
    return request(`/academics/admin/at-risk-students/?${params.toString()}`, "GET");
  },
};

export const isOnline = () => navigator.onLine;

export default apiService;
