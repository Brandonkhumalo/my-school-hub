import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

function RequireAuth({ children, allowedRoles }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isRootHrBoss = Boolean(user?.role === "hr" && user?.hr_is_root_boss);
  const canAccessAsRootHrBoss =
    isRootHrBoss && Array.isArray(allowedRoles) && allowedRoles.includes("admin");

  if (allowedRoles && !allowedRoles.includes(user.role) && !canAccessAsRootHrBoss) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  return children;
}

export default RequireAuth;
