import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canStudentUseBoarding, isSchoolBoardingEnabled } from "../utils/boardingAccess";

function RequireBoardingAccess({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isSchoolBoardingEnabled(user)) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  if (user.role === "student" && !canStudentUseBoarding(user)) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  return children;
}

export default RequireBoardingAccess;
