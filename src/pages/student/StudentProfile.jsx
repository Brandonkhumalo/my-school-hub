import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDateLong } from "../../utils/dateFormat";
import apiService from "../../services/apiService";

export default function StudentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    phone_number: "",
    bio: "",
    interests: "",
    emergency_contact: "",
  });

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [studentData, authProfile] = await Promise.all([
        apiService.getStudentProfile(),
        apiService.getProfile(),
      ]);
      const merged = { ...studentData, ...authProfile };
      setProfile(merged);
      setFormData({
        phone_number: merged.phone_number || "",
        bio: merged.bio || "",
        interests: merged.interests || "",
        emergency_contact: merged.emergency_contact || "",
      });
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      await apiService.updateProfile({
        phone_number: formData.phone_number,
      });
      setMessage({ type: "success", text: "Profile updated successfully!" });
      setEditing(false);
      loadProfile();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: "error", text: "Passwords do not match" });
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
      setShowPassword(false);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to change password" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="My Profile" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  const initials = ((profile?.name?.[0] || "") + (profile?.surname?.[0] || "")).toUpperCase() || "S";

  return (
    <div>
      <Header title="My Profile" user={user} />

      <div className="p-6 max-w-4xl mx-auto">
        {message.text && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </div>
        )}

        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
            <div className="flex items-center">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-blue-500">
                {initials}
              </div>
              <div className="ml-6 text-white">
                <h2 className="text-3xl font-bold">{profile?.name} {profile?.surname}</h2>
                <p className="text-blue-100 mt-1">{profile?.student_number}</p>
                <p className="text-blue-200 text-sm mt-1">{profile?.class || "No class assigned"}</p>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setEditing(!editing)}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition text-sm"
                >
                  <i className={`fas ${editing ? "fa-times" : "fa-edit"} mr-2`}></i>
                  {editing ? "Cancel" : "Edit Profile"}
                </button>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard icon="fa-id-card" color="blue" label="Full Name" value={`${profile?.name} ${profile?.surname}`} />
              <InfoCard icon="fa-school" color="green" label="Class" value={profile?.class || "Not assigned"} />
              <InfoCard icon="fa-hashtag" color="red" label="Student Number" value={profile?.student_number} />
              <InfoCard icon="fa-envelope" color="purple" label="Email" value={profile?.email} />

              {editing ? (
                <div className="col-span-full p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    <i className="fas fa-edit mr-2 text-blue-600"></i>Edit Your Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., +263 77 123 4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                      <input
                        type="text"
                        value={formData.emergency_contact}
                        onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="Parent/guardian phone"
                      />
                    </div>
                    <div className="col-span-full">
                      <label className="block text-sm font-medium text-gray-700 mb-1">About Me</label>
                      <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        rows="3"
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="Tell us about yourself..."
                      />
                    </div>
                    <div className="col-span-full">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Interests & Hobbies</label>
                      <input
                        type="text"
                        value={formData.interests}
                        onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Football, Debate, Science Club"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              ) : (
                <>
                  <InfoCard icon="fa-phone" color="purple" label="Phone" value={profile?.phone_number || "Not set"} />
                  <InfoCard icon="fa-ambulance" color="orange" label="Emergency Contact" value={profile?.emergency_contact || "Not set"} />
                  {profile?.date_of_birth && (
                    <InfoCard icon="fa-birthday-cake" color="pink" label="Date of Birth" value={formatDateLong(profile.date_of_birth)} />
                  )}
                  {profile?.gender && (
                    <InfoCard icon="fa-user" color="teal" label="Gender" value={profile.gender} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="flex items-center text-gray-700 font-semibold hover:text-blue-600 transition"
          >
            <i className={`fas fa-lock mr-2`}></i>
            Change Password
            <i className={`fas fa-chevron-${showPassword ? "up" : "down"} ml-2 text-sm`}></i>
          </button>

          {showPassword && (
            <form onSubmit={handlePasswordChange} className="mt-4 max-w-md space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
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
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
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
      </div>
    </div>
  );
}

function InfoCard({ icon, color, label, value }) {
  const colorMap = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600",
    red: "bg-red-100 text-red-600",
    pink: "bg-pink-100 text-pink-600",
    teal: "bg-teal-100 text-teal-600",
  };

  return (
    <div className="flex items-center p-4 bg-gray-50 rounded-lg">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${colorMap[color] || colorMap.blue}`}>
        <i className={`fas ${icon} text-xl`}></i>
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="font-semibold text-gray-800">{value || "-"}</p>
      </div>
    </div>
  );
}
