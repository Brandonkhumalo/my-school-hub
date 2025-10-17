import React from "react";

export default function ProfileForm({ formData, handleChange, handleSubmit }) {
  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Full Name</label>
        <input type="text" name="fullName" className="form-control" value={formData.fullName} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>Email Address</label>
        <input type="email" name="email" className="form-control" value={formData.email} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>Phone Number</label>
        <input type="tel" name="phone" className="form-control" value={formData.phone} onChange={handleChange} required />
      </div>
      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md">Save Changes</button>
    </form>
  );
}
