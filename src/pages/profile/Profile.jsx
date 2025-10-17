import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import ProfileSidebar from "./ProfileSidebar";
import ProfileContent from "./ProfileContent";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: user?.full_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    whatsappPin: ""
  });
  const [activeTab, setActiveTab] = useState("profile");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    alert("Profile updated successfully!");
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      alert("New password and confirm password do not match!");
      return;
    }
    alert("Password changed successfully!");
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    alert("WhatsApp PIN set successfully!");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <ProfileSidebar 
            user={user} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            handleLogout={handleLogout} 
          />
          <ProfileContent 
            activeTab={activeTab} 
            formData={formData} 
            handleChange={handleChange} 
            handleProfileSubmit={handleProfileSubmit} 
            handlePasswordSubmit={handlePasswordSubmit} 
            handlePinSubmit={handlePinSubmit} 
          />
        </div>
      </div>
    </div>
  );
}
