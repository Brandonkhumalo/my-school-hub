import React, { useState, useEffect } from 'react';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import apiService from '../../services/apiService';
import { Palette, Upload, Save, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function Customization() {
  const { fetchSettings } = useSchoolSettings();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [currentLogoUrl, setCurrentLogoUrl] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await apiService.getSchoolCustomization();
      if (data.primary_color) setPrimaryColor(data.primary_color);
      if (data.logo_url) setCurrentLogoUrl(data.logo_url);
    } catch (err) {
      toast.error('Failed to load customization settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveColor = async () => {
    setSavingSettings(true);
    try {
      await apiService.updateSchoolCustomization({ primary_color: primaryColor });
      toast.success('Color saved successfully!');
      fetchSettings(); // Refresh context
    } catch (err) {
      toast.error('Failed to save color.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const data = await apiService.uploadSchoolLogo(file);
      if (data.logo_url) setCurrentLogoUrl(data.logo_url);
      toast.success('Logo uploaded successfully!');
      fetchSettings(); // Refresh context
    } catch (err) {
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
    <div className="space-y-6 max-w-4xl mb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Customization</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Colors Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center space-x-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
            <Palette className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Theme Colors</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Primary Accent Color
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-20 rounded cursor-pointer border border-gray-200 dark:border-gray-600"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono text-sm px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full max-w-[120px]"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                This color will be used for buttons, active links, and highlights.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={handleSaveColor}
                disabled={savingSettings}
                className="btn-primary w-full md:w-auto"
                style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
              >
                {savingSettings ? (
                  <span className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <Save className="w-4 h-4" />
                    <span>Save Theme Color</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Logo Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center space-x-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
            <Upload className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">School Logo</h2>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800/50">
                {currentLogoUrl ? (
                  <img src={currentLogoUrl} alt="School Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <span className="text-gray-400 text-sm p-4 text-center">No logo uploaded</span>
                )}
              </div>
              
              <div className="w-full text-center">
                <label className="btn-secondary w-full md:w-auto cursor-pointer relative overflow-hidden inline-block">
                  <span className="flex items-center space-x-2 justify-center">
                    {uploadingLogo ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent)]"></div>
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
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Upload Guidelines</span>
              </h3>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>Recommended size: 500x500 pixels</li>
                <li>Format: PNG (transparent background) or JPG</li>
                <li>Max file size: 2MB</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Customization;
