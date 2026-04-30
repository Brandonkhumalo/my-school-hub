import React, { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Save, Send } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import toast from "react-hot-toast";

function toQuestionDraft(q, index) {
  return {
    id: q.id,
    order: q.order ?? index + 1,
    prompt_text: q.prompt_text || "",
    marks: q.marks ?? 1,
    question_type: q.question_type || "short",
    options: Array.isArray(q.options) ? q.options : [],
    correct_answer: q.correct_answer || "",
    source_page: q.source_page ?? null,
  };
}

export default function GenerateTest() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [papers, setPapers] = useState([]);
  const [assessmentPlans, setAssessmentPlans] = useState([]);
  const [generated, setGenerated] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState({
    source_paper_id: "",
    title: "",
    duration_minutes: 60,
    counts_for_report: false,
    assessment_plan_id: "",
    component_index: "",
    schedule_mode: "anytime",
    available_from: "",
    available_until: "",
    academic_year: String(new Date().getFullYear()),
    academic_term: "Term 1",
  });

  useEffect(() => {
    (async () => {
      try {
        const [paperRes, plans] = await Promise.all([
          apiService.listPastPapers(),
          apiService.listAssessmentPlans().catch(() => []),
        ]);
        setPapers(Array.isArray(paperRes) ? paperRes : (paperRes?.results || []));
        setAssessmentPlans(Array.isArray(plans) ? plans : (plans?.results || []));
      } catch (err) {
        toast.error(err.message || "Failed to load setup data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedPaper = useMemo(
    () => papers.find((p) => String(p.id) === String(form.source_paper_id)),
    [papers, form.source_paper_id]
  );

  async function handleGenerate(e) {
    e.preventDefault();
    if (!form.source_paper_id || !form.title) {
      toast.error("Choose a past paper and enter a title.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiService.generateTestFromPaper({
        source_paper_id: Number(form.source_paper_id),
        title: form.title,
        duration_minutes: Number(form.duration_minutes),
        academic_year: form.academic_year,
        academic_term: form.academic_term,
      });
      const test = res?.test;
      setGenerated(test);
      setQuestions((test?.questions || []).map(toQuestionDraft));
      toast.success("Draft test generated. Review questions before publishing.");
    } catch (err) {
      toast.error(err.message || "Failed to generate test.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMetadata() {
    if (!generated?.id) return;
    setSaving(true);
    try {
      const res = await apiService.updateTeacherTest(generated.id, {
        title: form.title,
        duration_minutes: Number(form.duration_minutes),
        counts_for_report: form.counts_for_report,
        assessment_plan_id: form.counts_for_report ? (form.assessment_plan_id || null) : null,
        component_index: form.counts_for_report ? (form.component_index || null) : null,
        schedule_mode: form.schedule_mode,
        available_from: form.schedule_mode === "scheduled" ? (form.available_from || null) : null,
        available_until: form.schedule_mode === "scheduled" ? (form.available_until || null) : null,
        academic_year: form.academic_year,
        academic_term: form.academic_term,
      });
      setGenerated(res?.test || generated);
      toast.success("Test metadata saved.");
    } catch (err) {
      toast.error(err.message || "Failed to save metadata.");
    } finally {
      setSaving(false);
    }
  }

  async function saveQuestions() {
    if (!generated?.id) return;
    setSaving(true);
    try {
      const normalized = questions.map((q, idx) => ({
        ...q,
        order: idx + 1,
        marks: Number(q.marks || 0),
      }));
      const res = await apiService.replaceTeacherTestQuestions(generated.id, normalized);
      setGenerated(res?.test || generated);
      setQuestions((res?.test?.questions || normalized).map(toQuestionDraft));
      toast.success("Questions saved.");
    } catch (err) {
      toast.error(err.message || "Failed to save questions.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!generated?.id) return;
    setSaving(true);
    try {
      await saveQuestions();
      await saveMetadata();
      const res = await apiService.publishTeacherTest(generated.id);
      setGenerated(res?.test || generated);
      toast.success("Test published.");
    } catch (err) {
      toast.error(err.message || "Publish failed.");
    } finally {
      setSaving(false);
    }
  }

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      toQuestionDraft({ prompt_text: "", marks: 1, question_type: "short", options: [], correct_answer: "" }, prev.length),
    ]);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <FileText className="w-7 h-7 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generate Test</h1>
      </div>

      <form onSubmit={handleGenerate} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={form.source_paper_id} onChange={(e) => setForm((f) => ({ ...f, source_paper_id: e.target.value }))} className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm">
            <option value="">Choose past paper</option>
            {papers.map((p) => <option key={p.id} value={p.id}>{p.subject_name} · {p.year} · {p.original_filename}</option>)}
          </select>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Test title" className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
          <input type="number" min={5} value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
          <input value={form.academic_year} onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))} placeholder="Academic year" className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
          <input value={form.academic_term} onChange={(e) => setForm((f) => ({ ...f, academic_term: e.target.value }))} placeholder="Academic term" className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
        </div>
        {selectedPaper && <p className="text-xs text-gray-500">Source: {selectedPaper.subject_name} · {selectedPaper.level_kind} {selectedPaper.level_number}</p>}
        <button disabled={saving} className="px-4 py-2 rounded text-white text-sm" style={{ backgroundColor: "var(--accent)" }}>{saving ? "Generating..." : "Generate Draft from Paper"}</button>
      </form>

      {generated && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Draft Settings</h2>
            <span className="text-xs text-gray-500">Status: {generated.status}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.counts_for_report} onChange={(e) => setForm((f) => ({ ...f, counts_for_report: e.target.checked }))} />
              Count this test in report cards
            </label>
            <select disabled={!form.counts_for_report} value={form.assessment_plan_id} onChange={(e) => setForm((f) => ({ ...f, assessment_plan_id: e.target.value }))} className="px-3 py-2 border rounded-md disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm">
              <option value="">Assessment plan</option>
              {assessmentPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input disabled={!form.counts_for_report} type="number" min={1} value={form.component_index} onChange={(e) => setForm((f) => ({ ...f, component_index: e.target.value }))} placeholder="Component index" className="px-3 py-2 border rounded-md disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
            <select value={form.schedule_mode} onChange={(e) => setForm((f) => ({ ...f, schedule_mode: e.target.value }))} className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm">
              <option value="anytime">Available anytime</option>
              <option value="scheduled">Scheduled window</option>
            </select>
            <input disabled={form.schedule_mode !== "scheduled"} type="datetime-local" value={form.available_from} onChange={(e) => setForm((f) => ({ ...f, available_from: e.target.value }))} className="px-3 py-2 border rounded-md disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
            <input disabled={form.schedule_mode !== "scheduled"} type="datetime-local" value={form.available_until} onChange={(e) => setForm((f) => ({ ...f, available_until: e.target.value }))} className="px-3 py-2 border rounded-md disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={saveMetadata} disabled={saving} className="px-3 py-2 rounded text-sm text-white bg-slate-600 inline-flex items-center gap-1"><Save className="w-4 h-4" /> Save Settings</button>
            <button type="button" onClick={publish} disabled={saving} className="px-3 py-2 rounded text-sm text-white inline-flex items-center gap-1" style={{ backgroundColor: "var(--accent)" }}><Send className="w-4 h-4" /> Publish Test</button>
          </div>
        </div>
      )}

      {generated && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Questions ({questions.length})</h2>
            <button onClick={addQuestion} className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
          </div>
          {questions.length === 0 && <p className="text-sm text-gray-500">No extracted questions. Add one manually.</p>}
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={idx} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input value={q.order} onChange={(e) => setQuestions((prev) => prev.map((row, i) => (i === idx ? { ...row, order: Number(e.target.value || idx + 1) } : row)))} type="number" min={1} className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  <input value={q.marks} onChange={(e) => setQuestions((prev) => prev.map((row, i) => (i === idx ? { ...row, marks: e.target.value } : row)))} type="number" min={0} step="0.5" className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  <select value={q.question_type} onChange={(e) => setQuestions((prev) => prev.map((row, i) => (i === idx ? { ...row, question_type: e.target.value } : row)))} className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="short">Short</option>
                    <option value="long">Long</option>
                    <option value="mcq">MCQ</option>
                  </select>
                </div>
                <textarea rows={2} value={q.prompt_text} onChange={(e) => setQuestions((prev) => prev.map((row, i) => (i === idx ? { ...row, prompt_text: e.target.value } : row)))} className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Question prompt" />
                <input value={q.correct_answer || ""} onChange={(e) => setQuestions((prev) => prev.map((row, i) => (i === idx ? { ...row, correct_answer: e.target.value } : row)))} className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Correct answer (for MCQ/short auto-marking)" />
              </div>
            ))}
          </div>
          <button type="button" onClick={saveQuestions} disabled={saving} className="px-3 py-2 rounded text-sm text-white bg-slate-700 inline-flex items-center gap-1"><Save className="w-4 h-4" /> Save Questions</button>
        </div>
      )}
    </div>
  );
}
