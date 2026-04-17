import React, { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate } from "../../utils/dateFormat";

const STATUS_OPTIONS = ["pending", "in_progress", "resolved"];

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [statusValue, setStatusValue] = useState("pending");
  const [savingStatus, setSavingStatus] = useState(false);

  const loadComplaints = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.fetchComplaints();
      setComplaints(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching complaints:", error);
      setComplaints([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  const sortedComplaints = useMemo(
    () => [...complaints].sort((a, b) => new Date(b.date_submitted) - new Date(a.date_submitted)),
    [complaints]
  );

  const openComplaint = async (complaintId) => {
    try {
      const detail = await apiService.getComplaintDetail(complaintId);
      setSelectedComplaint(detail);
      setStatusValue(detail?.status || "pending");
    } catch (error) {
      console.error("Error loading complaint detail:", error);
      alert(error.message || "Failed to load complaint details.");
    }
  };

  const saveStatus = async () => {
    if (!selectedComplaint) return;
    try {
      setSavingStatus(true);
      const updated = await apiService.updateComplaint(selectedComplaint.id, { status: statusValue });
      setSelectedComplaint(updated);
      setComplaints((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, status: updated.status } : item))
      );
    } catch (error) {
      console.error("Error updating complaint status:", error);
      alert(error.message || "Failed to update complaint status.");
    } finally {
      setSavingStatus(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Complaints" />
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {sortedComplaints.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Submitted By</th>
                    <th className="p-3">Student</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Message</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedComplaints.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => openComplaint(item.id)}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="p-3">{formatDate(item.date_submitted)}</td>
                      <td className="p-3">{item.submitted_by_name || "Unknown"}</td>
                      <td className="p-3">{item.student_name || "-"}</td>
                      <td className="p-3 capitalize">{item.complaint_type || "general"}</td>
                      <td className="p-3 max-w-md truncate">{item.description || "-"}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 capitalize">
                          {item.status || "pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No complaints available.</p>
          )}
        </div>
      </div>

      {selectedComplaint && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Complaint #{selectedComplaint.id}</h3>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Type:</span> <span className="capitalize">{selectedComplaint.complaint_type || "general"}</span></p>
              <p><span className="font-semibold">Submitted By:</span> {selectedComplaint.submitted_by_name || "Unknown"}</p>
              <p><span className="font-semibold">Student:</span> {selectedComplaint.student_name || "-"}</p>
              <p><span className="font-semibold">Title:</span> {selectedComplaint.title || "-"}</p>
              <p><span className="font-semibold">Message:</span></p>
              <p className="p-3 bg-gray-50 rounded border text-gray-700 whitespace-pre-wrap">{selectedComplaint.description || "-"}</p>
              <p><span className="font-semibold">Date Submitted:</span> {formatDate(selectedComplaint.date_submitted)}</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
              </select>
              <button
                onClick={saveStatus}
                disabled={savingStatus}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
              >
                {savingStatus ? "Saving..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
