import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminTimetable() {
  const [timetables, setTimetables] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');

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

  // Define grade structure
  const primaryGrades = [
    { grade: 1, sections: ['A', 'B'] },
    { grade: 2, sections: ['A', 'B'] },
    { grade: 3, sections: ['A', 'B'] },
    { grade: 4, sections: ['A', 'B'] },
    { grade: 5, sections: ['A', 'B'] },
    { grade: 6, sections: ['A', 'B'] },
    { grade: 7, sections: ['A', 'B'] },
  ];

  const secondaryForms = [
    { form: 1, sections: ['A', 'B'] },
    { form: 2, sections: ['A', 'B'] },
    { form: 3, sections: ['A', 'B'] },
    { form: 4, sections: ['A', 'B'] },
    { form: 5, sections: ['A', 'B'] },
    { form: 6, sections: ['A', 'B'] },
  ];

  // Function to get class name for display
  const getClassName = (grade, section, isPrimary = true) => {
    return isPrimary ? `Grade ${grade}${section}` : `Form ${grade}${section}`;
  };

  // Function to find class by name
  const findClassByName = (className) => {
    return classes.find(c => c.name === className);
  };

  // Function to get timetable for a class
  const getClassTimetable = (classId) => {
    return timetables.filter(t => t.class_obj?.id === classId || t.class === classId);
  };

  // Filter classes based on selection
  const filterClasses = () => {
    if (selectedClass !== 'all') {
      const cls = classes.find(c => c.id == selectedClass);
      return cls ? [cls] : [];
    }
    if (selectedGrade !== 'all') {
      return classes.filter(c => c.name?.toLowerCase().includes(selectedGrade.toLowerCase()));
    }
    return classes;
  };

  const filteredClasses = filterClasses();

  if (isLoading) return (
    <div>
      <Header title="Class Timetable" />
      <LoadingSpinner />
    </div>
  );

  return (
    <div>
      <Header title="Class Timetable & Schedules" />
      <div className="p-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Level</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Grades</option>
                <optgroup label="Primary">
                  <option value="grade 1">Grade 1</option>
                  <option value="grade 2">Grade 2</option>
                  <option value="grade 3">Grade 3</option>
                  <option value="grade 4">Grade 4</option>
                  <option value="grade 5">Grade 5</option>
                  <option value="grade 6">Grade 6</option>
                  <option value="grade 7">Grade 7</option>
                </optgroup>
                <optgroup label="Secondary">
                  <option value="form 1">Form 1</option>
                  <option value="form 2">Form 2</option>
                  <option value="form 3">Form 3</option>
                  <option value="form 4">Form 4</option>
                  <option value="form 5">Form 5</option>
                  <option value="form 6">Form 6</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Primary Grades Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Primary School (Grades 1-7)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {primaryGrades.map(({ grade, sections }) => (
              sections.map(section => {
                const className = getClassName(grade, section, true);
                const classData = findClassByName(className);
                const studentCount = classData?.student_count || 0;
                
                return (
                  <div key={`${grade}${section}`} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-blue-600">{className}</h3>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        {studentCount} students
                      </span>
                    </div>
                    {classData ? (
                      <div className="text-sm text-gray-600">
                        <p><i className="fas fa-user-tie mr-2"></i>Teacher: {classData.teacher_name || 'Not assigned'}</p>
                        <p className="mt-1"><i className="fas fa-door-open mr-2"></i>Room: {classData.room_number || 'TBA'}</p>
                        {getClassTimetable(classData.id).length > 0 && (
                          <p className="mt-1 text-green-600">
                            <i className="fas fa-check-circle mr-2"></i>
                            {getClassTimetable(classData.id).length} lessons scheduled
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">Class not yet created</p>
                    )}
                  </div>
                );
              })
            ))}
          </div>
        </div>

        {/* Secondary Forms Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Secondary School (Forms 1-6)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {secondaryForms.map(({ form, sections }) => (
              sections.map(section => {
                const className = getClassName(form, section, false);
                const classData = findClassByName(className);
                const studentCount = classData?.student_count || 0;
                
                return (
                  <div key={`form${form}${section}`} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-green-600">{className}</h3>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                        {studentCount} students
                      </span>
                    </div>
                    {classData ? (
                      <div className="text-sm text-gray-600">
                        <p><i className="fas fa-user-tie mr-2"></i>Teacher: {classData.teacher_name || 'Not assigned'}</p>
                        <p className="mt-1"><i className="fas fa-door-open mr-2"></i>Room: {classData.room_number || 'TBA'}</p>
                        {getClassTimetable(classData.id).length > 0 && (
                          <p className="mt-1 text-green-600">
                            <i className="fas fa-check-circle mr-2"></i>
                            {getClassTimetable(classData.id).length} lessons scheduled
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">Class not yet created</p>
                    )}
                  </div>
                );
              })
            ))}
          </div>
        </div>

        {/* Detailed Timetable View for Selected Classes */}
        {filteredClasses.length > 0 && selectedClass !== 'all' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Timetable for {filteredClasses[0].name}
            </h2>
            {getClassTimetable(filteredClasses[0].id).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Day</th>
                      <th className="px-4 py-2 text-left">Time</th>
                      <th className="px-4 py-2 text-left">Subject</th>
                      <th className="px-4 py-2 text-left">Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getClassTimetable(filteredClasses[0].id).map((entry) => (
                      <tr key={entry.id} className="border-t">
                        <td className="px-4 py-2">{entry.day_of_week}</td>
                        <td className="px-4 py-2">{entry.start_time} - {entry.end_time}</td>
                        <td className="px-4 py-2">{entry.subject_name || entry.subject}</td>
                        <td className="px-4 py-2">{entry.teacher_name || 'TBA'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <i className="fas fa-calendar-times text-gray-400 text-5xl mb-4"></i>
                <p className="text-gray-500">No timetable entries for this class yet</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
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
    </div>
  );
}
