import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import toast from "react-hot-toast";

function formatSecs(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function TakeTest() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.getStudentAttemptDetail(attemptId);
        setAttempt(res);
        setRemaining(Number(res?.remaining_seconds || 0));
      } catch (err) {
        toast.error(err.message || "Failed to open test.");
        navigate("/student/tests");
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId, navigate]);

  useEffect(() => {
    if (!attempt || submitting) return undefined;
    if (remaining <= 0) {
      submitAttempt(true);
      return undefined;
    }
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [attempt, remaining, submitting]);

  const questionRows = useMemo(() => attempt?.questions || [], [attempt]);

  async function submitAttempt(auto = false) {
    if (!attempt || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: questionRows.map((q) => ({
          question_id: q.id,
          answer_text: answers[q.id] || "",
        })),
      };
      await apiService.submitStudentAttempt(attempt.attempt_id, payload);
      toast.success(auto ? "Time is up. Test submitted." : "Test submitted.");
      navigate("/student/tests");
    } catch (err) {
      toast.error(err.message || "Submit failed.");
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!attempt) return null;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{attempt.title}</h1>
          <p className="text-xs text-gray-500">Attempt #{attempt.attempt_id}</p>
        </div>
        <div className={`text-lg font-bold ${remaining < 120 ? "text-red-600" : "text-[var(--accent)]"}`}>{formatSecs(remaining)}</div>
      </div>

      <div className="space-y-3">
        {questionRows.map((q, idx) => (
          <div key={q.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Q{idx + 1}. {q.prompt_text} <span className="text-xs text-gray-500">({q.marks} marks)</span>
            </p>
            {q.question_type === "mcq" && Array.isArray(q.options) && q.options.length > 0 ? (
              <div className="space-y-1">
                {q.options.map((opt, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={(answers[q.id] || "") === String(opt)}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: String(opt) }))}
                    />
                    <span>{String(opt)}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                rows={q.question_type === "long" ? 6 : 3}
                value={answers[q.id] || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Type your answer..."
              />
            )}
          </div>
        ))}
      </div>

      <div className="pb-8">
        <button onClick={() => submitAttempt(false)} disabled={submitting} className="px-4 py-2 rounded text-white text-sm" style={{ backgroundColor: "var(--accent)" }}>
          {submitting ? "Submitting..." : "Submit Test"}
        </button>
      </div>
    </div>
  );
}
