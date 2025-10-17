import React from "react";
import Header from "../../components/Header";

export default function ParentDashboard() {
  return (
    <div>
      <Header title="Parent Dashboard" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p>Welcome to your Parent Dashboard. Here you can view your children’s results, fees, and announcements.</p>
      </div>
    </div>
  );
}
