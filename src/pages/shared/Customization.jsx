import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import apiService from '../../services/apiService';
import { Palette, Upload, Save, CheckCircle, Type, MessageSquare, Sparkles, EyeOff, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

const COLOR_PRESETS = [
  { name: 'Ocean Blue', primary: '#2563eb', secondary: '#dbeafe' },
  { name: 'Forest Green', primary: '#16a34a', secondary: '#dcfce7' },
  { name: 'Royal Purple', primary: '#7c3aed', secondary: '#ede9fe' },
  { name: 'Sunset Orange', primary: '#ea580c', secondary: '#ffedd5' },
  { name: 'Rose Pink', primary: '#e11d48', secondary: '#ffe4e6' },
  { name: 'Slate Grey', primary: '#475569', secondary: '#f1f5f9' },
  { name: 'Teal', primary: '#0d9488', secondary: '#ccfbf1' },
  { name: 'Amber Gold', primary: '#d97706', secondary: '#fef3c7' },
];

const FONT_OPTIONS = [
  { value: 'sans', label: 'Sans-Serif', description: 'Modern & clean', sample: 'Aa' },
  { value: 'serif', label: 'Serif', description: 'Classic & formal', sample: 'Aa' },
  { value: 'mono', label: 'Monospace', description: 'Technical & precise', sample: 'Aa' },
];

function Customization() {
  const { user } = useAuth();
  const { refreshSettings } = useSchoolSettings();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#dbeafe');
  const [fontFamily, setFontFamily] = useState('sans');
  const [schoolName, setSchoolName] = useState('');
  const [schoolMotto, setSchoolMotto] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [currentLogoUrl, setCurrentLogoUrl] = useState('');

  // Page visibility + parent block (admin only)
  const [availablePages, setAvailablePages] = useState([]);
  const [hiddenPages, setHiddenPages] = useState([]);
  const [parentBlocked, setParentBlocked] = useState(false);
  const [parentBlockMessage, setParentBlockMessage] = useState('');
  const [parentBlockedUntil, setParentBlockedUntil] = useState('');

  useEffect(() => {
    loadSettings();
    if (isAdmin) {
      apiService.getAvailablePages()
        .then((res) => setAvailablePages(res?.pages || []))
        .catch(() => {});
    }
  }, [isAdmin]);

  const loadSettings = async () => {
    try {
      const data = await apiService.getSchoolCustomization();
      if (data.primary_color) setPrimaryColor(data.primary_color);
      if (data.secondary_color) setSecondaryColor(data.secondary_color);
      if (data.font_family) setFontFamily(data.font_family);
      if (data.school_name) setSchoolName(data.school_name);
      if (data.school_motto != null) setSchoolMotto(data.school_motto);
      if (data.welcome_message != null) setWelcomeMessage(data.welcome_message);
      if (data.logo_url) setCurrentLogoUrl(data.logo_url);
      if (Array.isArray(data.hidden_pages)) setHiddenPages(data.hidden_pages);
      setParentBlocked(Boolean(data.parent_login_blocked));
      setParentBlockMessage(data.parent_login_block_message || '');
      if (data.parent_login_blocked_until) {
        // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
        const d = new Date(data.parent_login_blocked_until);
        if (!Number.isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          setParentBlockedUntil(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          );
        }
      } else {
        setParentBlockedUntil('');
      }
    } catch {
      toast.error('Failed to load customization settings.');
    } finally {
      setLoading(false);
    }
  };

  const togglePageHidden = (key) => {
    setHiddenPages((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const applyPreset = (preset) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
  };

  const handleSave = async () => {
    if (isAdmin && parentBlocked && !parentBlockMessage.trim()) {
      toast.error('Please write a message to show parents before blocking their login.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        font_family: fontFamily,
        school_motto: schoolMotto,
        welcome_message: welcomeMessage,
      };
      if (isAdmin) {
        payload.hidden_pages = hiddenPages;
        payload.parent_login_blocked = parentBlocked;
        payload.parent_login_block_message = parentBlockMessage;
        payload.parent_login_blocked_until = parentBlockedUntil
          ? new Date(parentBlockedUntil).toISOString()
          : null;
      }
      await apiService.updateSchoolCustomization(payload);
      toast.success('Customization saved!');
      refreshSettings();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save customization.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      e.target.value = '';
      return;
    }
    setUploadingLogo(true);
    try {
      const data = await apiService.uploadSchoolLogo(file);
      if (data.logo_url) setCurrentLogoUrl(data.logo_url);
      toast.success('Logo uploaded successfully!');
      refreshSettings();
    } catch {
      toast.error('Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Customization</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center space-x-2"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save All Changes</span>
            </>
          )}
        </button>
      </div>

      {/* Color Presets */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center space-x-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
          <Sparkles className="w-6 h-6 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Color Presets</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">— Pick a palette to get started quickly</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="group relative rounded-lg p-3 border-2 transition-all hover:shadow-md"
              style={{
                borderColor: primaryColor === preset.primary ? preset.primary : 'transparent',
                backgroundColor: preset.secondary,
              }}
            >
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: preset.primary }} />
                <div className="w-5 h-5 rounded-full shadow-sm border border-gray-200" style={{ backgroundColor: preset.secondary }} />
              </div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-800">{preset.name}</p>
              {primaryColor === preset.primary && (
                <CheckCircle className="absolute top-2 right-2 w-4 h-4" style={{ color: preset.primary }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Colors Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center space-x-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
            <Palette className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Theme Colors</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Primary Accent Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-16 rounded cursor-pointer border border-gray-200 dark:border-gray-600"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono text-sm px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white w-28"
                />
                <div className="flex-1 h-9 rounded-md shadow-inner" style={{ backgroundColor: primaryColor }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Buttons, active links, highlights</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Secondary Accent Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-16 rounded cursor-pointer border border-gray-200 dark:border-gray-600"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="font-mono text-sm px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white w-28"
                />
                <div className="flex-1 h-9 rounded-md shadow-inner border border-gray-200 dark:border-gray-600" style={{ backgroundColor: secondaryColor }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Backgrounds, badges, cards</p>
            </div>

            {/* Live preview strip */}
            <div className="pt-2">
              <p className="text-xs text-gray-500 mb-2">Live preview</p>
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                <div className="h-8 flex items-center px-3 space-x-2" style={{ backgroundColor: primaryColor }}>
                  <div className="w-2 h-2 rounded-full bg-white opacity-80" />
                  <div className="w-16 h-2 rounded bg-white opacity-60" />
                </div>
                <div className="h-10 flex items-center px-3 space-x-2" style={{ backgroundColor: secondaryColor }}>
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: primaryColor }} />
                  <div className="w-20 h-2 rounded bg-gray-400 opacity-60" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Logo Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center space-x-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
            <Upload className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">School Logo</h2>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800/50">
              {currentLogoUrl ? (
                <img src={currentLogoUrl} alt="School Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <span className="text-gray-400 text-sm p-4 text-center">No logo</span>
              )}
            </div>

            <label className="btn-secondary cursor-pointer relative overflow-hidden inline-block">
              <span className="flex items-center space-x-2">
                {uploadingLogo ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent)]" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{uploadingLogo ? 'Uploading...' : 'Upload New Logo'}</span>
              </span>
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
              />
            </label>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Upload Guidelines</span>
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li>Recommended size: 500×500 pixels</li>
              <li>Format: PNG (transparent) or JPG</li>
              <li>Max file size: 10MB</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center space-x-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
          <Type className="w-6 h-6 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Typography</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FONT_OPTIONS.map((opt) => {
            const fontStyle = {
              sans: 'ui-sans-serif, system-ui, sans-serif',
              serif: 'ui-serif, Georgia, serif',
              mono: 'ui-monospace, monospace',
            }[opt.value];
            return (
              <button
                key={opt.value}
                onClick={() => setFontFamily(opt.value)}
                className="rounded-xl border-2 p-4 text-left transition-all hover:shadow-md"
                style={{ borderColor: fontFamily === opt.value ? primaryColor : 'transparent', backgroundColor: fontFamily === opt.value ? secondaryColor : '' }}
              >
                <p className="text-3xl font-bold text-gray-800 dark:text-white mb-1" style={{ fontFamily: fontStyle }}>{opt.sample}</p>
                <p className="font-semibold text-sm text-gray-700 dark:text-gray-200" style={{ fontFamily: fontStyle }}>{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.description}</p>
                {fontFamily === opt.value && (
                  <CheckCircle className="mt-2 w-4 h-4" style={{ color: primaryColor }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Identity Text */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-5">
        <div className="flex items-center space-x-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
          <MessageSquare className="w-6 h-6 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">School Identity</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            School Name Preview
          </label>
          <div className="rounded-md border border-gray-200 dark:border-gray-600 px-3 py-2 bg-gray-50 dark:bg-gray-700/40">
            <strong className="text-gray-900 dark:text-white">{schoolName || 'Your School Name'}</strong>
          </div>
          <p className="text-xs text-gray-500 mt-1">School name is always rendered in bold.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            School Motto
          </label>
          <input
            type="text"
            value={schoolMotto}
            onChange={(e) => setSchoolMotto(e.target.value)}
            placeholder="e.g. Excellence Through Knowledge"
            maxLength={255}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Displayed in the sidebar and on report cards</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Dashboard Welcome Message
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="e.g. Welcome back! We hope you have a great term ahead."
            rows={3}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">Shown on the admin dashboard home page</p>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center space-x-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
            <EyeOff className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Enabled Features</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
              — Uncheck pages your school doesn&apos;t use. Hidden pages disappear from everyone&apos;s sidebar.
            </span>
          </div>

          {availablePages.length === 0 ? (
            <p className="text-sm text-gray-500">Loading page list…</p>
          ) : (
            Object.entries(
              availablePages.reduce((acc, p) => {
                const k = `${p.role} — ${p.group}`;
                (acc[k] = acc[k] || []).push(p);
                return acc;
              }, {})
            ).map(([heading, pages]) => (
              <div key={heading} className="space-y-2">
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">{heading}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {pages.map((p) => {
                    const checked = !hiddenPages.includes(p.key);
                    const locked = p.always_on;
                    return (
                      <label
                        key={p.key}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-md border text-sm ${
                          locked
                            ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                            : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={() => !locked && togglePageHidden(p.key)}
                          className="accent-[var(--accent)]"
                        />
                        <span className={`truncate ${locked ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                          {p.label}
                        </span>
                        {locked && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center space-x-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
            <Lock className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Parent Access</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
              — Temporarily block every parent from signing in
            </span>
          </div>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={parentBlocked}
              onChange={(e) => setParentBlocked(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Block all parent logins
            </span>
          </label>

          {parentBlocked && (
            <div className="space-y-4 pl-7">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message to parents <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={parentBlockMessage}
                  onChange={(e) => setParentBlockMessage(e.target.value)}
                  required
                  placeholder="e.g. The parent portal is closed while term-end reports are being finalised."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Shown on the login page when a parent tries to sign in. Required.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expected unblock date &amp; time (optional)
                </label>
                <input
                  type="datetime-local"
                  value={parentBlockedUntil}
                  onChange={(e) => setParentBlockedUntil(e.target.value)}
                  className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Shown to parents as when they can try logging in again. Does not auto-unblock — you control that with the toggle above.
                </p>
              </div>
            </div>
          )}

          {!parentBlocked && parentBlockMessage && (
            <p className="text-xs text-gray-500 pl-7">
              Previous message (will be shown again if you re-enable the block): &quot;{parentBlockMessage}&quot;
            </p>
          )}
        </div>
      )}

    </div>
  );
}

export default Customization;
