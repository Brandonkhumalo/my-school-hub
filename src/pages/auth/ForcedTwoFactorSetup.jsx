import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import TwoFactorSetup from "../../components/TwoFactorSetup";
import toast from "react-hot-toast";

export default function ForcedTwoFactorSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleComplete = () => {
    toast.success("2FA enabled! Your account is now secure.");
    const role = user?.role || "";
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

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-shield-exclamation text-red-500 text-2xl" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-800">2FA Setup Required</h2>
          <p className="text-slate-500 text-sm mt-2">
            Your school requires two-factor authentication. You must set it up before continuing.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-red-50 border border-red-100 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-red-600">Required — cannot be skipped</span>
          </div>
        </div>

        <TwoFactorSetup onComplete={handleComplete} onCancel={null} />
      </div>
    </div>
  );
}
