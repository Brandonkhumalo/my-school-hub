import React from "react";

function DashboardCard({ title, value, icon, color }) {
  return (
    <div className={`card bg-white rounded-lg shadow-sm p-6 ${color}`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-gray-600 text-sm">{title}</p>
          <h3 className="text-2xl font-bold mt-2">{value}</h3>
        </div>
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${color.replace(
            "border-l-4",
            "bg-opacity-20 text-opacity-100"
          )}`}
        >
          <i className={`${icon} text-xl`}></i>
        </div>
      </div>
    </div>
  );
}

export default DashboardCard;
