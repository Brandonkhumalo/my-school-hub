import React from "react";
import ProfileForm from "./ProfileForm";
import PasswordForm from "./PasswordForm";
import WhatsAppPinForm from "./WhatsAppPinForm";

export default function ProfileContent({ activeTab, formData, handleChange, handleProfileSubmit, handlePasswordSubmit, handlePinSubmit }) {
  return (
    <div className="w-full md:w-2/3 p-6">
      {activeTab === "profile" && <ProfileForm formData={formData} handleChange={handleChange} handleSubmit={handleProfileSubmit} />}
      {activeTab === "security" && <PasswordForm formData={formData} handleChange={handleChange} handleSubmit={handlePasswordSubmit} />}
      {activeTab === "whatsapp" && <WhatsAppPinForm formData={formData} handleChange={handleChange} handleSubmit={handlePinSubmit} />}
    </div>
  );
}
