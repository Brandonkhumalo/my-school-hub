const API_BASE_URL = "/api";

function getToken() {
  return localStorage.getItem('token');
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
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "API request failed");
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
  
  fetchClasses: () => request("/academics/classes/", "GET"),
  createClass: (data) => request("/academics/classes/", "POST", data),
  
  fetchStudents: () => request("/academics/students/", "GET"),
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
  fetchTeacherStudents: () => request("/academics/students/", "GET"),
  fetchTeacherResults: () => request("/academics/results/", "GET"),
  
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
  
  // Timetable generation endpoints
  generateTimetable: (data = {}) => request("/academics/timetables/generate/", "POST", data),
  getTimetableStats: () => request("/academics/timetables/stats/", "GET"),
};

export default apiService;
