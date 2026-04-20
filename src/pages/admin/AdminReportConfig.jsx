import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSchoolSettings } from "../../context/SchoolSettingsContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";

/* ── Option lists ─────────────────────────────────────────────────── */

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
const FONT_FAMILY_OPTIONS = [
  { value: "serif", label: "Serif (Classic)" },
  { value: "sans", label: "Sans-Serif (Modern)" },
  { value: "elegant", label: "Elegant (Italic Serif)" },
];
const FONT_SCALE_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
];
const HEADER_STYLE_OPTIONS = [
  { value: "solid", label: "Solid Colour" },
  { value: "gradient", label: "Gradient" },
  { value: "banner", label: "Banner Image" },
];
const PAGE_SIZE_OPTIONS = [
  { value: "A4", label: "A4" },
  { value: "letter", label: "Letter" },
];
const ORIENTATION_OPTIONS = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];
const SUBJECT_GROUP_OPTIONS = [
  { value: "core", label: "Core" },
  { value: "language", label: "Languages" },
  { value: "elective", label: "Electives" },
  { value: "other", label: "Other" },
];
const DEFAULT_TEACHER_COMMENT =
  "when the teacher adds report feedback thats what must be there";

const SECTION_LABELS = {
  templates: { title: "Templates", icon: "fa-layer-group", color: "indigo" },
  branding: { title: "Branding", icon: "fa-palette", color: "blue" },
  typography: { title: "Typography & Page", icon: "fa-font", color: "teal" },
  layout: { title: "Layout & Display", icon: "fa-th-large", color: "green" },
  data: { title: "Data Columns", icon: "fa-chart-bar", color: "pink" },
  content: { title: "Content & Comments", icon: "fa-pen-fancy", color: "purple" },
  grading: { title: "Grading Display", icon: "fa-star-half-alt", color: "orange" },
  groups: { title: "Subject Grouping", icon: "fa-tags", color: "cyan" },
  extras: { title: "Extras", icon: "fa-magic", color: "red" },
};

/* ── Built-in presets (applied client-side for instant feedback) ──── */

const BUILTIN_PRESETS = {
  Classic: {
    font_family: "serif", font_size_scale: "normal",
    header_style: "solid", border_style: "simple",
    primary_color: "#1d4ed8", secondary_color: "#f3f4f6",
    show_grading_key: true, show_attendance: true, show_overall_average: true,
    show_class_teacher: true, show_grade_remark: true, show_exam_types: true,
    show_position: true,
  },
  Modern: {
    font_family: "sans", font_size_scale: "normal",
    header_style: "gradient", border_style: "none",
    primary_color: "#0f766e", secondary_color: "#ecfdf5",
    gradient_start_color: "#0f766e", gradient_end_color: "#22d3ee",
    show_grading_key: true, show_attendance: true, show_overall_average: true,
    show_class_average: true, show_previous_term: true, show_effort_grade: true,
    show_subject_chart: true, show_position: true, show_qr_code: true,
    highlight_pass_fail: true, show_grade_remark: true,
  },
  Minimalist: {
    font_family: "sans", font_size_scale: "compact",
    header_style: "solid", border_style: "none",
    primary_color: "#111827", secondary_color: "#f9fafb",
    show_grading_key: false, show_attendance: true, show_overall_average: true,
    show_class_teacher: false, show_grade_remark: false, show_exam_types: false,
    show_position: true,
  },
};

const DEFAULT_CONFIG_SECTIONS = {
  branding: {
    primary_color: "#1d4ed8", secondary_color: "#f3f4f6",
    gradient_start_color: "#1d4ed8", gradient_end_color: "#3b82f6",
    header_style: "solid", logo_position: "center",
  },
  typography: {
    font_family: "serif", font_size_scale: "normal",
    page_size: "A4", page_orientation: "portrait", one_page_fit: false,
  },
  layout: {
    show_grading_key: true, show_attendance: true, show_attendance_breakdown: false,
    show_overall_average: true, show_class_teacher: true,
  },
  data: {
    show_position: true, show_class_average: false, show_previous_term: false,
    show_effort_grade: false, show_subject_chart: false, show_promotion_status: false,
    show_fees_status: false, show_qr_code: false,
  },
  content: {
    principal_name: "", principal_title: "Head of School",
    teacher_comments_default: DEFAULT_TEACHER_COMMENT, principal_comments_default: "",
    comment_char_limit: 250, show_next_term_dates: true, custom_footer_text: "",
  },
  grading: {
    show_grade_remark: true, show_exam_types: true, highlight_pass_fail: false,
  },
  extras: {
    watermark_text: "", border_style: "simple",
    show_conduct_section: false, show_activities_section: false,
  },
};

/* ── Main component ───────────────────────────────────────────────── */

export default function AdminReportConfig() {
  const { user } = useAuth();
  const { currentAcademicYear, currentTerm } = useSchoolSettings();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [uploading, setUploading] = useState(null);

  // Templates
  const [templates, setTemplates] = useState([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");

  // Subject groups
  const [subjects, setSubjects] = useState([]);
  const [subjectGroups, setSubjectGroups] = useState([]);
  const [pendingGroupSubject, setPendingGroupSubject] = useState("");
  const [pendingGroupType, setPendingGroupType] = useState("core");

  // Generate reports state
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [previewStudentId, setPreviewStudentId] = useState("");
  const [genYear, setGenYear] = useState(currentAcademicYear);
  const [genTerm, setGenTerm] = useState(currentTerm);
  const [publishedReleases, setPublishedReleases] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);
  const [publishMessage, setPublishMessage] = useState(null);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [loadingApprovalRequests, setLoadingApprovalRequests] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState(null);
  const [rejectionNotes, setRejectionNotes] = useState({});

  useEffect(() => {
    loadConfig();
    loadClasses();
    loadPublished();
    loadApprovalRequests();
    loadTemplates();
    loadSubjects();
    loadSubjectGroups();
  }, []);

  useEffect(() => {
    if (!genYear && currentAcademicYear) setGenYear(String(currentAcademicYear));
    if (!genTerm && currentTerm) setGenTerm(String(currentTerm));
  }, [currentAcademicYear, currentTerm, genYear, genTerm]);

  const loadConfig = async () => {
    try {
      const data = await apiService.getReportCardConfig();
      setConfig({
        ...DEFAULT_CONFIG_SECTIONS.branding,
        ...DEFAULT_CONFIG_SECTIONS.typography,
        ...DEFAULT_CONFIG_SECTIONS.layout,
        ...DEFAULT_CONFIG_SECTIONS.data,
        ...DEFAULT_CONFIG_SECTIONS.content,
        ...DEFAULT_CONFIG_SECTIONS.grading,
        ...DEFAULT_CONFIG_SECTIONS.extras,
        ...(data || {}),
        teacher_comments_default: (data?.teacher_comments_default || "").trim()
          ? data.teacher_comments_default
          : DEFAULT_TEACHER_COMMENT,
      });
    } catch {
      setMessage({ type: "error", text: "Failed to load report card configuration" });
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      const data = await apiService.fetchClasses();
      setClasses(Array.isArray(data) ? data : data?.results || []);
    } catch (err) { console.error(err); }
  };

  const loadPublished = async () => {
    try {
      const data = await apiService.getPublishedReports();
      setPublishedReleases(data.releases || []);
    } catch (err) { console.error(err); }
  };

  const loadApprovalRequests = async () => {
    setLoadingApprovalRequests(true);
    try {
      const data = await apiService.getReportApprovalRequests();
      setApprovalRequests(data?.requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingApprovalRequests(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setTemplates(await apiService.getReportCardTemplates());
    } catch (err) { console.error(err); }
  };

  const loadSubjects = async () => {
    try {
      const data = await apiService.fetchSubjects ? await apiService.fetchSubjects() : [];
      setSubjects(Array.isArray(data) ? data : data?.results || []);
    } catch { /* fetchSubjects may not exist; ignore */ }
  };

  const loadSubjectGroups = async () => {
    try {
      setSubjectGroups(await apiService.getSubjectGroups());
    } catch (err) { console.error(err); }
  };

  const isPublished = (classId) => publishedReleases.some(
    r => r.class_id === parseInt(classId) && r.academic_year === genYear && r.academic_term === genTerm
  );

  const handleChange = (key, value) => setConfig((c) => ({ ...c, [key]: value }));
  const handleToggle = (key) => setConfig((c) => ({ ...c, [key]: !c[key] }));

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Strip image fields — those are updated via handleUpload (multipart POST).
      // Sending them as strings/null in a JSON PATCH causes DRF ImageField validation to fail.
      const {
        logo_url: _a, stamp_url: _b, banner_url: _c,
        logo: _d, stamp_image: _e, banner_image: _f,
        ...data
      } = config;
      if (!data.teacher_comments_default || !String(data.teacher_comments_default).trim()) {
        data.teacher_comments_default = DEFAULT_TEACHER_COMMENT;
      }
      await apiService.updateReportCardConfig(data);
      setMessage({ type: "success", text: "Report card settings saved!" });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to save settings" });
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
      setMessage({ type: "success", text: `${field.replace("_", " ")} uploaded` });
    } catch {
      setMessage({ type: "error", text: `Failed to upload ${field}` });
    } finally {
      setUploading(null);
    }
  };

  const applyBuiltinPreset = (name) => {
    const preset = BUILTIN_PRESETS[name];
    if (!preset) return;
    setConfig((c) => ({ ...c, ...preset, template_preset: name }));
    setMessage({ type: "success", text: `Applied "${name}" preset — click Save to persist.` });
  };

  const applyTemplate = async (id) => {
    try {
      const data = await apiService.applyReportCardTemplate(id);
      setConfig(data);
      setMessage({ type: "success", text: "Template applied and saved" });
    } catch {
      setMessage({ type: "error", text: "Failed to apply template" });
    }
  };

  const saveAsTemplate = async () => {
    const name = newTemplateName.trim();
    if (!name) return;
    try {
      await apiService.saveReportCardTemplate({ name, description: newTemplateDesc });
      setNewTemplateName("");
      setNewTemplateDesc("");
      await loadTemplates();
      setMessage({ type: "success", text: `Template "${name}" saved (shared with all tenants)` });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to save template" });
    }
  };

  const deleteTemplate = async (id, isBuiltin) => {
    if (isBuiltin) return;
    if (!window.confirm("Delete this template?")) return;
    try {
      await apiService.deleteReportCardTemplate(id);
      await loadTemplates();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to delete" });
    }
  };

  const resetSection = (sectionKey) => {
    const defaults = DEFAULT_CONFIG_SECTIONS[sectionKey];
    if (!defaults) return;
    setConfig((c) => ({ ...c, ...defaults }));
  };

  const addSubjectGroup = async () => {
    if (!pendingGroupSubject) return;
    try {
      await apiService.saveSubjectGroup({ subject: pendingGroupSubject, group_type: pendingGroupType });
      await loadSubjectGroups();
      setPendingGroupSubject("");
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed" });
    }
  };

  const removeSubjectGroup = async (id) => {
    try {
      await apiService.deleteSubjectGroup(id);
      await loadSubjectGroups();
    } catch { /* noop */ }
  };

  const handleClassSelect = async (classId) => {
    setSelectedClassId(classId);
    setPreviewStudentId("");
    if (!classId) { setStudents([]); return; }
    setLoadingStudents(true);
    try {
      const data = await apiService.fetchStudentsByClass(classId);
      const list = Array.isArray(data) ? data : data.results || [];
      setStudents(list.map(s => ({
        id: s.id,
        student_number: s.user?.student_number || s.student_number || "",
        full_name: s.user?.full_name || s.full_name
          || `${s.user?.first_name || ""} ${s.user?.last_name || ""}`.trim(),
      })));
    } catch (err) { console.error(err); }
    finally { setLoadingStudents(false); }
  };

  const handleDownloadReport = async (studentId, studentName) => {
    setDownloadingId(studentId);
    try {
      const blob = await apiService.downloadReportCard(studentId, { year: genYear, term: genTerm });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_card_${studentName}_${genTerm}_${genYear}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Failed to download report card");
    } finally { setDownloadingId(null); }
  };

  const handleDownloadAll = async () => {
    if (students.length === 0) return;
    setDownloadingAll(true);
    for (const s of students) {
      try {
        const blob = await apiService.downloadReportCard(s.id, { year: genYear, term: genTerm });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report_card_${s.full_name}_${genTerm}_${genYear}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) { console.error(err); }
    }
    setDownloadingAll(false);
  };

  const handlePublishClass = async () => {
    if (!selectedClassId) return;
    setPublishing(true);
    setPublishMessage(null);
    try {
      const data = await apiService.publishReports({ class_id: selectedClassId, year: genYear, term: genTerm });
      setPublishMessage({ type: "success", text: data.message });
      await loadPublished();
      await loadApprovalRequests();
    } catch (err) {
      setPublishMessage({ type: "error", text: err.message || "Failed" });
    } finally { setPublishing(false); }
  };

  const handlePublishAll = async () => {
    setPublishingAll(true);
    setPublishMessage(null);
    try {
      const data = await apiService.publishAllReports({ year: genYear, term: genTerm });
      setPublishMessage({ type: "success", text: data.message });
      await loadPublished();
      await loadApprovalRequests();
    } catch (err) {
      setPublishMessage({ type: "error", text: err.message || "Failed" });
    } finally { setPublishingAll(false); }
  };

  const handleReviewRequest = async (requestId, decision) => {
    setReviewingRequestId(requestId);
    setPublishMessage(null);
    try {
      const admin_note = decision === "reject" ? (rejectionNotes[requestId] || "").trim() : "";
      const data = await apiService.reviewReportApprovalRequest(requestId, { decision, admin_note });
      setPublishMessage({ type: "success", text: data.message || "Request updated" });
      await loadApprovalRequests();
      await loadPublished();
    } catch (err) {
      setPublishMessage({ type: "error", text: err.message || "Failed to review request" });
    } finally {
      setReviewingRequestId(null);
    }
  };

  const previewStudent = useMemo(
    () => students.find(s => String(s.id) === String(previewStudentId)),
    [students, previewStudentId],
  );

  const selectedRequest = useMemo(
    () => approvalRequests.find((r) =>
      String(r.class_id) === String(selectedClassId)
      && String(r.academic_year) === String(genYear)
      && String(r.academic_term) === String(genTerm)
    ),
    [approvalRequests, selectedClassId, genYear, genTerm],
  );

  if (loading) return <LoadingSpinner />;
  const c = config || {};

  return (
    <div>
      <Header title="Report Card Settings" user={user} />
      <div className="p-6">
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success"
              ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── LEFT: Config panels ── */}
          <div className="space-y-5">

            {/* Templates */}
            <Section id="templates" onReset={null}>
              <h3 className="text-xs font-semibold text-gray-600 mb-2">Quick Presets</h3>
              <div className="flex gap-2 flex-wrap mb-4">
                {Object.keys(BUILTIN_PRESETS).map((name) => (
                  <button key={name} onClick={() => applyBuiltinPreset(name)}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                    {name}
                  </button>
                ))}
              </div>

              <h3 className="text-xs font-semibold text-gray-600 mb-2">Shared Templates ({templates.length})</h3>
              <div className="max-h-44 overflow-y-auto border rounded divide-y mb-3">
                {templates.length === 0 && (
                  <p className="text-xs text-gray-400 p-3">No shared templates yet.</p>
                )}
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-3 py-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-800">{t.name}</span>
                      {t.is_builtin && <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded">built-in</span>}
                      {t.description && <p className="text-xs text-gray-500 truncate">{t.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => applyTemplate(t.id)}
                        className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Apply</button>
                      {!t.is_builtin && (
                        <button onClick={() => deleteTemplate(t.id, t.is_builtin)}
                          className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">×</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="text-xs font-semibold text-gray-600 mb-2">Save current design as template</h3>
              <div className="flex gap-2">
                <input type="text" value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Template name"
                  className="border rounded p-2 text-sm flex-1" />
                <input type="text" value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder="Short description (optional)"
                  className="border rounded p-2 text-sm flex-1" />
                <button onClick={saveAsTemplate}
                  disabled={!newTemplateName.trim()}
                  className="px-3 py-2 text-sm font-medium rounded bg-indigo-600 text-white disabled:opacity-50">
                  Save
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Templates are shared with every school on Tishanyq.
              </p>
            </Section>

            {/* Branding */}
            <Section id="branding" onReset={() => resetSection("branding")}>
              <div className="grid grid-cols-2 gap-4">
                <ColorPicker label="Primary Color" value={c.primary_color}
                  onChange={(v) => handleChange("primary_color", v)} defaultValue="#1d4ed8" />
                <ColorPicker label="Secondary Color" value={c.secondary_color}
                  onChange={(v) => handleChange("secondary_color", v)} defaultValue="#f3f4f6" />
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Header Style</label>
                <select value={c.header_style || "solid"}
                  onChange={(e) => handleChange("header_style", e.target.value)}
                  className="border rounded w-full p-2 text-sm">
                  {HEADER_STYLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {c.header_style === "gradient" && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <ColorPicker label="Gradient Start" value={c.gradient_start_color}
                    onChange={(v) => handleChange("gradient_start_color", v)} defaultValue="#1d4ed8" />
                  <ColorPicker label="Gradient End" value={c.gradient_end_color}
                    onChange={(v) => handleChange("gradient_end_color", v)} defaultValue="#3b82f6" />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 mt-4">
                <FileUploadField label="Logo" field="logo" url={c.logo_url}
                  uploading={uploading} onUpload={handleUpload} />
                <FileUploadField label="Stamp" field="stamp_image" url={c.stamp_url}
                  uploading={uploading} onUpload={handleUpload} />
                <FileUploadField label="Banner" field="banner_image" url={c.banner_url}
                  uploading={uploading} onUpload={handleUpload} />
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Logo Position</label>
                <select value={c.logo_position || "center"}
                  onChange={(e) => handleChange("logo_position", e.target.value)}
                  className="border rounded w-full p-2 text-sm">
                  {LOGO_POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </Section>

            {/* Typography & Page */}
            <Section id="typography" onReset={() => resetSection("typography")}>
              <div className="grid grid-cols-2 gap-4">
                <SelectField label="Font Family" value={c.font_family}
                  onChange={(v) => handleChange("font_family", v)} options={FONT_FAMILY_OPTIONS} />
                <SelectField label="Font Size" value={c.font_size_scale}
                  onChange={(v) => handleChange("font_size_scale", v)} options={FONT_SCALE_OPTIONS} />
                <SelectField label="Page Size" value={c.page_size}
                  onChange={(v) => handleChange("page_size", v)} options={PAGE_SIZE_OPTIONS} />
                <SelectField label="Orientation" value={c.page_orientation}
                  onChange={(v) => handleChange("page_orientation", v)} options={ORIENTATION_OPTIONS} />
              </div>
              <Toggle label="One-page auto-fit (shrink to fit single page)"
                checked={c.one_page_fit} onChange={() => handleToggle("one_page_fit")} />
            </Section>

            {/* Layout */}
            <Section id="layout" onReset={() => resetSection("layout")}>
              <Toggle label="Show grading key table" checked={c.show_grading_key}
                onChange={() => handleToggle("show_grading_key")} />
              <Toggle label="Show attendance summary" checked={c.show_attendance}
                onChange={() => handleToggle("show_attendance")} />
              <Toggle label="Show attendance breakdown (present / absent / late)"
                checked={c.show_attendance_breakdown}
                onChange={() => handleToggle("show_attendance_breakdown")} />
              <Toggle label="Show overall average" checked={c.show_overall_average}
                onChange={() => handleToggle("show_overall_average")} />
              <Toggle label="Show class teacher name" checked={c.show_class_teacher}
                onChange={() => handleToggle("show_class_teacher")} />
            </Section>

            {/* Data columns */}
            <Section id="data" onReset={() => resetSection("data")}>
              <Toggle label="Show position in class (rank)" checked={c.show_position}
                onChange={() => handleToggle("show_position")} />
              <Toggle label="Show class average & top score columns" checked={c.show_class_average}
                onChange={() => handleToggle("show_class_average")} />
              <Toggle label="Show previous term trend column" checked={c.show_previous_term}
                onChange={() => handleToggle("show_previous_term")} />
              <Toggle label="Show effort / attitude grade per subject" checked={c.show_effort_grade}
                onChange={() => handleToggle("show_effort_grade")} />
              <Toggle label="Show subject performance bar chart" checked={c.show_subject_chart}
                onChange={() => handleToggle("show_subject_chart")} />
              <Toggle label="Show promotion status (year-end)" checked={c.show_promotion_status}
                onChange={() => handleToggle("show_promotion_status")} />
              <Toggle label="Show outstanding fees balance" checked={c.show_fees_status}
                onChange={() => handleToggle("show_fees_status")} />
              <Toggle label="Include verification QR code" checked={c.show_qr_code}
                onChange={() => handleToggle("show_qr_code")} />
            </Section>

            {/* Content */}
            <Section id="content" onReset={() => resetSection("content")}>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <TextField label="Principal / Head Name" value={c.principal_name}
                  placeholder="e.g. Mr. J. Moyo"
                  onChange={(v) => handleChange("principal_name", v)} />
                <TextField label="Title" value={c.principal_title}
                  placeholder="e.g. Head of School"
                  onChange={(v) => handleChange("principal_title", v)} />
              </div>
              <TextArea label="Default Teacher Comment" value={c.teacher_comments_default}
                onChange={(v) => handleChange("teacher_comments_default", v)} />
              <TextArea label="Default Principal Comment" value={c.principal_comments_default}
                onChange={(v) => handleChange("principal_comments_default", v)} />
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    Per-subject comment limit ({c.comment_char_limit || 250} chars)
                  </label>
                  <input type="number" min={50} max={1000}
                    value={c.comment_char_limit || 250}
                    onChange={(e) => handleChange("comment_char_limit", parseInt(e.target.value) || 250)}
                    className="border rounded w-full p-2 text-sm" />
                </div>
                <TextField label="Custom Footer Text" value={c.custom_footer_text}
                  placeholder="e.g. God Bless You"
                  onChange={(v) => handleChange("custom_footer_text", v)} />
              </div>
              <Toggle label="Show next term opening/closing dates (hidden for Term 3)"
                checked={c.show_next_term_dates} onChange={() => handleToggle("show_next_term_dates")} />
            </Section>

            {/* Grading */}
            <Section id="grading" onReset={() => resetSection("grading")}>
              <Toggle label="Show grade remarks (Distinction, Merit, Credit, etc.)"
                checked={c.show_grade_remark} onChange={() => handleToggle("show_grade_remark")} />
              <Toggle label="Show individual exam types (tests, assignments, exams)"
                checked={c.show_exam_types} onChange={() => handleToggle("show_exam_types")} />
              <Toggle label="Color-code rows by grade (green=A, red=E)"
                checked={c.highlight_pass_fail} onChange={() => handleToggle("highlight_pass_fail")} />
            </Section>

            {/* Subject grouping */}
            <Section id="groups" onReset={null}>
              <Toggle label="Group subjects by Core / Electives / Languages on report"
                checked={c.subject_grouping_enabled}
                onChange={() => handleToggle("subject_grouping_enabled")} />
              {c.subject_grouping_enabled && (
                <>
                  <div className="flex gap-2 mt-3">
                    <select value={pendingGroupSubject}
                      onChange={(e) => setPendingGroupSubject(e.target.value)}
                      className="border rounded p-2 text-sm flex-1">
                      <option value="">— Select subject —</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={pendingGroupType}
                      onChange={(e) => setPendingGroupType(e.target.value)}
                      className="border rounded p-2 text-sm">
                      {SUBJECT_GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button onClick={addSubjectGroup} disabled={!pendingGroupSubject}
                      className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Add</button>
                  </div>
                  <div className="mt-3 max-h-36 overflow-y-auto border rounded divide-y">
                    {subjectGroups.length === 0 && (
                      <p className="text-xs text-gray-400 p-2">No subjects assigned yet.</p>
                    )}
                    {subjectGroups.map(g => (
                      <div key={g.id} className="flex justify-between items-center px-3 py-1.5 text-sm">
                        <span>{g.subject_name}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 capitalize">{g.group_type}</span>
                          <button onClick={() => removeSubjectGroup(g.id)}
                            className="text-red-500 text-xs hover:text-red-700">×</button>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Section>

            {/* Extras */}
            <Section id="extras" onReset={() => resetSection("extras")}>
              <TextField label="Watermark Text" value={c.watermark_text}
                placeholder="e.g. OFFICIAL COPY"
                onChange={(v) => handleChange("watermark_text", v)} />
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Border Style</label>
                <select value={c.border_style || "simple"}
                  onChange={(e) => handleChange("border_style", e.target.value)}
                  className="border rounded w-full p-2 text-sm">
                  {BORDER_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <Toggle label="Include conduct / discipline section"
                checked={c.show_conduct_section} onChange={() => handleToggle("show_conduct_section")} />
              <Toggle label="Include extra-curricular activities section"
                checked={c.show_activities_section} onChange={() => handleToggle("show_activities_section")} />
            </Section>

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 transition-all">
              {saving ? "Saving..." : "Save Report Card Settings"}
            </button>

            {/* ── Publish & Download Reports ── */}
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <i className="fas fa-file-pdf text-red-500"></i>
                Publish & Download Report Cards
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Publish reports to make them available to students and parents.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Class</label>
                  <select value={selectedClassId} onChange={(e) => handleClassSelect(e.target.value)}
                    className="border rounded w-full p-2 text-sm">
                    <option value="">Select a class</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name} {isPublished(cls.id) ? "✓" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Year</label>
                  <select value={genYear} onChange={(e) => setGenYear(e.target.value)}
                    className="border rounded w-full p-2 text-sm">
                    {[...Array(5)].map((_, i) => {
                      const y = parseInt(currentAcademicYear) - i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Term</label>
                  <select value={genTerm} onChange={(e) => setGenTerm(e.target.value)}
                    className="border rounded w-full p-2 text-sm">
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={handlePublishClass}
                  disabled={
                    !selectedClassId
                    || publishing
                    || (selectedClassId && isPublished(selectedClassId))
                    || !selectedRequest
                    || selectedRequest.status !== "pending"
                  }
                  className="py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 text-sm">
                  {publishing ? "Publishing..." : (selectedClassId && isPublished(selectedClassId))
                    ? "Already Published" : "Approve & Publish This Class"}
                </button>
                <button onClick={handlePublishAll} disabled={publishingAll}
                  className="py-2.5 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 text-sm">
                  {publishingAll ? "Publishing All..." : "Approve & Publish All Pending"}
                </button>
              </div>

              <div className="mb-4 p-3 border rounded-lg bg-gray-50">
                <p className="text-xs font-semibold text-gray-700 mb-2">Final Sign-off Queue (Current Selection)</p>
                {!selectedClassId ? (
                  <p className="text-xs text-gray-500">Choose a class to review sign-off status.</p>
                ) : !selectedRequest ? (
                  <p className="text-xs text-amber-700">No teacher submission yet for this class, year and term.</p>
                ) : (
                  <div>
                    <p className="text-xs text-gray-700">
                      Status: <span className="font-semibold">{selectedRequest.status}</span>
                      {" · "}
                      Submitted by: <span className="font-semibold">{selectedRequest.requested_by || "Unknown"}</span>
                    </p>
                    {selectedRequest.admin_note && (
                      <p className="text-xs text-red-700 mt-1">Admin note: {selectedRequest.admin_note}</p>
                    )}
                    {selectedRequest.status === "pending" && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={rejectionNotes[selectedRequest.id] || ""}
                          onChange={(e) => setRejectionNotes((prev) => ({ ...prev, [selectedRequest.id]: e.target.value }))}
                          placeholder="Reason if sending back"
                          className="sm:col-span-2 border rounded px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => handleReviewRequest(selectedRequest.id, "reject")}
                          disabled={reviewingRequestId === selectedRequest.id}
                          className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Send Back To Teacher
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {loadingApprovalRequests && (
                  <p className="text-xs text-gray-400 mt-2">Loading queue...</p>
                )}
              </div>

              {publishMessage && (
                <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${
                  publishMessage.type === "success" ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"}`}>
                  {publishMessage.text}
                </div>
              )}

              {loadingStudents ? (
                <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
              ) : selectedClassId && students.length > 0 ? (
                <>
                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Preview a real student's report
                    </label>
                    <select value={previewStudentId}
                      onChange={(e) => setPreviewStudentId(e.target.value)}
                      className="border rounded w-full p-2 text-sm">
                      <option value="">— Show mock preview —</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                  <button onClick={handleDownloadAll} disabled={downloadingAll}
                    className="w-full mb-3 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 text-sm">
                    {downloadingAll ? "Downloading All..." : `Download All (${students.length})`}
                  </button>
                  <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                    {students.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{s.full_name}</span>
                          <span className="text-xs text-gray-400 ml-2">{s.student_number}</span>
                        </div>
                        <button onClick={() => handleDownloadReport(s.id, s.full_name)}
                          disabled={downloadingId === s.id}
                          className="text-xs px-3 py-1 rounded-md font-medium bg-red-100 text-red-700 hover:bg-red-200">
                          {downloadingId === s.id ? "Generating..." : "PDF"}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : selectedClassId ? (
                <p className="text-sm text-gray-500 text-center py-4">No students in this class.</p>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Select a class to publish/download.</p>
              )}
            </div>
          </div>

          {/* ── RIGHT: Live preview ── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <h3 className="text-lg font-bold text-gray-800 mb-3">
              <i className="fas fa-eye mr-2 text-blue-500"></i>
              Live Preview
              {previewStudent && (
                <span className="ml-2 text-xs font-normal text-gray-500">({previewStudent.full_name})</span>
              )}
            </h3>
            <div className="bg-white rounded-xl shadow-lg overflow-hidden"
              style={{ maxHeight: "85vh", overflowY: "auto" }}>
              <ReportPreview config={c} previewStudent={previewStudent} term={genTerm} year={genYear} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Small helper components ─────────────────────────────────────── */

function Section({ id, children, onReset }) {
  const s = SECTION_LABELS[id];
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
          <i className={`fas ${s.icon} text-${s.color}-500`}></i>
          {s.title}
        </h2>
        {onReset && (
          <button onClick={onReset}
            className="text-xs text-gray-400 hover:text-gray-700"
            title="Reset this section to defaults">
            <i className="fas fa-undo-alt mr-1"></i>Reset
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer group">
      <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
      <input type="checkbox" className="sr-only" checked={!!checked} onChange={onChange} />
      <div className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-blue-500" : "bg-gray-300"}`}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`}></div>
      </div>
    </label>
  );
}

function ColorPicker({ label, value, onChange, defaultValue }) {
  const v = value || defaultValue;
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={v} onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded border cursor-pointer" />
        <input type="text" value={v} onChange={(e) => onChange(e.target.value)}
          className="border rounded p-1.5 text-sm font-mono w-24" />
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <select value={value || options[0].value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded w-full p-2 text-sm">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <input type="text" value={value || ""} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded w-full p-2 text-sm" />
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <div className="mb-3">
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <textarea value={value || ""} rows={2}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded w-full p-2 text-sm" />
    </div>
  );
}

function FileUploadField({ label, field, url, uploading, onUpload }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      {url && <img src={url} alt={label}
        className="w-16 h-16 object-contain border rounded mb-2" />}
      <input type="file" accept="image/*" onChange={(e) => onUpload(field, e)}
        className="text-xs" disabled={uploading === field} />
      {uploading === field && <p className="text-xs text-blue-500 mt-1">Uploading...</p>}
    </div>
  );
}

/* ── Live HTML Preview ──────────────────────────────────────────── */

function ReportPreview({ config, previewStudent, term, year }) {
  const c = config || {};
  const primary = c.primary_color || "#1d4ed8";
  const secondary = c.secondary_color || "#f3f4f6";
  const gradStart = c.gradient_start_color || primary;
  const gradEnd = c.gradient_end_color || primary;
  const fontFamily = {
    serif: "Georgia, serif",
    sans: "Inter, system-ui, sans-serif",
    elegant: "Garamond, 'Times New Roman', serif",
  }[c.font_family || "serif"];
  const fontScale = { compact: 0.88, normal: 1, large: 1.12 }[c.font_size_scale || "normal"];

  const borderStyle = c.border_style === "decorative"
    ? { border: `3px solid ${primary}`, outline: `1px solid ${primary}`, outlineOffset: "4px" }
    : c.border_style === "simple"
      ? { border: `1.5px solid ${primary}` }
      : {};

  const sampleResults = [
    { subject: "Mathematics", score: 78, prev: 72, classAvg: 65, top: 92, effort: "A" },
    { subject: "English",     score: 65, prev: 68, classAvg: 60, top: 88, effort: "B" },
    { subject: "Science",     score: 52, prev: 50, classAvg: 58, top: 85, effort: "C" },
    { subject: "History",     score: 45, prev: 48, classAvg: 55, top: 78, effort: "C" },
    { subject: "Shona",       score: 88, prev: 82, classAvg: 70, top: 95, effort: "A" },
  ];

  const getGrade = (pct) => {
    if (pct >= 70) return { grade: "A", desc: "Distinction", color: "#16a34a" };
    if (pct >= 60) return { grade: "B", desc: "Merit",       color: "#2563eb" };
    if (pct >= 50) return { grade: "C", desc: "Credit",      color: "#d97706" };
    if (pct >= 40) return { grade: "D", desc: "Satisfactory", color: "#ea580c" };
    return { grade: "E", desc: "Fail", color: "#dc2626" };
  };

  const avg = Math.round(sampleResults.reduce((s, r) => s + r.score, 0) / sampleResults.length);
  const avgGrade = getGrade(avg);
  const studentName = previewStudent?.full_name || "Tatenda Moyo";
  const studentNumber = previewStudent?.student_number || "STU2026001";

  const headerBg = c.header_style === "gradient"
    ? { background: `linear-gradient(90deg, ${gradStart}, ${gradEnd})`, color: "white" }
    : {};
  const headerTextColor = c.header_style === "gradient" ? "white" : primary;

  return (
    <div className="p-5 text-xs relative"
      style={{ ...borderStyle, margin: "6px", fontFamily, fontSize: `${10 * fontScale}px` }}>

      {c.watermark_text && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span className="text-6xl font-bold text-gray-100 rotate-45 select-none whitespace-nowrap">
            {c.watermark_text}
          </span>
        </div>
      )}

      {/* Header */}
      {c.header_style === "banner" && c.banner_url && (
        <img src={c.banner_url} alt="Banner"
          className="w-full h-16 object-cover rounded mb-2 relative z-10" />
      )}
      <div className="mb-3 relative z-10 rounded"
        style={c.header_style === "gradient" ? { ...headerBg, padding: "10px" } : {}}>
        {c.logo_position === "left" || c.logo_position === "right" ? (
          <div className={`flex items-center gap-3 ${c.logo_position === "right" ? "flex-row-reverse" : ""}`}>
            {c.logo_url && <img src={c.logo_url} className="w-12 h-12 object-contain" />}
            <div className="flex-1 text-center">
              <h1 className="font-bold" style={{ color: headerTextColor, fontSize: `${16 * fontScale}px` }}>
                Sample Academy
              </h1>
              <p className="italic" style={{ fontSize: `${8 * fontScale}px`, color: c.header_style === "gradient" ? "rgba(255,255,255,0.8)" : "#9ca3af" }}>
                Excellence in Education
              </p>
              <p style={{ fontSize: `${11 * fontScale}px`, color: headerTextColor }}>
                Student Report Card — {term} {year}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            {c.logo_url && <img src={c.logo_url} className="w-12 h-12 mx-auto mb-1 object-contain" />}
            <h1 className="font-bold" style={{ color: headerTextColor, fontSize: `${16 * fontScale}px` }}>
              Sample Academy
            </h1>
            <p className="italic" style={{ fontSize: `${8 * fontScale}px`, color: c.header_style === "gradient" ? "rgba(255,255,255,0.8)" : "#9ca3af" }}>
              Excellence in Education
            </p>
            <p style={{ fontSize: `${11 * fontScale}px`, color: headerTextColor }}>
              Student Report Card — {term} {year}
            </p>
          </div>
        )}
      </div>

      {/* Student info */}
      <table className="w-full mb-2 border-collapse relative z-10" style={{ fontSize: `${9.5 * fontScale}px` }}>
        <tbody>
          <tr>
            <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300 w-24">Student Name:</td>
            <td className="px-2 py-1 border border-gray-300">{studentName}</td>
            <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300 w-24">Student No:</td>
            <td className="px-2 py-1 border border-gray-300">{studentNumber}</td>
          </tr>
          <tr>
            <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Class:</td>
            <td className="px-2 py-1 border border-gray-300">Form 2A</td>
            <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Gender:</td>
            <td className="px-2 py-1 border border-gray-300">Male</td>
          </tr>
          {c.show_attendance && (
            <tr>
              <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Attendance:</td>
              <td className="px-2 py-1 border border-gray-300" colSpan={3}>
                {c.show_attendance_breakdown ? "P:55 A:3 L:2 (of 60)" : "58/60 days"}
              </td>
            </tr>
          )}
          {c.show_position && (
            <tr>
              <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Position:</td>
              <td className="px-2 py-1 border border-gray-300" colSpan={3}>5th of 32</td>
            </tr>
          )}
          {c.show_promotion_status && (
            <tr>
              <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Status:</td>
              <td className="px-2 py-1 border border-gray-300" colSpan={3}>Promoted → Form 3</td>
            </tr>
          )}
          {c.show_fees_status && (
            <tr>
              <td className="bg-blue-50 px-2 py-1 font-semibold border border-gray-300">Fees:</td>
              <td className="px-2 py-1 border border-gray-300" colSpan={3}>USD 120.00 outstanding</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Results */}
      <h2 className="font-bold mb-1 relative z-10" style={{ fontSize: `${11 * fontScale}px`, color: primary }}>
        Academic Results
      </h2>
      <table className="w-full border-collapse mb-2 relative z-10" style={{ fontSize: `${9 * fontScale}px` }}>
        <thead>
          <tr style={{ backgroundColor: primary, color: "white" }}>
            <th className="px-2 py-1 text-left">Subject</th>
            <th className="px-2 py-1">%</th>
            <th className="px-2 py-1">Grade</th>
            {c.show_grade_remark && <th className="px-2 py-1 text-left">Remark</th>}
            {c.show_effort_grade && <th className="px-2 py-1">Effort</th>}
            {c.show_class_average && <><th className="px-2 py-1">Class Avg</th><th className="px-2 py-1">Top</th></>}
            {c.show_previous_term && <><th className="px-2 py-1">Last</th><th className="px-2 py-1">Trend</th></>}
          </tr>
        </thead>
        <tbody>
          {sampleResults.map((r, i) => {
            const g = getGrade(r.score);
            const rowBg = c.highlight_pass_fail ? `${g.color}12` : i % 2 === 1 ? secondary : "white";
            const trend = r.score > r.prev + 1 ? "▲" : r.score < r.prev - 1 ? "▼" : "►";
            return (
              <tr key={i} style={{ backgroundColor: rowBg }}>
                <td className="px-2 py-1 border border-gray-200">{r.subject}</td>
                <td className="px-2 py-1 border border-gray-200 text-center">{r.score}%</td>
                <td className="px-2 py-1 border border-gray-200 text-center font-bold" style={{ color: g.color }}>{g.grade}</td>
                {c.show_grade_remark && <td className="px-2 py-1 border border-gray-200">{g.desc}</td>}
                {c.show_effort_grade && <td className="px-2 py-1 border border-gray-200 text-center">{r.effort}</td>}
                {c.show_class_average && <>
                  <td className="px-2 py-1 border border-gray-200 text-center">{r.classAvg}%</td>
                  <td className="px-2 py-1 border border-gray-200 text-center">{r.top}%</td>
                </>}
                {c.show_previous_term && <>
                  <td className="px-2 py-1 border border-gray-200 text-center">{r.prev}%</td>
                  <td className="px-2 py-1 border border-gray-200 text-center">{trend}</td>
                </>}
              </tr>
            );
          })}
        </tbody>
      </table>

      {c.show_subject_chart && (
        <div className="mb-2 relative z-10">
          <h3 className="font-bold mb-1" style={{ fontSize: `${10 * fontScale}px`, color: primary }}>Subject Performance</h3>
          <div className="flex items-end gap-1 h-16 border-b border-gray-200">
            {sampleResults.map((r, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div style={{ height: `${r.score}%`, width: "100%", backgroundColor: primary }}></div>
                <span className="text-[8px] mt-1 text-gray-500">{r.subject.slice(0, 4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {c.show_overall_average && (
        <p className="font-semibold mb-2 relative z-10" style={{ fontSize: `${10 * fontScale}px` }}>
          Overall Average: {avg}% — Grade {avgGrade.grade} ({avgGrade.desc})
        </p>
      )}

      {c.show_conduct_section && (
        <div className="mb-2 relative z-10">
          <h3 className="font-bold" style={{ fontSize: `${10 * fontScale}px` }}>Conduct & Discipline</h3>
          <div className="border-b border-gray-300 mt-1 mb-2"></div>
        </div>
      )}
      {c.show_activities_section && (
        <div className="mb-2 relative z-10">
          <h3 className="font-bold" style={{ fontSize: `${10 * fontScale}px` }}>Extra-Curricular Activities</h3>
          <div className="border-b border-gray-300 mt-1 mb-2"></div>
        </div>
      )}

      {(c.teacher_comments_default || c.principal_comments_default) && (
        <div className="mb-2 relative z-10 space-y-1">
          {c.teacher_comments_default && (
            <p><strong>Class Teacher's Comment:</strong> {c.teacher_comments_default}</p>
          )}
          {c.principal_comments_default && (
            <p><strong>Head of School's Comment:</strong> {c.principal_comments_default}</p>
          )}
        </div>
      )}

      <div className="flex justify-between items-end mt-3 pt-2 relative z-10 gap-2">
        <div className="text-center flex-1">
          <div className="border-b border-gray-400 w-24 mx-auto mb-1"></div>
          {c.show_class_teacher ? (
            <>
              <p style={{ fontSize: `${9 * fontScale}px` }}>Mrs. S. Ncube</p>
              <p className="text-gray-500" style={{ fontSize: `${8 * fontScale}px` }}>Class Teacher</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: `${9 * fontScale}px` }}>Teacher Signature</p>
              <p className="text-gray-500" style={{ fontSize: `${8 * fontScale}px` }}>Class Teacher</p>
            </>
          )}
        </div>
        {c.show_qr_code && (
          <div className="w-14 h-14 bg-gray-100 border flex items-center justify-center text-[7px] text-gray-500 text-center">
            QR<br/>verify
          </div>
        )}
        <div className="text-center flex-1">
          {c.stamp_url && <img src={c.stamp_url} className="w-8 h-8 mx-auto mb-1 object-contain" />}
          <div className="border-b border-gray-400 w-24 mx-auto mb-1"></div>
          <p style={{ fontSize: `${9 * fontScale}px` }}>{c.principal_name || "Mr. J. Moyo"}</p>
          <p className="text-gray-500" style={{ fontSize: `${8 * fontScale}px` }}>{c.principal_title || "Head of School"}</p>
        </div>
      </div>

      {c.show_next_term_dates && term !== "Term 3" && (
        <div className="mt-2 text-gray-600 relative z-10" style={{ fontSize: `${8.5 * fontScale}px` }}>
          Next Term: Opens 10 Sep {year} | Closes 05 Dec {year}
        </div>
      )}

      <div className="text-center text-gray-400 mt-3 pt-2 border-t border-gray-100 relative z-10"
        style={{ fontSize: `${7.5 * fontScale}px` }}>
        Generated on {formatDate(new Date().toISOString())} | Sample Academy
        {c.custom_footer_text && ` | ${c.custom_footer_text}`}
      </div>
    </div>
  );
}
