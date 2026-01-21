import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function TishanyqLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/superadmin/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      localStorage.setItem("tishanyq_token", data.access);
      localStorage.setItem("tishanyq_user", JSON.stringify(data.user));
      navigate("/tishanyq/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl mx-auto mb-4 flex items-center justify-center">
            <i className="fas fa-shield-alt text-white text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Tishanyq Admin</h1>
          <p className="text-gray-500 text-sm mt-2">Developer Portal Access</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin@tishanyq.co.zw"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:bg-blue-300"
          >
            {loading ? (
              <span><i className="fas fa-spinner fa-spin mr-2"></i>Signing in...</span>
            ) : (
              <span><i className="fas fa-sign-in-alt mr-2"></i>Sign In</span>
            )}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Don't have an account?{" "}
          <Link to="/tishanyq/admin/register" className="text-blue-600 hover:text-blue-800 font-medium">
            Register here
          </Link>
        </p>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            <i className="fas fa-lock mr-1"></i>
            Secured by Tishanyq Digital
          </p>
        </div>
      </div>
    </div>
  );
}
