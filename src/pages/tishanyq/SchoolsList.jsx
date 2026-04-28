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

  useEffect(() => {
    fetchSchools();
  }, []);

  const API_BASE_URL = "/api/v1";

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

      const data = await response.json();
      alert(`Password reset successfully! New password: ${data.new_password}`);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setResetting(null);
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
              }
            : s
        )
      );
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
                      <div>
                        <p className="font-semibold text-gray-800">{school.name}</p>
                        <p className="text-sm text-gray-500">{school.city} | {school.school_type}</p>
                        <p className="text-xs text-gray-400">{school.accommodation_type_display || school.accommodation_type || 'day'} | {school.curriculum}</p>
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
