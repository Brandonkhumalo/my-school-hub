import React, { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import apiService from "../../services/apiService";
import toast from "react-hot-toast";

export default function TestResults() {
  const [tests, setTests] = useState([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsPage, setTestsPage] = useState(1);
  const [testsPageSize] = useState(25);
  const [testsPagination, setTestsPagination] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("-updated_at");
  const [testId, setTestId] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [draftAnswers, setDraftAnswers] = useState([]);

  useEffect(() => {
    loadTests(1);
  }, [statusFilter, ordering]);

  const filteredTests = useMemo(() => tests, [tests]);

  async function loadTests(page = testsPage) {
    setTestsLoading(true);
    try {
      const res = await apiService.listTeacherTests({
        page,
        page_size: testsPageSize,
        status: statusFilter || undefined,
        q: search || undefined,
        ordering,
      });
      setTests(res?.tests || []);
      setTestsPagination(res?.pagination || null);
      setTestsPage((res?.pagination?.page) || page);
    } catch (err) {
      toast.error(err.message || "Failed to load tests.");
    } finally {
      setTestsLoading(false);
    }
  }

  async function loadAttempts() {
    if (!testId) return;
    setLoading(true);
    try {
      const res = await apiService.getTeacherTestAttempts(testId);
      setAttempts(res?.attempts || []);
      setActiveAttempt(null);
      setDraftAnswers([]);
    } catch (err) {
      toast.error(err.message || "Failed to load attempts.");
    } finally {
      setLoading(false);
    }
  }

  async function openAttempt(attemptId) {
    try {
      const res = await apiService.getTeacherAttemptDetail(attemptId);
      setActiveAttempt(res);
      setDraftAnswers(
        (res?.questions || []).map((q) => ({
          question_id: q.question_id,
          awarded_marks: q.awarded_marks ?? 0,
          teacher_comment: q.teacher_comment || "",
          question_type: q.question_type,
        }))
      );
    } catch (err) {
      toast.error(err.message || "Failed to load attempt details.");
    }
  }

  async function markAttempt(attempt, finalize) {
    try {
      const payloadAnswers = draftAnswers
        .filter((row) => row.question_type === "long")
        .map((row) => ({
          question_id: row.question_id,
          awarded_marks: Number(row.awarded_marks || 0),
          teacher_comment: row.teacher_comment || "",
        }));
      const res = await apiService.gradeTeacherTestAttempt(attempt.id, {
        answers: payloadAnswers,
        finalize,
      });
      setAttempts((prev) => prev.map((a) => (a.id === attempt.id ? { ...a, ...res } : a)));
      if (activeAttempt?.attempt_id === attempt.id) {
        setActiveAttempt((prev) => (prev ? { ...prev, ...res, status: res.status } : prev));
      }
      toast.success(finalize ? "Attempt finalized." : "Attempt graded.");
    } catch (err) {
      toast.error(err.message || "Failed to grade attempt.");
    }
  }

  async function finalizeTest() {
    if (!testId) return;
    try {
      const res = await apiService.finalizeTeacherTest(testId);
      toast.success(res?.message || "Results finalized.");
      await loadAttempts();
    } catch (err) {
      toast.error(err.message || "Finalize failed.");
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="w-7 h-7 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Results</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tests by title or subject"
              className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={ordering}
              onChange={(e) => setOrdering(e.target.value)}
              className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
            >
              <option value="-updated_at">Newest first</option>
              <option value="updated_at">Oldest first</option>
              <option value="title">Title A-Z</option>
              <option value="-title">Title Z-A</option>
              <option value="status">Status A-Z</option>
            </select>
            <button onClick={() => loadTests(1)} className="px-3 py-2 rounded text-white text-sm bg-slate-600">
              Refresh Tests
            </button>
          </div>
          <div className="max-h-56 overflow-auto border border-gray-100 dark:border-gray-700 rounded-lg">
            {testsLoading ? (
              <p className="text-sm text-gray-500 p-3">Loading tests...</p>
            ) : filteredTests.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">No tests found.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredTests.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTestId(String(t.id));
                      setAttempts([]);
                      setActiveAttempt(null);
                    }}
                    className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 ${String(testId) === String(t.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      #{t.id} {t.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.subject_name} · {t.status} · {t.academic_term} {t.academic_year} · attempts: {t.attempts_count}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {testsPagination && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Page {testsPagination.page} of {testsPagination.total_pages} · total {testsPagination.total}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!testsPagination.has_prev}
                  onClick={() => loadTests(testsPagination.page - 1)}
                  className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={!testsPagination.has_next}
                  onClick={() => loadTests(testsPagination.page + 1)}
                  className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={testId}
            onChange={(e) => setTestId(e.target.value)}
            placeholder="Selected Test ID"
            className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          />
          <button onClick={loadAttempts} className="px-3 py-2 rounded text-white text-sm" style={{ backgroundColor: "var(--accent)" }}>
            Load Attempts
          </button>
          <button onClick={finalizeTest} className="px-3 py-2 rounded text-white text-sm bg-slate-700">
            Finalize To Report Results
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : attempts.length === 0 ? (
          <p className="text-sm text-gray-500">No attempts loaded yet.</p>
        ) : (
          <div className="space-y-2">
            {attempts.map((a) => (
              <div key={a.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{a.student_name}</p>
                <p className="text-xs text-gray-500">Status: {a.status} · Auto: {a.auto_score || 0} · Manual: {a.manual_score || 0} · Final: {a.final_score || 0}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button onClick={() => openAttempt(a.id)} className="px-2 py-1 text-xs text-white rounded bg-indigo-600">Open Answers</button>
                  <button onClick={() => markAttempt(a, false)} className="px-2 py-1 text-xs text-white rounded bg-slate-600">Mark Reviewed</button>
                  <button onClick={() => markAttempt(a, true)} className="px-2 py-1 text-xs text-white rounded bg-emerald-600">Finalize Attempt</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeAttempt && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Grading: {activeAttempt.student_name} ({activeAttempt.test_title})
          </h2>
          <p className="text-xs text-gray-500">
            Auto: {activeAttempt.auto_score || 0} · Manual: {activeAttempt.manual_score || 0} · Final: {activeAttempt.final_score || 0}
          </p>
          <div className="space-y-3">
            {(activeAttempt.questions || []).map((q, idx) => (
              <div key={q.question_id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Q{idx + 1} ({q.question_type}) · {q.marks} marks
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{q.prompt_text}</p>
                <p className="text-xs text-gray-500">
                  Student answer: {q.student_answer || "No answer"}
                </p>
                {q.correct_answer ? (
                  <p className="text-xs text-gray-500">Model answer: {q.correct_answer}</p>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={q.marks}
                    disabled={q.question_type !== "long"}
                    value={draftAnswers.find((a) => a.question_id === q.question_id)?.awarded_marks ?? 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraftAnswers((prev) =>
                        prev.map((row) => (row.question_id === q.question_id ? { ...row, awarded_marks: value } : row))
                      );
                    }}
                    className="px-2 py-1 border rounded text-sm disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <input
                    disabled={q.question_type !== "long"}
                    placeholder="Teacher comment"
                    value={draftAnswers.find((a) => a.question_id === q.question_id)?.teacher_comment || ""}
                    onChange={(e) =>
                      setDraftAnswers((prev) =>
                        prev.map((row) => (row.question_id === q.question_id ? { ...row, teacher_comment: e.target.value } : row))
                      )
                    }
                    className="px-2 py-1 border rounded text-sm disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
