import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function SecurityDashboard() {
  const today = new Date().toISOString().split("T")[0];
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ todayVisitors: 0, checkedIn: 0, openIncidents: 0, attendanceRecords: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [visitors, incidents, attendance] = await Promise.all([
          apiService.getVisitorLogs({ date: today }),
          apiService.getIncidentReports({ status: "open" }),
          apiService.getStaffAttendance({ date: today }),
        ]);
        const checkedIn = (visitors || []).filter((v) => !v.check_out_time).length;
        setStats({
          todayVisitors: (visitors || []).length,
          checkedIn,
          openIncidents: (incidents || []).length,
          attendanceRecords: (attendance || []).length,
        });
      } catch (error) {
        console.error("Security dashboard load failed", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [today]);

  if (loading) {
    return (
      <div>
        <Header title="Security Dashboard" />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Security Dashboard" />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-500 text-white p-6 rounded-lg shadow">
            <p className="text-sm opacity-90">Visitors Today</p>
            <h3 className="text-3xl font-bold mt-2">{stats.todayVisitors}</h3>
          </div>
          <div className="bg-emerald-500 text-white p-6 rounded-lg shadow">
            <p className="text-sm opacity-90">Currently On Site</p>
            <h3 className="text-3xl font-bold mt-2">{stats.checkedIn}</h3>
          </div>
          <div className="bg-red-500 text-white p-6 rounded-lg shadow">
            <p className="text-sm opacity-90">Open Incidents</p>
            <h3 className="text-3xl font-bold mt-2">{stats.openIncidents}</h3>
          </div>
          <div className="bg-purple-500 text-white p-6 rounded-lg shadow">
            <p className="text-sm opacity-90">Attendance Records Today</p>
            <h3 className="text-3xl font-bold mt-2">{stats.attendanceRecords}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/security/visitors" className="p-4 bg-white rounded-lg shadow hover:bg-gray-50">
            <i className="fas fa-id-card text-blue-500 mr-2"></i>Visitor Log
          </Link>
          <Link to="/security/incidents" className="p-4 bg-white rounded-lg shadow hover:bg-gray-50">
            <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>Incident Reports
          </Link>
          <Link to="/security/attendance" className="p-4 bg-white rounded-lg shadow hover:bg-gray-50">
            <i className="fas fa-clipboard-check text-green-500 mr-2"></i>My Attendance
          </Link>
        </div>
      </div>
    </div>
  );
}
