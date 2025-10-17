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
};

export default apiService;
