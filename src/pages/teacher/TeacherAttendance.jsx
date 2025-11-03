import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function TeacherAttendance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});

  useEffect(() => {
    loadAttendance();
  }, [date]);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAttendanceRegister(date, null);
      setStudents(data.students);
      
      // Initialize attendance state from existing data
      const attendanceMap = {};
      data.students.forEach(student => {
        attendanceMap[student.student_id] = {
          status: student.status || 'present',
          remarks: student.remarks || ''
        };
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error("Error loading attendance:", error);
      alert("Failed to load attendance register");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: status
      }
    }));
  };

  const handleRemarksChange = (studentId, remarks) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks: remarks
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      // Prepare attendance data
      const attendanceData = students.map(student => ({
        student_id: student.student_id,
        status: attendance[student.student_id]?.status || 'present',
        remarks: attendance[student.student_id]?.remarks || ''
      }));

      await apiService.markAttendance({
        date: date,
        attendance: attendanceData
      });

      alert("Attendance saved successfully!");
      await loadAttendance();
    } catch (error) {
      console.error("Error saving attendance:", error);
      alert("Failed to save attendance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusCounts = () => {
    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0
    };
    
    students.forEach(student => {
      const status = attendance[student.student_id]?.status || 'present';
      counts[status]++;
    });
    
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div>
        <Header title="Attendance Register" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Attendance Register" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Daily Attendance Register</h2>
          <p className="text-gray-600 mt-2">Mark student attendance for the day</p>
        </div>

        {/* Date and Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          {/* Date Selector */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="fas fa-calendar mr-2 text-blue-600"></i>
              Select Date
            </label>
            <input
              type="date"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Summary Cards */}
          <div className="bg-green-50 rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-sm text-gray-600">Present</div>
            <div className="text-2xl font-bold text-green-600">{statusCounts.present}</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="text-sm text-gray-600">Absent</div>
            <div className="text-2xl font-bold text-red-600">{statusCounts.absent}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="text-sm text-gray-600">Late</div>
            <div className="text-2xl font-bold text-yellow-600">{statusCounts.late}</div>
          </div>
        </div>

        {/* Attendance Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              <i className="fas fa-clipboard-list mr-2 text-blue-600"></i>
              Student List ({students.length} students)
            </h3>

            {students.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-user-graduate text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No students found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">#</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student Number</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Class</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <tr key={student.student_id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.student_number}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {student.name} {student.surname}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.class}</td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.student_id, 'present')}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${
                                attendance[student.student_id]?.status === 'present'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                              }`}
                            >
                              <i className="fas fa-check mr-1"></i>P
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.student_id, 'absent')}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${
                                attendance[student.student_id]?.status === 'absent'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                              }`}
                            >
                              <i className="fas fa-times mr-1"></i>A
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.student_id, 'late')}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${
                                attendance[student.student_id]?.status === 'late'
                                  ? 'bg-yellow-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-yellow-100'
                              }`}
                            >
                              <i className="fas fa-clock mr-1"></i>L
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.student_id, 'excused')}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${
                                attendance[student.student_id]?.status === 'excused'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-blue-100'
                              }`}
                            >
                              <i className="fas fa-file-medical mr-1"></i>E
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Optional remarks..."
                            value={attendance[student.student_id]?.remarks || ''}
                            onChange={(e) => handleRemarksChange(student.student_id, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {students.length > 0 && (
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={loadAttendance}
                className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition"
              >
                <i className="fas fa-redo mr-2"></i>
                Reset
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:bg-gray-400"
              >
                {submitting ? (
                  <span>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Saving...
                  </span>
                ) : (
                  <span>
                    <i className="fas fa-save mr-2"></i>
                    Save Attendance
                  </span>
                )}
              </button>
            </div>
          )}
        </form>

        {/* Legend */}
        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <div className="flex">
            <i className="fas fa-info-circle text-blue-600 text-xl mr-3"></i>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Status Legend</h4>
              <p className="text-blue-700 text-sm">
                <strong>P</strong> = Present | <strong>A</strong> = Absent | 
                <strong className="ml-2">L</strong> = Late | <strong className="ml-2">E</strong> = Excused
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
