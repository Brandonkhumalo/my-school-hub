import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminTimetable() {
  const [timetables, setTimetables] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [timetableData, classData] = await Promise.all([
        apiService.fetchTimetables(),
        apiService.fetchClasses()
      ]);
      setTimetables(timetableData);
      setClasses(classData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getClassTimetable = (classId) => {
    return timetables.filter(t => t.class_obj?.id === classId || t.class === classId);
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const organizeTimetable = (entries) => {
    const organized = {};
    entries.forEach(entry => {
      const timeSlot = `${entry.start_time} - ${entry.end_time}`;
      if (!organized[timeSlot]) {
        organized[timeSlot] = {};
      }
      organized[timeSlot][entry.day_of_week] = entry;
    });
    return organized;
  };

  const primaryClasses = classes.filter(c => {
    const name = c.name?.toLowerCase() || '';
    return name.includes('grade');
  });

  const secondaryClasses = classes.filter(c => {
    const name = c.name?.toLowerCase() || '';
    return name.includes('form');
  });

  if (isLoading) return (
    <div>
      <Header title="Class Timetables" />
      <LoadingSpinner />
    </div>
  );

  return (
    <div>
      <Header title="Class Timetables" />
      <div className="p-6">
        {selectedClass ? (
          <div>
            <button
              onClick={() => setSelectedClass(null)}
              className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to All Classes
            </button>

            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedClass.name} Timetable</h2>
                  <p className="text-gray-600 mt-1">
                    <i className="fas fa-user-tie mr-2"></i>
                    Teacher: {selectedClass.teacher_name || 'Not assigned'}
                  </p>
                  <p className="text-gray-600 mt-1">
                    <i className="fas fa-users mr-2"></i>
                    Students: {selectedClass.student_count || 0}
                  </p>
                </div>
              </div>
            </div>

            {getClassTimetable(selectedClass.id).length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Time</th>
                        {days.map((day) => (
                          <th key={day} className="px-4 py-3 text-left font-semibold text-gray-700">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Object.entries(organizeTimetable(getClassTimetable(selectedClass.id))).map(([timeSlot, dayEntries]) => (
                        <tr key={timeSlot} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">
                            {timeSlot}
                          </td>
                          {days.map((day) => {
                            const entry = dayEntries[day];
                            return (
                              <td key={day} className="px-4 py-3">
                                {entry ? (
                                  <div className="bg-blue-50 p-2 rounded border-l-4 border-blue-500">
                                    <p className="font-semibold text-gray-800 text-sm">{entry.subject_name || entry.subject}</p>
                                    {entry.teacher_name && (
                                      <p className="text-xs text-gray-600 mt-1">{entry.teacher_name}</p>
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
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-center py-8">
                  <i className="fas fa-calendar-times text-gray-400 text-5xl mb-4"></i>
                  <p className="text-gray-500">No timetable entries for this class yet</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">All Classes</h2>
              <p className="text-gray-600 mt-1">Click on a class to view its timetable</p>
            </div>

            {primaryClasses.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  <i className="fas fa-school mr-2 text-blue-600"></i>
                  Primary School (Grades)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {primaryClasses.map((cls) => {
                    const timetableCount = getClassTimetable(cls.id).length;
                    return (
                      <div 
                        key={cls.id} 
                        className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition cursor-pointer border-l-4 border-blue-500"
                        onClick={() => setSelectedClass(cls)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-blue-600">{cls.name}</h3>
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                            {cls.student_count || 0} students
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p><i className="fas fa-user-tie mr-2"></i>{cls.teacher_name || 'No teacher assigned'}</p>
                          <p className="mt-1">
                            {timetableCount > 0 ? (
                              <span className="text-green-600">
                                <i className="fas fa-check-circle mr-2"></i>
                                {timetableCount} lessons scheduled
                              </span>
                            ) : (
                              <span className="text-gray-400">
                                <i className="fas fa-calendar-times mr-2"></i>
                                No timetable
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="mt-3 text-right">
                          <span className="text-blue-600 text-sm font-medium">
                            View Timetable <i className="fas fa-arrow-right ml-1"></i>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {secondaryClasses.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  <i className="fas fa-graduation-cap mr-2 text-green-600"></i>
                  Secondary School (Forms)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {secondaryClasses.map((cls) => {
                    const timetableCount = getClassTimetable(cls.id).length;
                    return (
                      <div 
                        key={cls.id} 
                        className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition cursor-pointer border-l-4 border-green-500"
                        onClick={() => setSelectedClass(cls)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-green-600">{cls.name}</h3>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                            {cls.student_count || 0} students
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p><i className="fas fa-user-tie mr-2"></i>{cls.teacher_name || 'No teacher assigned'}</p>
                          <p className="mt-1">
                            {timetableCount > 0 ? (
                              <span className="text-green-600">
                                <i className="fas fa-check-circle mr-2"></i>
                                {timetableCount} lessons scheduled
                              </span>
                            ) : (
                              <span className="text-gray-400">
                                <i className="fas fa-calendar-times mr-2"></i>
                                No timetable
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="mt-3 text-right">
                          <span className="text-green-600 text-sm font-medium">
                            View Timetable <i className="fas fa-arrow-right ml-1"></i>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {classes.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <i className="fas fa-calendar-alt text-gray-400 text-6xl mb-4"></i>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Classes Found</h3>
                <p className="text-gray-500 mb-4">
                  Create classes to start managing timetables
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
