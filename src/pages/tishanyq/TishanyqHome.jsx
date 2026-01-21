import React, { useEffect, useState } from "react";

export default function TishanyqHome() {
  const [stats, setStats] = useState({ schools: 0, admins: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("tishanyq_token");
      const response = await fetch("/api/auth/superadmin/stats/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Welcome to Tishanyq Admin</h1>
        <p className="text-gray-600 mt-2">Manage schools and their administrators from here</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Schools</p>
              <p className="text-3xl font-bold text-gray-800">{loading ? "..." : stats.schools}</p>
            </div>
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
              <i className="fas fa-school text-blue-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">School Admins</p>
              <p className="text-3xl font-bold text-gray-800">{loading ? "..." : stats.admins}</p>
            </div>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <i className="fas fa-user-shield text-green-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Active Sessions</p>
              <p className="text-3xl font-bold text-gray-800">1</p>
            </div>
            <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center">
              <i className="fas fa-users text-yellow-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            <i className="fas fa-bolt text-yellow-500 mr-2"></i>Quick Actions
          </h2>
          <div className="space-y-3">
            <a
              href="/tishanyq/admin/create-school"
              className="flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              <span className="font-medium text-blue-700">
                <i className="fas fa-plus mr-2"></i>Create New School
              </span>
              <i className="fas fa-chevron-right text-blue-500"></i>
            </a>
            <a
              href="/tishanyq/admin/schools"
              className="flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 rounded-lg transition"
            >
              <span className="font-medium text-green-700">
                <i className="fas fa-list mr-2"></i>View All Schools
              </span>
              <i className="fas fa-chevron-right text-green-500"></i>
            </a>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            <i className="fas fa-info-circle text-blue-500 mr-2"></i>System Info
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Platform</span>
              <span className="font-medium text-gray-800">MySchoolHub</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Developer</span>
              <span className="font-medium text-gray-800">Tishanyq Digital</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Website</span>
              <span className="font-medium text-blue-600">tishanyq.co.zw</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Version</span>
              <span className="font-medium text-gray-800">1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
