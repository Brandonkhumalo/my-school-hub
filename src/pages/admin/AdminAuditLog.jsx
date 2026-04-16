import React, { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import PaginationControls from "../../components/PaginationControls";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";

const ACTIONS = ["", "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "SUSPEND", "APPROVE"];
const PAGE_SIZE = 100;

export default function AdminAuditLog() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    user_id: "",
    action: "",
    model: "",
    from: "",
    to: "",
  });

  const loadUsers = async () => {
    try {
      const data = await apiService.fetchUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load users", error);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
      const data = await apiService.getAuditLogs(params);
      const rows = Array.isArray(data) ? data : (data?.results || []);
      setLogs(rows);
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to load audit logs", error);
      setLogs([]);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadLogs();
  }, []);

  const badgeClasses = {
    CREATE: "bg-emerald-100 text-emerald-700",
    UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700",
    LOGIN: "bg-violet-100 text-violet-700",
    LOGOUT: "bg-gray-100 text-gray-700",
    SUSPEND: "bg-orange-100 text-orange-700",
    APPROVE: "bg-teal-100 text-teal-700",
  };

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(logs.length / PAGE_SIZE)),
    [logs.length]
  );

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return logs.slice(start, start + PAGE_SIZE);
  }, [logs, currentPage]);

  return (
    <div>
      <Header title="Audit Log Analysis" />
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <select className="border rounded px-3 py-2" value={filters.user_id} onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}>
            <option value="">All Users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
            ))}
          </select>
          <select className="border rounded px-3 py-2" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
            {ACTIONS.map((action) => (
              <option key={action || "all"} value={action}>{action || "All Actions"}</option>
            ))}
          </select>
          <input className="border rounded px-3 py-2" placeholder="Model (e.g. Staff)" value={filters.model} onChange={(e) => setFilters({ ...filters, model: e.target.value })} />
          <input type="date" className="border rounded px-3 py-2" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <input type="date" className="border rounded px-3 py-2" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <button className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700" onClick={loadLogs}>Apply Filters</button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {loading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Timestamp</th>
                    <th className="text-left px-3 py-2">User</th>
                    <th className="text-left px-3 py-2">Role</th>
                    <th className="text-left px-3 py-2">Action</th>
                    <th className="text-left px-3 py-2">Resource</th>
                    <th className="text-left px-3 py-2">Object ID</th>
                    <th className="text-left px-3 py-2">IP</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-2">{formatDate(log.timestamp)}</td>
                      <td className="px-3 py-2">{log.user || "System"}</td>
                      <td className="px-3 py-2 capitalize">{log.user_role || "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${badgeClasses[log.action] || "bg-gray-100 text-gray-700"}`}>{log.action}</span>
                      </td>
                      <td className="px-3 py-2">{log.model}</td>
                      <td className="px-3 py-2">{log.object_id || "-"}</td>
                      <td className="px-3 py-2">{log.ip_address || "-"}</td>
                      <td className="px-3 py-2">{log.response_status || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && <p className="text-center py-6 text-gray-500">No audit logs found for selected filters.</p>}
            </div>
          )}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={logs.length}
            pageSize={PAGE_SIZE}
            onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          />
        </div>
      </div>
    </div>
  );
}
