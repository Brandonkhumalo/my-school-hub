import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSchoolSettings } from "../../context/SchoolSettingsContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

const EFFORT_OPTIONS = [
  { value: "", label: "—" },
  { value: "A", label: "A · Excellent" },
  { value: "B", label: "B · Good" },
  { value: "C", label: "C · Satisfactory" },
  { value: "D", label: "D · Needs Improvement" },
  { value: "E", label: "E · Poor" },
];

export default function TeacherSubjectFeedback() {
  const { user } = useAuth();
  const { currentAcademicYear, currentTerm } = useSchoolSettings();

  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [year, setYear] = useState(currentAcademicYear);
  const [term, setTerm] = useState(currentTerm);

  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [charLimit, setCharLimit] = useState(250);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const subs = await apiService.getTeacherSubjects();
        setSubjects(Array.isArray(subs) ? subs : subs?.results || []);
      } catch (e) { /* noop */ }
      try {
        const cls = await apiService.getTeacherClasses();
        setClasses(Array.isArray(cls) ? cls : cls?.results || []);
      } catch (e) { /* noop */ }
      try {
        const cfg = await apiService.getReportCardConfig();
        if (cfg?.comment_char_limit) setCharLimit(cfg.comment_char_limit);
      } catch (e) { /* noop */ }
    })();
  }, []);

  const loadRows = useCallback(async () => {
    if (!classId || !subjectId || !year || !term) return;
    setLoading(true);
    setMessage(null);
    try {
      const data = await apiService.getSubjectFeedback({
        class_id: classId, subject_id: subjectId, year, term,
      });
      setRows(data || []);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to load" });
      setRows([]);
    } finally { setLoading(false); }
  }, [classId, subjectId, year, term]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const updateField = (studentId, key, value) => {
    setRows(rs => rs.map(r => r.student_id === studentId ? { ...r, [key]: value, _dirty: true } : r));
  };

  const saveRow = async (row) => {
    setSavingId(row.student_id);
    try {
      await apiService.saveSubjectFeedback({
        student_id: row.student_id, subject_id: subjectId,
        year, term,
        comment: row.comment || "",
        effort_grade: row.effort_grade || "",
      });
      setRows(rs => rs.map(r => r.student_id === row.student_id ? { ...r, _dirty: false, _saved: Date.now() } : r));
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Save failed" });
    } finally { setSavingId(null); }
  };

  const saveAll = async () => {
    const dirty = rows.filter(r => r._dirty);
    for (const r of dirty) await saveRow(r);
    setMessage({ type: "success", text: `Saved ${dirty.length} entries` });
  };

  return (
    <div>
      <Header title="Report Card Feedback" user={user} />
      <div className="p-6">
        <div className="bg-white shadow rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-600 mb-3">
            Add a comment and effort grade for each student in your class — these will appear
            on their report cards for this term. Comments are capped at <b>{charLimit}</b> characters.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Class</label>
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="border rounded w-full p-2 text-sm">
                <option value="">— Select class —</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name || cls.class_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Subject</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                className="border rounded w-full p-2 text-sm">
                <option value="">— Select subject —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Year</label>
              <input type="text" value={year} onChange={e => setYear(e.target.value)}
                className="border rounded w-full p-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Term</label>
              <select value={term} onChange={e => setTerm(e.target.value)}
                className="border rounded w-full p-2 text-sm">
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </div>
          </div>
        </div>

        {message && (
          <div className={`mb-3 p-3 rounded text-sm ${message.type === "success"
            ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </div>
        )}

        {loading ? <LoadingSpinner /> : (
          rows.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-10 text-center text-sm text-gray-500">
              {classId && subjectId ? "No students in this class." : "Select a class and subject to begin."}
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-4 py-2 text-left">Student</th>
                    <th className="px-4 py-2 text-left">Effort</th>
                    <th className="px-4 py-2 text-left">Comment</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(r => {
                    const remaining = charLimit - (r.comment?.length || 0);
                    return (
                      <tr key={r.student_id} className={r._dirty ? "bg-yellow-50" : ""}>
                        <td className="px-4 py-2 align-top">
                          <div className="font-medium text-gray-800">{r.full_name}</div>
                          <div className="text-xs text-gray-400">{r.student_number}</div>
                        </td>
                        <td className="px-4 py-2 align-top w-32">
                          <select value={r.effort_grade || ""}
                            onChange={e => updateField(r.student_id, "effort_grade", e.target.value)}
                            className="border rounded p-1.5 text-sm w-full">
                            {EFFORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <textarea rows={2} maxLength={charLimit}
                            value={r.comment || ""}
                            onChange={e => updateField(r.student_id, "comment", e.target.value)}
                            className="border rounded w-full p-2 text-sm"
                            placeholder="Brief feedback for this student…" />
                          <div className={`text-[10px] mt-0.5 text-right ${remaining < 0 ? "text-red-500" : "text-gray-400"}`}>
                            {remaining} chars left
                          </div>
                        </td>
                        <td className="px-4 py-2 align-top w-24 text-right">
                          <button onClick={() => saveRow(r)}
                            disabled={savingId === r.student_id}
                            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700">
                            {savingId === r.student_id ? "…" : r._saved ? "Saved" : "Save"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-3 bg-gray-50 flex justify-end">
                <button onClick={saveAll}
                  disabled={!rows.some(r => r._dirty)}
                  className="px-4 py-2 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                  Save All Changes
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
