import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiService from "../../services/apiService";
import TwoFactorLogin from "../../components/TwoFactorLogin";
import toast from "react-hot-toast";

function Login() {
  const navigate   = useNavigate();
  const { login }  = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [otpSessionToken, setOtpSessionToken] = useState('');
  const [suspendedModal, setSuspendedModal] = useState(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotForm, setForgotForm] = useState({
    identifier: "",
    phone_number: "",
    student_number: "",
    new_password: "",
    confirm_password: "",
  });

  const navigateByRole = (role) => {
    switch (role) {
      case "admin":      navigate("/admin");      break;
      case "hr":         navigate("/hr");         break;
      case "accountant": navigate("/accountant"); break;
      case "security":   navigate("/security");   break;
      case "cleaner":    navigate("/cleaner");    break;
      case "librarian":  navigate("/librarian");  break;
      case "teacher":    navigate("/teacher");    break;
      case "parent":     navigate("/parent");     break;
      case "student":    navigate("/student");    break;
      default:           navigate("/");
    }
  };

  const handleTwoFactorSuccess = (user, token) => {
    login(user, token);
    navigateByRole(user.role);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const response = await apiService.login({ username, password });

      // Handle 2FA challenge
      if (response.requires_2fa) {
        setOtpSessionToken(response.otp_session_token);
        setShowTwoFactor(true);
        return;
      }

      // Show 2FA enforcement warning if present
      if (response['2fa_warning']) {
        toast(response['2fa_warning'], { icon: '🔒', duration: 6000 });
      }

      login(response.user, response.token);
      navigateByRole(response.user.role);
    } catch (err) {
      if (err.response?.data?.error === "school_suspended_admin") {
        setSuspendedModal({ type: "admin", message: err.response.data.message, contact: err.response.data.contact });
      } else if (err.response?.data?.error === "school_suspended") {
        setSuspendedModal({ type: "user", message: err.response.data.message });
      } else {
        setError("Failed to login. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Suspended Modal ─────────────────────────────────────── */}
      {suspendedModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-2xl shadow-2xl max-w-md w-full p-7"
            style={{ background: "#fff" }}
          >
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-exclamation-triangle text-red-500 text-2xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">School Suspended</h3>
              <p className="text-gray-500 text-sm">{suspendedModal.message}</p>
            </div>
            {suspendedModal.type === "admin" && suspendedModal.contact && (
              <div className="bg-blue-50 rounded-xl p-4 mb-5 text-sm">
                <p className="font-semibold text-blue-800 mb-2">Contact Tishanyq Digital:</p>
                <div className="space-y-1 text-blue-700">
                  {suspendedModal.contact.phone?.map((ph, i) => (
                    <p key={i}><i className="fas fa-phone mr-2" />{ph}</p>
                  ))}
                  <p><i className="fas fa-envelope mr-2" />{suspendedModal.contact.email}</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setSuspendedModal(null)}
              className="w-full py-3 rounded-xl font-semibold text-white transition"
              style={{ background: "#1e293b" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl shadow-2xl max-w-lg w-full p-7 bg-white">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Parent Forgot Password</h3>
            <p className="text-sm text-gray-600 mb-4">
              Verify your details and your child&apos;s student number to reset your password.
            </p>

            {forgotError && (
              <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                {forgotError}
              </div>
            )}
            {forgotSuccess && (
              <div className="mb-3 px-3 py-2 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
                {forgotSuccess}
              </div>
            )}

            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setForgotError("");
                setForgotSuccess("");
                try {
                  setForgotLoading(true);
                  const response = await apiService.parentForgotPassword(forgotForm);
                  setForgotSuccess(response?.message || "Password reset successful.");
                  setForgotForm({
                    identifier: "",
                    phone_number: "",
                    student_number: "",
                    new_password: "",
                    confirm_password: "",
                  });
                } catch (err) {
                  setForgotError(err.message || "Unable to reset password.");
                } finally {
                  setForgotLoading(false);
                }
              }}
            >
              <input
                required
                type="text"
                placeholder="Username or email"
                value={forgotForm.identifier}
                onChange={(e) => setForgotForm({ ...forgotForm, identifier: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                required
                type="text"
                placeholder="Phone number"
                value={forgotForm.phone_number}
                onChange={(e) => setForgotForm({ ...forgotForm, phone_number: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                required
                type="text"
                placeholder="Child's student number"
                value={forgotForm.student_number}
                onChange={(e) => setForgotForm({ ...forgotForm, student_number: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                required
                type="password"
                placeholder="New password"
                value={forgotForm.new_password}
                onChange={(e) => setForgotForm({ ...forgotForm, new_password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                required
                type="password"
                placeholder="Confirm new password"
                value={forgotForm.confirm_password}
                onChange={(e) => setForgotForm({ ...forgotForm, confirm_password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotError("");
                    setForgotSuccess("");
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {forgotLoading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── LEFT PANEL — Branding ─────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between p-10"
        style={{
          width: "45%",
          background: "linear-gradient(145deg, #0f172a 0%, #1e3a6e 60%, #0f172a 100%)",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <i className="fas fa-graduation-cap text-white text-lg" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">MySchoolHub</p>
            <p className="text-blue-400 text-xs">by Tishanyq Digital</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 px-3 py-1.5 rounded-full mb-5">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-amber-300 text-xs font-semibold tracking-wide">BUILT FOR ZIMBABWEAN SCHOOLS</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white leading-tight">
              Your School.<br />
              <span className="text-blue-400">One Dashboard.</span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mt-3 max-w-xs">
              Manage students, fees, results, attendance and parent communication — all in one place.
            </p>
          </div>

          {/* Feature bullets */}
          <ul className="space-y-3">
            {[
              { icon: "fa-chart-bar",      text: "Real-time academic analytics" },
              { icon: "fa-credit-card",    text: "Fee & invoice management" },
              { icon: "fa-comment-dots",   text: "WhatsApp parent alerts" },
              { icon: "fa-robot",          text: "AI performance predictions" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                  <i className={`fas ${f.icon} text-blue-300 text-xs`} />
                </span>
                <span className="text-slate-300 text-sm">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <p className="text-slate-600 text-xs">
          © {new Date().getFullYear()} Tishanyq Digital · Harare, Zimbabwe
        </p>
      </div>

      {/* ── RIGHT PANEL — Form ───────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12"
        style={{ background: "#f8fafc" }}
      >
        <div className="w-full max-w-md">

          {/* Back link */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm mb-8 transition hover:opacity-70"
            style={{ color: "#64748b" }}
          >
            <i className="fas fa-arrow-left text-xs" /> Back to Home
          </button>

          {showTwoFactor ? (
            <TwoFactorLogin
              otpSessionToken={otpSessionToken}
              onSuccess={handleTwoFactorSuccess}
              onCancel={() => { setShowTwoFactor(false); setOtpSessionToken(''); }}
            />
          ) : (
            <>
              {/* Form header */}
              <div className="mb-8">
                {/* Mobile logo */}
                <div className="flex items-center gap-2 mb-5 lg:hidden">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                    <i className="fas fa-graduation-cap text-white text-sm" />
                  </div>
                  <span className="font-bold text-slate-800">MySchoolHub</span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800">Welcome back 👋</h2>
                <p className="text-slate-500 text-sm mt-1">Sign in to access your portal</p>
              </div>

              {/* Error alert */}
              {error && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 text-sm"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
                >
                  <i className="fas fa-circle-exclamation flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Username */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "#374151" }}>
                    Student Number / Email
                  </label>
                  <div className="relative">
                    <i
                      className="fas fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-sm"
                      style={{ color: "#94a3b8" }}
                    />
                    <input
                      type="text"
                      id="login-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your student number or email"
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition"
                      style={{
                        background: "#fff",
                        border: "1.5px solid #e2e8f0",
                        color: "#0f172a",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                      onBlur={(e)  => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "#374151" }}>
                    Password
                  </label>
                  <div className="relative">
                    <i
                      className="fas fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-sm"
                      style={{ color: "#94a3b8" }}
                    />
                    <input
                      type={showPw ? "text" : "password"}
                      id="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-11 py-3 rounded-xl text-sm outline-none transition"
                      style={{
                        background: "#fff",
                        border: "1.5px solid #e2e8f0",
                        color: "#0f172a",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                      onBlur={(e)  => (e.target.style.borderColor = "#e2e8f0")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2"
                      style={{ color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}
                    >
                      <i className={`fas ${showPw ? "fa-eye-slash" : "fa-eye"} text-sm`} />
                    </button>
                  </div>
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Parent forgot password?
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition"
                  style={{
                    background: loading
                      ? "#93c5fd"
                      : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? (
                    <>
                      <div
                        className="w-5 h-5 rounded-full animate-spin"
                        style={{ border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                      />
                      Signing In…
                    </>
                  ) : (
                    <>
                      Sign In <i className="fas fa-arrow-right text-sm" />
                    </>
                  )}
                </button>
              </form>

              {/* Footer links */}
              <div className="mt-6 text-center space-y-2">
                <p className="text-sm" style={{ color: "#64748b" }}>
                  Are you a parent?{" "}
                  <a href="/register/parent" className="font-semibold text-blue-600 hover:text-blue-700 transition">
                    Register here
                  </a>
                </p>
                <p className="text-xs" style={{ color: "#94a3b8" }}>
                  Staff and students: Contact your administrator
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
