import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

function Sidebar({ items, role }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="fixed top-4 left-4 z-40 md:hidden bg-blue-800 text-white p-2 rounded-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        <i className={`fas ${isOpen ? "fa-times" : "fa-bars"}`}></i>
      </button>

      {/* Sidebar */}
      <div className={`sidebar bg-blue-900 text-white py-8 px-4 z-30 ${isOpen ? "show" : ""}`}>
        <div className="flex items-center justify-center mb-8">
          <i className="fas fa-school text-3xl mr-3"></i>
          <div>
            <h2 className="text-xl font-bold">School System</h2>
            <p className="text-sm text-blue-300 capitalize">{role} Dashboard</p>
          </div>
        </div>

        <nav>
          <ul>
            {items.map((item, index) => (
              <li key={index} className="mb-1">
                <Link
                  to={item.path}
                  className={`sidebar-link flex items-center ${
                    location.pathname === item.path ? "active bg-blue-800" : ""
                  }`}
                >
                  {item.icon && <i className={`${item.icon} mr-3 w-5`}></i>}
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto pt-8">
          <Link to="/profile" className="sidebar-link flex items-center mb-2">
            <i className="fas fa-user-circle mr-3"></i> Profile
          </Link>
          <Link to="/logout" className="sidebar-link flex items-center">
            <i className="fas fa-sign-out-alt mr-3"></i> Logout
          </Link>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
