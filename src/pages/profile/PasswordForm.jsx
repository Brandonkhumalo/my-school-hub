import React from "react";

export default function PasswordForm({ formData, handleChange, handleSubmit }) {
  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Current Password</label>
        <input type="password" name="currentPassword" className="form-control" value={formData.currentPassword} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>New Password</label>
        <input type="password" name="newPassword" className="form-control" value={formData.newPassword} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>Confirm New Password</label>
        <input type="password" name="confirmPassword" className="form-control" value={formData.confirmPassword} onChange={handleChange} required />
      </div>
      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md">Change Password</button>
    </form>
  );
}
