import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function StudentCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalendar();
  }, []);

  const loadCalendar = async () => {
    try {
      setLoading(true);
      const data = await apiService.getSchoolCalendar();
      setEvents(data);
    } catch (error) {
      console.error("Error loading calendar:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getEventTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'holiday':
        return 'border-green-500 bg-green-50';
      case 'activity':
        return 'border-blue-500 bg-blue-50';
      case 'exam':
        return 'border-red-500 bg-red-50';
      case 'event':
        return 'border-purple-500 bg-purple-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const getEventIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'holiday':
        return 'fa-umbrella-beach';
      case 'activity':
        return 'fa-running';
      case 'exam':
        return 'fa-pen-fancy';
      case 'event':
        return 'fa-calendar-star';
      default:
        return 'fa-calendar-day';
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="School Calendar" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="School Calendar" user={user} />
      
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Upcoming School Events & Holidays</h2>
          
          {events.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-calendar-times text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`p-4 rounded-lg border-l-4 ${getEventTypeColor(event.type)}`}
                >
                  <div className="flex items-start">
                    <div className="mr-4">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                        <i className={`fas ${getEventIcon(event.type)} text-2xl text-gray-700`}></i>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">{event.title}</h3>
                          <span className="inline-block px-2 py-1 mt-1 text-xs font-semibold bg-white rounded-full text-gray-700">
                            {event.type}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            {formatDate(event.start_date)}
                          </p>
                          {event.end_date && event.end_date !== event.start_date && (
                            <p className="text-sm text-gray-600">
                              to {formatDate(event.end_date)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-700 mt-2">{event.description}</p>
                      
                      {event.location && (
                        <p className="text-sm text-gray-600 mt-2">
                          <i className="fas fa-map-marker-alt mr-2"></i>
                          {event.location}
                        </p>
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
