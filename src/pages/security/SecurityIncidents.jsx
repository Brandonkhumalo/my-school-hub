import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";

const INCIDENT_TYPES = ["theft", "trespass", "fight", "damage", "other"];

export default function SecurityIncidents() {
  const [loading, setLoading] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [form, setForm] = useState({
    incident_type: "other",
    title: "",
    description: "",
    location: "",
    date_of_incident: new Date().toISOString().slice(0, 16),
  });

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const data = await apiService.getIncidentReports();
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
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await apiService.createIncidentReport(form);
      setForm({
        incident_type: "other",
        title: "",
        description: "",
        location: "",
        date_of_incident: new Date().toISOString().slice(0, 16),
      });
      loadIncidents();
    } catch (error) {
      alert(error.message || "Failed to submit incident");
    }
  };

  const statusClasses = {
    open: "bg-red-100 text-red-700",
    investigating: "bg-yellow-100 text-yellow-700",
    closed: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div>
      <Header title="Security Incidents" />
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Report Incident</h3>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select className="border rounded px-3 py-2" value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })}>
              {INCIDENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input required placeholder="Incident title" className="border rounded px-3 py-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input placeholder="Location" className="border rounded px-3 py-2" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <input type="datetime-local" required className="border rounded px-3 py-2" value={form.date_of_incident} onChange={(e) => setForm({ ...form, date_of_incident: e.target.value })} />
            <textarea required rows={4} placeholder="Description" className="md:col-span-2 border rounded px-3 py-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button type="submit" className="md:col-span-2 bg-red-600 text-white rounded px-4 py-2 hover:bg-red-700">Submit Incident</button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">My Incident Reports</h3>
          {loading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Title</th>
                    <th className="text-left px-3 py-2">Location</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {incidents.map((incident) => (
                    <tr key={incident.id}>
                      <td className="px-3 py-2">{formatDate(incident.date_of_incident)}</td>
                      <td className="px-3 py-2 capitalize">{incident.incident_type}</td>
                      <td className="px-3 py-2">{incident.title}</td>
                      <td className="px-3 py-2">{incident.location || "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs capitalize ${statusClasses[incident.status] || "bg-gray-100 text-gray-700"}`}>
                          {incident.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {incidents.length === 0 && <p className="text-center py-6 text-gray-500">No incidents reported yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
