import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";

export default function SecurityVisitorLog() {
  const today = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = useState(today);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({
    visitor_name: "",
    visitor_id_number: "",
    purpose: "",
    host_name: "",
    vehicle_reg: "",
    notes: "",
  });

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await apiService.getVisitorLogs({ date: dateFilter });
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

  const submit = async (e) => {
    e.preventDefault();
    try {
      await apiService.logVisitor(form);
      setForm({ visitor_name: "", visitor_id_number: "", purpose: "", host_name: "", vehicle_reg: "", notes: "" });
      loadLogs();
    } catch (error) {
      alert(error.message || "Failed to log visitor");
    }
  };

  const checkOut = async (id) => {
    try {
      await apiService.checkOutVisitor(id);
      loadLogs();
    } catch (error) {
      alert(error.message || "Failed to check out visitor");
    }
  };

  return (
    <div>
      <Header title="Visitor Log" />
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Log Visitor Entry</h3>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input required placeholder="Visitor name" className="border rounded px-3 py-2" value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} />
            <input placeholder="ID number" className="border rounded px-3 py-2" value={form.visitor_id_number} onChange={(e) => setForm({ ...form, visitor_id_number: e.target.value })} />
            <input required placeholder="Purpose" className="border rounded px-3 py-2" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            <input placeholder="Host name" className="border rounded px-3 py-2" value={form.host_name} onChange={(e) => setForm({ ...form, host_name: e.target.value })} />
            <input placeholder="Vehicle reg" className="border rounded px-3 py-2" value={form.vehicle_reg} onChange={(e) => setForm({ ...form, vehicle_reg: e.target.value })} />
            <input placeholder="Notes" className="border rounded px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button type="submit" className="md:col-span-3 bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">Save Entry</button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Daily Register</h3>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="border rounded px-3 py-2" />
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
                    <th className="text-left px-3 py-2">Action</th>
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
                      <td className="px-3 py-2">
                        {!log.check_out_time ? (
                          <button className="bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700" onClick={() => checkOut(log.id)}>
                            Check Out
                          </button>
                        ) : (
                          <span className="text-emerald-700">Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && <p className="text-gray-500 py-6 text-center">No visitor logs for selected date.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
