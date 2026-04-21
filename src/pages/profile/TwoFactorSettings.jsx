import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import TwoFactorSetup from '../../components/TwoFactorSetup';
import TrustedDevices from '../../components/TrustedDevices';
import toast from 'react-hot-toast';

export default function TwoFactorSettings() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [showNewBackupCodes, setShowNewBackupCodes] = useState(null);

  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    try {
      const data = await apiService.twoFactorStatus();
      setStatus(data);
    } catch { toast.error('Failed to load 2FA status.'); }
    finally { setLoading(false); }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    setDisableLoading(true);
    try {
      await apiService.twoFactorDisable({ password: disablePassword });
      toast.success('2FA disabled.');
      setShowDisableForm(false);
      setDisablePassword('');
      loadStatus();
    } catch { toast.error('Incorrect password or error disabling 2FA.'); }
    finally { setDisableLoading(false); }
  };

  const handleRegenBackup = async () => {
    if (!confirm('Regenerate backup codes? Your old codes will stop working.')) return;
    try {
      const data = await apiService.twoFactorRegenerateBackupCodes();
      setShowNewBackupCodes(data.backup_codes);
      toast.success('New backup codes generated!');
    } catch { toast.error('Failed to regenerate backup codes.'); }
  };

  if (loading) return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />;

  if (showSetup) {
    return (
      <div className="max-w-md mx-auto">
        <TwoFactorSetup onComplete={() => { setShowSetup(false); loadStatus(); toast.success('2FA is now active!'); }} onCancel={() => setShowSetup(false)} />
      </div>
    );
  }

  if (showDevices) {
    return (
      <div>
        <button onClick={() => setShowDevices(false)} className="flex items-center gap-1 text-sm text-blue-600 mb-4">
          <i className="fas fa-arrow-left" /> Back to 2FA Settings
        </button>
        <TrustedDevices />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Two-Factor Authentication</h3>
          <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${status?.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {status?.is_enabled ? 'Enabled' : 'Disabled'}
        </div>
      </div>

      {/* Enforcement warning */}
      {status?.enforcement?.is_enforced && !status?.is_enabled && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <i className="fas fa-triangle-exclamation text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">2FA Required by Your School</p>
            {status.enforcement.deadline && (
              <p className="text-xs text-amber-700 mt-0.5">
                Deadline: {new Date(status.enforcement.deadline).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {status?.is_enabled ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm">
            <i className="fas fa-key text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">
              {status.has_backup_codes ? 'Backup codes available' : 'No backup codes — regenerate recommended'}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleRegenBackup} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition">
              <i className="fas fa-refresh text-xs" /> Regenerate Backup Codes
            </button>
            <button onClick={() => setShowDevices(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition">
              <i className="fas fa-laptop text-xs" /> Trusted Devices ({status.trusted_devices_count})
            </button>
            <button onClick={() => setShowDisableForm(!showDisableForm)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition">
              <i className="fas fa-shield-slash text-xs" /> Disable 2FA
            </button>
          </div>

          {showDisableForm && (
            <form onSubmit={handleDisable} className="flex gap-2 mt-2">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Confirm your password"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
              <button type="submit" disabled={disableLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60">
                {disableLoading ? '...' : 'Confirm'}
              </button>
            </form>
          )}

          {showNewBackupCodes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-2">
              <p className="text-xs font-semibold text-amber-800 mb-2">New Backup Codes — Save these now:</p>
              <div className="grid grid-cols-2 gap-1">
                {showNewBackupCodes.map((c, i) => <code key={i} className="text-xs font-mono bg-white border border-amber-200 rounded px-2 py-0.5 text-center">{c}</code>)}
              </div>
              <button onClick={() => setShowNewBackupCodes(null)} className="text-xs text-amber-700 mt-2 hover:underline">Dismiss</button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowSetup(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition"
        >
          <i className="fas fa-shield-alt" /> Enable 2FA
        </button>
      )}
    </div>
  );
}
