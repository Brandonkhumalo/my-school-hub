import React, { createContext, useContext, useState, useEffect } from "react";
import { clearUserCache, setMetaToken, setMetaUserId, clearMetaToken } from "../utils/offlineDB.js";
import apiService from "../services/apiService.jsx";

const AuthContext = createContext();

// Pre-fetch key endpoints per role so data is cached before going offline
function runCacheWarmup(role) {
  const roleEndpoints = {
    student: [
      () => apiService.getStudentDashboardStats(),
      () => apiService.getStudentTimetable(),
      () => apiService.getStudentMarks(),
      () => apiService.getStudentHomework(),
      () => apiService.getStudentAnnouncements(),
    ],
    parent: [
      () => apiService.getParentChildren(),
      () => apiService.getParentHomework(),
      () => apiService.fetchAnnouncements(),
    ],
    teacher: [
      () => apiService.getTeacherClasses(),
      () => apiService.getTeacherSubjects(),
      () => apiService.getTeacherHomework(),
      () => apiService.fetchAnnouncements(),
    ],
    admin: [
      () => apiService.getDashboardStats(),
      () => apiService.fetchAnnouncements(),
      () => apiService.fetchClasses(),
    ],
    hr: [
      () => apiService.getHRDashboardStats(),
      () => apiService.getDepartments(),
    ],
    accountant: [
      () => apiService.getDashboardStats(),
      () => apiService.fetchFeeTypes(),
    ],
    librarian: [
      () => apiService.getBooks(),
      () => apiService.getLoans(),
    ],
  };

  const sharedFetchers = [
    () => apiService.getUnreadNotificationCount(),
    () => apiService.getSchoolCustomization(),
  ];

  const fetchers = [...sharedFetchers, ...(roleEndpoints[role] || [])];

  // Fire-and-forget after a short delay to not block login flow
  setTimeout(() => {
    fetchers.forEach((fn) => fn().catch(() => {}));
  }, 800);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Load auth state from localStorage on first render
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const savedUser = localStorage.getItem("user");
      const savedToken = localStorage.getItem("token");

      if (!savedUser || !savedToken) {
        if (isMounted) setAuthLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);
        if (isMounted) {
          setUser(parsedUser);
          setToken(savedToken);
        }

        // Refresh profile once on app load to hydrate newly added user fields
        const res = await fetch("/api/v1/auth/profile/", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${savedToken}`,
          },
        });
        if (!res.ok) return;

        const profile = await res.json();
        if (!profile) return;

        if (isMounted) {
          setUser(profile);
          localStorage.setItem("user", JSON.stringify(profile));
        }
      } catch {
        // Ignore and keep fallback local auth state.
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    initializeAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Login: save user + token, write meta to IndexedDB for SW sync queue, warm cache
  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    setAuthLoading(false);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", jwtToken);

    const userId = userData?.id || userData?.user_id;
    setMetaToken(jwtToken).catch(() => {});
    if (userId) setMetaUserId(userId).catch(() => {});

    runCacheWarmup(userData?.role);
  };

  // Logout: blacklist token, clear storage + IndexedDB cache
  const logout = async () => {
    const currentUser = user;
    try {
      const savedToken = localStorage.getItem("token");
      if (savedToken) {
        await fetch("https://myschoolhub.co.zw/api/v1/auth/logout/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${savedToken}`,
          },
        });
      }
    } catch (e) {
      // Continue logout even if backend call fails
    }

    // Clear IndexedDB user cache
    const userId = currentUser?.id || currentUser?.user_id;
    if (userId) clearUserCache(userId).catch(() => {});
    clearMetaToken().catch(() => {});

    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    setAuthLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, authLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
