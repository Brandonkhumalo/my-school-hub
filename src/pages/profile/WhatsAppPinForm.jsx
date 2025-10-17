import React from "react";

export default function WhatsAppPinForm({ formData, handleChange, handleSubmit }) {
  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>WhatsApp PIN (4 digits)</label>
        <input type="text" name="whatsappPin" className="form-control" value={formData.whatsappPin} onChange={handleChange} pattern="[0-9]{4}" maxLength="4" required />
      </div>
      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md">Set PIN</button>
    </form>
  );
}
