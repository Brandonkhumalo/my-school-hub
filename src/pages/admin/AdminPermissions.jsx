import React, { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import apiService from "../../services/apiService";

function normalizePermissions(pages, permissionMap) {
  const next = {};
  pages.forEach((page) => {
    const existing = permissionMap?.[page.key] || {};
    next[page.key] = {
      read: Boolean(existing.read),
      write: Boolean(existing.write),
    };
  });
  return next;
}

const TABS = [
  { key: "hr", label: "HR" },
  { key: "accountant", label: "Accountant" },
];

export default function AdminPermissions() {
  const [activeTab, setActiveTab] = useState("hr");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [pages, setPages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isHead, setIsHead] = useState(false);
  const [permissions, setPermissions] = useState({});

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const headFlagKey = activeTab === "hr" ? "is_root_boss" : "is_root_head";
  const headLabel = activeTab === "hr" ? "Root HR Head (full access)" : "Accountant Head (full access)";
  const badgeLabel = activeTab === "hr" ? "Root HR Head" : "Accountant Head";
  const emptyMessage = activeTab === "hr" ? "No HR employees found." : "No accountants found.";
  const panelTitle = activeTab === "hr" ? "HR Employees" : "Accountants";

  const load = async (preferredUserId = null, tab = activeTab) => {
    setLoading(true);
    setError("");
    try {
      const data = tab === "hr"
        ? await apiService.getHRPermissions()
        : await apiService.getAccountantPermissions();
      const pagesList = Array.isArray(data?.pages) ? data.pages : [];
      const usersList = Array.isArray(data?.hr_users)
        ? data.hr_users
        : (Array.isArray(data?.accountant_users) ? data.accountant_users : []);
      setPages(pagesList);
      setUsers(usersList);

      const preferredId = Number(preferredUserId);
      const hasPreferred = Number.isFinite(preferredId) && usersList.some((u) => u.id === preferredId);
      const nextSelected = hasPreferred ? preferredId : (usersList.length > 0 ? usersList[0].id : null);
      setSelectedUserId(nextSelected);
      if (nextSelected) {
        const u = usersList.find((x) => x.id === nextSelected);
        const flagKey = tab === "hr" ? "is_root_boss" : "is_root_head";
        setIsHead(Boolean(u?.[flagKey]));
        setPermissions(normalizePermissions(pagesList, u?.permissions || {}));
      } else {
        setIsHead(false);
        setPermissions({});
      }
    } catch (err) {
      setError(err.message || "Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(null, activeTab);
    setSuccess("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSelectUser = (userId) => {
    const id = Number(userId);
    setSelectedUserId(id);
    const u = users.find((x) => x.id === id);
    setIsHead(Boolean(u?.[headFlagKey]));
    setPermissions(normalizePermissions(pages, u?.permissions || {}));
    setSuccess("");
    setError("");
  };

  const updatePermission = (pageKey, field, value) => {
    setPermissions((prev) => {
      const next = { ...prev, [pageKey]: { ...(prev[pageKey] || { read: false, write: false }) } };
      next[pageKey][field] = value;
      if (field === "write" && value) {
        next[pageKey].read = true;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = { permissions };
      payload[headFlagKey] = isHead;
      if (activeTab === "hr") {
        await apiService.updateHRPermissions(selectedUserId, payload);
      } else {
        await apiService.updateAccountantPermissions(selectedUserId, payload);
      }
      setSuccess("Permissions updated successfully.");
      await load(selectedUserId, activeTab);
    } catch (err) {
      setError(err.message || "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header title="Permissions" />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Permissions Management</h2>
          <p className="text-gray-600 mt-1">Configure per-employee access rights.</p>
        </div>

        <div className="mb-4 flex gap-2 border-b">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tab.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{success}</div>}

        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-3">{panelTitle}</h3>
              {users.length === 0 ? (
                <p className="text-sm text-gray-500">{emptyMessage}</p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u.id)}
                      className={`w-full text-left p-3 rounded border ${selectedUserId === u.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                    >
                      <p className="font-medium text-gray-800">{u.full_name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                      {u[headFlagKey] && <p className="text-xs text-purple-700 mt-1">{badgeLabel}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
              {!selectedUser ? (
                <p className="text-sm text-gray-500">Select a user to edit permissions.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">{selectedUser.full_name}</h3>
                      <p className="text-xs text-gray-500">{selectedUser.email}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={isHead}
                        onChange={(e) => setIsHead(e.target.checked)}
                      />
                      {headLabel}
                    </label>
                  </div>

                  <div className="overflow-x-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                        <tr>
                          <th className="px-3 py-2 text-left">Page</th>
                          <th className="px-3 py-2 text-center">Read</th>
                          <th className="px-3 py-2 text-center">Write</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {pages.map((page) => (
                          <tr key={page.key}>
                            <td className="px-3 py-2 text-gray-800">{page.label}</td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                disabled={isHead}
                                checked={Boolean(permissions?.[page.key]?.read)}
                                onChange={(e) => updatePermission(page.key, "read", e.target.checked)}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                disabled={isHead}
                                checked={Boolean(permissions?.[page.key]?.write)}
                                onChange={(e) => updatePermission(page.key, "write", e.target.checked)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Permissions"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
