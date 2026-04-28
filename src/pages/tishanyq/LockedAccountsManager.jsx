import React, { useCallback, useEffect, useState } from "react";

const API_BASE_URL = "/api/v1";

export default function LockedAccountsManager() {
  const [accounts, setAccounts] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(null);
  const [schoolId, setSchoolId] = useState("");
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, total_pages: 1, has_next: false, has_prev: false, total: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("tishanyq_token");
      const q = new URLSearchParams();
      if (schoolId) q.set("school_id", schoolId);
      if (role) q.set("role", role);
      if (query) q.set("q", query);
      q.set("page", String(page));
      q.set("page_size", "50");
      const res = await fetch(`${API_BASE_URL}/auth/superadmin/locked-accounts/?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAccounts(data.results || []);
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
  }, [schoolId, role, query, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("tishanyq_token");
      const res = await fetch(`${API_BASE_URL}/auth/superadmin/schools/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setSchools(data.schools || []);
    })();
  }, []);

  const unlock = async (userId) => {
    setUnlocking(userId);
    try {
      const token = localStorage.getItem("tishanyq_token");
      const res = await fetch(`${API_BASE_URL}/auth/superadmin/locked-accounts/${userId}/unlock/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) await load();
    } finally {
      setUnlocking(null);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Locked Accounts</h1>
      <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="border px-3 py-2 rounded text-sm">
          <option value="">All Schools</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>{school.name}</option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="border px-3 py-2 rounded text-sm">
          <option value="">All Roles</option>
          <option value="admin">admin</option>
          <option value="teacher">teacher</option>
          <option value="parent">parent</option>
          <option value="hr">hr</option>
          <option value="accountant">accountant</option>
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name/email/school"
          className="border px-3 py-2 rounded text-sm"
        />
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">School</th>
              <th className="p-3 text-left">Failed Attempts</th>
              <th className="p-3 text-left">Locked Until</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-6 text-center text-gray-500" colSpan={6}>Loading...</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td className="p-6 text-center text-gray-500" colSpan={6}>No locked accounts.</td></tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id} className="border-t">
                  <td className="p-3">{account.name}</td>
                  <td className="p-3">{account.role}</td>
                  <td className="p-3">{account.school_name || "-"}</td>
                  <td className="p-3">{account.failed_login_attempts}</td>
                  <td className="p-3">{account.account_locked_until}</td>
                  <td className="p-3">
                    <button
                      onClick={() => unlock(account.id)}
                      disabled={unlocking === account.id}
                      className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                      {unlocking === account.id ? "Unlocking..." : "Unlock"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm mt-4">
        <span className="text-gray-600">Total locked accounts: {meta.total}</span>
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
