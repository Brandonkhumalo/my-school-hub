import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiService from "../../services/apiService";

function ParentRegister() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirm_password: "",
    first_name: "",
    last_name: "",
    email: "",
    phone_number: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!formData.username || !formData.password || !formData.first_name || !formData.last_name) {
      setError("Please fill in all required fields");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      setLoading(true);
      const registrationData = {
        username: formData.username,
        password: formData.password,
        confirm_password: formData.confirm_password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone_number: formData.phone_number,
        role: "parent"
      };

      await apiService.register(registrationData);
      setSuccess("Registration successful! Please login with your credentials.");
      
      // Clear form
      setFormData({
        username: "",
        password: "",
        confirm_password: "",
        first_name: "",
        last_name: "",
        email: "",
        phone_number: ""
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
      console.error("Registration error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Parent Registration</h1>
          <p className="text-gray-600 mt-2">Create your account to monitor your child's progress</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="first_name" className="block mb-2 text-sm font-medium text-gray-700">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Enter your first name"
                required
              />
            </div>

            <div>
              <label htmlFor="last_name" className="block mb-2 text-sm font-medium text-gray-700">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Enter your last name"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-700">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={formData.username}
              onChange={handleChange}
              placeholder="Choose a username"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email address"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="phone_number" className="block mb-2 text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone_number"
              name="phone_number"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="Enter your phone number"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.password}
                onChange={handleChange}
                placeholder="Choose a password"
                required
              />
            </div>

            <div>
              <label htmlFor="confirm_password" className="block mb-2 text-sm font-medium text-gray-700">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.confirm_password}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">Next Steps:</h3>
            <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
              <li>Register your account with your personal information</li>
              <li>Login with your credentials</li>
              <li>Your parent ID will be used to link you to your child's account</li>
              <li>Contact the school administrator to complete the linking process</li>
            </ol>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition duration-200 flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Creating Account...
              </>
            ) : (
              "Create Parent Account"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="text-green-600 hover:text-green-700 font-semibold">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ParentRegister;
