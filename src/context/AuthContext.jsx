import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Load auth state from localStorage on first render
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");
    if (savedUser && savedToken) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setToken(savedToken);

      // Refresh profile once on app load to hydrate newly added user fields
      fetch("/api/v1/auth/profile/", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${savedToken}`,
        },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((profile) => {
          if (!profile) return;
          setUser(profile);
          localStorage.setItem("user", JSON.stringify(profile));
        })
        .catch(() => {});
    }
  }, []);

  // Login: save user + token
  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
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
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
