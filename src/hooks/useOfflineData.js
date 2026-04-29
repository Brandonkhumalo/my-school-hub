import { useState, useEffect } from "react";

/**
 * Returns { online, queueCount } for use in any component that wants
 * to show offline-aware UI (e.g. disable submit buttons, show warnings).
 */
export function useOfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

/**
 * Wraps an async API call with offline-safe submit logic.
 * Returns { submit, loading, queued, error }
 *
 * Usage:
 *   const { submit, loading, queued } = useOfflineSubmit(
 *     (data) => apiService.submitAssignment(id, data)
 *   );
 */
export function useOfflineSubmit(apiFn, options = {}) {
  const { onSuccess, onError } = options;
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (data) => {
    setLoading(true);
    setError(null);
    setQueued(false);
    try {
      const result = await apiFn(data);
      if (result?.queued) {
        setQueued(true);
        onSuccess?.(result, true);
      } else {
        onSuccess?.(result, false);
      }
      return result;
    } catch (err) {
      setError(err.message || "Request failed");
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, queued, error };
}
