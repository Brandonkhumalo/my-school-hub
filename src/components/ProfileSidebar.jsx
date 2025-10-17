function ProfileSidebar({ user, activeTab, setActiveTab, handleLogout }) {
  return (
    <div className="w-full md:w-1/3 bg-blue-800 p-6 text-white">
      <div className="flex flex-col items-center mb-6">
        <div className="w-24 h-24 bg-white text-blue-800 rounded-full flex items-center justify-center text-3xl font-bold mb-4">
          {user?.full_name?.charAt(0) || "U"}
        </div>
        <h2 className="text-xl font-bold">{user?.full_name}</h2>
        <p className="text-blue-300 capitalize">{user?.role}</p>
      </div>
      
      <nav>
        <ul>
          <li className="mb-2">
            <button onClick={() => setActiveTab("profile")} className={`w-full text-left py-2 px-3 rounded-md ${activeTab === "profile" ? 'bg-blue-900' : 'hover:bg-blue-700'}`}>
              <i className="fas fa-user mr-2"></i> Profile Information
            </button>
          </li>
          <li className="mb-2">
            <button onClick={() => setActiveTab("security")} className={`w-full text-left py-2 px-3 rounded-md ${activeTab === "security" ? 'bg-blue-900' : 'hover:bg-blue-700'}`}>
              <i className="fas fa-lock mr-2"></i> Security
            </button>
          </li>
          <li className="mb-2">
            <button onClick={() => setActiveTab("whatsapp")} className={`w-full text-left py-2 px-3 rounded-md ${activeTab === "whatsapp" ? 'bg-blue-900' : 'hover:bg-blue-700'}`}>
              <i className="fab fa-whatsapp mr-2"></i> WhatsApp PIN
            </button>
          </li>
          <li className="mt-8">
            <button onClick={handleLogout} className="w-full text-left py-2 px-3 rounded-md hover:bg-red-700 bg-red-600">
              <i className="fas fa-sign-out-alt mr-2"></i> Logout
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
