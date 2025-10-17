<body>
  <div id="root"></div>
  
  <script type="text/babel" id="app-script">
    const { 
      useState, 
      useEffect, 
      useContext, 
      createContext, 
      useReducer 
    } = React;
    const { 
      BrowserRouter, 
      Routes, 
      Route, 
      Link, 
      useNavigate, 
      useLocation,
      Navigate 
    } = ReactRouterDOM;
    const { Provider, useSelector, useDispatch } = ReactRedux;
    const { createStore } = Redux;

    // Create Auth Context
    const AuthContext = createContext();

    // Create Auth Provider
    function AuthProvider({ children }) {
      const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
      });

      const login = (userData) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      };

      const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
      };

      return (
        <AuthContext.Provider value={{ user, login, logout }}>
          {children}
        </AuthContext.Provider>
      );
    }

    // Auth Hook
    function useAuth() {
      return useContext(AuthContext);
    }

    // Fake API service
    const apiService = {
      login: async (credentials) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            const response = {
              token: "abcd1234efgh5678",
              user: {
                id: 1,
                username: credentials.username,
                role: credentials.username, // For demo, we'll use the username as the role
                full_name: credentials.username === 'admin' ? 'Admin User' : 
                           credentials.username === 'teacher' ? 'John Doe' :
                           credentials.username === 'parent' ? 'Mary Smith' : 'Alice Smith'
              }
            };
            resolve(response);
          }, 1000);
        });
      },
      fetchSubjects: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 1, name: "Mathematics", code: "MATH101", description: "Basic math" },
              { id: 2, name: "Physics", code: "PHY101", description: "Physics subject" },
              { id: 3, name: "English", code: "ENG101", description: "English language" },
              { id: 4, name: "Chemistry", code: "CHEM101", description: "Chemistry basics" }
            ]);
          }, 800);
        });
      },
      fetchClasses: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 1, name: "Class A", grade_level: "7", academic_year: "2025", class_teacher: 3, class_teacher_name: "John Doe", student_count: 45 },
              { id: 2, name: "Class B", grade_level: "7", academic_year: "2025", class_teacher: 4, class_teacher_name: "Jane Smith", student_count: 42 },
              { id: 3, name: "Class C", grade_level: "8", academic_year: "2025", class_teacher: 5, class_teacher_name: "Robert Johnson", student_count: 39 }
            ]);
          }, 800);
        });
      },
      fetchStudents: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 5, user: { id: 10, full_name: "Alice Smith", email: "alice@example.com" }, student_class: 1, class_name: "Class A", admission_date: "2025-01-15", parent_contact: "+263771234567", address: "123 Main St", parent_names: ["Mary Smith", "John Smith"] },
              { id: 6, user: { id: 11, full_name: "Bob Johnson", email: "bob@example.com" }, student_class: 2, class_name: "Class B", admission_date: "2025-01-16", parent_contact: "+263772345678", address: "456 Oak St", parent_names: ["Carol Johnson", "David Johnson"] },
              { id: 7, user: { id: 12, full_name: "Eva Williams", email: "eva@example.com" }, student_class: 1, class_name: "Class A", admission_date: "2025-01-17", parent_contact: "+263773456789", address: "789 Pine St", parent_names: ["Sarah Williams", "Michael Williams"] }
            ]);
          }, 800);
        });
      },
      fetchTeachers: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 2, user: { id: 12, full_name: "John Doe", email: "john@example.com" }, subjects: [{ id: 1, name: "Mathematics", code: "MATH101" }], class_taught: [{ id: 1, name: "Class A" }], hire_date: "2023-01-01", qualification: "B.Ed Mathematics" },
              { id: 3, user: { id: 13, full_name: "Jane Smith", email: "jane@example.com" }, subjects: [{ id: 2, name: "Physics", code: "PHY101" }], class_taught: [{ id: 2, name: "Class B" }], hire_date: "2023-02-15", qualification: "M.Sc Physics" },
              { id: 4, user: { id: 14, full_name: "Robert Johnson", email: "robert@example.com" }, subjects: [{ id: 3, name: "English", code: "ENG101" }], class_taught: [{ id: 3, name: "Class C" }], hire_date: "2023-03-10", qualification: "B.A English Literature" }
            ]);
          }, 800);
        });
      },
      fetchResults: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 1, student: 5, student_name: "Alice Smith", student_number: "STU2025001", subject_name: "Mathematics", teacher_name: "John Doe", exam_type: "Midterm", score: 80, max_score: 100, percentage: 80, grade: "A-", date_recorded: "2025-03-15", academic_term: "Term 1", academic_year: "2025" },
              { id: 2, student: 6, student_name: "Bob Johnson", student_number: "STU2025002", subject_name: "Physics", teacher_name: "Jane Smith", exam_type: "Final", score: 75, max_score: 100, percentage: 75, grade: "B+", date_recorded: "2025-03-30", academic_term: "Term 1", academic_year: "2025" },
              { id: 3, student: 7, student_name: "Eva Williams", student_number: "STU2025003", subject_name: "English", teacher_name: "Robert Johnson", exam_type: "Quiz", score: 90, max_score: 100, percentage: 90, grade: "A+", date_recorded: "2025-03-10", academic_term: "Term 1", academic_year: "2025" }
            ]);
          }, 800);
        });
      },
      fetchTimetable: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 10, class_name: "Class A", subject_name: "Math", teacher_name: "John Doe", day_of_week: "Monday", start_time: "08:00", end_time: "09:30", room: "101" },
              { id: 11, class_name: "Class A", subject_name: "Physics", teacher_name: "Jane Smith", day_of_week: "Monday", start_time: "10:00", end_time: "11:30", room: "102" },
              { id: 12, class_name: "Class A", subject_name: "English", teacher_name: "Robert Johnson", day_of_week: "Tuesday", start_time: "08:00", end_time: "09:30", room: "101" }
            ]);
          }, 800);
        });
      },
      fetchAnnouncements: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 1, title: "School Opening", content: "School opens on January 15, 2025", author_name: "Admin", date_posted: "2024-12-20", is_active: true },
              { id: 2, title: "Parent Teacher Meeting", content: "PTM scheduled for February 5, 2025", author_name: "Admin", date_posted: "2025-01-20", is_active: true },
              { id: 3, title: "Holiday", content: "School closed tomorrow", author_name: "Admin", date_posted: "2025-09-22", is_active: true }
            ]);
          }, 800);
        });
      },
      fetchComplaints: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 4, student_name: "Alice Smith", submitted_by_name: "Mary Smith", title: "Classroom Issue", description: "Inadequate lighting in Class A", status: "Resolved" },
              { id: 5, student_name: "Bob Johnson", submitted_by_name: "Carol Johnson", title: "Transport Issue", description: "School bus delay", status: "In Progress" },
              { id: 6, student_name: "Alice Smith", submitted_by_name: "Mary Smith", title: "Bullying", description: "Reported incident", status: "Pending" }
            ]);
          }, 800);
        });
      },
      fetchSuspensions: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 7, student_name: "Bob Johnson", teacher_name: "Jane Smith", reason: "Disrupting class", start_date: "2025-02-10", end_date: "2025-02-12", is_active: false },
              { id: 8, student_name: "Alice Smith", teacher_name: "John Doe", reason: "Discipline", start_date: "2025-09-20", end_date: "2025-09-25", is_active: true }
            ]);
          }, 800);
        });
      },
      fetchFeeTypes: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 1, name: "Tuition Fee" },
              { id: 2, name: "Transport Fee" },
              { id: 3, name: "Laboratory Fee" }
            ]);
          }, 800);
        });
      },
      fetchStudentFees: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 11, student_name: "Alice Smith", fee_type_name: "Tuition Fee", amount_due: 500, amount_paid: 200, balance: 300, academic_term: "Term 1", academic_year: "2025" },
              { id: 12, student_name: "Bob Johnson", fee_type_name: "Tuition Fee", amount_due: 500, amount_paid: 500, balance: 0, academic_term: "Term 1", academic_year: "2025" },
              { id: 13, student_name: "Eva Williams", fee_type_name: "Transport Fee", amount_due: 200, amount_paid: 100, balance: 100, academic_term: "Term 1", academic_year: "2025" }
            ]);
          }, 800);
        });
      },
      fetchPayments: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 20, student_name: "Alice Smith", amount: 200, payment_method: "cash", transaction_id: "TXN123456", payment_status: "completed", payment_date: "2025-01-20" },
              { id: 21, student_name: "Eva Williams", amount: 100, payment_method: "bank transfer", transaction_id: "TXN123457", payment_status: "completed", payment_date: "2025-01-25" }
            ]);
          }, 800);
        });
      },
      fetchInvoices: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 15, student_name: "Alice Smith", total_amount: 500, amount_paid: 200, balance: 300, issue_date: "2025-09-01", due_date: "2025-09-30", status: "Partially Paid" },
              { id: 16, student_name: "Bob Johnson", total_amount: 500, amount_paid: 500, balance: 0, issue_date: "2025-09-01", due_date: "2025-09-30", status: "Paid" },
              { id: 17, student_name: "Eva Williams", total_amount: 200, amount_paid: 100, balance: 100, issue_date: "2025-09-01", due_date: "2025-09-30", status: "Partially Paid" }
            ]);
          }, 800);
        });
      },
      fetchReports: async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([
              { id: 7, title: "Term 1 Report", report_type: "Revenue", total_revenue: 10000, total_expenses: 4000, net_profit: 6000, academic_year: "2025", academic_term: "Term 1", generated_by_name: "Accountant Admin" },
              { id: 8, title: "Term 2 Report", report_type: "Revenue", total_revenue: 12000, total_expenses: 5000, net_profit: 7000, academic_year: "2025", academic_term: "Term 2", generated_by_name: "Accountant Admin" }
            ]);
          }, 800);
        });
      },
      fetchStudentSummary: async (id) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              student_id: id,
              total_fees_due: 500,
              total_fees_paid: 200,
              total_balance: 300,
              unpaid_fees_count: 1,
              recent_payments: [
                { id: 20, amount: 200, payment_status: "completed", payment_date: "2025-01-20" }
              ],
              pending_fees: [
                { id: 11, fee_type_name: "Tuition Fee", balance: 300 }
              ]
            });
          }, 800);
        });
      },
      fetchStudentDetails: async (id) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: id || 5,
              user: {
                id: 10,
                full_name: "Alice Smith",
                email: "alice@example.com"
              },
              student_class: 1,
              class_name: "Class A",
              admission_date: "2025-01-15",
              parent_contact: "+263771234567",
              address: "123 Main St",
              parent_names: ["Mary Smith", "John Smith"]
            });
          }, 800);
        });
      },
      fetchStudentPerformance: async (id) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              student_id: id || 5,
              student_name: "Alice Smith",
              student_number: "STU2025001",
              class_name: "Class A",
              academic_year: "2025",
              academic_term: "Term 1",
              total_subjects: 3,
              average_score: 82.5,
              overall_grade: "A-",
              results: [
                { id: 1, student: 5, subject: 1, subject_name: "Mathematics", teacher_name: "John Doe", exam_type: "Midterm", score: 80, max_score: 100, percentage: 80, grade: "A-", date_recorded: "2025-03-15", academic_term: "Term 1", academic_year: "2025" },
                { id: 2, student: 5, subject: 2, subject_name: "Physics", teacher_name: "Jane Smith", exam_type: "Final", score: 75, max_score: 100, percentage: 75, grade: "B+", date_recorded: "2025-03-30", academic_term: "Term 1", academic_year: "2025" },
                { id: 3, student: 5, subject: 3, subject_name: "English", teacher_name: "Robert Johnson", exam_type: "Quiz", score: 90, max_score: 100, percentage: 90, grade: "A+", date_recorded: "2025-03-10", academic_term: "Term 1", academic_year: "2025" }
              ]
            });
          }, 800);
        });
      }
    };

    // Login Component
    function Login() {
      const navigate = useNavigate();
      const { login } = useAuth();
      const [username, setUsername] = useState("");
      const [password, setPassword] = useState("");
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState("");

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
          setError("Please enter both username and password");
          return;
        }

        try {
          setLoading(true);
          setError("");
          const response = await apiService.login({ username, password });
          login(response.user);
          
          // Redirect based on role
          switch (response.user.role) {
            case "admin":
              navigate("/admin");
              break;
            case "teacher":
              navigate("/teacher");
              break;
            case "parent":
              navigate("/parent");
              break;
            case "student":
              navigate("/student");
              break;
            default:
              navigate("/");
          }
        } catch (err) {
          setError("Failed to login. Please check your credentials.");
        } finally {
          setLoading(false);
        }
      };

      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800">School Management System</h1>
              <p className="text-gray-600 mt-2">Sign in to access your dashboard</p>
            </div>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  id="username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                />
                <p className="text-xs text-gray-500 mt-1">Use: admin, teacher, parent, or student</p>
              </div>
              
              <div className="mb-6">
                <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  id="password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <p className="text-xs text-gray-500 mt-1">Use any password for demo</p>
              </div>
              
              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition duration-200 flex items-center justify-center"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Signing In...
                  </>
                ) : "Sign In"}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account? Contact your administrator
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Sidebar Component
    function Sidebar({ items, role }) {
      const [isOpen, setIsOpen] = useState(false);
      const location = useLocation();

      return (
        <>
          {/* Mobile menu button */}
          <button 
            className="fixed top-4 left-4 z-40 md:hidden bg-blue-800 text-white p-2 rounded-md"
            onClick={() => setIsOpen(!isOpen)}
          >
            <i className={`fas ${isOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
          
          {/* Sidebar */}
          <div className={`sidebar bg-blue-900 text-white py-8 px-4 z-30 ${isOpen ? 'show' : ''}`}>
            <div className="flex items-center justify-center mb-8">
              <i className="fas fa-school text-3xl mr-3"></i>
              <div>
                <h2 className="text-xl font-bold">School System</h2>
                <p className="text-sm text-blue-300 capitalize">{role} Dashboard</p>
              </div>
            </div>
            
            <nav>
              <ul>
                {items.map((item, index) => (
                  <li key={index} className="mb-1">
                    <Link 
                      to={item.path} 
                      className={`sidebar-link flex items-center ${location.pathname === item.path ? 'active bg-blue-800' : ''}`}
                    >
                      {item.icon && <i className={`${item.icon} mr-3 w-5`}></i>}
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            
            <div className="mt-auto pt-8">
              <Link to="/profile" className="sidebar-link flex items-center mb-2">
                <i className="fas fa-user-circle mr-3"></i> Profile
              </Link>
              <Link to="/logout" className="sidebar-link flex items-center">
                <i className="fas fa-sign-out-alt mr-3"></i> Logout
              </Link>
            </div>
          </div>
        </>
      );
    }

    // Header Component
    function Header({ title, user }) {
      return (
        <div className="bg-white shadow-sm mb-6 px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          <div className="flex items-center">
            <div className="mr-4">
              <span className="text-sm text-gray-600">Welcome,</span>
              <span className="ml-1 font-medium">{user?.full_name}</span>
            </div>
            <div className="bg-blue-600 w-10 h-10 rounded-full flex items-center justify-center text-white">
              {user?.full_name?.charAt(0)}
            </div>
          </div>
        </div>
      );
    }

    // Dashboard Card
    function DashboardCard({ title, value, icon, color }) {
      return (
        <div className={`card bg-white rounded-lg shadow-sm p-6 ${color}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-600 text-sm">{title}</p>
              <h3 className="text-2xl font-bold mt-2">{value}</h3>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color.replace('border-l-4', 'bg-opacity-20 text-opacity-100')}`}>
              <i className={`${icon} text-xl`}></i>
            </div>
          </div>
        </div>
      );
    }

    // Table Component
    function DataTable({ columns, data, isLoading }) {
      return (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    {columns.map((column, index) => (
                      <th key={index}>{column.header}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length > 0 ? (
                    data.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {columns.map((column, colIndex) => (
                          <td key={colIndex}>{row[column.accessor]}</td>
                        ))}
                        <td>
                          <div className="flex space-x-2">
                            <button className="text-blue-600 hover:text-blue-800">
                              <i className="fas fa-eye"></i>
                            </button>
                            <button className="text-yellow-600 hover:text-yellow-800">
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="text-red-600 hover:text-red-800">
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length + 1} className="text-center py-4">
                        No data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    // Loading component
    function LoadingSpinner() {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="spinner"></div>
        </div>
      );
    }

    // Protected Route
    function RequireAuth({ children, allowedRoles }) {
      const { user } = useAuth();
      const location = useLocation();
      
      if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
      }
      
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" state={{ from: location }} replace />;
      }
      
      return children;
    }

    // Admin Dashboard Components
    function AdminDashboard() {
      const { user } = useAuth();
      const [stats, setStats] = useState({
        students: 126,
        teachers: 18,
        classes: 12,
        revenue: "$45,250"
      });
      
      return (
        <div>
          <Header title="Admin Dashboard" user={user} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <DashboardCard 
              title="Total Students" 
              value={stats.students} 
              icon="fas fa-user-graduate" 
              color="border-l-4 border-blue-500"
            />
            <DashboardCard 
              title="Total Teachers" 
              value={stats.teachers} 
              icon="fas fa-chalkboard-teacher" 
              color="border-l-4 border-green-500"
            />
            <DashboardCard 
              title="Total Classes" 
              value={stats.classes} 
              icon="fas fa-school" 
              color="border-l-4 border-yellow-500"
            />
            <DashboardCard 
              title="Total Revenue" 
              value={stats.revenue} 
              icon="fas fa-dollar-sign" 
              color="border-l-4 border-purple-500"
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Announcements</h3>
              <ul className="divide-y">
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">School Opening</span>
                    <span className="text-sm text-gray-500">Dec 20, 2024</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">School opens on January 15, 2025</p>
                </li>
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Parent Teacher Meeting</span>
                    <span className="text-sm text-gray-500">Jan 20, 2025</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">PTM scheduled for February 5, 2025</p>
                </li>
              </ul>
              <div className="mt-4 text-right">
                <a href="javascript:void(0)" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  View All <i className="fas fa-arrow-right ml-1"></i>
                </a>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Complaints</h3>
              <ul className="divide-y">
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Classroom Issue</span>
                    <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">Resolved</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">Inadequate lighting in Class A - Reported by Mary Smith</p>
                </li>
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Transport Issue</span>
                    <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">In Progress</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">School bus delay - Reported by Carol Johnson</p>
                </li>
              </ul>
              <div className="mt-4 text-right">
                <a href="javascript:void(0)" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  View All <i className="fas fa-arrow-right ml-1"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    function AdminSubjects() {
      const { user } = useAuth();
      const [subjects, setSubjects] = useState([]);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const data = await apiService.fetchSubjects();
            setSubjects(data);
          } catch (error) {
            console.error("Error fetching subjects:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      const columns = [
        { header: "ID", accessor: "id" },
        { header: "Name", accessor: "name" },
        { header: "Code", accessor: "code" },
        { header: "Description", accessor: "description" }
      ];

      return (
        <div>
          <Header title="Manage Subjects" user={user} />
          
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Subjects</h2>
            <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center">
              <i className="fas fa-plus mr-2"></i> Add Subject
            </button>
          </div>
          
          <DataTable columns={columns} data={subjects} isLoading={isLoading} />
        </div>
      );
    }

    function AdminClasses() {
      const { user } = useAuth();
      const [classes, setClasses] = useState([]);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const data = await apiService.fetchClasses();
            setClasses(data);
          } catch (error) {
            console.error("Error fetching classes:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      const columns = [
        { header: "ID", accessor: "id" },
        { header: "Name", accessor: "name" },
        { header: "Grade", accessor: "grade_level" },
        { header: "Academic Year", accessor: "academic_year" },
        { header: "Teacher", accessor: "class_teacher_name" },
        { header: "Students", accessor: "student_count" }
      ];

      return (
        <div>
          <Header title="Manage Classes" user={user} />
          
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Classes</h2>
            <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center">
              <i className="fas fa-plus mr-2"></i> Add Class
            </button>
          </div>
          
          <DataTable columns={columns} data={classes} isLoading={isLoading} />
        </div>
      );
    }

    function AdminStudents() {
      const { user } = useAuth();
      const [students, setStudents] = useState([]);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const data = await apiService.fetchStudents();
            setStudents(data);
          } catch (error) {
            console.error("Error fetching students:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      const columns = [
        { header: "ID", accessor: "id" },
        { header: "Name", accessor: "user.full_name" },
        { header: "Email", accessor: "user.email" },
        { header: "Class", accessor: "class_name" },
        { header: "Admission Date", accessor: "admission_date" },
        { header: "Parent Contact", accessor: "parent_contact" }
      ];

      return (
        <div>
          <Header title="Manage Students" user={user} />
          
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Students</h2>
            <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center">
              <i className="fas fa-plus mr-2"></i> Add Student
            </button>
          </div>
          
          <DataTable 
            columns={columns} 
            data={students.map(student => ({
              ...student,
              "user.full_name": student.user.full_name,
              "user.email": student.user.email
            }))} 
            isLoading={isLoading} 
          />
        </div>
      );
    }

    function AdminTeachers() {
      const { user } = useAuth();
      const [teachers, setTeachers] = useState([]);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const data = await apiService.fetchTeachers();
            setTeachers(data);
          } catch (error) {
            console.error("Error fetching teachers:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      const columns = [
        { header: "ID", accessor: "id" },
        { header: "Name", accessor: "user.full_name" },
        { header: "Email", accessor: "user.email" },
        { header: "Subjects", accessor: "subjects_display" },
        { header: "Hire Date", accessor: "hire_date" },
        { header: "Qualification", accessor: "qualification" }
      ];

      return (
        <div>
          <Header title="Manage Teachers" user={user} />
          
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Teachers</h2>
            <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center">
              <i className="fas fa-plus mr-2"></i> Add Teacher
            </button>
          </div>
          
          <DataTable 
            columns={columns} 
            data={teachers.map(teacher => ({
              ...teacher,
              "user.full_name": teacher.user.full_name,
              "user.email": teacher.user.email,
              "subjects_display": teacher.subjects.map(subj => subj.name).join(', ')
            }))} 
            isLoading={isLoading} 
          />
        </div>
      );
    }

    function AdminResults() {
      const { user } = useAuth();
      const [results, setResults] = useState([]);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const data = await apiService.fetchResults();
            setResults(data);
          } catch (error) {
            console.error("Error fetching results:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      const columns = [
        { header: "ID", accessor: "id" },
        { header: "Student", accessor: "student_name" },
        { header: "Subject", accessor: "subject_name" },
        { header: "Exam Type", accessor: "exam_type" },
        { header: "Score", accessor: "score" },
        { header: "Grade", accessor: "grade" },
        { header: "Date", accessor: "date_recorded" }
      ];

      return (
        <div>
          <Header title="Manage Results" user={user} />
          
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Results</h2>
            <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center">
              <i className="fas fa-plus mr-2"></i> Add Result
            </button>
          </div>
          
          <DataTable columns={columns} data={results} isLoading={isLoading} />
        </div>
      );
    }

    // Teacher Dashboard Components
    function TeacherDashboard() {
      const { user } = useAuth();
      const [stats, setStats] = useState({
        classes: 3,
        students: 85,
        subjects: 2,
        announcements: 5
      });
      
      return (
        <div>
          <Header title="Teacher Dashboard" user={user} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <DashboardCard 
              title="My Classes" 
              value={stats.classes} 
              icon="fas fa-chalkboard" 
              color="border-l-4 border-blue-500"
            />
            <DashboardCard 
              title="My Students" 
              value={stats.students} 
              icon="fas fa-user-graduate" 
              color="border-l-4 border-green-500"
            />
            <DashboardCard 
              title="Subjects" 
              value={stats.subjects} 
              icon="fas fa-book" 
              color="border-l-4 border-yellow-500"
            />
            <DashboardCard 
              title="Announcements" 
              value={stats.announcements} 
              icon="fas fa-bullhorn" 
              color="border-l-4 border-purple-500"
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Today's Classes</h3>
              <ul className="divide-y">
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Mathematics</span>
                    <span className="text-sm text-gray-500">08:00 - 09:30</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">Class A, Room 101</p>
                </li>
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Physics</span>
                    <span className="text-sm text-gray-500">10:00 - 11:30</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">Class B, Room 102</p>
                </li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Announcements</h3>
              <ul className="divide-y">
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">School Opening</span>
                    <span className="text-sm text-gray-500">Dec 20, 2024</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">School opens on January 15, 2025</p>
                </li>
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Parent Teacher Meeting</span>
                    <span className="text-sm text-gray-500">Jan 20, 2025</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">PTM scheduled for February 5, 2025</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    function TeacherClasses() {
      const { user } = useAuth();
      const [classes, setClasses] = useState([]);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            // For demo, we'll use the same class data
            const data = await apiService.fetchClasses();
            // Simulating that this teacher only teaches some classes
            setClasses(data.slice(0, 2));
          } catch (error) {
            console.error("Error fetching classes:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      const columns = [
        { header: "Class Name", accessor: "name" },
        { header: "Grade", accessor: "grade_level" },
        { header: "Academic Year", accessor: "academic_year" },
        { header: "Students", accessor: "student_count" }
      ];

      return (
        <div>
          <Header title="My Classes" user={user} />
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Classes I Teach</h2>
            <p className="text-gray-600">View and manage your assigned classes</p>
          </div>
          
          <DataTable columns={columns} data={classes} isLoading={isLoading} />
        </div>
      );
    }

    function TeacherStudents() {
      const { user } = useAuth();
      const [students, setStudents] = useState([]);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const data = await apiService.fetchStudents();
            // For demo, we'll show all students
            setStudents(data);
          } catch (error) {
            console.error("Error fetching students:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      const columns = [
        { header: "Name", accessor: "user.full_name" },
        { header: "Class", accessor: "class_name" },
        { header: "Email", accessor: "user.email" },
        { header: "Parent Contact", accessor: "parent_contact" }
      ];

      return (
        <div>
          <Header title="My Students" user={user} />
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Students in My Classes</h2>
            <p className="text-gray-600">View and manage students in your classes</p>
          </div>
          
          <DataTable 
            columns={columns} 
            data={students.map(student => ({
              ...student,
              "user.full_name": student.user.full_name,
              "user.email": student.user.email
            }))} 
            isLoading={isLoading} 
          />
        </div>
      );
    }

    function TeacherResults() {
      const { user } = useAuth();
      const [students, setStudents] = useState([]);
      const [subjects, setSubjects] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      const [formData, setFormData] = useState({
        student: "",
        subject: "",
        examType: "",
        score: "",
        maxScore: "100",
        academicTerm: "Term 1",
        academicYear: "2025"
      });

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const studentsData = await apiService.fetchStudents();
            const subjectsData = await apiService.fetchSubjects();
            setStudents(studentsData);
            setSubjects(subjectsData);
          } catch (error) {
            console.error("Error fetching data:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
      };

      const handleSubmit = (e) => {
        e.preventDefault();
        alert("This is a prototype. In the real system, this would submit the result to the backend.");
      };

      if (isLoading) {
        return (
          <div>
            <Header title="Enter Results" user={user} />
            <LoadingSpinner />
          </div>
        );
      }

      return (
        <div>
          <Header title="Enter Results" user={user} />
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Add New Result</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label htmlFor="student">Student</label>
                  <select 
                    id="student" 
                    name="student" 
                    className="form-control"
                    value={formData.student}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Student</option>
                    {students.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.user.full_name} ({student.class_name})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="subject">Subject</label>
                  <select 
                    id="subject" 
                    name="subject" 
                    className="form-control"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} ({subject.code})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="examType">Exam Type</label>
                  <select 
                    id="examType" 
                    name="examType" 
                    className="form-control"
                    value={formData.examType}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Exam Type</option>
                    <option value="Midterm">Midterm</option>
                    <option value="Final">Final</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Assignment">Assignment</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="score">Score</label>
                  <input 
                    type="number" 
                    id="score" 
                    name="score" 
                    className="form-control"
                    value={formData.score}
                    onChange={handleChange}
                    min="0"
                    max={formData.maxScore}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="maxScore">Maximum Score</label>
                  <input 
                    type="number" 
                    id="maxScore" 
                    name="maxScore" 
                    className="form-control"
                    value={formData.maxScore}
                    onChange={handleChange}
                    min="1"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="academicTerm">Academic Term</label>
                  <select 
                    id="academicTerm" 
                    name="academicTerm" 
                    className="form-control"
                    value={formData.academicTerm}
                    onChange={handleChange}
                    required
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="academicYear">Academic Year</label>
                  <input 
                    type="text" 
                    id="academicYear" 
                    name="academicYear" 
                    className="form-control"
                    value={formData.academicYear}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md"
                >
                  Submit Result
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    // Parent Dashboard Components
    function ParentDashboard() {
      const { user } = useAuth();
      const [children, setChildren] = useState([
        {
          id: 5,
          name: "Alice Smith",
          class: "Class A",
          performance: "Excellent",
          attendance: "95%"
        }
      ]);
      
      return (
        <div>
          <Header title="Parent Dashboard" user={user} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <DashboardCard 
              title="My Children" 
              value={children.length} 
              icon="fas fa-child" 
              color="border-l-4 border-blue-500"
            />
            <DashboardCard 
              title="Unpaid Fees" 
              value="$300" 
              icon="fas fa-dollar-sign" 
              color="border-l-4 border-red-500"
            />
            <DashboardCard 
              title="Announcements" 
              value="3" 
              icon="fas fa-bullhorn" 
              color="border-l-4 border-yellow-500"
            />
            <DashboardCard 
              title="Complaints" 
              value="1" 
              icon="fas fa-exclamation-triangle" 
              color="border-l-4 border-purple-500"
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">My Children</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Class</th>
                      <th>Performance</th>
                      <th>Attendance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map(child => (
                      <tr key={child.id}>
                        <td>{child.name}</td>
                        <td>{child.class}</td>
                        <td>{child.performance}</td>
                        <td>{child.attendance}</td>
                        <td>
                          <button className="text-blue-600 hover:text-blue-800">
                            <i className="fas fa-eye"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Announcements</h3>
              <ul className="divide-y">
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">School Opening</span>
                    <span className="text-sm text-gray-500">Dec 20, 2024</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">School opens on January 15, 2025</p>
                </li>
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Parent Teacher Meeting</span>
                    <span className="text-sm text-gray-500">Jan 20, 2025</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">PTM scheduled for February 5, 2025</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    function ParentChildren() {
      const { user } = useAuth();
      const [children, setChildren] = useState([]);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            // For demo, we'll use a subset of students as children
            const data = await apiService.fetchStudents();
            setChildren(data.slice(0, 1));
          } catch (error) {
            console.error("Error fetching children:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      const columns = [
        { header: "Name", accessor: "user.full_name" },
        { header: "Class", accessor: "class_name" },
        { header: "Admission Date", accessor: "admission_date" },
        { header: "Address", accessor: "address" }
      ];

      return (
        <div>
          <Header title="My Children" user={user} />
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Children Details</h2>
            <p className="text-gray-600">View information about your children</p>
          </div>
          
          <DataTable 
            columns={columns} 
            data={children.map(child => ({
              ...child,
              "user.full_name": child.user.full_name
            }))} 
            isLoading={isLoading} 
          />
        </div>
      );
    }

    function ParentResults() {
      const { user } = useAuth();
      const [results, setResults] = useState([]);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            // For demo, we'll simulate results for the parent's child
            const data = await apiService.fetchStudentPerformance(5);
            setResults(data.results);
          } catch (error) {
            console.error("Error fetching results:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      const columns = [
        { header: "Subject", accessor: "subject_name" },
        { header: "Exam Type", accessor: "exam_type" },
        { header: "Score", accessor: "score" },
        { header: "Max Score", accessor: "max_score" },
        { header: "Grade", accessor: "grade" },
        { header: "Date", accessor: "date_recorded" }
      ];

      return (
        <div>
          <Header title="View Results" user={user} />
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Alice Smith's Results</h2>
            <p className="text-gray-600">Class A, Term 1, 2025</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex flex-wrap justify-between items-center">
              <div className="mb-4 md:mb-0">
                <p className="text-gray-600">Average Score</p>
                <h3 className="text-3xl font-bold text-blue-600">82.5%</h3>
              </div>
              <div className="mb-4 md:mb-0">
                <p className="text-gray-600">Grade</p>
                <h3 className="text-3xl font-bold text-green-600">A-</h3>
              </div>
              <div className="mb-4 md:mb-0">
                <p className="text-gray-600">Position</p>
                <h3 className="text-3xl font-bold text-purple-600">2<span className="text-lg">nd</span></h3>
              </div>
              <div className="mb-4 md:mb-0">
                <p className="text-gray-600">Subjects</p>
                <h3 className="text-3xl font-bold text-orange-600">3</h3>
              </div>
            </div>
          </div>
          
          <DataTable columns={columns} data={results} isLoading={isLoading} />
        </div>
      );
    }

    function ParentFeeSummary() {
      const { user } = useAuth();
      const [summary, setSummary] = useState(null);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const data = await apiService.fetchStudentSummary(5);
            setSummary(data);
          } catch (error) {
            console.error("Error fetching fee summary:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      if (isLoading) {
        return (
          <div>
            <Header title="Fee Summary" user={user} />
            <LoadingSpinner />
          </div>
        );
      }

      return (
        <div>
          <Header title="Fee Summary" user={user} />
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Alice Smith's Fee Summary</h2>
            <p className="text-gray-600">Academic Year 2025</p>
          </div>
          
          {summary && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
                  <p className="text-gray-600">Total Fees Due</p>
                  <h3 className="text-3xl font-bold">${summary.total_fees_due}</h3>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                  <p className="text-gray-600">Total Fees Paid</p>
                  <h3 className="text-3xl font-bold">${summary.total_fees_paid}</h3>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
                  <p className="text-gray-600">Balance</p>
                  <h3 className="text-3xl font-bold">${summary.total_balance}</h3>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Pending Fees</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th>Fee Type</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.pending_fees.map((fee, index) => (
                          <tr key={index}>
                            <td>{fee.fee_type_name}</td>
                            <td>${fee.balance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Recent Payments</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.recent_payments.map((payment, index) => (
                          <tr key={index}>
                            <td>{payment.id}</td>
                            <td>${payment.amount}</td>
                            <td>
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                {payment.payment_status}
                              </span>
                            </td>
                            <td>{payment.payment_date || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    // Student Dashboard Components
    function StudentDashboard() {
      const { user } = useAuth();
      
      return (
        <div>
          <Header title="Student Dashboard" user={user} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <DashboardCard 
              title="My Subjects" 
              value="3" 
              icon="fas fa-book" 
              color="border-l-4 border-blue-500"
            />
            <DashboardCard 
              title="Average Score" 
              value="82.5%" 
              icon="fas fa-chart-line" 
              color="border-l-4 border-green-500"
            />
            <DashboardCard 
              title="Fee Balance" 
              value="$300" 
              icon="fas fa-dollar-sign" 
              color="border-l-4 border-red-500"
            />
            <DashboardCard 
              title="Announcements" 
              value="3" 
              icon="fas fa-bullhorn" 
              color="border-l-4 border-yellow-500"
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">My Timetable (Today)</h3>
              <ul className="divide-y">
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Mathematics</span>
                    <span className="text-sm text-gray-500">08:00 - 09:30</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">Room 101, Mr. John Doe</p>
                </li>
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Physics</span>
                    <span className="text-sm text-gray-500">10:00 - 11:30</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">Room 102, Ms. Jane Smith</p>
                </li>
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">English</span>
                    <span className="text-sm text-gray-500">13:00 - 14:30</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">Room 103, Mr. Robert Johnson</p>
                </li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Announcements</h3>
              <ul className="divide-y">
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">School Opening</span>
                    <span className="text-sm text-gray-500">Dec 20, 2024</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">School opens on January 15, 2025</p>
                </li>
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Parent Teacher Meeting</span>
                    <span className="text-sm text-gray-500">Jan 20, 2025</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">PTM scheduled for February 5, 2025</p>
                </li>
                <li className="py-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Holiday</span>
                    <span className="text-sm text-gray-500">Sep 22, 2025</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">School closed tomorrow</p>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Results</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Exam Type</th>
                    <th>Score</th>
                    <th>Grade</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Mathematics</td>
                    <td>Midterm</td>
                    <td>80/100</td>
                    <td>A-</td>
                    <td>Mar 15, 2025</td>
                  </tr>
                  <tr>
                    <td>Physics</td>
                    <td>Final</td>
                    <td>75/100</td>
                    <td>B+</td>
                    <td>Mar 30, 2025</td>
                  </tr>
                  <tr>
                    <td>English</td>
                    <td>Quiz</td>
                    <td>90/100</td>
                    <td>A+</td>
                    <td>Mar 10, 2025</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    function StudentResults() {
      const { user } = useAuth();
      const [performance, setPerformance] = useState(null);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const data = await apiService.fetchStudentPerformance(5);
            setPerformance(data);
          } catch (error) {
            console.error("Error fetching performance:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      if (isLoading) {
        return (
          <div>
            <Header title="My Results" user={user} />
            <LoadingSpinner />
          </div>
        );
      }

      return (
        <div>
          <Header title="My Results" user={user} />
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Academic Performance</h2>
            <p className="text-gray-600">Term 1, 2025</p>
          </div>
          
          {performance && (
            <>
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="flex flex-wrap justify-between items-center">
                  <div className="mb-4 md:mb-0">
                    <p className="text-gray-600">Average Score</p>
                    <h3 className="text-3xl font-bold text-blue-600">{performance.average_score}%</h3>
                  </div>
                  <div className="mb-4 md:mb-0">
                    <p className="text-gray-600">Overall Grade</p>
                    <h3 className="text-3xl font-bold text-green-600">{performance.overall_grade}</h3>
                  </div>
                  <div className="mb-4 md:mb-0">
                    <p className="text-gray-600">Total Subjects</p>
                    <h3 className="text-3xl font-bold text-orange-600">{performance.total_subjects}</h3>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold">Detailed Results</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Teacher</th>
                        <th>Exam Type</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Grade</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.results.map((result, index) => (
                        <tr key={index}>
                          <td>{result.subject_name}</td>
                          <td>{result.teacher_name}</td>
                          <td>{result.exam_type}</td>
                          <td>{result.score}/{result.max_score}</td>
                          <td>{result.percentage}%</td>
                          <td>{result.grade}</td>
                          <td>{result.date_recorded}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    function StudentTimetable() {
      const { user } = useAuth();
      const [timetable, setTimetable] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const data = await apiService.fetchTimetable();
            setTimetable(data);
          } catch (error) {
            console.error("Error fetching timetable:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      if (isLoading) {
        return (
          <div>
            <Header title="My Timetable" user={user} />
            <LoadingSpinner />
          </div>
        );
      }

      // Group timetable by day
      const timetableByDay = {};
      days.forEach(day => {
        timetableByDay[day] = timetable.filter(item => item.day_of_week === day);
      });

      return (
        <div>
          <Header title="My Timetable" user={user} />
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Class A Timetable</h2>
            <p className="text-gray-600">Academic Year 2025</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <ul className="flex flex-wrap -mb-px nav-pills">
                {days.map((day, index) => (
                  <li key={index} className="nav-item">
                    <button className={`nav-link ${index === 0 ? 'active' : ''}`}>
                      {day}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-6">
              {/* For demo, only showing Monday's timetable */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Subject</th>
                      <th>Teacher</th>
                      <th>Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timetableByDay["Monday"].length > 0 ? (
                      timetableByDay["Monday"].map((item, index) => (
                        <tr key={index}>
                          <td>{item.start_time} - {item.end_time}</td>
                          <td>{item.subject_name}</td>
                          <td>{item.teacher_name}</td>
                          <td>{item.room}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center py-4">
                          No classes scheduled for Monday
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      );
    }

    function StudentFeeSummary() {
      const { user } = useAuth();
      const [summary, setSummary] = useState(null);
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        const fetchData = async () => {
          setIsLoading(true);
          try {
            const data = await apiService.fetchStudentSummary(5);
            setSummary(data);
          } catch (error) {
            console.error("Error fetching fee summary:", error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchData();
      }, []);

      if (isLoading) {
        return (
          <div>
            <Header title="Fee Summary" user={user} />
            <LoadingSpinner />
          </div>
        );
      }

      return (
        <div>
          <Header title="Fee Summary" user={user} />
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold">My Fee Summary</h2>
            <p className="text-gray-600">Academic Year 2025</p>
          </div>
          
          {summary && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
                  <p className="text-gray-600">Total Fees Due</p>
                  <h3 className="text-3xl font-bold">${summary.total_fees_due}</h3>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                  <p className="text-gray-600">Total Fees Paid</p>
                  <h3 className="text-3xl font-bold">${summary.total_fees_paid}</h3>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
                  <p className="text-gray-600">Balance</p>
                  <h3 className="text-3xl font-bold">${summary.total_balance}</h3>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Pending Fees</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th>Fee Type</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.pending_fees.map((fee, index) => (
                          <tr key={index}>
                            <td>{fee.fee_type_name}</td>
                            <td>${fee.balance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Recent Payments</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.recent_payments.map((payment, index) => (
                          <tr key={index}>
                            <td>{payment.id}</td>
                            <td>${payment.amount}</td>
                            <td>
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                {payment.payment_status}
                              </span>
                            </td>
                            <td>{payment.payment_date || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    // Profile Component
    function Profile() {
      const { user, logout } = useAuth();
      const navigate = useNavigate();
      const [formData, setFormData] = useState({
        fullName: user?.full_name || "",
        email: "user@example.com",
        phone: "+1234567890",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        whatsappPin: ""
      });
      const [activeTab, setActiveTab] = useState("profile");

      const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
      };

      const handleProfileSubmit = (e) => {
        e.preventDefault();
        alert("Profile updated successfully!");
      };

      const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (formData.newPassword !== formData.confirmPassword) {
          alert("New password and confirm password do not match!");
          return;
        }
        alert("Password changed successfully!");
      };

      const handlePinSubmit = (e) => {
        e.preventDefault();
        alert("WhatsApp PIN set successfully!");
      };

      const handleLogout = () => {
        logout();
        navigate("/login");
      };

      return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-1/3 bg-blue-800 p-6 text-white">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-24 h-24 bg-white text-blue-800 rounded-full flex items-center justify-center text-3xl font-bold mb-4">
                    {user?.full_name?.charAt(0) || "U"}
                  </div>
                  <h2 className="text-xl font-bold">{user?.full_name}</h2>
                  <p className="text-blue-300 capitalize">{user?.role}</p>
                </div>
                
                <nav>
                  <ul>
                    <li className="mb-2">
                      <button
                        onClick={() => setActiveTab("profile")}
                        className={`w-full text-left py-2 px-3 rounded-md ${activeTab === "profile" ? 'bg-blue-900' : 'hover:bg-blue-700'}`}
                      >
                        <i className="fas fa-user mr-2"></i> Profile Information
                      </button>
                    </li>
                    <li className="mb-2">
                      <button
                        onClick={() => setActiveTab("security")}
                        className={`w-full text-left py-2 px-3 rounded-md ${activeTab === "security" ? 'bg-blue-900' : 'hover:bg-blue-700'}`}
                      >
                        <i className="fas fa-lock mr-2"></i> Security
                      </button>
                    </li>
                    <li className="mb-2">
                      <button
                        onClick={() => setActiveTab("whatsapp")}
                        className={`w-full text-left py-2 px-3 rounded-md ${activeTab === "whatsapp" ? 'bg-blue-900' : 'hover:bg-blue-700'}`}
                      >
                        <i className="fab fa-whatsapp mr-2"></i> WhatsApp PIN
                      </button>
                    </li>
                    <li className="mt-8">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left py-2 px-3 rounded-md hover:bg-red-700 bg-red-600"
                      >
                        <i className="fas fa-sign-out-alt mr-2"></i> Logout
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
              
              <div className="w-full md:w-2/3 p-6">
                {activeTab === "profile" && (
                  <div>
                    <h3 className="text-xl font-semibold mb-6">Profile Information</h3>
                    <form onSubmit={handleProfileSubmit}>
                      <div className="form-group">
                        <label htmlFor="fullName">Full Name</label>
                        <input
                          type="text"
                          id="fullName"
                          name="fullName"
                          className="form-control"
                          value={formData.fullName}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          className="form-control"
                          value={formData.email}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="phone">Phone Number</label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          className="form-control"
                          value={formData.phone}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md"
                      >
                        Save Changes
                      </button>
                    </form>
                  </div>
                )}
                
                {activeTab === "security" && (
                  <div>
                    <h3 className="text-xl font-semibold mb-6">Change Password</h3>
                    <form onSubmit={handlePasswordSubmit}>
                      <div className="form-group">
                        <label htmlFor="currentPassword">Current Password</label>
                        <input
                          type="password"
                          id="currentPassword"
                          name="currentPassword"
                          className="form-control"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="newPassword">New Password</label>
                        <input
                          type="password"
                          id="newPassword"
                          name="newPassword"
                          className="form-control"
                          value={formData.newPassword}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm New Password</label>
                        <input
                          type="password"
                          id="confirmPassword"
                          name="confirmPassword"
                          className="form-control"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md"
                      >
                        Change Password
                      </button>
                    </form>
                  </div>
                )}
                
                {activeTab === "whatsapp" && (
                  <div>
                    <h3 className="text-xl font-semibold mb-6">Set WhatsApp PIN</h3>
                    <p className="text-gray-600 mb-4">
                      Setting up a WhatsApp PIN allows you to receive notifications and updates via WhatsApp.
                    </p>
                    <form onSubmit={handlePinSubmit}>
                      <div className="form-group">
                        <label htmlFor="whatsappPin">WhatsApp PIN (4 digits)</label>
                        <input
                          type="text"
                          id="whatsappPin"
                          name="whatsappPin"
                          className="form-control"
                          value={formData.whatsappPin}
                          onChange={handleChange}
                          pattern="[0-9]{4}"
                          maxLength="4"
                          required
                        />
                      </div>
                      
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md"
                      >
                        Set PIN
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Not Found Page
    function NotFound() {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
          <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
          <p className="text-xl text-gray-600 mb-8">Page Not Found</p>
          <Link to="/" className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md">
            Go Home
          </Link>
        </div>
      );
    }

    // Unauthorized Page
    function Unauthorized() {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
          <h1 className="text-6xl font-bold text-red-600 mb-4">403</h1>
          <p className="text-xl text-gray-600 mb-8">You are not authorized to access this page</p>
          <Link to="/" className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md">
            Go Back
          </Link>
        </div>
      );
    }

    // Logout Component
    function Logout() {
      const { logout } = useAuth();
      const navigate = useNavigate();
      
      useEffect(() => {
        logout();
        navigate("/login");
      }, []);
      
      return null;
    }

    // Admin Layout
    function AdminLayout() {
      const { user } = useAuth();
      const sidebarItems = [
        { title: "Dashboard", path: "/admin", icon: "fas fa-tachometer-alt" },
        { title: "Subjects", path: "/admin/subjects", icon: "fas fa-book" },
        { title: "Classes", path: "/admin/classes", icon: "fas fa-chalkboard" },
        { title: "Teachers", path: "/admin/teachers", icon: "fas fa-chalkboard-teacher" },
        { title: "Students", path: "/admin/students", icon: "fas fa-user-graduate" },
        { title: "Results", path: "/admin/results", icon: "fas fa-chart-bar" },
        { title: "Timetable", path: "/admin/timetable", icon: "fas fa-calendar-alt" },
        { title: "Announcements", path: "/admin/announcements", icon: "fas fa-bullhorn" },
        { title: "Complaints", path: "/admin/complaints", icon: "fas fa-exclamation-triangle" },
        { title: "Suspensions", path: "/admin/suspensions", icon: "fas fa-ban" },
        { title: "Fee Management", path: "/admin/fees", icon: "fas fa-money-bill-wave" },
        { title: "Payments", path: "/admin/payments", icon: "fas fa-credit-card" },
        { title: "Invoices", path: "/admin/invoices", icon: "fas fa-file-invoice-dollar" },
        { title: "Reports", path: "/admin/reports", icon: "fas fa-chart-line" },
        { title: "Users", path: "/admin/users", icon: "fas fa-users" }
      ];
      
      return (
        <div className="min-h-screen bg-gray-50">
          <Sidebar items={sidebarItems} role="admin" />
          <div className="content p-6">
            <Routes>
              <Route index element={<AdminDashboard />} />
              <Route path="subjects" element={<AdminSubjects />} />
              <Route path="classes" element={<AdminClasses />} />
              <Route path="teachers" element={<AdminTeachers />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="results" element={<AdminResults />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      );
    }

    // Teacher Layout
    function TeacherLayout() {
      const { user } = useAuth();
      const sidebarItems = [
        { title: "Dashboard", path: "/teacher", icon: "fas fa-tachometer-alt" },
        { title: "My Classes", path: "/teacher/classes", icon: "fas fa-chalkboard" },
        { title: "My Students", path: "/teacher/students", icon: "fas fa-user-graduate" },
        { title: "Enter Results", path: "/teacher/results", icon: "fas fa-chart-bar" },
        { title: "Timetable", path: "/teacher/timetable", icon: "fas fa-calendar-alt" },
        { title: "Announcements", path: "/teacher/announcements", icon: "fas fa-bullhorn" },
        { title: "Log Complaints", path: "/teacher/complaints", icon: "fas fa-exclamation-triangle" }
      ];
      
      return (
        <div className="min-h-screen bg-gray-50">
          <Sidebar items={sidebarItems} role="teacher" />
          <div className="content p-6">
            <Routes>
              <Route index element={<TeacherDashboard />} />
              <Route path="classes" element={<TeacherClasses />} />
              <Route path="students" element={<TeacherStudents />} />
              <Route path="results" element={<TeacherResults />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      );
    }

    // Parent Layout
    function ParentLayout() {
      const { user } = useAuth();
      const sidebarItems = [
        { title: "Dashboard", path: "/parent", icon: "fas fa-tachometer-alt" },
        { title: "Children Details", path: "/parent/children", icon: "fas fa-child" },
        { title: "View Results", path: "/parent/results", icon: "fas fa-chart-bar" },
        { title: "Fee Summary", path: "/parent/fees", icon: "fas fa-money-bill-wave" },
        { title: "Announcements", path: "/parent/announcements", icon: "fas fa-bullhorn" }
      ];
      
      return (
        <div className="min-h-screen bg-gray-50">
          <Sidebar items={sidebarItems} role="parent" />
          <div className="content p-6">
            <Routes>
              <Route index element={<ParentDashboard />} />
              <Route path="children" element={<ParentChildren />} />
              <Route path="results" element={<ParentResults />} />
              <Route path="fees" element={<ParentFeeSummary />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      );
    }
  </script>
</body>
</html>