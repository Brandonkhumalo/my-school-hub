import React, { useEffect, useState } from "react";

export default function SchoolsList() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(null);
  const [suspending, setSuspending] = useState(null);
  const [updatingSchool, setUpdatingSchool] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolDetail, setSchoolDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [unlockingInDetail, setUnlockingInDetail] = useState(null);

  useEffect(() => {
    fetchSchools();
  }, []);

  const API_BASE_URL = "/api/v1";
  const formatLabel = (value) =>
    String(value || "-")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const fetchSchools = async () => {
    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch(`${API_BASE_URL}/auth/superadmin/schools/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch schools");

      const data = await response.json();
      setSchools(data.schools || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (schoolId) => {
    const newPassword = prompt("Enter new password for this admin:");
    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    setResetting(schoolId);

    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch(`${API_BASE_URL}/auth/superadmin/schools/${schoolId}/reset-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (!response.ok) throw new Error("Failed to reset password");

      await response.json();
      alert("Password reset successfully.");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setResetting(null);
    }
  };

  const openSchoolDetail = async (school) => {
    setSelectedSchool(school);
    setDetailLoading(true);
    setSchoolDetail(null);
    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch(`${API_BASE_URL}/auth/superadmin/schools/${school.id}/detail/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load school details");
      setSchoolDetail(data);
    } catch (err) {
      alert("Error: " + err.message);
      setSelectedSchool(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const unlockFromDetail = async (userId) => {
    setUnlockingInDetail(userId);
    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch(`${API_BASE_URL}/auth/superadmin/locked-accounts/${userId}/unlock/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to unlock account");
      if (selectedSchool) {
        await openSchoolDetail(selectedSchool);
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setUnlockingInDetail(null);
    }
  };

  const handleToggleSuspend = async (schoolId, currentStatus) => {
    const action = currentStatus ? 'unsuspend' : 'suspend';
    const reason = !currentStatus ? prompt("Enter reason for suspension (optional):") : null;
    
    if (!currentStatus && reason === null) return;

    setSuspending(schoolId);

    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch(`${API_BASE_URL}/auth/superadmin/schools/${schoolId}/suspend/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ suspend: !currentStatus, reason: reason || '' }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} school`);

      const data = await response.json();
      
      setSchools(schools.map(s => 
        s.id === schoolId 
          ? { ...s, is_suspended: data.is_suspended }
          : s
      ));
      
      alert(`School ${action}ed successfully!`);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSuspending(null);
    }
  };

  const handleDeleteSchool = async () => {
    if (!deleteModal) return;
    setDeleting(deleteModal.id);
    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch(`${API_BASE_URL}/auth/superadmin/schools/${deleteModal.id}/delete/`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmation: deleteConfirmText }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete school");

      setSchools((prev) => prev.filter((s) => s.id !== deleteModal.id));
      setDeleteModal(null);
      setDeleteConfirmText("");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleUpdateSchoolProfile = async (schoolId, patchData) => {
    setUpdatingSchool(schoolId);
    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch(`${API_BASE_URL}/auth/superadmin/schools/${schoolId}/update/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patchData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update school");

      setSchools((prev) =>
        prev.map((s) =>
          s.id === schoolId
            ? {
                ...s,
                school_type: data.school.school_type_display || data.school.school_type,
                accommodation_type: data.school.accommodation_type,
                accommodation_type_display: data.school.accommodation_type_display,
                curriculum: data.school.curriculum,
                student_limit: data.school.student_limit,
              }
            : s
        )
      );
      if (data.activated_students > 0) {
        alert(`${data.activated_students} pending student account(s) were automatically activated.`);
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setUpdatingSchool(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
          <p className="text-gray-600">Loading schools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Schools</h1>
          <p className="text-gray-600 mt-2">Manage all registered schools and their admins</p>
        </div>
        <a
          href="/tishanyq/admin/create-school"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          <i className="fas fa-plus mr-2"></i>Add School
        </a>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          <i className="fas fa-exclamation-circle mr-2"></i>{error}
        </div>
      )}

      {schools.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <i className="fas fa-school text-6xl text-gray-300 mb-4"></i>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Schools Yet</h3>
          <p className="text-gray-500 mb-6">Create your first school to get started</p>
          <a
            href="/tishanyq/admin/create-school"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <i className="fas fa-plus mr-2"></i>Create First School
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">School</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {schools.map((school) => (
                  <tr key={school.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <button className="text-left font-semibold text-gray-900 hover:text-blue-700" onClick={() => openSchoolDetail(school)}>
                          {school.name}
                        </button>
                        <p className="text-sm text-gray-500">
                          {school.city || "Unknown City"} <span className="mx-1 text-gray-300">|</span> {formatLabel(school.school_type)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {formatLabel(school.accommodation_type_display || school.accommodation_type || "day")}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            {formatLabel(school.curriculum)}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            Student Limit: {school.student_limit ?? "-"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{school.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      {school.is_suspended ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <i className="fas fa-ban mr-1"></i>Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <i className="fas fa-check-circle mr-1"></i>Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-800">{school.admin_username}</p>
                        <p className="text-sm text-gray-500">{school.admin_email}</p>
                        <p className="text-xs text-gray-400">{school.admin_phone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <select
                          value={school.accommodation_type || "day"}
                          disabled={updatingSchool === school.id}
                          onChange={(e) => handleUpdateSchoolProfile(school.id, { accommodation_type: e.target.value })}
                          className="px-2 py-2 border border-gray-200 rounded text-xs"
                          title="School accommodation type"
                        >
                          <option value="day">Day</option>
                          <option value="boarding">Boarding</option>
                          <option value="both">Both</option>
                        </select>
                        <input
                          type="number"
                          min="1"
                          defaultValue={school.student_limit || 500}
                          disabled={updatingSchool === school.id}
                          onBlur={(e) => {
                            const next = Number(e.target.value || 0);
                            if (!next || next < 1 || next === school.student_limit) return;
                            handleUpdateSchoolProfile(school.id, { student_limit: next });
                          }}
                          className="w-24 px-2 py-2 border border-gray-200 rounded text-xs"
                          title="Student limit"
                        />
                        <button
                          onClick={() => handleResetPassword(school.id)}
                          disabled={resetting === school.id}
                          className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-sm transition disabled:opacity-50"
                        >
                          {resetting === school.id ? (
                            <span><i className="fas fa-spinner fa-spin mr-1"></i></span>
                          ) : (
                            <span><i className="fas fa-key mr-1"></i>Reset</span>
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleSuspend(school.id, school.is_suspended)}
                          disabled={suspending === school.id}
                          className={`px-3 py-2 rounded-lg text-sm transition disabled:opacity-50 ${
                            school.is_suspended
                              ? 'bg-green-100 hover:bg-green-200 text-green-700'
                              : 'bg-red-100 hover:bg-red-200 text-red-700'
                          }`}
                        >
                          {suspending === school.id ? (
                            <span><i className="fas fa-spinner fa-spin mr-1"></i></span>
                          ) : school.is_suspended ? (
                            <span><i className="fas fa-play mr-1"></i>Activate</span>
                          ) : (
                            <span><i className="fas fa-ban mr-1"></i>Suspend</span>
                          )}
                        </button>
                        <button
                          onClick={() => { setDeleteModal(school); setDeleteConfirmText(""); }}
                          className="px-3 py-2 bg-gray-800 hover:bg-black text-white rounded-lg text-sm transition"
                          title="Permanently delete this school"
                        >
                          <i className="fas fa-trash mr-1"></i>Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedSchool && (
        <div className="fixed inset-0 bg-black/50 z-40 flex justify-end">
          <div className="w-full max-w-xl bg-white h-full overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">{selectedSchool.name} Details</h3>
              <button onClick={() => setSelectedSchool(null)} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            {detailLoading ? (
              <div className="text-gray-500">Loading details...</div>
            ) : schoolDetail ? (
              <div className="space-y-4 text-sm">
                <section className="border rounded-lg p-3">
                  <p className="font-semibold mb-2">Counts</p>
                  <p>Students: {schoolDetail.counts?.students ?? 0}</p>
                  <p>Active Students: {schoolDetail.counts?.active_students ?? 0}</p>
                  <p>Pending Activation: {schoolDetail.counts?.pending_activation_students ?? 0}</p>
                  <p>Teachers: {schoolDetail.counts?.teachers ?? 0}</p>
                  <p>HR: {schoolDetail.counts?.hr ?? 0}</p>
                  <p>Accountants: {schoolDetail.counts?.accountants ?? 0}</p>
                  <p>Security: {schoolDetail.counts?.security ?? 0}</p>
                  <p>Librarians: {schoolDetail.counts?.librarians ?? 0}</p>
                  <p>Cleaners: {schoolDetail.counts?.cleaners ?? 0}</p>
                  <p>Parents: {schoolDetail.counts?.parents ?? 0}</p>
                  <p>Staff: {schoolDetail.counts?.staff ?? 0}</p>
                  <p>Student Limit: {schoolDetail.capacity?.student_limit ?? "-"}</p>
                </section>
                <section className="border rounded-lg p-3">
                  <p className="font-semibold mb-2">Setup & Security</p>
                  <p>Admin Last Login: {schoolDetail.admin_last_login || "Never"}</p>
                  <p>2FA Enforced: {schoolDetail.setup?.two_factor_enforced ? "Yes" : "No"}</p>
                  <p>Setup Complete: {schoolDetail.setup?.is_setup_complete ? "Yes" : "No"}</p>
                  <p>Has Logo: {schoolDetail.setup?.has_logo ? "Yes" : "No"}</p>
                  <p>Academic Period Configured: {schoolDetail.setup?.has_academic_period ? "Yes" : "No"}</p>
                  <p>Classes Created: {schoolDetail.setup?.classes_count ?? 0}</p>
                </section>
                <section className="border rounded-lg p-3">
                  <p className="font-semibold mb-2">Locked Accounts</p>
                  {(schoolDetail.locked_accounts || []).length === 0 ? (
                    <p className="text-gray-500">No locked users</p>
                  ) : (
                    schoolDetail.locked_accounts.map((u) => (
                      <div key={u.id} className="flex justify-between items-center border-b py-1">
                        <div>
                          <span>{u.name} ({u.role})</span>
                          <p className="text-xs text-gray-500">{u.account_locked_until}</p>
                        </div>
                        <button
                          onClick={() => unlockFromDetail(u.id)}
                          disabled={unlockingInDetail === u.id}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                        >
                          {unlockingInDetail === u.id ? "Unlocking..." : "Unlock"}
                        </button>
                      </div>
                    ))
                  )}
                </section>
                <section className="border rounded-lg p-3">
                  <p className="font-semibold mb-2">Recent Audit Logs</p>
                  {(schoolDetail.recent_audit_logs || []).length === 0 ? (
                    <p className="text-gray-500">No recent audit activity</p>
                  ) : (
                    schoolDetail.recent_audit_logs.map((log) => (
                      <div key={log.id} className="border-b py-2">
                        <p className="text-xs text-gray-500">{log.timestamp}</p>
                        <p className="text-sm font-medium">{log.action} {log.model_name}</p>
                        <p className="text-xs text-gray-600">{log.object_repr}</p>
                      </div>
                    ))
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-red-600"></i>
              </div>
              <h2 className="text-xl font-bold text-gray-800">Delete School</h2>
            </div>
            <p className="text-gray-600 mb-2">
              This will <span className="font-semibold text-red-600">permanently delete</span> <span className="font-semibold">{deleteModal.name}</span> and all its data — students, staff, finances, academics, and settings. This cannot be undone.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Type <span className="font-mono font-semibold text-gray-800">{deleteModal.name}</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deleteModal.name}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteModal(null); setDeleteConfirmText(""); }}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSchool}
                disabled={deleteConfirmText !== deleteModal.name || deleting === deleteModal.id}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting === deleteModal.id ? (
                  <span><i className="fas fa-spinner fa-spin mr-2"></i>Deleting...</span>
                ) : (
                  <span><i className="fas fa-trash mr-2"></i>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
