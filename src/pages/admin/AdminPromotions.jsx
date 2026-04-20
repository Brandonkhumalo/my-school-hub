import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate } from "../../utils/dateFormat";

export default function AdminPromotions() {
  const [activeTab, setActiveTab] = useState("process"); // "process" | "history"

  // Process tab state
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [preview, setPreview] = useState(null);
  const [decisions, setDecisions] = useState({}); // { studentId: { action, to_class_id } }
  const [availableClasses, setAvailableClasses] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: "success"|"error", message }

  // History tab state
  const [history, setHistory] = useState([]);
  const [historyYear, setHistoryYear] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load classes on mount
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const data = await apiService.fetchClasses();
        setClasses(Array.isArray(data) ? data : []);
        setAvailableClasses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching classes:", err);
      }
    };
    loadClasses();
  }, []);

  // Load history when tab switches to history
  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const params = {};
      if (historyYear) params.academic_year = historyYear;
      const data = await apiService.getPromotionHistory(params);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching promotion history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedClassId || !academicYear) {
      setFeedback({ type: "error", message: "Please select a class and enter the academic year." });
      return;
    }
    setFeedback(null);
    setIsLoadingPreview(true);
    try {
      const data = await apiService.getPromotionPreview(selectedClassId, academicYear);
      setPreview(data);
      // Initialise decisions from the suggested values
      const initial = {};
      (data.students || []).forEach((s) => {
        initial[s.student_id] = {
          action: s.suggested_action,
          to_class_id: s.suggested_to_class?.id || "",
        };
      });
      setDecisions(initial);
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to load preview." });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const updateDecision = (studentId, field, value) => {
    setDecisions((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleProcess = async () => {
    if (!preview || !preview.students?.length) return;
    setFeedback(null);
    setIsProcessing(true);

    const promotions = preview.students
      .filter((s) => !s.already_processed)
      .map((s) => {
        const d = decisions[s.student_id] || {};
        const entry = {
          student_id: s.student_id,
          action: d.action || "promote",
          from_class_id: s.current_class?.id,
        };
        if (d.action === "promote" && d.to_class_id) {
          entry.to_class_id = Number(d.to_class_id);
        }
        return entry;
      });

    if (!promotions.length) {
      setFeedback({ type: "error", message: "No students to process (all may already be processed)." });
      setIsProcessing(false);
      return;
    }

    try {
      const result = await apiService.processPromotions({
        academic_year: academicYear,
        confirm_class_changes: true,
        promotions,
      });
      const summary = result.summary || result;
      let msg = `Done! Promoted: ${summary.promoted}, Repeated: ${summary.repeated}, Graduated: ${summary.graduated}.`;
      if (summary.errors?.length) {
        msg += ` Errors: ${summary.errors.join("; ")}`;
      }
      setFeedback({ type: summary.errors?.length ? "error" : "success", message: msg });
      // Refresh preview to show updated statuses
      handlePreview();
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to process promotions." });
    } finally {
      setIsProcessing(false);
    }
  };

  const actionLabel = (action) => {
    switch (action) {
      case "promote": return "Promoted";
      case "repeat": return "Repeating";
      case "graduate": return "Graduated";
      default: return action;
    }
  };

  const actionBadge = (action) => {
    switch (action) {
      case "promote": return "bg-green-100 text-green-800";
      case "repeat": return "bg-yellow-100 text-yellow-800";
      case "graduate": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <Header title="Student Promotions" />

      {/* Tabs */}
      <div className="mb-6 flex space-x-4 border-b">
        <button
          className={`pb-2 px-1 font-semibold ${activeTab === "process" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("process")}
        >
          Process Promotions
        </button>
        <button
          className={`pb-2 px-1 font-semibold ${activeTab === "history" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={`mb-4 p-4 rounded-lg text-sm ${feedback.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {feedback.message}
        </div>
      )}

      {/* ── Process Tab ─────────────────────────────────────────────── */}
      {activeTab === "process" && (
        <div>
          {/* Controls */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  <option value="">-- Select Class --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} (Grade {cls.grade_level}) - {cls.academic_year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 2026"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                />
              </div>
              <div>
                <button
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  onClick={handlePreview}
                  disabled={isLoadingPreview}
                >
                  {isLoadingPreview ? "Loading..." : "Preview Promotions"}
                </button>
              </div>
            </div>
          </div>

          {/* Preview table */}
          {isLoadingPreview && <LoadingSpinner />}

          {preview && !isLoadingPreview && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  {preview.class} &mdash; {preview.academic_year}
                </h2>
                <span className="text-sm text-gray-500">{preview.students?.length || 0} student(s)</span>
              </div>

              {preview.students?.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 font-medium text-gray-600">Student Name</th>
                          <th className="px-4 py-3 font-medium text-gray-600">Student Number</th>
                          <th className="px-4 py-3 font-medium text-gray-600">Current Class</th>
                          <th className="px-4 py-3 font-medium text-gray-600">Action</th>
                          <th className="px-4 py-3 font-medium text-gray-600">Target Class</th>
                          <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.students.map((s) => {
                          const d = decisions[s.student_id] || {};
                          return (
                            <tr key={s.student_id} className={s.already_processed ? "bg-gray-50 opacity-60" : ""}>
                              <td className="px-4 py-3 font-medium">{s.student_name}</td>
                              <td className="px-4 py-3 text-gray-500">{s.student_number}</td>
                              <td className="px-4 py-3">{s.current_class?.name}</td>
                              <td className="px-4 py-3">
                                {s.already_processed ? (
                                  <span className="text-gray-400 italic">Already processed</span>
                                ) : (
                                  <select
                                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={d.action || "promote"}
                                    onChange={(e) => updateDecision(s.student_id, "action", e.target.value)}
                                  >
                                    <option value="promote">Promote</option>
                                    <option value="repeat">Repeat</option>
                                    <option value="graduate">Graduate</option>
                                  </select>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {s.already_processed ? (
                                  <span className="text-gray-400">-</span>
                                ) : d.action === "promote" ? (
                                  <select
                                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={d.to_class_id || ""}
                                    onChange={(e) => updateDecision(s.student_id, "to_class_id", e.target.value)}
                                  >
                                    <option value="">-- Select --</option>
                                    {availableClasses.map((cls) => (
                                      <option key={cls.id} value={cls.id}>
                                        {cls.name} (Grade {cls.grade_level})
                                      </option>
                                    ))}
                                  </select>
                                ) : d.action === "repeat" ? (
                                  <span className="text-yellow-600 text-sm">Same class</span>
                                ) : (
                                  <span className="text-blue-600 text-sm">N/A (Graduating)</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {s.already_processed && (
                                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                                    Processed
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
                      onClick={handleProcess}
                      disabled={isProcessing}
                    >
                      {isProcessing ? "Processing..." : "Process Promotions"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">No students found in this class.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── History Tab ─────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div>
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Academic Year</label>
                <input
                  type="text"
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 2026"
                  value={historyYear}
                  onChange={(e) => setHistoryYear(e.target.value)}
                />
              </div>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                onClick={loadHistory}
              >
                Filter
              </button>
            </div>
          </div>

          {isLoadingHistory ? (
            <LoadingSpinner />
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6">
              {history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-gray-600">Student</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Student No.</th>
                        <th className="px-4 py-3 font-medium text-gray-600">From</th>
                        <th className="px-4 py-3 font-medium text-gray-600">To</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Action</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Year</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Decided By</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history.map((rec) => (
                        <tr key={rec.id}>
                          <td className="px-4 py-3 font-medium">{rec.student_name}</td>
                          <td className="px-4 py-3 text-gray-500">{rec.student_number}</td>
                          <td className="px-4 py-3">{rec.from_class}</td>
                          <td className="px-4 py-3">{rec.to_class || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${actionBadge(rec.action)}`}>
                              {actionLabel(rec.action)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{rec.academic_year}</td>
                          <td className="px-4 py-3">{rec.decided_by}</td>
                          <td className="px-4 py-3">{formatDate(rec.date_processed)}</td>
                          <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{rec.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No promotion records found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
