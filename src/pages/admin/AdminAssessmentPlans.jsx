import React, { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

const DEFAULT_TERMS = ["Term 1", "Term 2", "Term 3"];
const emptyForm = {
  academic_year: new Date().getFullYear().toString(),
  academic_term: "Term 1",
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
  const [plans, setPlans] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState({ year: "", term: "" });

  useEffect(() => {
    loadPlans();
    loadSubjects();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.year) params.year = filter.year;
      if (filter.term) params.term = filter.term;
      const data = await apiService.listAssessmentPlans(params);
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      alert("Failed to load plans: " + (err.message || "Unknown error"));
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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (plan) => {
    setEditingId(plan.id);
    setForm({
      academic_year: plan.academic_year,
      academic_term: plan.academic_term,
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
    const payload = { ...form, paper_weights: weights };
    try {
      if (editingId) {
        await apiService.updateAssessmentPlan(editingId, payload);
      } else {
        await apiService.createAssessmentPlan(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
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

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1].map(String);
  }, []);

  return (
    <div>
      <Header title="Assessment Plans" />
      <div className="p-6">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600">Year</label>
            <select
              value={filter.year}
              onChange={(e) => setFilter({ ...filter, year: e.target.value })}
              className="px-3 py-2 border rounded"
            >
              <option value="">All</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
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
          <button onClick={loadPlans} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Apply
          </button>
          <button
            onClick={openCreate}
            className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
                        className="text-blue-600 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removePlan(p)}
                        className="text-red-600 hover:underline"
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
                    onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
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
