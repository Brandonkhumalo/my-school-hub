import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate } from "../../utils/dateFormat";

export default function AdminDiscipline() {
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState({ severity: "", resolved: "" });
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState({
    student_id: "",
    incident_type: "",
    severity: "minor",
    description: "",
    action_taken: "",
    date_of_incident: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.severity) params.severity = filter.severity;
      if (filter.resolved) params.is_resolved = filter.resolved;
      const [recordsData, studentsData] = await Promise.all([
        apiService.getDisciplinaryRecords(params).catch(() => []),
        apiService.fetchStudents().catch(() => []),
      ]);
      setRecords(Array.isArray(recordsData) ? recordsData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
    } catch (err) {
      console.error("Error loading discipline data:", err);
      setRecords([]);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiService.createDisciplinaryRecord(formData);
      setShowForm(false);
      setFormData({
        student_id: "",
        incident_type: "",
        severity: "minor",
        description: "",
        action_taken: "",
        date_of_incident: new Date().toISOString().split("T")[0],
      });
      loadData();
    } catch (err) {
      alert("Failed to create record: " + (err.message || "Unknown error"));
    }
  };

  const handleResolve = async (id) => {
    if (!confirm("Mark this incident as resolved?")) return;
    try {
      await apiService.resolveDisciplinaryRecord(id);
      loadData();
    } catch (err) {
      alert("Failed to resolve: " + (err.message || "Unknown error"));
    }
  };

  const severityColor = {
    minor: "bg-yellow-100 text-yellow-800",
    major: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };

  const filtered = records.filter((r) => {
    if (!search) return true;
    const name = (r.student_name || "").toLowerCase();
    return name.includes(search.toLowerCase());
  });

  if (loading) return (<div><Header title="Disciplinary Records" /><LoadingSpinner /></div>);

  return (
    <div>
      <Header title="Disciplinary Records" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Disciplinary Records ({filtered.length})
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center"
          >
            <i className={`fas ${showForm ? "fa-times" : "fa-plus"} mr-2`}></i>
            {showForm ? "Cancel" : "New Record"}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Record New Incident</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select value={formData.student_id} onChange={(e) => setFormData({ ...formData, student_id: e.target.value })} required
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500">
                  <option value="">Select student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name || s.name} {s.last_name || s.surname} ({s.student_number})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Incident Type *</label>
                <input type="text" value={formData.incident_type} onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })} required
                  placeholder="e.g., Bullying, Late, Truancy" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity *</label>
                <select value={formData.severity} onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500">
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Incident *</label>
                <input type="date" value={formData.date_of_incident} onChange={(e) => setFormData({ ...formData, date_of_incident: e.target.value })} required
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required rows="3"
                  placeholder="Describe the incident..." className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Action Taken</label>
                <textarea value={formData.action_taken} onChange={(e) => setFormData({ ...formData, action_taken: e.target.value })} rows="2"
                  placeholder="e.g., Verbal warning, Detention, Parent notified" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="col-span-full">
                <button type="submit" className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600">
                  <i className="fas fa-save mr-2"></i>Save Record
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search student name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-64"
          />
          <select value={filter.severity} onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Severities</option>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
          <select value={filter.resolved} onChange={(e) => setFilter({ ...filter, resolved: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Status</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>
        </div>

        {/* Records List */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <i className="fas fa-gavel text-gray-300 text-6xl mb-4"></i>
              <p className="text-gray-500 text-lg">No disciplinary records found</p>
            </div>
          ) : (
            filtered.map((record) => (
              <div key={record.id} className={`bg-white rounded-lg shadow-sm p-5 border-l-4 ${record.is_resolved ? "border-green-400" : "border-red-400"}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-800">{record.student_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColor[record.severity] || severityColor.minor}`}>
                        {record.severity}
                      </span>
                      {record.is_resolved && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Resolved</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 font-medium">{record.incident_type}</p>
                    <p className="text-sm text-gray-600 mt-1">{record.description}</p>
                    {record.action_taken && (
                      <p className="text-sm text-gray-500 mt-1">
                        <span className="font-medium">Action:</span> {record.action_taken}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDate(record.date_of_incident)} | Reported by {record.reported_by_name || "Admin"}
                    </p>
                  </div>
                  {!record.is_resolved && (
                    <button
                      onClick={() => handleResolve(record.id)}
                      className="text-green-600 hover:text-green-800 text-sm font-medium ml-4"
                    >
                      <i className="fas fa-check-circle mr-1"></i>Resolve
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
