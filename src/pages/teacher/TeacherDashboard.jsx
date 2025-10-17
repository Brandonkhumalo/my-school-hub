import React from "react";
import Header from "../../components/Header";

export default function TeacherDashboard() {
  return (
    <div>
      <Header title="Teacher Dashboard" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p>Welcome to your Teacher Dashboard. Here you can manage classes, students, results, and more.</p>
      </div>
    </div>
  );
}
