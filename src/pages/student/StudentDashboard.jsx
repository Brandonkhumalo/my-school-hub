import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upcomingSubmissions, setUpcomingSubmissions] = useState([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, submissionsData, announcementsData] = await Promise.all([
        apiService.getStudentDashboardStats(),
        apiService.getStudentSubmissions(),
        apiService.getStudentAnnouncements()
      ]);
      setStats(statsData);
      setUpcomingSubmissions(submissionsData.slice(0, 3));
      setRecentAnnouncements(announcementsData.slice(0, 3));
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div>
        <Header title="Student Dashboard" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Student Dashboard" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Welcome back, {user?.full_name || user?.first_name}!</h2>
          <p className="text-gray-600 mt-2">Here's what's happening with your academics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Overall Average</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.overall_average || 0}%</h3>
              </div>
              <i className="fas fa-chart-line text-4xl opacity-50"></i>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Subjects</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.total_subjects || 0}</h3>
              </div>
              <i className="fas fa-book text-4xl opacity-50"></i>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Pending Submissions</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.pending_submissions || 0}</h3>
              </div>
              <i className="fas fa-tasks text-4xl opacity-50"></i>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Attendance</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.attendance_percentage || 0}%</h3>
              </div>
              <i className="fas fa-calendar-check text-4xl opacity-50"></i>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/student/marks"
                className="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
              >
                <i className="fas fa-chart-line text-blue-500 text-2xl mr-3"></i>
                <div>
                  <p className="font-semibold text-gray-800">View Marks</p>
                  <p className="text-sm text-gray-600">Check your grades</p>
                </div>
              </Link>

              <Link
                to="/student/timetable"
                className="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition"
              >
                <i className="fas fa-clock text-green-500 text-2xl mr-3"></i>
                <div>
                  <p className="font-semibold text-gray-800">Timetable</p>
                  <p className="text-sm text-gray-600">View schedule</p>
                </div>
              </Link>

              <Link
                to="/student/submissions"
                className="flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
              >
                <i className="fas fa-tasks text-purple-500 text-2xl mr-3"></i>
                <div>
                  <p className="font-semibold text-gray-800">Submissions</p>
                  <p className="text-sm text-gray-600">Due assignments</p>
                </div>
              </Link>

              <Link
                to="/student/calendar"
                className="flex items-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition"
              >
                <i className="fas fa-calendar text-orange-500 text-2xl mr-3"></i>
                <div>
                  <p className="font-semibold text-gray-800">Calendar</p>
                  <p className="text-sm text-gray-600">School events</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Upcoming Submissions</h3>
              <Link to="/student/submissions" className="text-blue-500 hover:text-blue-600 text-sm">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingSubmissions.length > 0 ? (
                upcomingSubmissions.map((submission) => (
                  <div key={submission.id} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center mr-3">
                        <i className="fas fa-file-alt"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{submission.title}</p>
                        <p className="text-sm text-gray-600">{submission.subject_name}</p>
                      </div>
                    </div>
                    <span className="text-sm text-orange-600 font-semibold">
                      {formatDate(submission.deadline)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No upcoming submissions</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Recent Announcements</h3>
              <Link to="/student/announcements" className="text-blue-500 hover:text-blue-600 text-sm">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentAnnouncements.length > 0 ? (
                recentAnnouncements.map((announcement) => (
                  <div key={announcement.id} className="p-3 bg-gray-50 rounded hover:bg-gray-100 transition">
                    <div className="flex items-start">
                      <i className="fas fa-bullhorn text-blue-500 text-lg mr-3 mt-1"></i>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{announcement.title}</p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{announcement.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {formatDate(announcement.date)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No recent announcements</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Academic Links</h3>
            <div className="space-y-3">
              <Link
                to="/student/profile"
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-center">
                  <i className="fas fa-user text-blue-500 text-xl mr-3"></i>
                  <span className="text-gray-700">My Profile</span>
                </div>
                <i className="fas fa-chevron-right text-gray-400"></i>
              </Link>

              <Link
                to="/student/teachers"
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-center">
                  <i className="fas fa-chalkboard-teacher text-green-500 text-xl mr-3"></i>
                  <span className="text-gray-700">My Teachers</span>
                </div>
                <i className="fas fa-chevron-right text-gray-400"></i>
              </Link>

              <Link
                to="/student/marks"
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-center">
                  <i className="fas fa-chart-bar text-purple-500 text-xl mr-3"></i>
                  <span className="text-gray-700">Academic Performance</span>
                </div>
                <i className="fas fa-chevron-right text-gray-400"></i>
              </Link>

              <Link
                to="/student/calendar"
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-center">
                  <i className="fas fa-calendar-alt text-orange-500 text-xl mr-3"></i>
                  <span className="text-gray-700">School Calendar</span>
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
