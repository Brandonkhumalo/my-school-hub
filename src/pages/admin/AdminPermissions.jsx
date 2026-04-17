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

export default function AdminPermissions() {
  const [activeTab, setActiveTab] = useState("hr");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [pages, setPages] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [selectedHrId, setSelectedHrId] = useState(null);
  const [isRootBoss, setIsRootBoss] = useState(false);
  const [permissions, setPermissions] = useState({});

  const selectedHr = useMemo(
    () => hrUsers.find((u) => u.id === selectedHrId) || null,
    [hrUsers, selectedHrId]
  );

  const load = async (preferredUserId = null) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiService.getHRPermissions();
      const pagesList = Array.isArray(data?.pages) ? data.pages : [];
      const usersList = Array.isArray(data?.hr_users) ? data.hr_users : [];
      setPages(pagesList);
      setHrUsers(usersList);

      const preferredId = Number(preferredUserId);
      const hasPreferred = Number.isFinite(preferredId) && usersList.some((u) => u.id === preferredId);
      const nextSelected = hasPreferred ? preferredId : (usersList.length > 0 ? usersList[0].id : null);
      setSelectedHrId(nextSelected);
      if (nextSelected) {
        const hr = usersList.find((u) => u.id === nextSelected);
        setIsRootBoss(Boolean(hr?.is_root_boss));
        setPermissions(normalizePermissions(pagesList, hr?.permissions || {}));
      } else {
        setIsRootBoss(false);
        setPermissions({});
      }
    } catch (err) {
      setError(err.message || "Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSelectHr = (userId) => {
    const id = Number(userId);
    setSelectedHrId(id);
    const hr = hrUsers.find((u) => u.id === id);
    setIsRootBoss(Boolean(hr?.is_root_boss));
    setPermissions(normalizePermissions(pages, hr?.permissions || {}));
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
    if (!selectedHrId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiService.updateHRPermissions(selectedHrId, {
        is_root_boss: isRootBoss,
        permissions,
      });
      setSuccess("Permissions updated successfully.");
      await load(selectedHrId);
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
          <button
            onClick={() => setActiveTab("hr")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === "hr" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500"}`}
          >
            HR
          </button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{success}</div>}

        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : activeTab === "hr" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-3">HR Employees</h3>
              {hrUsers.length === 0 ? (
                <p className="text-sm text-gray-500">No HR employees found.</p>
              ) : (
                <div className="space-y-2">
                  {hrUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectHr(u.id)}
                      className={`w-full text-left p-3 rounded border ${selectedHrId === u.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                    >
                      <p className="font-medium text-gray-800">{u.full_name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                      {u.is_root_boss && <p className="text-xs text-purple-700 mt-1">Root HR Boss</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
              {!selectedHr ? (
                <p className="text-sm text-gray-500">Select an HR employee to edit permissions.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">{selectedHr.full_name}</h3>
                      <p className="text-xs text-gray-500">{selectedHr.email}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={isRootBoss}
                        onChange={(e) => setIsRootBoss(e.target.checked)}
                      />
                      Root HR Boss (full access)
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
                                disabled={isRootBoss}
                                checked={Boolean(permissions?.[page.key]?.read)}
                                onChange={(e) => updatePermission(page.key, "read", e.target.checked)}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                disabled={isRootBoss}
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
        ) : null}
      </div>
    </div>
  );
}
