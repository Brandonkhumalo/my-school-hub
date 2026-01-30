import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentClasses, setRecentClasses] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, classesData] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.fetchClasses()
      ]);
      setStats(statsData);
      setRecentClasses(classesData.slice(0, 5));
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="Admin Dashboard" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Admin Dashboard" user={user} />
      
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">School Statistics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-500 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Students</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.total_students || 0}</h3>
              </div>
              <i className="fas fa-user-graduate text-4xl opacity-50"></i>
            </div>
          </div>

          <div className="bg-green-500 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Teachers</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.total_teachers || 0}</h3>
              </div>
              <i className="fas fa-chalkboard-teacher text-4xl opacity-50"></i>
            </div>
          </div>

          <div className="bg-purple-500 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Parents</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.total_parents || 0}</h3>
              </div>
              <i className="fas fa-users text-4xl opacity-50"></i>
            </div>
          </div>

          <div className="bg-orange-500 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Classes</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.total_classes || 0}</h3>
              </div>
              <i className="fas fa-door-open text-4xl opacity-50"></i>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/admin/students"
                className="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
              >
                <i className="fas fa-user-plus text-blue-500 text-2xl mr-3"></i>
                <div>
                  <p className="font-semibold text-gray-800">Add Student</p>
                  <p className="text-sm text-gray-600">Register new student</p>
                </div>
              </Link>

              <Link
                to="/admin/teachers"
                className="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition"
              >
                <i className="fas fa-user-tie text-green-500 text-2xl mr-3"></i>
                <div>
                  <p className="font-semibold text-gray-800">Add Teacher</p>
                  <p className="text-sm text-gray-600">Add new teacher</p>
                </div>
              </Link>

              <Link
                to="/admin/users"
                className="flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
              >
                <i className="fas fa-user-friends text-purple-500 text-2xl mr-3"></i>
                <div>
                  <p className="font-semibold text-gray-800">Add Parent</p>
                  <p className="text-sm text-gray-600">Register parent</p>
                </div>
              </Link>

              <Link
                to="/admin/classes"
                className="flex items-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition"
              >
                <i className="fas fa-school text-orange-500 text-2xl mr-3"></i>
                <div>
                  <p className="font-semibold text-gray-800">Manage Classes</p>
                  <p className="text-sm text-gray-600">View & edit classes</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Financial Overview</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center">
                  <i className="fas fa-money-bill-wave text-green-500 text-xl mr-3"></i>
                  <span className="text-gray-700">Total Revenue</span>
                </div>
                <span className="font-bold text-green-600">
                  ${stats?.total_revenue?.toLocaleString() || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center">
                  <i className="fas fa-file-invoice text-orange-500 text-xl mr-3"></i>
                  <span className="text-gray-700">Pending Invoices</span>
                </div>
                <span className="font-bold text-orange-600">{stats?.pending_invoices || 0}</span>
              </div>

              <div className="flex gap-2 mt-4">
                <Link
                  to="/admin/payments"
                  className="flex-1 text-center bg-green-500 hover:bg-green-600 text-white py-2 rounded transition"
                >
                  <i className="fas fa-credit-card mr-2"></i>
                  Payments
                </Link>
                <Link
                  to="/admin/invoices"
                  className="flex-1 text-center bg-blue-500 hover:bg-blue-600 text-white py-2 rounded transition"
                >
                  <i className="fas fa-file-invoice mr-2"></i>
                  Invoices
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Recent Classes</h3>
              <Link to="/admin/classes" className="text-blue-500 hover:text-blue-600 text-sm">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentClasses.length > 0 ? (
                recentClasses.map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mr-3">
                        <i className="fas fa-chalkboard"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{cls.name}</p>
                        <p className="text-sm text-gray-600">
                          {cls.student_count || 0} students
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/admin/classes`}
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <i className="fas fa-arrow-right"></i>
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No classes yet</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Management Links</h3>
            <div className="space-y-3">
              <Link
                to="/admin/students"
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-center">
                  <i className="fas fa-user-graduate text-blue-500 text-xl mr-3"></i>
                  <span className="text-gray-700">View All Students</span>
                </div>
                <i className="fas fa-chevron-right text-gray-400"></i>
              </Link>

              <Link
                to="/admin/teachers"
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-center">
                  <i className="fas fa-chalkboard-teacher text-green-500 text-xl mr-3"></i>
                  <span className="text-gray-700">View All Teachers</span>
                </div>
                <i className="fas fa-chevron-right text-gray-400"></i>
              </Link>

              <Link
                to="/admin/users"
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-center">
                  <i className="fas fa-users text-purple-500 text-xl mr-3"></i>
                  <span className="text-gray-700">View All Parents</span>
                </div>
                <i className="fas fa-chevron-right text-gray-400"></i>
              </Link>

              <Link
                to="/admin/timetable"
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-center">
                  <i className="fas fa-calendar-alt text-orange-500 text-xl mr-3"></i>
                  <span className="text-gray-700">Class Schedules</span>
                </div>
                <i className="fas fa-chevron-right text-gray-400"></i>
              </Link>

              <Link
                to="/admin/results"
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-center">
                  <i className="fas fa-chart-bar text-red-500 text-xl mr-3"></i>
                  <span className="text-gray-700">Class Performance</span>
                </div>
                <i className="fas fa-chevron-right text-gray-400"></i>
              </Link>

              <Link
                to="/admin/payments"
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-center">
                  <i className="fas fa-credit-card text-green-500 text-xl mr-3"></i>
                  <span className="text-gray-700">Fee Payments</span>
                </div>
                <i className="fas fa-chevron-right text-gray-400"></i>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
