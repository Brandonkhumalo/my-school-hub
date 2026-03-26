import React, { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { formatDateShort } from "../../utils/dateFormat";

const STATUS_COLORS = { present: "green", absent: "red", late: "yellow" };

export default function StudentAttendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [year, setYear] = useState("");

  const load = () => {
    setLoading(true);
    const params = {};
    if (term) params.term = term;
    if (year) params.year = year;
    apiService.getStudentAttendance(params)
      .then(setData)
      .catch(() => setError("Failed to load attendance"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [term, year]);

  const stats = data?.stats;
  const records = data?.records || [];

  const statCards = stats ? [
    { label: "Total Days", value: stats.total_days, color: "blue" },
    { label: "Present", value: stats.present, color: "green" },
    { label: "Absent", value: stats.absent, color: "red" },
    { label: "Late", value: stats.late, color: "yellow" },
    { label: "Attendance %", value: `${stats.attendance_percentage}%`, color: stats.attendance_percentage >= 80 ? "green" : "red" },
  ] : [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Attendance</h1>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select className="border rounded px-3 py-2 text-sm"
          value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="">All Terms</option>
          {["Term 1", "Term 2", "Term 3"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input type="number" placeholder="Year e.g. 2025" min="2020" max="2030"
          className="border rounded px-3 py-2 text-sm w-40"
          value={year} onChange={(e) => setYear(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {statCards.map((c) => (
              <div key={c.label} className={`bg-white rounded-lg shadow p-4 border-t-4 border-${c.color}-500 text-center`}>
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-2xl font-bold text-${c.color}-600`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Circular progress ring */}
          {stats && (
            <div className="flex justify-center mb-8">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={stats.attendance_percentage >= 80 ? "#16a34a" : "#dc2626"}
                    strokeWidth="3"
                    strokeDasharray={`${stats.attendance_percentage} 100`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-800">{stats.attendance_percentage}%</span>
                  <span className="text-xs text-gray-500">Attendance</span>
                </div>
              </div>
            </div>
          )}

          {/* Records */}
          {records.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No attendance records found</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((r) => {
                    const c = STATUS_COLORS[r.status] || "gray";
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">
                          {formatDateShort(r.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${c}-100 text-${c}-700`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.remarks || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
