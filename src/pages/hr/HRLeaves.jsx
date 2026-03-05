import React, { useEffect, useState } from "react";
import apiService from "../../services/apiService";

const STATUS_COLORS = { pending: "yellow", approved: "green", rejected: "red" };

export default function HRLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    apiService.getLeaves()
      .then(setLeaves)
      .catch(() => setError("Failed to load leave requests"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = filterStatus ? leaves.filter((l) => l.status === filterStatus) : leaves;

  const handleReview = async (action) => {
    try {
      await apiService.reviewLeave(reviewing.id, { action, notes: reviewNote });
      setSuccess(`Leave ${action}d successfully.`);
      setReviewing(null);
      setReviewNote("");
      load();
    } catch {
      setError("Failed to review leave");
    }
  };

  const badge = (status) => {
    const c = STATUS_COLORS[status] || "gray";
    return `px-2 py-1 rounded-full text-xs font-medium bg-${c}-100 text-${c}-700`;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Leave Requests</h1>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-3">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-3">{success}</div>}

      <div className="mb-4">
        <select className="border rounded px-3 py-2 text-sm"
          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Staff</th>
                <th className="px-4 py-3 text-left">Leave Type</th>
                <th className="px-4 py-3 text-left">From</th>
                <th className="px-4 py-3 text-left">To</th>
                <th className="px-4 py-3 text-left">Days</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No leave requests</td></tr>
              ) : filtered.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{l.staff_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{l.leave_type}</td>
                  <td className="px-4 py-3 text-gray-600">{l.start_date}</td>
                  <td className="px-4 py-3 text-gray-600">{l.end_date}</td>
                  <td className="px-4 py-3 text-gray-600">{l.total_days ?? "—"}</td>
                  <td className="px-4 py-3"><span className={badge(l.status)}>{l.status}</span></td>
                  <td className="px-4 py-3">
                    {l.status === "pending" && (
                      <button onClick={() => { setReviewing(l); setReviewNote(""); }}
                        className="text-blue-600 hover:text-blue-800 text-xs">Review</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm relative">
            <button onClick={() => setReviewing(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <h2 className="text-lg font-bold mb-3">Review Leave — {reviewing.staff_name}</h2>
            <p className="text-sm text-gray-600 mb-1">
              {reviewing.leave_type} · {reviewing.start_date} to {reviewing.end_date}
            </p>
            {reviewing.reason && <p className="text-sm text-gray-500 mb-3 italic">"{reviewing.reason}"</p>}
            <textarea
              className="border rounded w-full p-2 text-sm mb-4"
              rows={3}
              placeholder="Notes (optional)"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => handleReview("approve")}
                className="flex-1 bg-green-600 text-white rounded py-2 text-sm hover:bg-green-700">
                Approve
              </button>
              <button onClick={() => handleReview("reject")}
                className="flex-1 bg-red-600 text-white rounded py-2 text-sm hover:bg-red-700">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
