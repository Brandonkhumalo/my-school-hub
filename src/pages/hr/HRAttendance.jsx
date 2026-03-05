import React, { useEffect, useState } from "react";
import apiService from "../../services/apiService";

export default function HRAttendance() {
  const [records, setRecords] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [marking, setMarking] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      apiService.getStaffAttendance({ date }),
      apiService.getStaffList(),
    ])
      .then(([att, st]) => { setRecords(att); setStaffList(st); })
      .catch(() => setError("Failed to load attendance"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [date]);

  const getStatus = (staffId) => {
    const r = records.find((r) => r.staff === staffId || r.staff_id === staffId);
    return r?.status || null;
  };

  const handleMark = async (staffId, status) => {
    setMarking((m) => ({ ...m, [staffId]: true }));
    try {
      await apiService.markStaffAttendance({ staff: staffId, date, status });
      setSuccess("Attendance marked");
      load();
    } catch {
      setError("Failed to mark attendance");
    } finally {
      setMarking((m) => ({ ...m, [staffId]: false }));
    }
  };

  const statusColor = (s) =>
    s === "present" ? "green" : s === "absent" ? "red" : s === "late" ? "yellow" : "gray";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Staff Attendance</h1>
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-3">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-3">{success}</div>}

      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm text-gray-600">Date:</label>
        <input type="date" className="border rounded px-3 py-2 text-sm"
          value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Staff Member</th>
                <th className="px-4 py-3 text-left">Position</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Mark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staffList.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No staff found</td></tr>
              ) : staffList.map((s) => {
                const status = getStatus(s.id);
                const c = statusColor(status);
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {s.user?.first_name} {s.user?.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{s.position}</td>
                    <td className="px-4 py-3">
                      {status ? (
                        <span className={`px-2 py-1 rounded-full text-xs bg-${c}-100 text-${c}-700`}>
                          {status}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Not marked</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {["present", "absent", "late"].map((st) => (
                          <button key={st} disabled={marking[s.id]}
                            onClick={() => handleMark(s.id, st)}
                            className={`px-2 py-1 rounded text-xs font-medium border
                              ${status === st
                                ? `bg-${statusColor(st)}-600 text-white border-transparent`
                                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"}`}>
                            {st.charAt(0).toUpperCase() + st.slice(1)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
