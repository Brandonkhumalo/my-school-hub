import React, { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth } from "../../context/AuthContext";
import { useSchoolSettings } from "../../context/SchoolSettingsContext";
import { canWritePage, isForbiddenError } from "../../utils/hrPermissions";

const DEFAULT_TERMS = ["Term 1", "Term 2", "Term 3"];
const emptyForm = {
  academic_year: "",
  academic_term: "Term 1",
  grade_levels: [],
  subject_ids: [],
  num_papers: 0,
  paper_numbers: [],
  paper_weights: {},
  num_tests: 0,
  num_assignments: 0,
  papers_weight: 0.6,
  tests_weight: 0.25,
  assignments_weight: 0.15,
  notes: "",
};

export default function AdminAssessmentPlans() {
  const { user } = useAuth();
  const { currentAcademicYear } = useSchoolSettings();
  const canWrite = canWritePage(user, "results");
  const [plans, setPlans] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState({ year: "", term: "", grade: "" });

  useEffect(() => {
    if (!currentAcademicYear) return;
    setForm((prev) => ({ ...prev, academic_year: String(currentAcademicYear) }));
    const nextFilter = { year: String(currentAcademicYear), term: "", grade: "" };
    setFilter(nextFilter);
    loadPlans(nextFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAcademicYear]);

  useEffect(() => {
    loadPlans();
    loadSubjects();
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlans = async (overrideFilter = null) => {
    setLoading(true);
    setForbidden(false);
    setLoadError("");
    try {
      const activeFilter = overrideFilter || filter;
      const params = {};
      if (activeFilter.year) params.year = activeFilter.year;
      if (activeFilter.term) params.term = activeFilter.term;
      if (activeFilter.grade) params.grade = activeFilter.grade;
      const data = await apiService.listAssessmentPlans(params);
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      if (isForbiddenError(err)) {
        setForbidden(true);
      } else {
        setLoadError(err.message || "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      const data = await apiService.fetchSubjects();
      setSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load subjects", err);
    }
  };

  const loadClasses = async () => {
    try {
      const data = await apiService.fetchClasses();
      setClasses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load classes", err);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      academic_year: String(currentAcademicYear || ""),
      academic_term: "Term 1",
      grade_levels: [],
    });
    setShowForm(true);
  };

  const openEdit = (plan) => {
    setEditingId(plan.id);
    setForm({
      academic_year: String(currentAcademicYear || plan.academic_year || ""),
      academic_term: plan.academic_term,
      grade_levels: (plan.grade_levels || []).map((g) => Number(g)),
      subject_ids: (plan.subjects_detail || []).map((s) => s.id),
      num_papers: plan.num_papers || 0,
      paper_numbers: plan.paper_numbers || [],
      paper_weights: plan.paper_weights || {},
      num_tests: plan.num_tests || 0,
      num_assignments: plan.num_assignments || 0,
      papers_weight: plan.papers_weight ?? 0.6,
      tests_weight: plan.tests_weight ?? 0.25,
      assignments_weight: plan.assignments_weight ?? 0.15,
      notes: plan.notes || "",
    });
    setShowForm(true);
  };

  const toggleGradeLevel = (level) => {
    setForm((f) => ({
      ...f,
      grade_levels: f.grade_levels.includes(level)
        ? f.grade_levels.filter((g) => g !== level)
        : [...f.grade_levels, level].sort((a, b) => a - b),
    }));
  };

  const toggleSubject = (id) => {
    setForm((f) => ({
      ...f,
      subject_ids: f.subject_ids.includes(id)
        ? f.subject_ids.filter((s) => s !== id)
        : [...f.subject_ids, id],
    }));
  };

  const togglePaperNumber = (n) => {
    setForm((f) => {
      const set = new Set(f.paper_numbers || []);
      if (set.has(n)) set.delete(n);
      else set.add(n);
      const arr = Array.from(set).sort((a, b) => a - b);
      return { ...f, paper_numbers: arr, num_papers: arr.length };
    });
  };

  const updateWeight = (paperNum, value) => {
    setForm((f) => ({
      ...f,
      paper_weights: { ...(f.paper_weights || {}), [paperNum]: value },
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.subject_ids.length === 0) {
      alert("Select at least one subject.");
      return;
    }
    // Coerce weights to floats (drop blanks) and validate sum if any provided
    const weights = {};
    let weightSum = 0;
    let hasAny = false;
    for (const n of form.paper_numbers || []) {
      const raw = form.paper_weights?.[n];
      if (raw !== "" && raw !== undefined && raw !== null) {
        const f = parseFloat(raw);
        if (!isNaN(f)) {
          weights[n] = f;
          weightSum += f;
          hasAny = true;
        }
      }
    }
    if (hasAny && Math.abs(weightSum - 1.0) > 0.01) {
      if (!confirm(`Per-paper weights sum to ${weightSum.toFixed(2)}, not 1.0. Save anyway?`)) return;
    }
    const compositeSum =
      parseFloat(form.papers_weight || 0) +
      parseFloat(form.tests_weight || 0) +
      parseFloat(form.assignments_weight || 0);
    if (Math.abs(compositeSum - 1.0) > 0.01) {
      alert(
        `Papers + Tests + Assignments weights must sum to 1.0 (currently ${compositeSum.toFixed(
          2
        )}).`
      );
      return;
    }
    const payload = {
      ...form,
      academic_year: String(currentAcademicYear || form.academic_year || ""),
      grade_levels: (form.grade_levels || []).map((g) => Number(g)).sort((a, b) => a - b),
      paper_weights: weights,
    };
    try {
      if (editingId) {
        await apiService.updateAssessmentPlan(editingId, payload);
      } else {
        await apiService.createAssessmentPlan(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm((prev) => ({ ...emptyForm, academic_year: String(currentAcademicYear || prev.academic_year || "") }));
      loadPlans();
    } catch (err) {
      alert("Failed to save plan: " + (err.message || "Unknown error"));
    }
  };

  const removePlan = async (plan) => {
    if (!confirm(`Delete plan for ${plan.academic_term} ${plan.academic_year}?`)) return;
    try {
      await apiService.deleteAssessmentPlan(plan.id);
      loadPlans();
    } catch (err) {
      alert("Failed to delete: " + (err.message || "Unknown error"));
    }
  };

  const availableGrades = useMemo(() => {
    return [...new Set((classes || []).map((c) => Number(c.grade_level)).filter((g) => Number.isInteger(g) && g > 0))]
      .sort((a, b) => a - b);
  }, [classes]);

  if (forbidden) {
    return (
      <div>
        <Header title="Assessment Plans" />
        <div className="p-6">
          <div className="bg-white rounded-lg shadow p-8 text-center border border-red-200">
            <i className="fas fa-lock text-4xl text-red-500 mb-3"></i>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Forbidden</h3>
            <p className="text-gray-600">You don't have permission to view this page. Contact your administrator to request access.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Assessment Plans" />
      <div className="p-6">
        {loadError && (
          <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
            Failed to load plans: {loadError}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600">Year</label>
            <div className="px-3 py-2 border rounded bg-gray-50 text-sm text-gray-700">
              {currentAcademicYear || "Not set"}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Term</label>
            <select
              value={filter.term}
              onChange={(e) => setFilter({ ...filter, term: e.target.value })}
              className="px-3 py-2 border rounded"
            >
              <option value="">All</option>
              {DEFAULT_TERMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Form/Grade</label>
            <select
              value={filter.grade}
              onChange={(e) => setFilter({ ...filter, grade: e.target.value })}
              className="px-3 py-2 border rounded"
            >
              <option value="">All</option>
              {availableGrades.map((g) => (
                <option key={g} value={String(g)}>Grade {g}</option>
              ))}
            </select>
          </div>
          <button onClick={loadPlans} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Apply
          </button>
          <button
            onClick={openCreate}
            disabled={!canWrite}
            title={canWrite ? "" : "You don't have write permission"}
            className={`ml-auto px-4 py-2 rounded text-white ${canWrite ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}`}
          >
            <i className="fas fa-plus mr-2"></i>New Plan
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No assessment plans yet. Click "New Plan" to define one.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Term</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Year</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Forms/Grades</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Subjects</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Papers</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tests</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Assign.</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Weights (P/T/A)</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">{p.academic_term}</td>
                    <td className="px-4 py-2">{p.academic_year}</td>
                    <td className="px-4 py-2 text-sm">
                      {(p.grade_levels || []).length > 0
                        ? p.grade_levels.map((g) => `Grade ${g}`).join(", ")
                        : "All Grades"}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {(p.subjects_detail || []).map((s) => s.name).join(", ")}
                    </td>
                    <td className="px-4 py-2">
                      {p.num_papers}
                      {p.effective_papers && p.effective_papers.length > 0 && (
                        <span className="ml-1 text-xs text-gray-500">
                          ({p.effective_papers.join(", ")})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{p.num_tests}</td>
                    <td className="px-4 py-2">{p.num_assignments}</td>
                    <td className="px-4 py-2 text-xs font-mono text-gray-700">
                      {Number(p.papers_weight ?? 0).toFixed(2)} /{" "}
                      {Number(p.tests_weight ?? 0).toFixed(2)} /{" "}
                      {Number(p.assignments_weight ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        disabled={!canWrite}
                        title={canWrite ? "" : "You don't have write permission"}
                        className={`mr-3 ${canWrite ? "text-blue-600 hover:underline" : "text-gray-400 cursor-not-allowed"}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removePlan(p)}
                        disabled={!canWrite}
                        title={canWrite ? "" : "You don't have write permission"}
                        className={canWrite ? "text-red-600 hover:underline" : "text-gray-400 cursor-not-allowed"}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form
              onSubmit={submit}
              className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
            >
              <h3 className="text-lg font-semibold mb-4">
                {editingId ? "Edit Assessment Plan" : "New Assessment Plan"}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Academic Year</label>
                  <input
                    type="text"
                    required
                    value={form.academic_year}
                    readOnly
                    className="w-full px-3 py-2 border rounded bg-gray-50 text-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">Taken from School Settings.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Term</label>
                  <select
                    required
                    value={form.academic_term}
                    onChange={(e) => setForm({ ...form, academic_term: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    {DEFAULT_TERMS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Forms/Grades <span className="text-gray-500 font-normal">(select one, many, or none for all)</span>
                </label>
                <div className="max-h-40 overflow-y-auto border rounded p-2 grid grid-cols-3 gap-1">
                  {availableGrades.map((g) => (
                    <label key={g} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        checked={form.grade_levels.includes(g)}
                        onChange={() => toggleGradeLevel(g)}
                      />
                      Grade {g}
                    </label>
                  ))}
                  {availableGrades.length === 0 && (
                    <div className="text-sm text-gray-500 col-span-3">No classes/forms available</div>
                  )}
                </div>
                {(form.grade_levels || []).length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">No selection means this plan applies to all grades.</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Subjects <span className="text-gray-500 font-normal">(select one or more)</span>
                </label>
                <div className="max-h-48 overflow-y-auto border rounded p-2 grid grid-cols-2 gap-1">
                  {subjects.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        checked={form.subject_ids.includes(s.id)}
                        onChange={() => toggleSubject(s.id)}
                      />
                      {s.name} <span className="text-gray-400">({s.code})</span>
                    </label>
                  ))}
                  {subjects.length === 0 && (
                    <div className="text-sm text-gray-500 col-span-2">No subjects available</div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Exam Papers Written <span className="text-gray-500 font-normal">(up to 6)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6].map((n) => {
                    const active = (form.paper_numbers || []).includes(n);
                    return (
                      <button
                        type="button"
                        key={n}
                        onClick={() => togglePaperNumber(n)}
                        className={`px-3 py-1 rounded border ${
                          active
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-300"
                        }`}
                      >
                        Paper {n}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {(form.paper_numbers || []).length} paper(s)
                </p>
              </div>

              {(form.paper_numbers || []).length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Paper Weights{" "}
                    <span className="text-gray-500 font-normal">
                      (optional — leave blank for equal weights; must sum to 1.0 if used)
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(form.paper_numbers || []).map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-sm w-16">Paper {n}</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          placeholder="e.g. 0.25"
                          value={form.paper_weights?.[n] ?? ""}
                          onChange={(e) => updateWeight(n, e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Number of Tests</label>
                  <input
                    type="number"
                    min="0"
                    value={form.num_tests}
                    onChange={(e) =>
                      setForm({ ...form, num_tests: parseInt(e.target.value || "0", 10) })
                    }
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Number of Assignments</label>
                  <input
                    type="number"
                    min="0"
                    value={form.num_assignments}
                    onChange={(e) =>
                      setForm({ ...form, num_assignments: parseInt(e.target.value || "0", 10) })
                    }
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div className="mb-4 p-3 rounded border border-amber-300 bg-amber-50">
                <div className="flex items-baseline justify-between mb-2">
                  <label className="block text-sm font-semibold">
                    Final Mark Weights
                  </label>
                  <span
                    className={`text-xs font-mono ${
                      Math.abs(
                        parseFloat(form.papers_weight || 0) +
                          parseFloat(form.tests_weight || 0) +
                          parseFloat(form.assignments_weight || 0) -
                          1
                      ) > 0.01
                        ? "text-red-600"
                        : "text-green-700"
                    }`}
                  >
                    sum ={" "}
                    {(
                      parseFloat(form.papers_weight || 0) +
                      parseFloat(form.tests_weight || 0) +
                      parseFloat(form.assignments_weight || 0)
                    ).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  How much each component contributes to the final subject mark. Must
                  sum to 1.00. Example: Papers 0.6, Tests 0.25, Assignments 0.15.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Papers</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={form.papers_weight}
                      onChange={(e) =>
                        setForm({ ...form, papers_weight: e.target.value })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Tests</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={form.tests_weight}
                      onChange={(e) =>
                        setForm({ ...form, tests_weight: e.target.value })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Assignments
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={form.assignments_weight}
                      onChange={(e) =>
                        setForm({ ...form, assignments_weight: e.target.value })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <textarea
                  rows="2"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Any guidance for teachers"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingId ? "Save Changes" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
