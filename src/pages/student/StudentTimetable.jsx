import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function StudentTimetable() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimetable();
  }, []);

  const loadTimetable = async () => {
    try {
      setLoading(true);
      const data = await apiService.getStudentTimetable();
      setTimetable(data);
    } catch (error) {
      console.error("Error loading timetable:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  if (loading) {
    return (
      <div>
        <Header title="My Timetable" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="My Timetable" user={user} />
      
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back
        </button>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
            <h2 className="text-2xl font-bold">Weekly Timetable</h2>
            {timetable?.week_start_date && (
              <p className="text-blue-100 mt-2">
                Week of {formatDate(timetable.week_start_date)}
              </p>
            )}
          </div>

          {!timetable?.schedule || Object.keys(timetable.schedule).length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-clock text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No timetable available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                    {days.map((day) => (
                      <th key={day} className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {timetable.schedule && Object.entries(timetable.schedule).map(([timeSlot, classes]) => (
                    <tr key={timeSlot} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">
                        {timeSlot}
                      </td>
                      {days.map((day) => {
                        const classInfo = classes[day];
                        return (
                          <td key={day} className="px-4 py-3">
                            {classInfo ? (
                              <div className="bg-blue-50 p-2 rounded border-l-4 border-blue-500">
                                <p className="font-semibold text-gray-800 text-sm">{classInfo.subject}</p>
                                {classInfo.teacher && (
                                  <p className="text-xs text-gray-600 mt-1">{classInfo.teacher}</p>
                                )}
                                {classInfo.room && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    <i className="fas fa-door-open mr-1"></i>
                                    {classInfo.room}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="text-gray-400 text-sm">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {timetable?.notes && (
          <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex">
              <i className="fas fa-info-circle text-yellow-600 text-xl mr-3"></i>
              <div>
                <h4 className="font-semibold text-yellow-800 mb-1">Notes</h4>
                <p className="text-yellow-700">{timetable.notes}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
