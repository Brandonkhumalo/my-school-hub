import React, { useEffect, useState } from "react";

export default function SchoolsList() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(null);
  const [suspending, setSuspending] = useState(null);
  const [showPassword, setShowPassword] = useState({});

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch("/api/auth/superadmin/schools/", {
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
      const response = await fetch(`/api/auth/superadmin/schools/${schoolId}/reset-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (!response.ok) throw new Error("Failed to reset password");

      const data = await response.json();
      
      setSchools(schools.map(s => 
        s.id === schoolId 
          ? { ...s, admin_password: data.new_password }
          : s
      ));
      
      alert("Password reset successfully!");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setResetting(null);
    }
  };

  const togglePassword = (schoolId) => {
    setShowPassword(prev => ({ ...prev, [schoolId]: !prev[schoolId] }));
  };

  const handleToggleSuspend = async (schoolId, currentStatus) => {
    const action = currentStatus ? 'unsuspend' : 'suspend';
    const reason = !currentStatus ? prompt("Enter reason for suspension (optional):") : null;
    
    if (!currentStatus && reason === null) return;

    setSuspending(schoolId);

    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch(`/api/auth/superadmin/schools/${schoolId}/suspend/`, {
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</th>
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
                        <p className="text-xs text-gray-400">{school.curriculum}</p>
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
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-sm ${showPassword[school.id] ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'} px-2 py-1 rounded`}>
                          {showPassword[school.id] ? school.admin_password : '••••••••'}
                        </span>
                        <button
                          onClick={() => togglePassword(school.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <i className={`fas fa-eye${showPassword[school.id] ? '-slash' : ''}`}></i>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
