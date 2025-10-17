import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function StudentAnnouncements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await apiService.getStudentAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      console.error("Error loading announcements:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'border-red-500 bg-red-50';
      case 'high':
        return 'border-orange-500 bg-orange-50';
      case 'normal':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'fa-exclamation-triangle';
      case 'high':
        return 'fa-exclamation-circle';
      default:
        return 'fa-info-circle';
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="Announcements" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Announcements" user={user} />
      
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">School Announcements</h2>
          
          {announcements.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-bullhorn text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No announcements at this time</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`p-5 rounded-lg border-l-4 ${getPriorityColor(announcement.priority)}`}
                >
                  <div className="flex items-start">
                    <div className="mr-4">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                        <i className={`fas ${getPriorityIcon(announcement.priority)} text-2xl text-gray-700`}></i>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-800 mb-1">
                            {announcement.title}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span>
                              <i className="fas fa-user mr-1"></i>
                              {announcement.author}
                            </span>
                            <span>
                              <i className="fas fa-calendar mr-1"></i>
                              {formatDate(announcement.date)}
                            </span>
                            {announcement.priority && (
                              <span className="px-2 py-1 bg-white rounded-full text-xs font-semibold">
                                {announcement.priority.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-gray-700 mt-3 leading-relaxed">{announcement.message}</p>
                      
                      {announcement.attachments && announcement.attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-sm text-gray-600 mb-2">
                            <i className="fas fa-paperclip mr-2"></i>
                            Attachments:
                          </p>
                          <div className="space-y-1">
                            {announcement.attachments.map((file, idx) => (
                              <a
                                key={idx}
                                href={file.url}
                                className="text-blue-600 hover:text-blue-700 text-sm block"
                              >
                                <i className="fas fa-file mr-2"></i>
                                {file.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
