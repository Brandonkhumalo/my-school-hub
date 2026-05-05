import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import apiService from "../../services/apiService";
import { formatDateShort } from "../../utils/dateFormat";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [clearingId, setClearingId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);

  const loadAnnouncements = async () => {
    try {
      const data = await apiService.fetchAnnouncements();
      setAnnouncements(Array.isArray(data) ? data.slice(0, 3) : []);
    } catch (error) {
      console.error("Error loading announcements:", error);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleDeleteAnnouncement = async (announcementId) => {
    setDeletingId(announcementId);
    try {
      await apiService.deleteAnnouncement(announcementId);
      await loadAnnouncements();
    } catch (error) {
      console.error("Error deleting announcement:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAnnouncement = async (announcementId) => {
    setClearingId(announcementId);
    try {
      await apiService.dismissAnnouncement(announcementId);
      await loadAnnouncements();
    } catch (error) {
      console.error("Error clearing announcement:", error);
    } finally {
      setClearingId(null);
    }
  };

  const handleClearAllAnnouncements = async () => {
    setClearingAll(true);
    try {
      await apiService.dismissAllAnnouncements();
      await loadAnnouncements();
    } catch (error) {
      console.error("Error clearing announcements:", error);
    } finally {
      setClearingAll(false);
    }
  };

  const features = [
    {
      title: "Add Student Marks",
      description: "Enter and manage student marks for your subjects",
      icon: "fa-edit",
      color: "blue",
      link: "/teacher/marks"
    },
    {
      title: "Attendance Register",
      description: "Mark daily attendance for your students",
      icon: "fa-clipboard-list",
      color: "green",
      link: "/teacher/attendance"
    },
    {
      title: "Subject Performance",
      description: "View analytics and performance statistics",
      icon: "fa-chart-line",
      color: "purple",
      link: "/teacher/performance"
    }
  ];

  return (
    <div>
      <Header title="Teacher Dashboard" user={user} />
      
      <div className="p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800">
            Welcome, {user?.first_name}!
          </h2>
          <p className="text-gray-600 mt-2">Manage your classes, students, and academic records</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {features.map((feature, index) => (
            <Link
              key={index}
              to={feature.link}
              className="block bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:-translate-y-1"
            >
              <div className="flex items-start">
                <div className={`w-12 h-12 bg-${feature.color}-100 rounded-lg flex items-center justify-center mr-4`}>
                  <i className={`fas ${feature.icon} text-2xl text-${feature.color}-600`}></i>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center text-blue-600 font-medium">
                <span>Get Started</span>
                <i className="fas fa-arrow-right ml-2"></i>
              </div>
            </Link>
          ))}
        </div>

        {/* Information Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
              <i className="fas fa-lightbulb mr-2"></i>
              Quick Tips
            </h3>
            <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <li className="flex items-start">
                <i className="fas fa-check-circle mr-2 mt-1"></i>
                <span>Mark attendance daily to track student participation</span>
              </li>
              <li className="flex items-start">
                <i className="fas fa-check-circle mr-2 mt-1"></i>
                <span>Add marks regularly to monitor student progress</span>
              </li>
              <li className="flex items-start">
                <i className="fas fa-check-circle mr-2 mt-1"></i>
                <span>Review subject performance analytics to identify areas for improvement</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-800/40 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
              <i className="fas fa-info-circle mr-2"></i>
              Your Responsibilities
            </h3>
            <ul className="space-y-2 text-sm text-green-700 dark:text-green-300">
              <li className="flex items-start">
                <i className="fas fa-graduation-cap mr-2 mt-1"></i>
                <span>Teach assigned subjects and maintain class records</span>
              </li>
              <li className="flex items-start">
                <i className="fas fa-chart-bar mr-2 mt-1"></i>
                <span>Evaluate student performance through exams and assignments</span>
              </li>
              <li className="flex items-start">
                <i className="fas fa-users mr-2 mt-1"></i>
                <span>Track attendance and maintain accurate student records</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-800">
              <i className="fas fa-bullhorn mr-2 text-blue-600"></i>
              Recent Announcements
            </h3>
            <button
              type="button"
              onClick={handleClearAllAnnouncements}
              disabled={clearingAll || announcements.length === 0}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {clearingAll ? "Clearing..." : "Clear All"}
            </button>
          </div>
          {announcements.length > 0 ? (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-800">{announcement.title}</p>
                    {announcement.can_delete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        disabled={deletingId === announcement.id}
                        className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {deletingId === announcement.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleClearAnnouncement(announcement.id)}
                      disabled={clearingId === announcement.id}
                      className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {clearingId === announcement.id ? "Clearing..." : "Clear"}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{announcement.content}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDateShort(announcement.date_posted)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No announcements available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
