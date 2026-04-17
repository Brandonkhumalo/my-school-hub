import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

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

  // Login: save user + token
  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    setAuthLoading(false);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", jwtToken);
  };

  // Logout: call backend to blacklist token, then clear storage + state
  const logout = async () => {
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
