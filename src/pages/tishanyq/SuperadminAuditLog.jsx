import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const API_BASE_URL = "/api/v1";

export default function SuperadminAuditLog() {
  const [searchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(searchParams.get("action") || "");
  const [modelName, setModelName] = useState(searchParams.get("model_name") || "");
  const [schoolId, setSchoolId] = useState("");
  const [userId, setUserId] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, total_pages: 1, has_next: false, has_prev: false, total: 0 });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("tishanyq_token");
      const q = new URLSearchParams();
      if (action) q.set("action", action);
      if (modelName) q.set("model_name", modelName);
      if (schoolId) q.set("school_id", schoolId);
      if (userId) q.set("user_id", userId);
      if (userQuery) q.set("user_q", userQuery);
      if (schoolQuery) q.set("school_q", schoolQuery);
      if (dateFrom) q.set("date_from", dateFrom);
      if (dateTo) q.set("date_to", dateTo);
      q.set("page", String(page));
      q.set("page_size", "50");
      const response = await fetch(`${API_BASE_URL}/auth/superadmin/audit-logs/?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setLogs(data.results || []);
        setMeta({
          page: data.page || 1,
          total_pages: data.total_pages || 1,
          has_next: !!data.has_next,
          has_prev: !!data.has_prev,
          total: data.total || 0,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [action, modelName, schoolId, userId, userQuery, schoolQuery, dateFrom, dateTo, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch(`${API_BASE_URL}/auth/superadmin/schools/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) setSchools(data.schools || []);
    })();
  }, []);

  const exportCsv = async () => {
    const token = localStorage.getItem("tishanyq_token");
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    if (modelName) q.set("model_name", modelName);
    if (schoolId) q.set("school_id", schoolId);
    if (userId) q.set("user_id", userId);
    if (userQuery) q.set("user_q", userQuery);
    if (schoolQuery) q.set("school_q", schoolQuery);
    if (dateFrom) q.set("date_from", dateFrom);
    if (dateTo) q.set("date_to", dateTo);
    const response = await fetch(`${API_BASE_URL}/auth/superadmin/audit-logs/export/?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "superadmin_audit_logs.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 space-y-4">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Platform Audit Logs</h1>
        <button onClick={exportCsv} className="px-4 py-2 bg-gray-900 text-white rounded">Export CSV</button>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select value={action} onChange={(e) => setAction(e.target.value)} className="border px-2 py-2 rounded text-sm">
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="SUSPEND">SUSPEND</option>
          </select>
          <select value={modelName} onChange={(e) => setModelName(e.target.value)} className="border px-2 py-2 rounded text-sm">
            <option value="">All Models</option>
            <option value="GeneratedTest">GeneratedTest</option>
            <option value="TestAttempt">TestAttempt</option>
            <option value="School">School</option>
            <option value="CustomUser">CustomUser</option>
          </select>
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="border px-2 py-2 rounded text-sm">
            <option value="">All Schools</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID"
            className="border px-2 py-2 rounded text-sm"
          />
          <input
            type="text"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="User name/email"
            className="border px-2 py-2 rounded text-sm"
          />
          <input
            type="text"
            value={schoolQuery}
            onChange={(e) => setSchoolQuery(e.target.value)}
            placeholder="School name search"
            className="border px-2 py-2 rounded text-sm"
          />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border px-2 py-2 rounded text-sm" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border px-2 py-2 rounded text-sm" />
        </div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">When</th>
              <th className="p-3 text-left">Action</th>
              <th className="p-3 text-left">Model</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">School</th>
              <th className="p-3 text-left">Summary</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">No logs found.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-3">{log.timestamp}</td>
                  <td className="p-3">{log.action}</td>
                  <td className="p-3">{log.model_name}</td>
                  <td className="p-3">{log.user_email || "-"}</td>
                  <td className="p-3">{log.school_name || "Platform"}</td>
                  <td className="p-3">{log.object_repr}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Total records: {meta.total}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!meta.has_prev}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-2 py-1">Page {meta.page} / {meta.total_pages}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!meta.has_next}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
