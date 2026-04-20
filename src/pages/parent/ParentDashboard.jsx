import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDateShort } from "../../utils/dateFormat";
import apiService from "../../services/apiService";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState(null);
  const [children, setChildren] = useState([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState(null);
  const [clearingAnnouncementId, setClearingAnnouncementId] = useState(null);
  const [clearingAllAnnouncements, setClearingAllAnnouncements] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [complaintForm, setComplaintForm] = useState({
    student: "",
    complaint_type: "parent",
    title: "",
    description: "",
  });
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [childrenData, complaintsData, announcementsData] = await Promise.all([
        apiService.getParentChildren(),
        apiService.fetchComplaints(),
        apiService.fetchAnnouncements(),
      ]);
      
      setChildren(childrenData);
      setComplaints(Array.isArray(complaintsData) ? complaintsData.slice(0, 5) : []);
      setRecentAnnouncements(Array.isArray(announcementsData) ? announcementsData.slice(0, 3) : []);
      
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

  const handleDeleteAnnouncement = async (announcementId) => {
    setDeletingAnnouncementId(announcementId);
    try {
      await apiService.deleteAnnouncement(announcementId);
      const announcementsData = await apiService.fetchAnnouncements();
      setRecentAnnouncements(Array.isArray(announcementsData) ? announcementsData.slice(0, 3) : []);
    } catch (error) {
      console.error("Error deleting announcement:", error);
    } finally {
      setDeletingAnnouncementId(null);
    }
  };

  const handleClearAnnouncement = async (announcementId) => {
    setClearingAnnouncementId(announcementId);
    try {
      await apiService.dismissAnnouncement(announcementId);
      const announcementsData = await apiService.fetchAnnouncements();
      setRecentAnnouncements(Array.isArray(announcementsData) ? announcementsData.slice(0, 3) : []);
    } catch (error) {
      console.error("Error clearing announcement:", error);
    } finally {
      setClearingAnnouncementId(null);
    }
  };

  const handleClearAllAnnouncements = async () => {
    setClearingAllAnnouncements(true);
    try {
      await apiService.dismissAllAnnouncements();
      const announcementsData = await apiService.fetchAnnouncements();
      setRecentAnnouncements(Array.isArray(announcementsData) ? announcementsData.slice(0, 3) : []);
    } catch (error) {
      console.error("Error clearing announcements:", error);
    } finally {
      setClearingAllAnnouncements(false);
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

  const formatDate = formatDateShort;

  const submitComplaint = async (e) => {
    e.preventDefault();
    setComplaintSubmitting(true);
    try {
      await apiService.createComplaint({
        student: complaintForm.student ? Number(complaintForm.student) : null,
        complaint_type: complaintForm.complaint_type,
        title: complaintForm.title,
        description: complaintForm.description,
      });
      const refreshed = await apiService.fetchComplaints();
      setComplaints(Array.isArray(refreshed) ? refreshed.slice(0, 5) : []);
      setComplaintForm({ student: "", complaint_type: "parent", title: "", description: "" });
    } catch (error) {
      alert(error.message || "Failed to submit complaint");
    } finally {
      setComplaintSubmitting(false);
    }
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
          <>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg mb-6">
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
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">File a Complaint</h3>
              <form onSubmit={submitComplaint} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Complaint title"
                  value={complaintForm.title}
                  onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })}
                  className="md:col-span-2 border rounded px-3 py-2"
                />
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the issue"
                  value={complaintForm.description}
                  onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                  className="md:col-span-2 border rounded px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={complaintSubmitting}
                  className="md:col-span-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-60"
                >
                  {complaintSubmitting ? "Submitting..." : "Submit Complaint"}
                </button>
              </form>
            </div>
          </>
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

            <div className="grid grid-cols-1 gap-6 mb-8">
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

            </div>

            <div className="bg-white p-6 rounded-lg shadow mb-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  <i className="fas fa-bullhorn mr-2 text-blue-600"></i>
                  Recent Announcements
                </h3>
                <button
                  type="button"
                  onClick={handleClearAllAnnouncements}
                  disabled={clearingAllAnnouncements || recentAnnouncements.length === 0}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {clearingAllAnnouncements ? "Clearing..." : "Clear All"}
                </button>
              </div>
              {recentAnnouncements.length > 0 ? (
                <div className="space-y-3">
                  {recentAnnouncements.map((announcement) => (
                    <div key={announcement.id} className="p-3 bg-gray-50 rounded hover:bg-gray-100 transition">
                      <div className="flex justify-between items-start gap-3">
                        <p className="font-semibold text-gray-800">{announcement.title}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {formatDate(announcement.date_posted)}
                          </span>
                          {announcement.can_delete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAnnouncement(announcement.id)}
                              disabled={deletingAnnouncementId === announcement.id}
                              className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              {deletingAnnouncementId === announcement.id ? "Deleting..." : "Delete"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleClearAnnouncement(announcement.id)}
                            disabled={clearingAnnouncementId === announcement.id}
                            className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            {clearingAnnouncementId === announcement.id ? "Clearing..." : "Clear"}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{announcement.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No announcements available.</p>
              )}
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
                  to="/parent/chat"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
                >
                  <div className="flex items-center">
                    <i className="fas fa-envelope text-purple-500 text-xl mr-3"></i>
                    <span className="text-gray-700">Chat with Teachers</span>
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

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">File a Complaint</h3>
              <form onSubmit={submitComplaint} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={complaintForm.student}
                  onChange={(e) => setComplaintForm({ ...complaintForm, student: e.target.value })}
                  className="border rounded px-3 py-2"
                >
                  <option value="">General Complaint (No child selected)</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name} {child.surname}
                    </option>
                  ))}
                </select>
                <input
                  required
                  placeholder="Complaint title"
                  value={complaintForm.title}
                  onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })}
                  className="border rounded px-3 py-2"
                />
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the issue"
                  value={complaintForm.description}
                  onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                  className="md:col-span-2 border rounded px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={complaintSubmitting}
                  className="md:col-span-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-60"
                >
                  {complaintSubmitting ? "Submitting..." : "Submit Complaint"}
                </button>
              </form>

              <div className="mt-4">
                <h4 className="font-medium text-gray-800 mb-2">Recent Complaints</h4>
                <div className="space-y-2">
                  {complaints.map((complaint) => (
                    <div key={complaint.id} className="p-3 bg-gray-50 rounded">
                      <div className="flex justify-between">
                        <p className="font-medium text-gray-800">{complaint.title}</p>
                        <span className="text-xs text-gray-500">{formatDate(complaint.date_submitted)}</span>
                      </div>
                      <p className="text-sm text-gray-600">{complaint.student_name || "General"}</p>
                      <p className="text-xs text-gray-500 capitalize">Status: {complaint.status}</p>
                    </div>
                  ))}
                  {complaints.length === 0 && <p className="text-sm text-gray-500">No complaints submitted yet.</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
