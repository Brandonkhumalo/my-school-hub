import React, { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import apiService from "../../services/apiService";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function StudentTests() {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState([]);
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.getStudentTests();
        setTests(res?.tests || []);
      } catch (err) {
        toast.error(err.message || "Failed to load tests.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function startTest(testId) {
    setStartingId(testId);
    try {
      const res = await apiService.startStudentTest(testId);
      const attemptId = res?.attempt_id;
      if (!attemptId) {
        toast.error("Could not start test.");
        return;
      }
      window.location.href = `/student/tests/${attemptId}/take`;
    } catch (err) {
      toast.error(err.message || "Could not start test.");
    } finally {
      setStartingId(null);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-7 h-7 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tests</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        {tests.length === 0 ? (
          <p className="text-sm text-gray-500">No available tests right now.</p>
        ) : (
          <div className="space-y-2">
            {tests.map((t) => (
              <div key={t.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.title}</p>
                  <p className="text-xs text-gray-500">{t.subject_name} · {t.duration_minutes} min · / {t.total_marks} · {t.academic_term} {t.academic_year}</p>
                  <p className="text-xs mt-1 text-gray-600 dark:text-gray-300">Status: {t.status}</p>
                </div>
                <div>
                  {t.status === "submitted" || t.status === "graded" || t.status === "finalized" ? (
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">Submitted</span>
                  ) : (
                    <button onClick={() => startTest(t.id)} disabled={startingId === t.id} className="px-3 py-1 text-xs rounded text-white" style={{ backgroundColor: "var(--accent)" }}>
                      {startingId === t.id ? "Starting..." : (t.status === "in_progress" ? "Resume" : "Start Test")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
