import React, { useEffect, useState } from "react";
import apiService from "../../services/apiService";

const GRADING_SYSTEMS = ["percentage", "letter", "gpa"];
const CURRENCIES = ["USD", "ZWL", "ZAR", "GBP"];
const TIMEZONES = ["Africa/Harare", "Africa/Johannesburg", "UTC", "Africa/Nairobi"];

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    apiService.getSchoolSettings()
      .then(setSettings)
      .catch(() => setError("Failed to load school settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      await apiService.updateSchoolSettings(settings);
      setSuccess("Settings saved successfully.");
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-400">Loading settings...</div>;

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">School Settings</h1>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{success}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Academic Settings */}
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Academic Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Current Academic Year</label>
              <input type="text" className="border rounded w-full p-2 text-sm"
                placeholder="e.g. 2025" value={settings?.current_academic_year || ""}
                onChange={(e) => handleChange("current_academic_year", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Current Term</label>
              <select className="border rounded w-full p-2 text-sm"
                value={settings?.current_term || ""}
                onChange={(e) => handleChange("current_term", e.target.value)}>
                <option value="">Select term</option>
                {["Term 1", "Term 2", "Term 3"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Term Start Date</label>
              <input type="date" className="border rounded w-full p-2 text-sm"
                value={settings?.term_start_date || ""}
                onChange={(e) => handleChange("term_start_date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Term End Date</label>
              <input type="date" className="border rounded w-full p-2 text-sm"
                value={settings?.term_end_date || ""}
                onChange={(e) => handleChange("term_end_date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Grading System</label>
              <select className="border rounded w-full p-2 text-sm"
                value={settings?.grading_system || "percentage"}
                onChange={(e) => handleChange("grading_system", e.target.value)}>
                {GRADING_SYSTEMS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Max Students per Class</label>
              <input type="number" min="1" max="200" className="border rounded w-full p-2 text-sm"
                value={settings?.max_students_per_class || ""}
                onChange={(e) => handleChange("max_students_per_class", e.target.value)} />
            </div>
          </div>
        </section>

        {/* School Identity */}
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">School Identity</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">School Motto</label>
              <input type="text" className="border rounded w-full p-2 text-sm"
                value={settings?.school_motto || ""}
                onChange={(e) => handleChange("school_motto", e.target.value)} />
            </div>
          </div>
        </section>

        {/* Finance Settings */}
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Finance Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Currency</label>
              <select className="border rounded w-full p-2 text-sm"
                value={settings?.currency || "USD"}
                onChange={(e) => handleChange("currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Late Fee % (per month)</label>
              <input type="number" min="0" max="100" step="0.1" className="border rounded w-full p-2 text-sm"
                value={settings?.late_fee_percentage || ""}
                onChange={(e) => handleChange("late_fee_percentage", e.target.value)} />
            </div>
          </div>
        </section>

        {/* System Settings */}
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">System Settings</h2>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Timezone</label>
            <select className="border rounded w-full p-2 text-sm"
              value={settings?.timezone || "Africa/Harare"}
              onChange={(e) => handleChange("timezone", e.target.value)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </section>

        {/* PayNow Zimbabwe */}
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-1">PayNow Zimbabwe</h2>
          <p className="text-xs text-gray-500 mb-4">
            Enter your school&rsquo;s PayNow integration credentials. Get them from{" "}
            <a href="https://paynow.co.zw" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 underline">paynow.co.zw</a>{" "}
            under &ldquo;Integration Details&rdquo;.
          </p>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Integration ID</label>
              <input type="text" className="border rounded w-full p-2 text-sm font-mono"
                placeholder="e.g. 12345"
                value={settings?.paynow_integration_id || ""}
                onChange={(e) => handleChange("paynow_integration_id", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Integration Key</label>
              <input type="password" className="border rounded w-full p-2 text-sm font-mono"
                placeholder="Your PayNow integration key"
                value={settings?.paynow_integration_key || ""}
                onChange={(e) => handleChange("paynow_integration_key", e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Stored securely. Leave blank to keep the existing key.</p>
            </div>
          </div>
          {settings?.paynow_integration_id && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded px-3 py-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              PayNow credentials configured (ID: {settings.paynow_integration_id})
            </div>
          )}
        </section>

        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-60">
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
