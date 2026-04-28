import React, { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { FileText, Download, Filter } from "lucide-react";
import toast from "react-hot-toast";

function levelLabel(kind) {
  return kind === "form" ? "Form" : "Grade";
}

function bytes(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudentPastPapers() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterYear, setFilterYear] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.listPastPapers();
        setPapers(res?.results || []);
      } catch (e) {
        toast.error(e.message || "Failed to load past papers.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const subjects = useMemo(() => {
    const seen = new Map();
    for (const p of papers) {
      if (!seen.has(p.subject_id)) seen.set(p.subject_id, { id: p.subject_id, name: p.subject_name });
    }
    return Array.from(seen.values());
  }, [papers]);

  const filtered = useMemo(() => {
    return papers.filter((p) => {
      if (filterSubject && String(p.subject_id) !== String(filterSubject)) return false;
      if (filterYear && String(p.year) !== String(filterYear)) return false;
      return true;
    });
  }, [papers, filterSubject, filterYear]);

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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center space-x-2 text-gray-900 dark:text-white">
          <Filter className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Browse</h2>
          <span className="text-xs text-gray-500">— Past papers for your level and the subjects you take</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        </div>

        {papers.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No past papers available for your subjects yet. Check back after your teachers upload some.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No papers match these filters.</p>
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
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-gray-700/50">
                    <td className="py-2 pr-4">{p.subject_name}</td>
                    <td className="py-2 pr-4">{levelLabel(p.level_kind)} {p.level_number}</td>
                    <td className="py-2 pr-4">{p.year}</td>
                    <td className="py-2 pr-4">{p.exam_session || "—"}</td>
                    <td className="py-2 pr-4">P{p.paper_number}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">
                      <span className="block">{p.original_filename}</span>
                      <span className="text-xs text-gray-400">{bytes(p.size_bytes)} {p.page_count ? `· ${p.page_count}p` : ""}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        onClick={() => handleDownload(p)}
                        className="text-xs px-2 py-1 rounded text-white inline-flex items-center space-x-1"
                        style={{ backgroundColor: "var(--accent)" }}
                      >
                        <Download className="w-3 h-3" /> <span>Download</span>
                      </button>
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
