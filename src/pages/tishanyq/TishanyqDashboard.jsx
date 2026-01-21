import React, { useEffect, useState } from "react";
import { useNavigate, Link, Outlet, useLocation } from "react-router-dom";

export default function TishanyqDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("tishanyq_token");
    const userData = localStorage.getItem("tishanyq_user");
    
    if (!token || !userData) {
      navigate("/tishanyq/admin/login");
      return;
    }
    
    setUser(JSON.parse(userData));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("tishanyq_token");
    localStorage.removeItem("tishanyq_user");
    navigate("/tishanyq/admin/login");
  };

  const isActive = (path) => location.pathname === path;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-code text-gray-900"></i>
            </div>
            <div>
              <h1 className="font-bold text-lg">Tishanyq</h1>
              <p className="text-xs text-gray-400">Developer Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <Link
                to="/tishanyq/admin/dashboard"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive("/tishanyq/admin/dashboard")
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                <i className="fas fa-home w-5"></i>
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/tishanyq/admin/create-school"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive("/tishanyq/admin/create-school")
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                <i className="fas fa-plus-circle w-5"></i>
                Create School
              </Link>
            </li>
            <li>
              <Link
                to="/tishanyq/admin/schools"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive("/tishanyq/admin/schools")
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                <i className="fas fa-school w-5"></i>
                Schools
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <i className="fas fa-user text-white"></i>
            </div>
            <div>
              <p className="font-medium text-sm">{user.full_name}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition"
          >
            <i className="fas fa-sign-out-alt mr-2"></i>Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
