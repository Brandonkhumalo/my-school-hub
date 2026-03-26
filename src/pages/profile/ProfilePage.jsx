import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiService from "../../services/apiService";
import { formatDateLong } from "../../utils/dateFormat";
import Header from "../../components/Header";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
  });
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await apiService.getProfile();
      setProfile(data);
      setFormData({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        phone_number: data.phone_number || "",
      });
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      await apiService.updateProfile(formData);
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: "error", text: "New password and confirm password do not match" });
      return;
    }
    if (passwordData.new_password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      await apiService.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      setMessage({ type: "success", text: "Password changed successfully!" });
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to change password" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
    } catch (e) {
      // continue even if backend call fails
    }
    logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const role = user?.role || "user";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Header title="My Profile" />
      <div className="max-w-4xl mx-auto mt-4">
        {message.text && (
          <div className={`mb-4 p-3 rounded ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-white rounded-lg shadow-sm p-1">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${activeTab === "profile" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Profile Info
          </button>
          <button
            onClick={() => setActiveTab("password")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${activeTab === "password" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Change Password
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === "profile" && (
            <>
              {/* Profile header */}
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {(profile?.first_name?.[0] || "U").toUpperCase()}
                </div>
                <div className="ml-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    {profile?.first_name} {profile?.last_name}
                  </h2>
                  <span className="inline-block mt-1 px-3 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                    {role}
                  </span>
                  {profile?.school_name && (
                    <p className="text-sm text-gray-500 mt-1">{profile.school_name}</p>
                  )}
                </div>
              </div>

              {/* Read-only info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                {profile?.student_number && (
                  <div>
                    <span className="text-xs text-gray-500">Student Number</span>
                    <p className="font-medium">{profile.student_number}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-500">Email</span>
                  <p className="font-medium">{profile?.email}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Role</span>
                  <p className="font-medium capitalize">{role}</p>
                </div>
                {profile?.date_joined && (
                  <div>
                    <span className="text-xs text-gray-500">Member Since</span>
                    <p className="font-medium">
                      {formatDateLong(profile.date_joined)}
                    </p>
                  </div>
                )}
              </div>

              {/* Editable form */}
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saving ? "Saving..." : "Update Profile"}
                </button>
              </form>
            </>
          )}

          {activeTab === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  minLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? "Changing..." : "Change Password"}
              </button>
            </form>
          )}
        </div>

        {/* Logout */}
        <div className="mt-6 text-center">
          <button
            onClick={handleLogout}
            className="text-red-600 hover:text-red-800 font-medium transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
