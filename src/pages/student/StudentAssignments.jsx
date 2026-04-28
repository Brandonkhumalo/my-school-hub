import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth } from "../../context/AuthContext";
import apiService from "../../services/apiService";

export default function StudentAssignments() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [textSubmission, setTextSubmission] = useState("");
  const [files, setFiles] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiService.getStudentAssignments();
      setAssignments(data?.assignments || []);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles() {
    const rows = [];
    for (const file of files) {
      const res = await apiService.uploadAssignmentAttachmentFile(file);
      rows.push({
        file_key: res.file_key,
        original_filename: res.original_filename || file.name,
        mime_type: res.mime_type || file.type || "",
        size_bytes: res.size_bytes || file.size || 0,
      });
    }
    return rows;
  }

  async function submitAssignment() {
    if (!selected) return;
    if (!textSubmission && files.length === 0) return;
    setSubmitting(true);
    try {
      const attachmentRows = await uploadFiles();
      const fd = new FormData();
      if (textSubmission) fd.append("text_submission", textSubmission);
      if (attachmentRows.length > 0) {
        fd.append("attachments", JSON.stringify(attachmentRows));
      }
      await apiService.submitAssignment(selected.id, fd);
      setSelected(null);
      setTextSubmission("");
      setFiles([]);
      await load();
    } catch (err) {
      alert(err.message || "Failed to submit assignment.");
    } finally {
      setSubmitting(false);
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
      <div className="p-6 space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Assignments</h2>
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{a.title}</p>
                  <p className="text-xs text-gray-500">{a.subject_name} • Due: {new Date(a.deadline).toLocaleString()}</p>
                  {a.submission?.status ? (
                    <p className="text-xs mt-1">
                      Status: <span className="font-semibold">{a.submission.status}</span>
                      {a.submission.is_late ? <span className="text-red-600"> (late)</span> : null}
                      {a.submission.grade !== null && a.submission.grade !== undefined ? ` • Grade: ${a.submission.grade}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs mt-1 text-amber-700">Not submitted</p>
                  )}
                </div>
                <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded" onClick={() => setSelected(a)}>
                  {a.submission ? "Resubmit" : "Submit"}
                </button>
              </div>
            ))}
            {assignments.length === 0 && <p className="text-sm text-gray-500">No assignments found.</p>}
          </div>
        </div>

        {selected && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Submit: {selected.title}</h3>
            <textarea
              rows={4}
              className="border rounded p-2 text-sm w-full mb-2"
              placeholder="Type your answer"
              value={textSubmission}
              onChange={(e) => setTextSubmission(e.target.value)}
            />
            <input type="file" multiple className="text-sm mb-3" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <div className="flex gap-2">
              <button className="px-3 py-2 text-sm bg-green-600 text-white rounded" disabled={submitting} onClick={submitAssignment}>
                {submitting ? "Submitting..." : "Submit"}
              </button>
              <button className="px-3 py-2 text-sm bg-gray-200 rounded" onClick={() => setSelected(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
