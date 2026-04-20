import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import apiService from "../services/apiService";

const SchoolSettingsContext = createContext();

export function SchoolSettingsProvider({ children }) {
  const { user, token } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await apiService.getCurrentAcademicPeriod();
      setSettings(data);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (user && token) {
      fetchSettings();
    } else {
      setSettings(null);
      setLoaded(false);
    }
  }, [user, token, fetchSettings]);

  // Convenience accessors — all sourced from whatever the admin set
  const value = {
    settings,
    loaded,
    refreshSettings: fetchSettings,
    // Academic
    currentAcademicYear: settings?.current_academic_year || "",
    currentTerm: settings?.current_term || "",
    gradingSystem: settings?.grading_system || "",
    maxStudentsPerClass: settings?.max_students_per_class || "",
    // Calendar
    term1Start: settings?.term_1_start || "",
    term1End: settings?.term_1_end || "",
    term2Start: settings?.term_2_start || "",
    term2End: settings?.term_2_end || "",
    term3Start: settings?.term_3_start || "",
    term3End: settings?.term_3_end || "",
    // Identity
    schoolMotto: settings?.school_motto || "",
    primaryColor: settings?.primary_color || "",
    logoUrl: settings?.logo_url || "",
    // Finance
    currency: settings?.currency || "",
    lateFeePercentage: settings?.late_fee_percentage ?? "",
    // System
    timezone: settings?.timezone || "",
  };

  useEffect(() => {
    if (settings?.primary_color) {
      document.documentElement.style.setProperty('--accent', settings.primary_color);
      document.documentElement.style.setProperty('--sidebar-active', settings.primary_color);
    }
  }, [settings?.primary_color]);

  return (
    <SchoolSettingsContext.Provider value={value}>
      {children}
    </SchoolSettingsContext.Provider>
  );
}

export function useSchoolSettings() {
  return useContext(SchoolSettingsContext);
}
