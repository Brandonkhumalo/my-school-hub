import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function TeacherPerformance() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAtRisk, setFilterAtRisk] = useState("all");
  const [sortBy, setSortBy] = useState("risk_score");

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadStudents();
    }
  }, [selectedSubject, search, filterAtRisk, sortBy]);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTeacherSubjects();
      setSubjects(data);
      if (data.length > 0) {
        setSelectedSubject(data[0].id);
      }
    } catch (error) {
      console.error("Error loading subjects:", error);
      alert("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    if (!selectedSubject) return;
    try {
      setLoadingStudents(true);
      const data = await apiService.getSubjectStudentsAtRisk(
        selectedSubject,
        search,
        filterAtRisk,
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
      case "B": return \"bg-blue-100 text-blue-800 border-blue-300\";
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

  const getRiskBadge = (atRisk) => {
    return atRisk ? (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
        <i className="fas fa-exclamation-circle mr-2"></i>
        At Risk
      </span>
    ) : (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
        <i className="fas fa-check-circle mr-2"></i>
        Safe
      </span>
    );
  };

  if (loading) {
    return (
      <div>
        <Header title="Performance by Subject" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header title="Performance by Subject" user={user} />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Student Performance Monitoring</h2>
          <p className="text-gray-600 mt-2">View student performance and identify at-risk students</p>
        </div>

        {subjects.length === 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-yellow-800">No subjects assigned. Contact administrator.</p>
          </div>
        ) : (
          <div>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <i className="fas fa-book mr-2 text-blue-600"></i>Select Subject
              </label>
              <select
                className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedSubject || ""}
                onChange={(e) => setSelectedSubject(parseInt(e.target.value))}
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code}) - {subject.students_count} students
                  </option>
                ))}
              </select>
            </div>

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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-filter mr-2"></i>Risk Status
                  </label>
                  <select
                    value={filterAtRisk}
                    onChange={(e) => setFilterAtRisk(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Students</option>
                    <option value="at_risk">At Risk Only</option>
                    <option value="safe">Safe Only</option>
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
                    <option value="risk_score">Risk Score</option>
                    <option value="name">Name</option>
                    <option value="trend">Trend</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={loadStudents}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <i className="fas fa-refresh mr-2"></i>Refresh
                  </button>
                </div>
              </div>
            </div>

            {students && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Students</p>
                      <p className="text-3xl font-bold text-blue-600 mt-2">{students.total_students}</p>
                    </div>
                    <i className="fas fa-users text-4xl text-blue-200"></i>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">At Risk</p>
                      <p className="text-3xl font-bold text-red-600 mt-2">{students.at_risk_count}</p>
                    </div>
                    <i className="fas fa-exclamation-triangle text-4xl text-red-200"></i>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Safe</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">
                        {students.total_students - students.at_risk_count}
                      </p>
                    </div>
                    <i className="fas fa-check-circle text-4xl text-green-200"></i>
                  </div>
                </div>
              </div>
            )}

            {loadingStudents ? (
              <LoadingSpinner />
            ) : students && students.results.length > 0 ? (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Current</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Predicted</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Trend</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.results.map((student) => (
                        <tr
                          key={student.student_id}
                          className={`border-b hover:bg-gray-50 ${student.at_risk ? "bg-red-50" : ""}`}
                        >
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-semibold text-gray-800">{student.name}</p>
                              <p className="text-sm text-gray-600">#{student.student_number}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full font-semibold border ${getGradeColor(student.current_grade)}`}>
                                {student.current_grade}
                              </span>
                              <span className="text-sm text-gray-600">{student.current_percentage}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full font-semibold border ${getGradeColor(student.predicted_grade)}`}>
                                {student.predicted_grade}
                              </span>
                              <span className="text-sm text-gray-600">{student.predicted_percentage}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              {getTrendIcon(student.trend)}
                              <span className="capitalize text-sm font-medium">{student.trend}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">{getRiskBadge(student.at_risk)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                              student.confidence === 'high' ? 'bg-green-100 text-green-800' :
                              student.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {student.confidence}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : students && students.results.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <i className="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-600">No students found matching your criteria.</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
