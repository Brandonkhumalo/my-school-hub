import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth } from "../../context/AuthContext";
import apiService from "../../services/apiService";

export default function TeacherAssignments() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    subject_id: "",
    class_id: "",
    deadline: "",
    max_score: 100,
    allow_late: false,
  });
  const [files, setFiles] = useState([]);
  const [gradeDrafts, setGradeDrafts] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [a, s, c] = await Promise.all([
        apiService.getTeacherAssignments(),
        apiService.getTeacherSubjects(),
        apiService.getTeacherClasses(),
      ]);
      setAssignments(a?.assignments || []);
      setSubjects(Array.isArray(s) ? s : (s?.results || []));
      setClasses(Array.isArray(c) ? c : (c?.results || []));
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles() {
    const uploaded = [];
    for (const file of files) {
      const res = await apiService.uploadAssignmentAttachmentFile(file);
      uploaded.push({
        file_key: res.file_key,
        original_filename: res.original_filename || file.name,
        mime_type: res.mime_type || file.type || "",
        size_bytes: res.size_bytes || file.size || 0,
      });
    }
    return uploaded;
  }

  async function createAssignment(e) {
    e.preventDefault();
    if (!form.title || !form.description || !form.subject_id || !form.class_id || !form.deadline) return;
    setSaving(true);
    try {
      const attachments = await uploadFiles();
      await apiService.createTeacherAssignment({
        ...form,
        attachments,
      });
      setForm({
        title: "",
        description: "",
        subject_id: "",
        class_id: "",
        deadline: "",
        max_score: 100,
        allow_late: false,
      });
      setFiles([]);
      await load();
    } catch (err) {
      alert(err.message || "Failed to create assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function openSubmissions(assignmentId) {
    setSelectedAssignmentId(String(assignmentId));
    setLoadingSubmissions(true);
    try {
      const data = await apiService.getAssignmentSubmissions(assignmentId);
      setSubmissions(data?.submissions || []);
    } catch {
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  }

  async function gradeSubmission(submission) {
    const draft = gradeDrafts[submission.id] || {};
    const grade = draft.grade;
    const feedback = draft.feedback || "";
    if (grade === undefined || grade === "") return;
    try {
      const data = await apiService.gradeSubmission(submission.id, { grade, feedback });
      setSubmissions((prev) => prev.map((s) => (
        s.id === submission.id
          ? { ...s, status: "graded", grade: data.grade, feedback: data.feedback }
          : s
      )));
    } catch (err) {
      alert(err.message || "Failed to grade submission.");
    }
  }

  async function removeAssignment(assignmentId) {
    if (!window.confirm("Delete this assignment?")) return;
    try {
      await apiService.deleteTeacherAssignment(assignmentId);
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      if (String(assignmentId) === selectedAssignmentId) {
        setSelectedAssignmentId("");
        setSubmissions([]);
      }
    } catch (err) {
      alert(err.message || "Failed to delete assignment.");
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Assignments" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Assignments" user={user} />
      <div className="p-6 space-y-6">
        <form onSubmit={createAssignment} className="bg-white rounded-lg shadow p-4 space-y-3">
          <h2 className="font-semibold text-gray-800">Create Assignment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded p-2 text-sm" placeholder="Title" value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} />
            <input className="border rounded p-2 text-sm" type="datetime-local" value={form.deadline} onChange={(e) => setForm((v) => ({ ...v, deadline: e.target.value }))} />
            <select className="border rounded p-2 text-sm" value={form.subject_id} onChange={(e) => setForm((v) => ({ ...v, subject_id: e.target.value }))}>
              <option value="">Select subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="border rounded p-2 text-sm" value={form.class_id} onChange={(e) => setForm((v) => ({ ...v, class_id: e.target.value }))}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="border rounded p-2 text-sm" type="number" min="1" value={form.max_score} onChange={(e) => setForm((v) => ({ ...v, max_score: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.allow_late} onChange={(e) => setForm((v) => ({ ...v, allow_late: e.target.checked }))} />
              Allow late submission
            </label>
          </div>
          <textarea className="border rounded p-2 text-sm w-full" rows={3} placeholder="Instructions" value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} />
          <input type="file" multiple className="text-sm" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          <button disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
            {saving ? "Saving..." : "Create Assignment"}
          </button>
        </form>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-800 mb-3">My Assignments</h2>
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{a.title}</p>
                  <p className="text-xs text-gray-500">{a.subject_name} • {a.class_name} • / {a.max_score}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 text-xs bg-green-600 text-white rounded" onClick={() => openSubmissions(a.id)}>Submissions</button>
                  <button className="px-2 py-1 text-xs bg-red-600 text-white rounded" onClick={() => removeAssignment(a.id)}>Delete</button>
                </div>
              </div>
            ))}
            {assignments.length === 0 && <p className="text-sm text-gray-500">No assignments yet.</p>}
          </div>
        </div>

        {selectedAssignmentId && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Submissions</h2>
            {loadingSubmissions ? <p className="text-sm text-gray-500">Loading...</p> : (
              <div className="space-y-3">
                {submissions.map((s) => (
                  <div key={s.id} className="border rounded p-3">
                    <p className="text-sm font-medium">{s.student_name} {s.is_late ? <span className="text-red-600">(Late)</span> : null}</p>
                    <p className="text-xs text-gray-500 mb-2">{s.text_submission || "No text submission"}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input type="number" className="border rounded p-2 text-sm" placeholder="Raw grade" value={gradeDrafts[s.id]?.grade || ""} onChange={(e) => setGradeDrafts((v) => ({ ...v, [s.id]: { ...(v[s.id] || {}), grade: e.target.value } }))} />
                      <input className="border rounded p-2 text-sm md:col-span-2" placeholder="Feedback" value={gradeDrafts[s.id]?.feedback || ""} onChange={(e) => setGradeDrafts((v) => ({ ...v, [s.id]: { ...(v[s.id] || {}), feedback: e.target.value } }))} />
                    </div>
                    <button className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded" onClick={() => gradeSubmission(s)}>Save Grade</button>
                    {s.grade !== null && s.grade !== undefined && <p className="text-xs text-gray-600 mt-1">Final grade: {s.grade}</p>}
                  </div>
                ))}
                {submissions.length === 0 && <p className="text-sm text-gray-500">No submissions yet.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
