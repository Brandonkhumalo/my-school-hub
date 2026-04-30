import React, { useCallback, useMemo, useState, useEffect } from "react";
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
  const [riskSearch, setRiskSearch] = useState("");
  const [marksSearch, setMarksSearch] = useState("");
  const [filterAtRisk, setFilterAtRisk] = useState("all");
  const [sortBy, setSortBy] = useState("risk_score");
  const [viewMode, setViewMode] = useState("risk"); // "risk" | "marks"
  const [marks, setMarks] = useState([]);
  const [marksStudents, setMarksStudents] = useState([]);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [selectedMarksStudent, setSelectedMarksStudent] = useState(null);
  const [studentBreakdown, setStudentBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState("");
  const [breakdownTermFilter, setBreakdownTermFilter] = useState("");

  const buildBreakdownPayload = useCallback((payload, student, subjectId) => {
    if (payload && !Array.isArray(payload) && typeof payload === "object") {
      const rows = Array.isArray(payload.results) ? payload.results : [];
      return {
        scope: payload.scope || "selected_subject",
        is_class_teacher_view: Boolean(payload.is_class_teacher_view),
        total_results: Number.isFinite(payload.total_results) ? payload.total_results : rows.length,
        subject_summaries: Array.isArray(payload.subject_summaries) ? payload.subject_summaries : [],
        results: rows,
      };
    }

    const rows = Array.isArray(payload) ? payload : [];
    const bySubject = new Map();
    rows.forEach((row) => {
      const key = row.subject_name || "Unknown Subject";
      if (!bySubject.has(key)) {
        bySubject.set(key, { subject_name: key, result_count: 0, total: 0 });
      }
      const bucket = bySubject.get(key);
      bucket.result_count += 1;
      bucket.total += Number(row.percentage || 0);
    });
    const subjectSummaries = Array.from(bySubject.values()).map((item) => ({
      subject_name: item.subject_name,
      result_count: item.result_count,
      average_percentage: item.result_count ? Number((item.total / item.result_count).toFixed(2)) : 0,
    }));

    return {
      scope: "selected_subject",
      is_class_teacher_view: false,
      total_results: rows.length,
      subject_summaries: subjectSummaries,
      results: rows,
      student: student ? {
        id: student.id,
        name: `${student.name || ""} ${student.surname || ""}`.trim(),
        student_number: student.student_number || "",
        class_name: student.class || "",
      } : undefined,
      selected_subject: subjectId ? { id: subjectId } : undefined,
    };
  }, []);

  const normalizeStudentsPayload = (payload) => {
    if (Array.isArray(payload)) {
      return {
        results: payload,
        total_students: payload.length,
        at_risk_count: payload.filter((s) => Boolean(s?.at_risk)).length,
      };
    }
    if (payload && typeof payload === "object") {
      const results = Array.isArray(payload.results) ? payload.results : [];
      const totalStudents = Number.isFinite(payload.total_students) ? payload.total_students : results.length;
      const atRiskCount = Number.isFinite(payload.at_risk_count)
        ? payload.at_risk_count
        : results.filter((s) => Boolean(s?.at_risk)).length;
      return {
        ...payload,
        results,
        total_students: totalStudents,
        at_risk_count: atRiskCount,
      };
    }
    return {
      results: [],
      total_students: 0,
      at_risk_count: 0,
    };
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadMarks = useCallback(async () => {
    try {
      setLoadingMarks(true);
      const [marksData, studentsData] = await Promise.all([
        apiService.fetchResults({ subject: selectedSubject }),
        apiService.getSubjectStudents(selectedSubject),
      ]);
      const rows = Array.isArray(marksData) ? marksData : (marksData?.results || []);
      setMarks(rows || []);
      setMarksStudents(Array.isArray(studentsData) ? studentsData : []);
    } catch (err) {
      console.error("Error loading marks:", err);
      setMarks([]);
      setMarksStudents([]);
    } finally {
      setLoadingMarks(false);
    }
  }, [selectedSubject]);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTeacherSubjects();
      const safeSubjects = Array.isArray(data) ? data : [];
      setSubjects(safeSubjects);
      if (safeSubjects.length > 0) {
        setSelectedSubject(safeSubjects[0].id);
      }
    } catch (error) {
      console.error("Error loading subjects:", error);
      alert("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = useCallback(async () => {
    if (!selectedSubject) return;
    try {
      setLoadingStudents(true);
      const data = await apiService.getSubjectStudentsAtRisk(
        selectedSubject,
        riskSearch,
        filterAtRisk,
        sortBy
      );
      setStudents(normalizeStudentsPayload(data));
    } catch (error) {
      console.error("Error loading students:", error);
      setStudents(normalizeStudentsPayload(null));
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedSubject, riskSearch, filterAtRisk, sortBy]);

  useEffect(() => {
    if (!selectedSubject) return;
    setSelectedMarksStudent(null);
    setStudentBreakdown(null);
    setBreakdownError("");
    setBreakdownTermFilter("");
    if (viewMode === "risk") {
      loadStudents();
    } else {
      loadMarks();
    }
  }, [selectedSubject, viewMode, loadStudents, loadMarks]);

  const marksSummaryByStudent = useMemo(() => {
    const summary = new Map();
    marks.forEach((row) => {
      const studentId = row.student;
      if (!studentId) return;
      if (!summary.has(studentId)) {
        summary.set(studentId, {
          count: 0,
          totalPercentage: 0,
          latest: null,
        });
      }
      const item = summary.get(studentId);
      item.count += 1;
      item.totalPercentage += Number(row.percentage || 0);
      if (!item.latest) {
        item.latest = row;
      }
    });
    return summary;
  }, [marks]);

  const filteredMarksStudents = useMemo(() => {
    const q = marksSearch.trim().toLowerCase();
    if (!q) return marksStudents;
    return marksStudents.filter((student) => {
      const studentName = `${student.name || ""} ${student.surname || ""}`.toLowerCase();
      const studentNumber = (student.student_number || "").toLowerCase();
      return studentName.includes(q) || studentNumber.includes(q);
    });
  }, [marksStudents, marksSearch]);

  const loadStudentBreakdown = async (student) => {
    if (!selectedSubject || !student?.id) return;
    setSelectedMarksStudent(student);
    setLoadingBreakdown(true);
    setBreakdownError("");
    setBreakdownTermFilter("");
    try {
      const payload = await apiService.getTeacherStudentMarksBreakdown(student.id, selectedSubject);
      setStudentBreakdown(buildBreakdownPayload(payload, student, selectedSubject));
    } catch (error) {
      console.error("Error loading student mark breakdown from dedicated endpoint:", error);
      try {
        // Fallback: use teacher results list filtered by student+subject so breakdown remains usable.
        const fallbackResults = await apiService.fetchResults({
          student: student.id,
          subject: selectedSubject,
        });
        setStudentBreakdown(buildBreakdownPayload(fallbackResults, student, selectedSubject));
        setBreakdownError("");
      } catch (fallbackError) {
        console.error("Fallback breakdown loading failed:", fallbackError);
        setStudentBreakdown(null);
        setBreakdownError(fallbackError?.message || error?.message || "Failed to load student breakdown.");
      }
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const breakdownTermOptions = useMemo(() => {
    const terms = [...new Set((studentBreakdown?.results || []).map((r) => r.academic_term).filter(Boolean))];
    const termOrder = { "Term 1": 1, "Term 2": 2, "Term 3": 3, "Term 4": 4 };
    return terms.sort((a, b) => (termOrder[a] || 99) - (termOrder[b] || 99) || a.localeCompare(b));
  }, [studentBreakdown]);

  const filteredBreakdownResults = useMemo(() => {
    const rows = studentBreakdown?.results || [];
    if (!breakdownTermFilter) return rows;
    return rows.filter((row) => row.academic_term === breakdownTermFilter);
  }, [studentBreakdown, breakdownTermFilter]);

  const filteredBreakdownSummaries = useMemo(() => {
    const bySubject = new Map();
    filteredBreakdownResults.forEach((row) => {
      const key = row.subject_name || "Unknown Subject";
      if (!bySubject.has(key)) {
        bySubject.set(key, { subject_name: key, result_count: 0, total: 0 });
      }
      const bucket = bySubject.get(key);
      bucket.result_count += 1;
      bucket.total += Number(row.percentage || 0);
    });
    return Array.from(bySubject.values())
      .map((item) => ({
        subject_name: item.subject_name,
        result_count: item.result_count,
        average_percentage: item.result_count ? Number((item.total / item.result_count).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
  }, [filteredBreakdownResults]);

  const closeBreakdownModal = () => {
    setSelectedMarksStudent(null);
    setStudentBreakdown(null);
    setBreakdownError("");
    setBreakdownTermFilter("");
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

  const topPerformers = useMemo(() => {
    const rows = students?.results || [];
    return rows
      .filter((s) => !s.at_risk)
      .sort((a, b) => Number(b.current_percentage || 0) - Number(a.current_percentage || 0))
      .slice(0, 6);
  }, [students]);

  const atRiskStudents = useMemo(() => {
    const rows = students?.results || [];
    return rows
      .filter((s) => Boolean(s.at_risk))
      .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0));
  }, [students]);

  if (loading) {
    return (
      <div>
        <Header title="At-Risk Students" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header title="At-Risk Students" user={user} />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">At-Risk Students</h2>
          <p className="text-gray-600 mt-2">Track top performers and identify students needing intervention</p>
        </div>

        {subjects.length === 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-yellow-800">No subjects assigned. Contact administrator.</p>
          </div>
        ) : (
          <div>
            <div className="mb-6 flex gap-2">
              <button
                onClick={() => setViewMode("risk")}
                className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === "risk" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`}
              >
                <i className="fas fa-chart-line mr-2"></i>AI Risk Predictor
              </button>
              <button
                onClick={() => setViewMode("marks")}
                className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === "marks" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`}
              >
                <i className="fas fa-clipboard-list mr-2"></i>Student Marks Overview
              </button>
            </div>
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

            {viewMode === "risk" && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-search mr-2"></i>Search
                  </label>
                  <input
                    type="text"
                    placeholder="Name, email, or student #"
                    value={riskSearch}
                    onChange={(e) => setRiskSearch(e.target.value)}
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
            )}

            {viewMode === "risk" && students && (
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

            {viewMode === "risk" && students && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    <i className="fas fa-trophy mr-2 text-yellow-500"></i>Top Performers
                  </h3>
                  {topPerformers.length === 0 ? (
                    <p className="text-sm text-gray-500">No top performer data yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {topPerformers.map((s) => (
                        <div key={s.student_id} className="p-3 rounded border border-green-200 bg-green-50">
                          <p className="font-medium text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-600">#{s.student_number}</p>
                          <p className="text-sm text-green-800">Current: {s.current_grade} ({s.current_percentage}%)</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    <i className="fas fa-exclamation-triangle mr-2 text-red-500"></i>Students At Risk
                  </h3>
                  {atRiskStudents.length === 0 ? (
                    <p className="text-sm text-gray-500">No at-risk students in this selection.</p>
                  ) : (
                    <div className="space-y-2">
                      {atRiskStudents.slice(0, 8).map((s) => (
                        <div key={s.student_id} className="p-3 rounded border border-red-200 bg-red-50">
                          <p className="font-medium text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-600">#{s.student_number}</p>
                          <p className="text-sm text-red-800">Current: {s.current_grade} ({s.current_percentage}%)</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {viewMode === "risk" && (loadingStudents ? (
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
            ) : null)}

            {viewMode === "marks" && (
              loadingMarks ? <LoadingSpinner /> : (
                <div className="space-y-4">
                  <div className="bg-white rounded-lg shadow-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-search mr-2"></i>Find Student Marks
                    </label>
                    <input
                      type="text"
                      placeholder="Search by name, surname, or student number"
                      value={marksSearch}
                      onChange={(e) => setMarksSearch(e.target.value)}
                      className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Class</th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Records (Subject)</th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Average % (Subject)</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Last Assessment</th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMarksStudents.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No students found for this search in the selected subject.</td></tr>
                          ) : filteredMarksStudents.map((student) => {
                            const stats = marksSummaryByStudent.get(student.id);
                            const recordCount = stats?.count || 0;
                            const averagePercentage = recordCount > 0 ? (stats.totalPercentage / recordCount) : 0;
                            const latest = stats?.latest || null;
                            return (
                            <tr
                              key={student.id}
                              className={`border-b hover:bg-blue-50 ${selectedMarksStudent?.id === student.id ? "bg-blue-50" : ""}`}
                            >
                              <td className="px-6 py-3">
                                <div className="font-medium text-gray-800">{student.name} {student.surname}</div>
                                <div className="text-xs text-gray-500">#{student.student_number}</div>
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-700">{student.class || "-"}</td>
                              <td className="px-6 py-3 text-right font-medium">{recordCount}</td>
                              <td className="px-6 py-3 text-right font-medium">{averagePercentage.toFixed(2)}%</td>
                              <td className="px-6 py-3 text-sm text-gray-700">
                                {latest ? `${latest.exam_type} (${latest.academic_term} / ${latest.academic_year})` : "No marks yet"}
                              </td>
                              <td className="px-6 py-3 text-center">
                                <button
                                  onClick={() => loadStudentBreakdown(student)}
                                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
                                >
                                  View Breakdown
                                </button>
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )
            )}
          </div>
        )}
      </div>

      {selectedMarksStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {selectedMarksStudent.name} {selectedMarksStudent.surname} - Marks Breakdown
                </h3>
                <p className="text-sm text-gray-600">
                  #{selectedMarksStudent.student_number} | {selectedMarksStudent.class}
                </p>
              </div>
              <button
                type="button"
                onClick={closeBreakdownModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                aria-label="Close breakdown"
                title="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-72px)]">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div />
                {studentBreakdown?.scope && (
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                    studentBreakdown.scope === "all_subjects"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {studentBreakdown.scope === "all_subjects"
                      ? "Class Teacher View: All Subjects"
                      : "Subject Teacher View: Selected Subject"}
                  </span>
                )}
              </div>

              {loadingBreakdown && (
                <div className="py-6 text-sm text-gray-600">
                  <i className="fas fa-spinner fa-spin mr-2"></i>Loading detailed results...
                </div>
              )}

              {!loadingBreakdown && breakdownError && (
                <div className="p-3 mb-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
                  {breakdownError}
                </div>
              )}

              {!loadingBreakdown && !breakdownError && studentBreakdown && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Term</label>
                    <select
                      value={breakdownTermFilter}
                      onChange={(e) => setBreakdownTermFilter(e.target.value)}
                      className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Terms</option>
                      {breakdownTermOptions.map((term) => (
                        <option key={term} value={term}>{term}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="p-3 rounded bg-gray-50 border">
                      <p className="text-xs text-gray-500">Total Results{breakdownTermFilter ? ` (${breakdownTermFilter})` : ""}</p>
                      <p className="text-xl font-semibold text-gray-800">{filteredBreakdownResults.length || 0}</p>
                    </div>
                    {filteredBreakdownSummaries.slice(0, 2).map((summary) => (
                      <div key={summary.subject_name} className="p-3 rounded bg-gray-50 border">
                        <p className="text-xs text-gray-500">{summary.subject_name}</p>
                        <p className="text-sm font-medium text-gray-700">
                          {summary.result_count} results | Avg {summary.average_percentage}%
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Subject</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Assessment</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Term / Year</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Score</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Out Of</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">%</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Grade</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Teacher</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBreakdownResults.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                              No results found for this student in the selected term.
                            </td>
                          </tr>
                        ) : filteredBreakdownResults.map((result) => (
                          <tr key={result.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-700">{result.subject_name}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{result.exam_type}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{result.academic_term} / {result.academic_year}</td>
                            <td className="px-4 py-2 text-right text-sm">{result.score}</td>
                            <td className="px-4 py-2 text-right text-sm">{result.max_score}</td>
                            <td className="px-4 py-2 text-right text-sm font-medium">{result.percentage}%</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${getGradeColor((result.grade || '').charAt(0))}`}>
                                {result.grade}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">{result.teacher_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
