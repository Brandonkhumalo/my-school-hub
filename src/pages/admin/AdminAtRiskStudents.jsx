import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";

export default function AdminAtRiskStudents() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overall");
  const [students, setStudents] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("risk_score");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [marks, setMarks] = useState([]);
  const [loadingMarks, setLoadingMarks] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === "marks") {
      loadMarks();
    } else {
      loadStudents();
    }
  }, [activeTab, search, sortBy, selectedSubject, selectedClass]);

  const loadMarks = async () => {
    try {
      setLoadingMarks(true);
      const params = {};
      if (selectedSubject) params.subject = selectedSubject;
      const data = await apiService.fetchResults(params);
      const rows = Array.isArray(data) ? data : (data?.results || []);
      const filtered = search
        ? rows.filter((r) => (r.student_name || "").toLowerCase().includes(search.toLowerCase()) || (r.student_number || "").toString().includes(search))
        : rows;
      setMarks(filtered);
    } catch (err) {
      console.error("Error loading marks:", err);
      setMarks([]);
    } finally {
      setLoadingMarks(false);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [subjectsData, classesData] = await Promise.all([
        apiService.getSubjects(),
        apiService.getClasses(),
      ]);
      setSubjects(subjectsData);
      setClasses(classesData);
      await loadStudents();
    } catch (error) {
      console.error("Error loading initial data:", error);
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      const data = await apiService.getAdminAtRiskStudents(
        activeTab,
        search,
        selectedSubject ? parseInt(selectedSubject) : null,
        selectedClass ? parseInt(selectedClass) : null,
        sortBy
      );
      setStudents(data);
    } catch (error) {
      console.error("Error loading students:", error);
      setStudents(null);
    } finally {
      setLoadingStudents(false);
    }
  };

  const getGradeColor = (grade) => {
    switch (grade) {
      case "A": return "bg-green-100 text-green-800 border-green-300";
      case "B": return "bg-blue-100 text-blue-800 border-blue-300";
      case "C": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "D": return "bg-orange-100 text-orange-800 border-orange-300";
      case "E": return "bg-red-100 text-red-800 border-red-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getTrendIcon = (trend) => {
    const iconMap = {
      "up": <i className="fas fa-arrow-up text-green-600 mr-2"></i>,
      "down": <i className="fas fa-arrow-down text-red-600 mr-2"></i>,
      "stable": <i className="fas fa-minus text-gray-600 mr-2"></i>
    };
    return iconMap[trend] || iconMap["stable"];
  };

  const getRiskLevel = (riskScore) => {
    if (riskScore >= 75) return { level: "High", color: "bg-red-100 text-red-800", icon: "fa-circle text-red-600" };
    if (riskScore >= 50) return { level: "Medium", color: "bg-orange-100 text-orange-800", icon: "fa-circle text-orange-600" };
    return { level: "Low", color: "bg-green-100 text-green-800", icon: "fa-circle text-green-600" };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-800";
      case "acknowledged": return "bg-yellow-100 text-yellow-800";
      case "intervention_scheduled": return "bg-purple-100 text-purple-800";
      case "resolved": return "bg-green-100 text-green-800";
      case "escalated": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="At-Risk Students Dashboard" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header title="At-Risk Students Dashboard" user={user} />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">At-Risk Students Monitoring</h2>
          <p className="text-gray-600 mt-2">Comprehensive view of students at risk across all subjects</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("overall")}
              className={`px-6 py-4 font-medium transition ${
                activeTab === "overall"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <i className="fas fa-chart-bar mr-2"></i>Overall Risk
            </button>
            <button
              onClick={() => setActiveTab("by_subject")}
              className={`px-6 py-4 font-medium transition ${
                activeTab === "by_subject"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <i className="fas fa-book mr-2"></i>By Subject
            </button>
            <button
              onClick={() => setActiveTab("marks")}
              className={`px-6 py-4 font-medium transition ${
                activeTab === "marks"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <i className="fas fa-clipboard-list mr-2"></i>Student Marks
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-search mr-2"></i>Search
              </label>
              <input
                type="text"
                placeholder="Name, email, or student #"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(activeTab === "by_subject" || activeTab === "marks") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-book mr-2"></i>Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-users mr-2"></i>Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-sort mr-2"></i>Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="risk_score">Risk Score (High to Low)</option>
                <option value="name">Name</option>
                <option value="date">Most Recent Alert</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {activeTab !== "marks" && students && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total At-Risk</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">{students.total_at_risk || 0}</p>
                </div>
                <i className="fas fa-exclamation-triangle text-4xl text-red-200"></i>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">High Risk (&gt;=75)</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">
                    {students.students.filter(s => s.overall_risk_score >= 75).length || 0}
                  </p>
                </div>
                <i className="fas fa-fire text-4xl text-red-200"></i>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Medium Risk (50-74)</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">
                    {students.students.filter(s => s.overall_risk_score >= 50 && s.overall_risk_score < 75).length || 0}
                  </p>
                </div>
                <i className="fas fa-exclamation-circle text-4xl text-orange-200"></i>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Low Risk (&lt;50)</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {students.students.filter(s => s.overall_risk_score < 50).length || 0}
                  </p>
                </div>
                <i className="fas fa-check-circle text-4xl text-green-200"></i>
              </div>
            </div>
          </div>
        )}

        {/* Top Performers */}
        {activeTab !== "marks" && students && Array.isArray(students.top_performers) && students.top_performers.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              <i className="fas fa-trophy mr-2 text-yellow-500"></i>
              Top Performers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {students.top_performers.slice(0, 9).map((s) => (
                <div key={s.student_id} className="p-4 rounded-lg border border-green-200 bg-green-50">
                  <p className="font-semibold text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-600">#{s.student_number} • {s.class}</p>
                  <p className="text-sm text-green-800 mt-1">
                    Avg: <span className="font-semibold">{s.average_percentage}%</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Student Marks view */}
        {activeTab === "marks" && (
          loadingMarks ? <LoadingSpinner /> : (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Subject</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Assessment</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Term / Year</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Score</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Out of</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">%</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marks.length === 0 ? (
                      <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No marks recorded.</td></tr>
                    ) : marks.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <div className="font-medium text-gray-800">{r.student_name}</div>
                          <div className="text-xs text-gray-500">#{r.student_number}</div>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-700">{r.subject_name}</td>
                        <td className="px-6 py-3 text-sm text-gray-700">{r.exam_type}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{r.academic_term} / {r.academic_year}</td>
                        <td className="px-6 py-3 text-right">{r.score}</td>
                        <td className="px-6 py-3 text-right">{r.max_score}</td>
                        <td className="px-6 py-3 text-right font-medium">{r.percentage}%</td>
                        <td className="px-6 py-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${getGradeColor((r.grade || '').charAt(0))}`}>{r.grade}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* Students List */}
        {activeTab !== "marks" && (loadingStudents ? (
          <LoadingSpinner />
        ) : students && students.students.length > 0 ? (
          <div className="space-y-4">
            {students.students.map((student) => {
              const riskLevel = getRiskLevel(student.overall_risk_score);
              const isExpanded = expandedStudent === student.student_id;

              return (
                <div key={student.student_id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition">
                  <div
                    onClick={() => setExpandedStudent(isExpanded ? null : student.student_id)}
                    className="p-6 cursor-pointer hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${riskLevel.color}`}>
                          <i className={`fas ${riskLevel.icon}`}></i>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-800">{student.name}</h3>
                          <p className="text-sm text-gray-600">
                            #{student.student_number} • {student.class}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Risk Score</p>
                          <p className={`text-3xl font-bold ${riskLevel.color.replace("bg-", "text-").replace(" text-", "")}`}>
                            {student.overall_risk_score}%
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-4 py-2 rounded-full text-sm font-medium ${riskLevel.color}`}>
                            {riskLevel.level} Risk
                          </span>
                        </div>
                        <div className="text-gray-400">
                          <i className={`fas fa-chevron-${isExpanded ? "up" : "down"}`}></i>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t px-6 py-6">
                      {/* At-Risk Subjects */}
                      {student.at_risk_subjects && student.at_risk_subjects.length > 0 && (
                        <div className="mb-6">
                          <h4 className="font-semibold text-gray-800 mb-4">
                            <i className="fas fa-book mr-2 text-blue-600"></i>
                            At-Risk Subjects ({student.at_risk_subjects.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {student.at_risk_subjects.map((subject, idx) => (
                              <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="font-medium text-gray-800 mb-2">{subject.subject}</p>
                                <div className="space-y-1 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Current Grade:</span>
                                    <span className={`px-2 py-1 rounded font-semibold border ${getGradeColor(subject.current_grade)}`}>
                                      {subject.current_grade}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Predicted Grade:</span>
                                    <span className={`px-2 py-1 rounded font-semibold border ${getGradeColor(subject.predicted_grade)}`}>
                                      {subject.predicted_grade}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Trend:</span>
                                    <div className="flex items-center">
                                      {getTrendIcon(subject.trend)}
                                      <span className="capitalize font-medium">{subject.trend}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent Alerts */}
                      {student.recent_alerts && student.recent_alerts.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-4">
                            <i className="fas fa-bell mr-2 text-yellow-600"></i>
                            Recent Alerts ({student.recent_alerts.length})
                          </h4>
                          <div className="space-y-3">
                            {student.recent_alerts.map((alert, idx) => (
                              <div key={idx} className="bg-white p-4 rounded-lg border-l-4 border-orange-400">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="font-medium text-gray-800">{alert.subject_name}</p>
                                    <p className="text-sm text-gray-600">{alert.triggered_by}</p>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
                                    {alert.status}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  <i className="fas fa-clock mr-1"></i>
                                  {formatDate(alert.created_at)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : students && students.students.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <i className="fas fa-check-circle text-6xl text-green-300 mb-4"></i>
            <p className="text-gray-600 text-lg">No at-risk students found!</p>
            <p className="text-gray-500 mt-2">All students in your selection are performing well.</p>
          </div>
        ) : null)}
      </div>
    </div>
  );
}
