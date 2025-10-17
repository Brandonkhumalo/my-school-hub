import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState(null);
  const [children, setChildren] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [childrenData, messagesData] = await Promise.all([
        apiService.getParentChildren(),
        apiService.getParentWeeklyMessages()
      ]);
      
      setChildren(childrenData);
      setRecentMessages(messagesData.slice(0, 3));
      
      if (childrenData.length > 0) {
        const defaultChild = childrenData.find(c => c.is_confirmed) || childrenData[0];
        setSelectedChild(defaultChild);
        
        if (defaultChild) {
          const statsData = await apiService.getParentDashboardStats(defaultChild.id);
          setStats(statsData);
        }
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChildChange = async (childId) => {
    const child = children.find(c => c.id === parseInt(childId));
    setSelectedChild(child);
    
    if (child) {
      try {
        const statsData = await apiService.getParentDashboardStats(child.id);
        setStats(statsData);
      } catch (error) {
        console.error("Error loading child stats:", error);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div>
        <Header title="Parent Dashboard" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Parent Dashboard" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Welcome, {user?.full_name || user?.first_name}!</h2>
          <p className="text-gray-600 mt-2">Monitor your child's academic progress</p>
        </div>

        {children.length === 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
            <div className="flex items-start">
              <i className="fas fa-exclamation-triangle text-yellow-600 text-2xl mr-4"></i>
              <div>
                <h3 className="font-semibold text-yellow-800 mb-2">No Children Linked</h3>
                <p className="text-yellow-700 mb-3">
                  You haven't linked any children to your account yet.
                </p>
                <Link
                  to="/parent/children"
                  className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded transition"
                >
                  Link a Child
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Viewing Child:</h3>
                <select
                  value={selectedChild?.id || ''}
                  onChange={(e) => handleChildChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name} {child.surname} - {child.class} {!child.is_confirmed && '(Pending)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedChild && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Overall Average</p>
                      <h3 className="text-3xl font-bold mt-2">{stats.overall_average || 0}%</h3>
                    </div>
                    <i className="fas fa-chart-line text-4xl opacity-50"></i>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Total Subjects</p>
                      <h3 className="text-3xl font-bold mt-2">{stats.total_subjects || 0}</h3>
                    </div>
                    <i className="fas fa-book text-4xl opacity-50"></i>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Attendance</p>
                      <h3 className="text-3xl font-bold mt-2">{stats.attendance_percentage || 0}%</h3>
                    </div>
                    <i className="fas fa-calendar-check text-4xl opacity-50"></i>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Outstanding Fees</p>
                      <h3 className="text-3xl font-bold mt-2">${stats.outstanding_fees || 0}</h3>
                    </div>
                    <i className="fas fa-money-bill-wave text-4xl opacity-50"></i>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Link
                    to="/parent/performance"
                    className="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                  >
                    <i className="fas fa-chart-line text-blue-500 text-2xl mr-3"></i>
                    <div>
                      <p className="font-semibold text-gray-800">View Performance</p>
                      <p className="text-sm text-gray-600">Academic results</p>
                    </div>
                  </Link>

                  <Link
                    to="/parent/messages"
                    className="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition"
                  >
                    <i className="fas fa-envelope text-green-500 text-2xl mr-3"></i>
                    <div>
                      <p className="font-semibold text-gray-800">Weekly Messages</p>
                      <p className="text-sm text-gray-600">Teacher updates</p>
                    </div>
                  </Link>

                  <Link
                    to="/parent/fees"
                    className="flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                  >
                    <i className="fas fa-credit-card text-purple-500 text-2xl mr-3"></i>
                    <div>
                      <p className="font-semibold text-gray-800">Pay Fees</p>
                      <p className="text-sm text-gray-600">School payments</p>
                    </div>
                  </Link>

                  <Link
                    to="/parent/children"
                    className="flex items-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition"
                  >
                    <i className="fas fa-child text-orange-500 text-2xl mr-3"></i>
                    <div>
                      <p className="font-semibold text-gray-800">Manage Children</p>
                      <p className="text-sm text-gray-600">Link/confirm kids</p>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Recent Weekly Messages</h3>
                  <Link to="/parent/messages" className="text-blue-500 hover:text-blue-600 text-sm">
                    View All
                  </Link>
                </div>
                <div className="space-y-3">
                  {recentMessages.length > 0 ? (
                    recentMessages.map((message) => (
                      <div key={message.id} className="p-3 bg-gray-50 rounded hover:bg-gray-100 transition">
                        <div className="flex items-start">
                          <i className="fas fa-envelope text-blue-500 text-lg mr-3 mt-1"></i>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-gray-800">{message.subject}</p>
                              <span className="text-xs text-gray-500">
                                {formatDate(message.date)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{message.message}</p>
                            <p className="text-xs text-gray-500 mt-1">From: {message.teacher}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No recent messages</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Parent Links</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Link
                  to="/parent/children"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
                >
                  <div className="flex items-center">
                    <i className="fas fa-child text-blue-500 text-xl mr-3"></i>
                    <span className="text-gray-700">My Children</span>
                  </div>
                  <i className="fas fa-chevron-right text-gray-400"></i>
                </Link>

                <Link
                  to="/parent/performance"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
                >
                  <div className="flex items-center">
                    <i className="fas fa-chart-bar text-green-500 text-xl mr-3"></i>
                    <span className="text-gray-700">Academic Performance</span>
                  </div>
                  <i className="fas fa-chevron-right text-gray-400"></i>
                </Link>

                <Link
                  to="/parent/messages"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
                >
                  <div className="flex items-center">
                    <i className="fas fa-envelope text-purple-500 text-xl mr-3"></i>
                    <span className="text-gray-700">Weekly Messages</span>
                  </div>
                  <i className="fas fa-chevron-right text-gray-400"></i>
                </Link>

                <Link
                  to="/parent/fees"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
                >
                  <div className="flex items-center">
                    <i className="fas fa-credit-card text-orange-500 text-xl mr-3"></i>
                    <span className="text-gray-700">School Fees Payment</span>
                  </div>
                  <i className="fas fa-chevron-right text-gray-400"></i>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
