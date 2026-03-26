import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDateLong } from "../../utils/dateFormat";
import apiService from "../../services/apiService";

export default function StudentCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [activityEvents, setActivityEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    holiday: true, activity: true, exam: true, event: true, sport: true,
  });

  useEffect(() => {
    loadCalendar();
  }, []);

  const loadCalendar = async () => {
    try {
      setLoading(true);
      const [calData, actData] = await Promise.all([
        apiService.getSchoolCalendar(),
        apiService.getStudentActivities().catch(() => []),
      ]);
      setEvents(calData);
      // Flatten activity events into calendar format
      const actEvents = [];
      const activities = Array.isArray(actData) ? actData : (actData?.activities || []);
      for (const act of activities) {
        if (act.events) {
          for (const ev of act.events) {
            actEvents.push({
              id: `act-${ev.id}`,
              title: `${act.name}: ${ev.title}`,
              description: ev.notes || '',
              type: 'sport',
              event_type: 'sport',
              start_date: ev.event_date,
              end_date: ev.event_date,
              location: ev.location || act.location || '',
            });
          }
        }
      }
      setActivityEvents(actEvents);
    } catch (error) {
      console.error("Error loading calendar:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (type) => setFilters(prev => ({ ...prev, [type]: !prev[type] }));

  // Merge and filter events
  const allEvents = [...events, ...activityEvents]
    .filter(e => {
      const type = (e.type || e.event_type || '').toLowerCase();
      return filters[type] !== false;
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const fmtDate = formatDateLong;

  const typeConfig = {
    holiday:  { color: 'border-gray-500 bg-gray-50',    icon: 'fa-umbrella-beach', label: 'Holidays',   dot: 'bg-gray-500' },
    activity: { color: 'border-orange-500 bg-orange-50', icon: 'fa-star',           label: 'Activities', dot: 'bg-orange-500' },
    exam:     { color: 'border-red-500 bg-red-50',       icon: 'fa-pen-fancy',      label: 'Exams',      dot: 'bg-red-500' },
    event:    { color: 'border-blue-500 bg-blue-50',     icon: 'fa-calendar-day',   label: 'Events',     dot: 'bg-blue-500' },
    sport:    { color: 'border-green-500 bg-green-50',   icon: 'fa-running',        label: 'Sports',     dot: 'bg-green-500' },
  };

  const getEventTypeColor = (type) => (typeConfig[type?.toLowerCase()] || typeConfig.event).color;
  const getEventIcon = (type) => (typeConfig[type?.toLowerCase()] || typeConfig.event).icon;

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
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back
        </button>
        
        {/* Filter toggles */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(typeConfig).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                filters[key]
                  ? 'bg-white border-gray-300 text-gray-800'
                  : 'bg-gray-200 border-gray-200 text-gray-400 line-through'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full mr-2 ${cfg.dot}`}></span>
              {cfg.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Upcoming Events & Activities ({allEvents.length})
          </h2>

          {allEvents.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-calendar-times text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allEvents.map((event) => (
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
                            {fmtDate(event.start_date)}
                          </p>
                          {event.end_date && event.end_date !== event.start_date && (
                            <p className="text-sm text-gray-600">
                              to {fmtDate(event.end_date)}
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
