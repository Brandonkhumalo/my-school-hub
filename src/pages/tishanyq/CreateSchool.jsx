import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CreateSchool() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    school_name: "",
    school_location: "",
    school_type: "secondary",
    curriculum: "ZIMSEC",
    admin_email: "",
    admin_phone: "",
    admin_password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(null);
    setLoading(true);

    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch("/api/auth/superadmin/create-school/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create school");
      }

      setSuccess(data);
      setFormData({
        school_name: "",
        school_location: "",
        school_type: "secondary",
        curriculum: "ZIMSEC",
        admin_email: "",
        admin_phone: "",
        admin_password: "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Create School Admin</h1>
        <p className="text-gray-600 mt-2">Register a new school and create its admin account</p>
      </div>

      <div className="max-w-2xl">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 mb-4">
              <i className="fas fa-check-circle mr-2"></i>School Created Successfully!
            </h3>
            <div className="bg-white p-4 rounded-lg border border-green-300 space-y-2">
              <p><strong>School Name:</strong> {success.school_name}</p>
              <p><strong>School Code:</strong> <span className="font-mono bg-gray-100 px-2 py-1 rounded">{success.school_code}</span></p>
              <p><strong>Admin Username:</strong> <span className="font-mono bg-gray-100 px-2 py-1 rounded">{success.admin_username}</span></p>
              <p><strong>Admin Email:</strong> {success.admin_email}</p>
              <p><strong>Admin Password:</strong> <span className="font-mono bg-yellow-100 px-2 py-1 rounded text-yellow-800">{success.admin_password}</span></p>
            </div>
            <p className="mt-4 text-sm text-yellow-700 bg-yellow-50 p-3 rounded">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              Save these credentials! The password cannot be recovered.
            </p>
            <button
              onClick={() => navigate("/tishanyq/admin/schools")}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              View All Schools
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-4 border-b">
            <i className="fas fa-school text-blue-500 mr-2"></i>School Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                School Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Harare High School"
                value={formData.school_name}
                onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location (City) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Harare"
                value={formData.school_location}
                onChange={(e) => setFormData({ ...formData, school_location: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">School Type</label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.school_type}
                onChange={(e) => setFormData({ ...formData, school_type: e.target.value })}
              >
                <option value="primary">Primary School</option>
                <option value="secondary">Secondary School</option>
                <option value="combined">Combined (Primary + Secondary)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Curriculum</label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.curriculum}
                onChange={(e) => setFormData({ ...formData, curriculum: e.target.value })}
              >
                <option value="ZIMSEC">ZIMSEC</option>
                <option value="Cambridge">Cambridge International</option>
                <option value="Both">Both ZIMSEC & Cambridge</option>
              </select>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-4 border-b">
            <i className="fas fa-user-shield text-green-500 mr-2"></i>Admin Account
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="admin@school.com"
                value={formData.admin_email}
                onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="+263 77 123 4567"
                value={formData.admin_phone}
                onChange={(e) => setFormData({ ...formData, admin_phone: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Password <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a secure password"
                value={formData.admin_password}
                onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">This password will be shown to you once after creation</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:bg-blue-300"
          >
            {loading ? (
              <span><i className="fas fa-spinner fa-spin mr-2"></i>Creating School...</span>
            ) : (
              <span><i className="fas fa-plus mr-2"></i>Create School & Admin</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
