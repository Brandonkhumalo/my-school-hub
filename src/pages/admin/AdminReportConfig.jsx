import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSchoolSettings } from "../../context/SchoolSettingsContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

const BORDER_OPTIONS = [
  { value: "simple", label: "Simple Line Border" },
  { value: "decorative", label: "Decorative Double Border" },
  { value: "none", label: "No Border" },
];

const LOGO_POSITION_OPTIONS = [
  { value: "left", label: "Left of School Name" },
  { value: "right", label: "Right of School Name" },
  { value: "center", label: "Centered Above Name" },
];

const SECTION_LABELS = {
  branding: { title: "Branding", icon: "fa-palette", color: "blue" },
  layout: { title: "Layout & Display", icon: "fa-th-large", color: "green" },
  content: { title: "Content & Comments", icon: "fa-pen-fancy", color: "purple" },
  grading: { title: "Grading Display", icon: "fa-star-half-alt", color: "orange" },
  extras: { title: "Extras", icon: "fa-magic", color: "red" },
};

export default function AdminReportConfig() {
  const { user } = useAuth();
  const { currentAcademicYear, currentTerm } = useSchoolSettings();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [uploading, setUploading] = useState(null);

  // Generate reports state
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [genYear, setGenYear] = useState(currentAcademicYear);
  const [genTerm, setGenTerm] = useState(currentTerm);
  const [publishedReleases, setPublishedReleases] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);
  const [publishMessage, setPublishMessage] = useState(null);

  useEffect(() => {
    loadConfig();
    loadClasses();
    loadPublished();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await apiService.fetchClasses();
      setClasses(Array.isArray(data) ? data : data?.results || []);
    } catch (error) {
      console.error("Error loading classes:", error);
    }
  };

  const loadPublished = async () => {
    try {
      const data = await apiService.getPublishedReports();
      setPublishedReleases(data.releases || []);
    } catch (error) {
      console.error("Error loading published reports:", error);
    }
  };

  const isPublished = (classId) => {
    return publishedReleases.some(
      r => r.class_id === parseInt(classId) && r.academic_year === genYear && r.academic_term === genTerm
    );
  };

  const handlePublishClass = async () => {
    if (!selectedClassId) return;
    setPublishing(true);
    setPublishMessage(null);
    try {
      const data = await apiService.publishReports({
        class_id: selectedClassId, year: genYear, term: genTerm,
      });
      setPublishMessage({ type: 'success', text: data.message });
      await loadPublished();
    } catch (error) {
      setPublishMessage({ type: 'error', text: error.message || 'Failed to publish' });
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishAll = async () => {
    setPublishingAll(true);
    setPublishMessage(null);
    try {
      const data = await apiService.publishAllReports({ year: genYear, term: genTerm });
      setPublishMessage({ type: 'success', text: data.message });
      await loadPublished();
    } catch (error) {
      setPublishMessage({ type: 'error', text: error.message || 'Failed to publish' });
    } finally {
      setPublishingAll(false);
    }
  };

  const handleClassSelect = async (classId) => {
    setSelectedClassId(classId);
    if (!classId) { setStudents([]); return; }
    setLoadingStudents(true);
    try {
      const data = await apiService.fetchStudentsByClass(classId);
      const list = Array.isArray(data) ? data : data.results || [];
      setStudents(list.map(s => ({
        id: s.id,
        student_number: s.user?.student_number || s.student_number || '',
        full_name: s.user?.full_name || s.full_name || `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim(),
        class_name: s.class_name || '',
      })));
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleDownloadReport = async (studentId, studentName) => {
    setDownloadingId(studentId);
    try {
      const blob = await apiService.downloadReportCard(studentId, { year: genYear, term: genTerm });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_card_${studentName}_${genTerm}_${genYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || 'Failed to download report card');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (students.length === 0) return;
    setDownloadingAll(true);
    for (const student of students) {
      try {
        const blob = await apiService.downloadReportCard(student.id, { year: genYear, term: genTerm });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_card_${student.full_name}_${genTerm}_${genYear}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error(`Failed for ${student.full_name}:`, error);
      }
    }
    setDownloadingAll(false);
  };

  const loadConfig = async () => {
    try {
      const data = await apiService.getReportCardConfig();
      setConfig(data);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to load report card configuration" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => setConfig((c) => ({ ...c, [key]: value }));
  const handleToggle = (key) => setConfig((c) => ({ ...c, [key]: !c[key] }));

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { logo_url, stamp_url, ...data } = config;
      await apiService.updateReportCardConfig(data);
      setMessage({ type: "success", text: "Report card settings saved successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (field, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(field);
    try {
      const data = await apiService.uploadReportCardImage(field, file);
      setConfig(data);
      setMessage({ type: "success", text: `${field === 'logo' ? 'Logo' : 'Stamp'} uploaded successfully!` });
    } catch (error) {
      setMessage({ type: "error", text: `Failed to upload ${field}` });
    } finally {
      setUploading(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  const c = config || {};

  return (
    <div>
      <Header title="Report Card Settings" user={user} />
      <div className="p-6">
        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── LEFT: Config Options ── */}
          <div className="space-y-5">
            {/* Branding */}
            <Section id="branding">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={c.primary_color || "#1d4ed8"}
                      onChange={(e) => handleChange("primary_color", e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer" />
                    <input type="text" value={c.primary_color || "#1d4ed8"}
                      onChange={(e) => handleChange("primary_color", e.target.value)}
                      className="border rounded p-1.5 text-sm font-mono w-24" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={c.secondary_color || "#f3f4f6"}
                      onChange={(e) => handleChange("secondary_color", e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer" />
                    <input type="text" value={c.secondary_color || "#f3f4f6"}
                      onChange={(e) => handleChange("secondary_color", e.target.value)}
                      className="border rounded p-1.5 text-sm font-mono w-24" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">School Logo</label>
                  {c.logo_url && <img src={c.logo_url} alt="Logo" className="w-16 h-16 object-contain border rounded mb-2" />}
                  <input type="file" accept="image/*" onChange={(e) => handleUpload("logo", e)}
                    className="text-xs" disabled={uploading === "logo"} />
                  {uploading === "logo" && <p className="text-xs text-blue-500 mt-1">Uploading...</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">School Stamp / Signature</label>
                  {c.stamp_url && <img src={c.stamp_url} alt="Stamp" className="w-16 h-16 object-contain border rounded mb-2" />}
                  <input type="file" accept="image/*" onChange={(e) => handleUpload("stamp_image", e)}
                    className="text-xs" disabled={uploading === "stamp_image"} />
                  {uploading === "stamp_image" && <p className="text-xs text-blue-500 mt-1">Uploading...</p>}
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Logo Position</label>
                <select value={c.logo_position || "center"}
                  onChange={(e) => handleChange("logo_position", e.target.value)}
                  className="border rounded w-full p-2 text-sm">
                  {LOGO_POSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </Section>

            {/* Layout */}
            <Section id="layout">
              <Toggle label="Show grading key table" checked={c.show_grading_key} onChange={() => handleToggle("show_grading_key")} />
              <Toggle label="Show attendance summary" checked={c.show_attendance} onChange={() => handleToggle("show_attendance")} />
              <Toggle label="Show overall average" checked={c.show_overall_average} onChange={() => handleToggle("show_overall_average")} />
              <Toggle label="Show class teacher name" checked={c.show_class_teacher} onChange={() => handleToggle("show_class_teacher")} />
            </Section>

            {/* Content */}
            <Section id="content">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Principal / Head Name</label>
                  <input type="text" value={c.principal_name || ""} placeholder="e.g. Mr. J. Moyo"
                    onChange={(e) => handleChange("principal_name", e.target.value)}
                    className="border rounded w-full p-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Title</label>
                  <input type="text" value={c.principal_title || ""} placeholder="e.g. Head of School"
                    onChange={(e) => handleChange("principal_title", e.target.value)}
                    className="border rounded w-full p-2 text-sm" />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Default Teacher Comment</label>
                <textarea value={c.teacher_comments_default || ""} rows={2} placeholder="e.g. Keep up the good work!"
                  onChange={(e) => handleChange("teacher_comments_default", e.target.value)}
                  className="border rounded w-full p-2 text-sm" />
              </div>
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Default Principal Comment</label>
                <textarea value={c.principal_comments_default || ""} rows={2} placeholder="e.g. A promising student."
                  onChange={(e) => handleChange("principal_comments_default", e.target.value)}
                  className="border rounded w-full p-2 text-sm" />
              </div>
              <Toggle label="Show next term opening/closing dates (hidden for Term 3)" checked={c.show_next_term_dates} onChange={() => handleToggle("show_next_term_dates")} />
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Custom Footer Text</label>
                <input type="text" value={c.custom_footer_text || ""} placeholder="e.g. God Bless You"
                  onChange={(e) => handleChange("custom_footer_text", e.target.value)}
                  className="border rounded w-full p-2 text-sm" />
              </div>
            </Section>

            {/* Grading */}
            <Section id="grading">
              <Toggle label="Show grade remarks (Distinction, Merit, Credit, etc.)" checked={c.show_grade_remark} onChange={() => handleToggle("show_grade_remark")} />
              <Toggle label="Show individual exam types (tests, assignments, exams)" checked={c.show_exam_types} onChange={() => handleToggle("show_exam_types")} />
              <Toggle label="Color-code rows by grade (green=A, red=E)" checked={c.highlight_pass_fail} onChange={() => handleToggle("highlight_pass_fail")} />
            </Section>

            {/* Extras */}
            <Section id="extras">
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Watermark Text</label>
                <input type="text" value={c.watermark_text || ""} placeholder="e.g. OFFICIAL COPY"
                  onChange={(e) => handleChange("watermark_text", e.target.value)}
                  className="border rounded w-full p-2 text-sm" />
              </div>
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Border Style</label>
                <select value={c.border_style || "simple"}
                  onChange={(e) => handleChange("border_style", e.target.value)}
                  className="border rounded w-full p-2 text-sm">
                  {BORDER_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <Toggle label="Include conduct / discipline section" checked={c.show_conduct_section} onChange={() => handleToggle("show_conduct_section")} />
              <Toggle label="Include extra-curricular activities section" checked={c.show_activities_section} onChange={() => handleToggle("show_activities_section")} />
            </Section>

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 transition-all">
              {saving ? "Saving..." : "Save Report Card Settings"}
            </button>

            {/* ── Publish & Download Reports ── */}
            <div className="bg-white rounded-lg shadow p-5 mt-5">
              <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <i className="fas fa-file-pdf text-red-500"></i>
                Publish & Download Report Cards
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Publish reports to make them available to students and parents. They will receive a notification on the announcements page.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Class</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => handleClassSelect(e.target.value)}
                    className="border rounded w-full p-2 text-sm"
                  >
                    <option value="">Select a class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} {isPublished(cls.id) ? '✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Year</label>
                  <select
                    value={genYear}
                    onChange={(e) => setGenYear(e.target.value)}
                    className="border rounded w-full p-2 text-sm"
                  >
                    {[...Array(5)].map((_, i) => {
                      const y = parseInt(currentAcademicYear) - i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Term</label>
                  <select
                    value={genTerm}
                    onChange={(e) => setGenTerm(e.target.value)}
                    className="border rounded w-full p-2 text-sm"
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
              </div>

              {/* Publish buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={handlePublishClass}
                  disabled={!selectedClassId || publishing || (selectedClassId && isPublished(selectedClassId))}
                  className="py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                >
                  {publishing ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i>Publishing...</>
                  ) : selectedClassId && isPublished(selectedClassId) ? (
                    <><i className="fas fa-check mr-2"></i>Already Published</>
                  ) : (
                    <><i className="fas fa-bullhorn mr-2"></i>Publish This Class</>
                  )}
                </button>
                <button
                  onClick={handlePublishAll}
                  disabled={publishingAll}
                  className="py-2.5 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition-all text-sm"
                >
                  {publishingAll ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i>Publishing All...</>
                  ) : (
                    <><i className="fas fa-bullhorn mr-2"></i>Publish All Classes</>
                  )}
                </button>
              </div>

              {publishMessage && (
                <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${
                  publishMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {publishMessage.text}
                </div>
              )}

              {loadingStudents ? (
                <div className="flex justify-center py-6">
                  <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : selectedClassId && students.length > 0 ? (
                <>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Download Reports (Admin Preview)</h3>
                  <button
                    onClick={handleDownloadAll}
                    disabled={downloadingAll}
                    className="w-full mb-3 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 transition-all text-sm"
                  >
                    {downloadingAll ? (
                      <><i className="fas fa-spinner fa-spin mr-2"></i>Downloading All...</>
                    ) : (
                      <><i className="fas fa-download mr-2"></i>Download All Reports ({students.length} students)</>
                    )}
                  </button>
                  <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                    {students.map((student) => (
                      <div key={student.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{student.full_name}</span>
                          <span className="text-xs text-gray-400 ml-2">{student.student_number || ''}</span>
                        </div>
                        <button
                          onClick={() => handleDownloadReport(student.id, student.full_name)}
                          disabled={downloadingId === student.id}
                          className={`text-xs px-3 py-1 rounded-md font-medium transition-all ${
                            downloadingId === student.id
                              ? 'bg-gray-200 text-gray-400'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {downloadingId === student.id ? (
                            <><i className="fas fa-spinner fa-spin mr-1"></i>Generating...</>
                          ) : (
                            <><i className="fas fa-download mr-1"></i>PDF</>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : selectedClassId && students.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No students in this class.</p>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  <i className="fas fa-hand-pointer mr-1"></i>Select a class to publish and download reports.
                </p>
              )}
            </div>
          </div>

          {/* ── RIGHT: Live Preview ── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <h3 className="text-lg font-bold text-gray-800 mb-3">
              <i className="fas fa-eye mr-2 text-blue-500"></i>
              Live Preview
            </h3>
            <div className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ maxHeight: "85vh", overflowY: "auto" }}>
              <ReportPreview config={c} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helper Components ───────────────────────────────────────────── */

function Section({ id, children }) {
  const s = SECTION_LABELS[id];
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <i className={`fas ${s.icon} text-${s.color}-500`}></i>
        {s.title}
      </h2>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer group">
      <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
      <div className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-blue-500" : "bg-gray-300"}`}
        onClick={onChange}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`}></div>
      </div>
    </label>
  );
}

/* ── Live HTML Preview (mirrors the PDF output) ──────────────────── */

function ReportPreview({ config }) {
  const c = config || {};
  const primary = c.primary_color || "#1d4ed8";
  const secondary = c.secondary_color || "#f3f4f6";

  const borderStyle = c.border_style === "decorative"
    ? { border: `3px solid ${primary}`, outline: `1px solid ${primary}`, outlineOffset: "4px" }
    : c.border_style === "simple"
      ? { border: `1.5px solid ${primary}` }
      : {};

  const sampleResults = [
    { subject: "Mathematics", exam: "End of Term", score: 78, max: 100 },
    { subject: "English", exam: "End of Term", score: 65, max: 100 },
    { subject: "Science", exam: "End of Term", score: 52, max: 100 },
    { subject: "History", exam: "End of Term", score: 45, max: 100 },
    { subject: "Shona", exam: "End of Term", score: 88, max: 100 },
  ];

  const getGrade = (pct) => {
    if (pct >= 70) return { grade: "A", desc: "Distinction", color: "#16a34a" };
    if (pct >= 60) return { grade: "B", desc: "Merit", color: "#2563eb" };
    if (pct >= 50) return { grade: "C", desc: "Credit", color: "#d97706" };
    if (pct >= 40) return { grade: "D", desc: "Satisfactory", color: "#ea580c" };
    return { grade: "E", desc: "Fail", color: "#dc2626" };
  };

  const avg = Math.round(sampleResults.reduce((s, r) => s + r.score, 0) / sampleResults.length);
  const avgGrade = getGrade(avg);

  return (
    <div className="p-5 text-xs relative" style={{ ...borderStyle, margin: c.border_style === "decorative" ? "8px" : "4px", fontFamily: "serif" }}>
      {/* Watermark */}
      {c.watermark_text && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span className="text-6xl font-bold text-gray-100 rotate-45 select-none whitespace-nowrap">
            {c.watermark_text}
          </span>
        </div>
      )}

      {/* Header */}
      {c.logo_position === "left" || c.logo_position === "right" ? (
        <div className={`flex items-center mb-3 relative z-10 gap-3 ${c.logo_position === "right" ? "flex-row-reverse" : ""}`}>
          {c.logo_url && <img src={c.logo_url} alt="Logo" className="w-14 h-14 object-contain flex-shrink-0" />}
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold" style={{ color: primary }}>Sample Academy</h1>
            <p className="text-gray-400 italic text-[10px]">Excellence in Education</p>
            <p className="text-sm mt-1">Student Report Card &mdash; Term 1 2026</p>
          </div>
          {c.logo_url && <div className="w-14 flex-shrink-0" />}
        </div>
      ) : (
        <div className="text-center mb-3 relative z-10">
          {c.logo_url && <img src={c.logo_url} alt="Logo" className="w-12 h-12 mx-auto mb-1 object-contain" />}
          <h1 className="text-lg font-bold" style={{ color: primary }}>Sample Academy</h1>
          <p className="text-gray-400 italic text-[10px]">Excellence in Education</p>
          <p className="text-sm mt-1">Student Report Card &mdash; Term 1 2026</p>
        </div>
      )}

      {/* Student Info */}
      <table className="w-full mb-3 border-collapse relative z-10" style={{ fontSize: "10px" }}>
        <tbody>
          <tr>
            <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300 w-24">Student Name:</td>
            <td className="px-2 py-1 border border-gray-300">Tatenda Moyo</td>
            <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300 w-24">Student No:</td>
            <td className="px-2 py-1 border border-gray-300">STU2026001</td>
          </tr>
          <tr>
            <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Class:</td>
            <td className="px-2 py-1 border border-gray-300">Form 2A</td>
            <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Gender:</td>
            <td className="px-2 py-1 border border-gray-300">Male</td>
          </tr>
          {c.show_attendance !== false && (
            <tr>
              <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Admission:</td>
              <td className="px-2 py-1 border border-gray-300">2024-01-15</td>
              <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Attendance:</td>
              <td className="px-2 py-1 border border-gray-300">58/60 days</td>
            </tr>
          )}
          {c.show_class_teacher !== false && (
            <tr>
              <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Class Teacher:</td>
              <td className="px-2 py-1 border border-gray-300" colSpan={3}>Mrs. S. Ncube</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Results */}
      <h2 className="font-bold text-sm mb-1 relative z-10">Academic Results</h2>
      <table className="w-full border-collapse mb-2 relative z-10" style={{ fontSize: "10px" }}>
        <thead>
          <tr style={{ backgroundColor: primary, color: "white" }}>
            <th className="px-2 py-1.5 text-left">Subject</th>
            {c.show_exam_types !== false && (
              <>
                <th className="px-2 py-1.5">Exam</th>
                <th className="px-2 py-1.5">Score</th>
                <th className="px-2 py-1.5">Max</th>
              </>
            )}
            <th className="px-2 py-1.5">%</th>
            <th className="px-2 py-1.5">Grade</th>
            {c.show_grade_remark !== false && <th className="px-2 py-1.5 text-left">Remark</th>}
          </tr>
        </thead>
        <tbody>
          {sampleResults.map((r, i) => {
            const g = getGrade(r.score);
            const rowBg = c.highlight_pass_fail
              ? `${g.color}12`
              : i % 2 === 1 ? secondary : "white";
            return (
              <tr key={i} style={{ backgroundColor: rowBg }}>
                <td className="px-2 py-1 border border-gray-200">{r.subject}</td>
                {c.show_exam_types !== false && (
                  <>
                    <td className="px-2 py-1 border border-gray-200 text-center">{r.exam}</td>
                    <td className="px-2 py-1 border border-gray-200 text-center">{r.score}</td>
                    <td className="px-2 py-1 border border-gray-200 text-center">{r.max}</td>
                  </>
                )}
                <td className="px-2 py-1 border border-gray-200 text-center">{r.score}%</td>
                <td className="px-2 py-1 border border-gray-200 text-center font-bold" style={{ color: g.color }}>{g.grade}</td>
                {c.show_grade_remark !== false && (
                  <td className="px-2 py-1 border border-gray-200">{g.desc}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Overall average */}
      {c.show_overall_average !== false && (
        <p className="font-semibold text-[11px] mb-2 relative z-10">
          Overall Average: {avg}% &mdash; Grade {avgGrade.grade} ({avgGrade.desc})
        </p>
      )}

      {/* Conduct */}
      {c.show_conduct_section && (
        <div className="mb-2 relative z-10">
          <h3 className="font-bold text-[11px]">Conduct &amp; Discipline</h3>
          <div className="border-b border-gray-300 mt-1 mb-2"></div>
        </div>
      )}

      {/* Activities */}
      {c.show_activities_section && (
        <div className="mb-2 relative z-10">
          <h3 className="font-bold text-[11px]">Extra-Curricular Activities</h3>
          <div className="border-b border-gray-300 mt-1 mb-2"></div>
        </div>
      )}

      {/* Comments */}
      {(c.teacher_comments_default || c.principal_comments_default) && (
        <div className="mb-2 relative z-10 space-y-1">
          {c.teacher_comments_default && (
            <p><strong>Class Teacher&rsquo;s Comment:</strong> {c.teacher_comments_default}</p>
          )}
          {c.principal_comments_default && (
            <p><strong>Head of School&rsquo;s Comment:</strong> {c.principal_comments_default}</p>
          )}
        </div>
      )}

      {/* Next term dates */}
      {c.show_next_term_dates !== false && (
        <p className="text-[10px] mb-2 relative z-10">
          <strong>Next Term (Term 2):</strong> Opens 06 May 2026 &mdash; Closes 08 August 2026
        </p>
      )}

      {/* Grading key */}
      {c.show_grading_key !== false && (
        <div className="mb-2 relative z-10">
          <h3 className="font-bold text-[11px] mb-1">Grading Key</h3>
          <table className="border-collapse" style={{ fontSize: "9px" }}>
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="px-2 py-0.5">Grade</th>
                <th className="px-2 py-0.5">Description</th>
                <th className="px-2 py-0.5">Range</th>
              </tr>
            </thead>
            <tbody>
              {[["A","Distinction","70-100%"],["B","Merit","60-69%"],["C","Credit (Pass)","50-59%"],
                ["D","Satisfactory","40-49%"],["E","Fail","0-39%"]].map(([g,d,r],i)=>(
                <tr key={i} className="border border-gray-200">
                  <td className="px-2 py-0.5 text-center font-bold">{g}</td>
                  <td className="px-2 py-0.5">{d}</td>
                  <td className="px-2 py-0.5 text-center">{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Signatures */}
      {c.principal_name && (
        <div className="flex justify-between mt-4 pt-2 relative z-10">
          <div className="text-center">
            <div className="border-b border-gray-400 w-32 mb-1"></div>
            <p>Mrs. S. Ncube</p>
            <p className="text-gray-500">Class Teacher</p>
          </div>
          <div className="text-center">
            {c.stamp_url && <img src={c.stamp_url} alt="Stamp" className="w-8 h-8 mx-auto mb-1 object-contain" />}
            <div className="border-b border-gray-400 w-32 mb-1"></div>
            <p>{c.principal_name}</p>
            <p className="text-gray-500">{c.principal_title || "Head of School"}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-gray-400 mt-3 pt-2 border-t border-gray-100 relative z-10" style={{ fontSize: "8px" }}>
        Generated on 30 March 2026 | Sample Academy
        {c.custom_footer_text && ` | ${c.custom_footer_text}`}
      </div>
    </div>
  );
}
