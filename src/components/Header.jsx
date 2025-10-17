import React from "react";

export default function Header({ title, user }) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="text-gray-700">
        Welcome, {user?.full_name || "User"} ({user?.role || "Role"})
      </div>
    </div>
  );
}
