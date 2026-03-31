import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

const STATUS_BUTTONS = [
  { key: "present", label: "P", icon: "fa-check", color: "green" },
  { key: "absent", label: "A", icon: "fa-times", color: "red" },
  { key: "late", label: "L", icon: "fa-clock", color: "yellow" },
  { key: "excused", label: "E", icon: "fa-file-medical", color: "blue" },
];

/* ------------------------------------------------------------------ */
/*  Shared attendance table used by both tabs                         */
/* ------------------------------------------------------------------ */
function AttendanceTable({ students, attendance, locked, onStatusChange, onRemarksChange }) {
  if (students.length === 0) {
    return (
      <div className="text-center py-8">
        <i className="fas fa-user-graduate text-6xl text-gray-300 mb-4"></i>
        <p className="text-gray-500">No students in this class</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">#</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student Number</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
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
              <td className="px-4 py-3">
                <div className="flex space-x-2">
                  {STATUS_BUTTONS.map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      disabled={locked}
                      onClick={() => onStatusChange(student.student_id, btn.key)}
                      className={`px-3 py-1 rounded text-xs font-medium transition ${
                        attendance[student.student_id]?.status === btn.key
                          ? `bg-${btn.color}-600 text-white`
                          : `bg-gray-200 text-gray-700 hover:bg-${btn.color}-100`
                      } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <i className={`fas ${btn.icon} mr-1`}></i>{btn.label}
                    </button>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <input
                  type="text"
                  disabled={locked}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                  placeholder="Optional remarks..."
                  value={attendance[student.student_id]?.remarks || ""}
                  onChange={(e) => onRemarksChange(student.student_id, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status summary cards                                              */
/* ------------------------------------------------------------------ */
function StatusCounts({ students, attendance }) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  students.forEach((s) => {
    const st = attendance[s.student_id]?.status || "present";
    counts[st]++;
  });
  return (
    <>
      <div className="bg-green-50 rounded-lg shadow p-4 border-l-4 border-green-500">
        <div className="text-sm text-gray-600">Present</div>
        <div className="text-2xl font-bold text-green-600">{counts.present}</div>
      </div>
      <div className="bg-red-50 rounded-lg shadow p-4 border-l-4 border-red-500">
        <div className="text-sm text-gray-600">Absent</div>
        <div className="text-2xl font-bold text-red-600">{counts.absent}</div>
      </div>
      <div className="bg-yellow-50 rounded-lg shadow p-4 border-l-4 border-yellow-500">
        <div className="text-sm text-gray-600">Late</div>
        <div className="text-2xl font-bold text-yellow-600">{counts.late}</div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  CLASS ATTENDANCE TAB                                              */
/* ------------------------------------------------------------------ */
function ClassAttendanceTab({ date }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [className, setClassName] = useState("");
  const [locked, setLocked] = useState(false);
  const [noClass, setNoClass] = useState(false);

  const loadRegister = async () => {
    try {
      setLoading(true);
      const data = await apiService.getClassAttendanceRegister(date);
      if (data.no_class) {
        setNoClass(true);
        setStudents([]);
        return;
      }
      setNoClass(false);
      setStudents(data.students || []);
      setClassName(data.class_name || "");
      setLocked(!!data.locked);

      const map = {};
      (data.students || []).forEach((s) => {
        map[s.student_id] = { status: s.status || "present", remarks: s.remarks || "" };
      });
      setAttendance(map);
    } catch {
      alert("Failed to load class attendance register");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRegister(); }, [date]);

  const handleStatusChange = (id, status) =>
    setAttendance((prev) => ({ ...prev, [id]: { ...prev[id], status } }));
  const handleRemarksChange = (id, remarks) =>
    setAttendance((prev) => ({ ...prev, [id]: { ...prev[id], remarks } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiService.markClassAttendance({
        date,
        attendance: students.map((s) => ({
          student_id: s.student_id,
          status: attendance[s.student_id]?.status || "present",
          remarks: attendance[s.student_id]?.remarks || "",
        })),
      });
      setLocked(true);
    } catch (err) {
      const msg = err?.data?.error || err?.message || "Failed to save attendance";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (noClass) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
        <div className="flex items-start">
          <i className="fas fa-exclamation-triangle text-yellow-600 text-2xl mr-4"></i>
          <div>
            <h3 className="text-lg font-semibold text-yellow-800">No Class Assigned</h3>
            <p className="text-yellow-700 mt-2">
              You are not assigned as a class teacher. Only class teachers can mark the daily class attendance register.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {locked && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-lock text-green-600 text-xl mr-3"></i>
            <div>
              <h4 className="font-semibold text-green-800">Attendance Submitted</h4>
              <p className="text-green-700 text-sm">
                Class attendance for this date has been recorded and is now locked.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-500">Class</p>
          <p className="text-lg font-bold text-blue-600">{className}</p>
        </div>
        <StatusCounts students={students} attendance={attendance} />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            <i className="fas fa-clipboard-list mr-2 text-blue-600"></i>
            {className} — Student List ({students.length} students)
          </h3>
          <AttendanceTable
            students={students}
            attendance={attendance}
            locked={locked}
            onStatusChange={handleStatusChange}
            onRemarksChange={handleRemarksChange}
          />
        </div>

        {students.length > 0 && !locked && (
          <div className="flex justify-end space-x-4">
            <button type="button" onClick={loadRegister}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition">
              <i className="fas fa-redo mr-2"></i>Reset
            </button>
            <button type="submit" disabled={submitting}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:bg-gray-400">
              {submitting ? (
                <span><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</span>
              ) : (
                <span><i className="fas fa-save mr-2"></i>Submit Class Attendance</span>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SUBJECT ATTENDANCE TAB                                            */
/* ------------------------------------------------------------------ */
function SubjectAttendanceTab({ date }) {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [locked, setLocked] = useState(false);
  const [className, setClassName] = useState("");
  const [subjectName, setSubjectName] = useState("");

  // Load classes where teacher teaches (via timetable)
  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.getTeacherClasses();
        const list = data.classes || (Array.isArray(data) ? data : []);
        setClasses(list);
        if (list.length > 0) setSelectedClassId(list[0].id);
      } catch {
        console.error("Failed to load classes");
      }
    })();
  }, []);

  // Load subjects for selected class
  useEffect(() => {
    if (!selectedClassId) return;
    setSelectedSubjectId(null);
    setSubjects([]);
    setStudents([]);
    (async () => {
      try {
        const data = await apiService.getTeacherClassSubjects(selectedClassId);
        const list = Array.isArray(data) ? data : [];
        setSubjects(list);
        if (list.length > 0) setSelectedSubjectId(list[0].id);
      } catch {
        console.error("Failed to load subjects");
      }
    })();
  }, [selectedClassId]);

  // Load register when class + subject + date are set
  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId) return;
    loadRegister();
  }, [selectedClassId, selectedSubjectId, date]);

  const loadRegister = async () => {
    try {
      setLoading(true);
      const data = await apiService.getSubjectAttendanceRegister(date, selectedClassId, selectedSubjectId);
      setStudents(data.students || []);
      setClassName(data.class_name || "");
      setSubjectName(data.subject_name || "");
      setLocked(!!data.locked);

      const map = {};
      (data.students || []).forEach((s) => {
        map[s.student_id] = { status: s.status || "present", remarks: s.remarks || "" };
      });
      setAttendance(map);
    } catch {
      alert("Failed to load subject attendance register");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (id, status) =>
    setAttendance((prev) => ({ ...prev, [id]: { ...prev[id], status } }));
  const handleRemarksChange = (id, remarks) =>
    setAttendance((prev) => ({ ...prev, [id]: { ...prev[id], remarks } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiService.markSubjectAttendance({
        date,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        attendance: students.map((s) => ({
          student_id: s.student_id,
          status: attendance[s.student_id]?.status || "present",
          remarks: attendance[s.student_id]?.remarks || "",
        })),
      });
      setLocked(true);
    } catch (err) {
      const msg = err?.data?.error || err?.message || "Failed to save attendance";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <i className="fas fa-school mr-2 text-purple-600"></i>Select Class
          </label>
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={selectedClassId || ""}
            onChange={(e) => setSelectedClassId(Number(e.target.value))}
          >
            {classes.length === 0 && <option value="">No classes available</option>}
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <i className="fas fa-book mr-2 text-purple-600"></i>Select Subject
          </label>
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={selectedSubjectId || ""}
            onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
          >
            {subjects.length === 0 && <option value="">Select a class first</option>}
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </div>
      </div>

      {locked && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-lock text-green-600 text-xl mr-3"></i>
            <div>
              <h4 className="font-semibold text-green-800">Attendance Submitted</h4>
              <p className="text-green-700 text-sm">
                Subject attendance for {subjectName} ({className}) on this date has been recorded and is now locked.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : selectedClassId && selectedSubjectId && students.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-gray-500">Class</p>
              <p className="text-lg font-bold text-purple-600">{className}</p>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-gray-500">Subject</p>
              <p className="text-lg font-bold text-purple-600">{subjectName}</p>
            </div>
            <StatusCounts students={students} attendance={attendance} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                <i className="fas fa-clipboard-list mr-2 text-purple-600"></i>
                {subjectName} — {className} ({students.length} students)
              </h3>
              <AttendanceTable
                students={students}
                attendance={attendance}
                locked={locked}
                onStatusChange={handleStatusChange}
                onRemarksChange={handleRemarksChange}
              />
            </div>

            {!locked && (
              <div className="flex justify-end space-x-4">
                <button type="button" onClick={loadRegister}
                  className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition">
                  <i className="fas fa-redo mr-2"></i>Reset
                </button>
                <button type="submit" disabled={submitting}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition disabled:bg-gray-400">
                  {submitting ? (
                    <span><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</span>
                  ) : (
                    <span><i className="fas fa-save mr-2"></i>Submit Subject Attendance</span>
                  )}
                </button>
              </div>
            )}
          </form>
        </>
      ) : (
        <div className="text-center py-8 text-gray-400">
          {selectedClassId && selectedSubjectId
            ? "No students found in this class"
            : "Select a class and subject to view the register"}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                    */
/* ------------------------------------------------------------------ */
export default function TeacherAttendance() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("class");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const tabs = [
    { key: "class", label: "Class Register", icon: "fa-users", color: "blue" },
    { key: "subject", label: "Subject Register", icon: "fa-book", color: "purple" },
  ];

  return (
    <div>
      <Header title="Attendance Register" user={user} />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Attendance Register</h2>
          <p className="text-gray-600 mt-1">Mark daily class attendance or per-subject lesson attendance.</p>
        </div>

        {/* Date picker + Tabs */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fas fa-calendar mr-2 text-blue-600"></i>Date
            </label>
            <input
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="flex bg-white rounded-lg shadow overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? `bg-${tab.color}-600 text-white`
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <i className={`fas ${tab.icon} mr-2`}></i>{tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "class" ? (
          <ClassAttendanceTab date={date} />
        ) : (
          <SubjectAttendanceTab date={date} />
        )}

        {/* Legend */}
        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <div className="flex">
            <i className="fas fa-info-circle text-blue-600 text-xl mr-3"></i>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Status Legend</h4>
              <p className="text-blue-700 text-sm">
                <strong>P</strong> = Present | <strong>A</strong> = Absent |{" "}
                <strong>L</strong> = Late | <strong>E</strong> = Excused
              </p>
              <p className="text-blue-700 text-sm mt-1">
                <i className="fas fa-lock mr-1"></i> Once attendance is submitted for a date it cannot be changed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
