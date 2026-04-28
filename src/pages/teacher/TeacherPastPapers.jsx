import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { FileText, Upload, Trash2, Filter, Download } from "lucide-react";
import toast from "react-hot-toast";

const ACCEPT_MIME = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function levelLabel(kind) {
  return kind === "form" ? "Form" : "Grade";
}

function bytes(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TeacherPastPapers() {
  const { user } = useAuth();
  const schoolType = user?.school?.school_type || user?.school_type || "secondary";
  const defaultLevelKind = schoolType === "primary" ? "grade" : "form";
  const isCombined = schoolType === "combined";

  const [papers, setPapers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [filterSubject, setFilterSubject] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  const [form, setForm] = useState({
    file: null,
    subject_id: "",
    level_kind: defaultLevelKind,
    level_number: "",
    year: new Date().getFullYear(),
    exam_session: "",
    paper_number: 1,
    title: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [papersRes, subjectsRes] = await Promise.all([
        apiService.listPastPapers(),
        apiService.getTeacherSubjects().catch(() => apiService.getSubjects()),
      ]);
      setPapers(papersRes?.results || []);
      setSubjects(Array.isArray(subjectsRes) ? subjectsRes : (subjectsRes?.results || subjectsRes || []));
    } catch (e) {
      toast.error(e.message || "Failed to load past papers.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return papers.filter((p) => {
      if (filterSubject && String(p.subject_id) !== String(filterSubject)) return false;
      if (filterYear && String(p.year) !== String(filterYear)) return false;
      if (filterLevel && String(p.level_number) !== String(filterLevel)) return false;
      return true;
    });
  }, [papers, filterSubject, filterYear, filterLevel]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!form.file) return toast.error("Pick a file (.pdf or .docx).");
    if (!form.subject_id) return toast.error("Choose a subject.");
    if (!form.level_number) return toast.error("Enter the grade/form number.");
    if (!form.year) return toast.error("Enter the year.");

    setUploading(true);
    try {
      // Step 1: stream the file to go-services
      const uploaded = await apiService.uploadPastPaperFile(form.file);
      // Step 2: persist metadata in Django
      await apiService.createPastPaper({
        subject_id: Number(form.subject_id),
        level_kind: form.level_kind,
        level_number: Number(form.level_number),
        year: Number(form.year),
        exam_session: form.exam_session,
        paper_number: Number(form.paper_number) || 1,
        title: form.title,
        file_key: uploaded.file_key,
        original_filename: uploaded.original_filename,
        mime_type: uploaded.mime_type,
        size_bytes: uploaded.size_bytes,
        page_count: uploaded.page_count || 0,
      });
      toast.success("Past paper uploaded.");
      setForm((f) => ({ ...f, file: null, exam_session: "", paper_number: 1, title: "" }));
      await load();
    } catch (e) {
      toast.error(e.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(paper) {
    if (!confirm(`Delete "${paper.original_filename}"?`)) return;
    try {
      await apiService.deletePastPaper(paper.id);
      toast.success("Deleted.");
      setPapers((prev) => prev.filter((p) => p.id !== paper.id));
    } catch (e) {
      toast.error(e.message || "Failed to delete.");
    }
  }

  async function handleDownload(paper) {
    try {
      const blob = await apiService.downloadPastPaperFile(paper.file_key);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = paper.original_filename || "paper";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      toast.error(e.message || "Download failed.");
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center space-x-3">
        <FileText className="w-7 h-7 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Past Exam Papers</h1>
      </div>

      <form
        onSubmit={handleUpload}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4"
      >
        <div className="flex items-center space-x-2 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-3">
          <Upload className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Upload a paper</h2>
          <span className="text-xs text-gray-500">PDF or DOCX, max 25MB</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">File</label>
            <input
              type="file"
              accept={ACCEPT_MIME}
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
              className="block w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Subject</label>
            <select
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              required
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>

          {isCombined && (
            <div>
              <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Level</label>
              <select
                value={form.level_kind}
                onChange={(e) => setForm({ ...form, level_kind: e.target.value })}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              >
                <option value="grade">Grade (primary)</option>
                <option value="form">Form (secondary)</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">{levelLabel(form.level_kind)} number</label>
            <input
              type="number"
              min={1}
              max={13}
              value={form.level_number}
              onChange={(e) => setForm({ ...form, level_number: e.target.value })}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Year</label>
            <input
              type="number"
              min={1990}
              max={2100}
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Exam session</label>
            <input
              type="text"
              placeholder="e.g. November"
              value={form.exam_session}
              onChange={(e) => setForm({ ...form, exam_session: e.target.value })}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Paper #</label>
            <input
              type="number"
              min={1}
              max={9}
              value={form.paper_number}
              onChange={(e) => setForm({ ...form, paper_number: e.target.value })}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Title (optional)</label>
            <input
              type="text"
              placeholder="e.g. ZIMSEC Paper 1 (Algebra)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={uploading}
            className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {uploading ? "Uploading…" : "Upload paper"}
          </button>
        </div>
      </form>

      {/* Filters + list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center space-x-2 text-gray-900 dark:text-white">
          <Filter className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Library</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
          <input
            type="number"
            placeholder="Year"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          />
          <input
            type="number"
            placeholder={`${levelLabel(form.level_kind)} number`}
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No papers match these filters yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="py-2 pr-4">Subject</th>
                  <th className="py-2 pr-4">Level</th>
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 pr-4">Session</th>
                  <th className="py-2 pr-4">Paper</th>
                  <th className="py-2 pr-4">File</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-gray-700/50">
                    <td className="py-2 pr-4">{p.subject_code} — {p.subject_name}</td>
                    <td className="py-2 pr-4">{levelLabel(p.level_kind)} {p.level_number}</td>
                    <td className="py-2 pr-4">{p.year}</td>
                    <td className="py-2 pr-4">{p.exam_session || "—"}</td>
                    <td className="py-2 pr-4">P{p.paper_number}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">
                      <span className="block">{p.original_filename}</span>
                      <span className="text-xs text-gray-400">{bytes(p.size_bytes)} {p.page_count ? `· ${p.page_count}p` : ""}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDownload(p)}
                          className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3" /> <span>Download</span>
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 inline-flex items-center space-x-1"
                        >
                          <Trash2 className="w-3 h-3" /> <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
