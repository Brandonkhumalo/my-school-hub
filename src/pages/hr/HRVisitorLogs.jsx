import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";

export default function HRVisitorLogs() {
  const today = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = useState(today);
  const [nameFilter, setNameFilter] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await apiService.getVisitorLogs({ date: dateFilter, visitor_name: nameFilter });
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load visitor logs", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [dateFilter]);

  return (
    <div>
      <Header title="HR Visitor Logs" />
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="border rounded px-3 py-2" />
          <input value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} placeholder="Search visitor name" className="border rounded px-3 py-2" />
          <button onClick={loadLogs} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Apply</button>
        </div>

        {loading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Visitor</th>
                  <th className="text-left px-3 py-2">Purpose</th>
                  <th className="text-left px-3 py-2">Host</th>
                  <th className="text-left px-3 py-2">Check In</th>
                  <th className="text-left px-3 py-2">Check Out</th>
                  <th className="text-left px-3 py-2">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2">{log.visitor_name}</td>
                    <td className="px-3 py-2">{log.purpose}</td>
                    <td className="px-3 py-2">{log.host_name || "-"}</td>
                    <td className="px-3 py-2">{formatDate(log.check_in_time)}</td>
                    <td className="px-3 py-2">{log.check_out_time ? formatDate(log.check_out_time) : "-"}</td>
                    <td className="px-3 py-2">{log.logged_by_name || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <p className="text-center py-6 text-gray-500">No visitor logs found.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
