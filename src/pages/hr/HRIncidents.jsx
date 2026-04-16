import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";

const STATUSES = ["open", "investigating", "closed"];

export default function HRIncidents() {
  const [loading, setLoading] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const data = await apiService.getIncidentReports(statusFilter ? { status: statusFilter } : {});
      setIncidents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load incidents", error);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [statusFilter]);

  const saveIncident = async () => {
    if (!editing) return;
    try {
      await apiService.updateIncidentReport(editing.id, {
        status: editing.status,
        action_taken: editing.action_taken || "",
      });
      setEditing(null);
      loadIncidents();
    } catch (error) {
      alert(error.message || "Failed to update incident");
    }
  };

  return (
    <div>
      <Header title="HR Incident Reports" />
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-4">
          <label className="text-sm font-medium mr-2">Status Filter</label>
          <select className="border rounded px-3 py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {loading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Title</th>
                    <th className="text-left px-3 py-2">Reported By</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {incidents.map((incident) => (
                    <tr key={incident.id}>
                      <td className="px-3 py-2">{formatDate(incident.date_of_incident)}</td>
                      <td className="px-3 py-2 capitalize">{incident.incident_type}</td>
                      <td className="px-3 py-2">{incident.title}</td>
                      <td className="px-3 py-2">{incident.reported_by_name || "-"}</td>
                      <td className="px-3 py-2 capitalize">{incident.status}</td>
                      <td className="px-3 py-2">
                        <button className="text-blue-600 hover:text-blue-800" onClick={() => setEditing(incident)}>
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {incidents.length === 0 && <p className="text-center py-6 text-gray-500">No incidents found.</p>}
            </div>
          )}
        </div>

        {editing && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Update Incident: {editing.title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <select className="border rounded px-3 py-2" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <input className="border rounded px-3 py-2" placeholder="Action taken" value={editing.action_taken || ""} onChange={(e) => setEditing({ ...editing, action_taken: e.target.value })} />
            </div>
            <div className="flex gap-3">
              <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" onClick={saveIncident}>Save</button>
              <button className="border px-4 py-2 rounded hover:bg-gray-50" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
