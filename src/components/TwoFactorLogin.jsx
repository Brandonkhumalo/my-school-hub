import React, { useState } from 'react';
import apiService from '../services/apiService';

export default function TwoFactorLogin({ otpSessionToken, onSuccess, onCancel }) {
  const [activeTab, setActiveTab] = useState('totp'); // 'totp' | 'backup'
  const [code, setCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) { setError('Enter the 6-digit code from your app'); return; }
    setLoading(true); setError('');
    try {
      const resp = await apiService.twoFactorVerifyOtp({ otp_session_token: otpSessionToken, code, trust_device: trustDevice });
      onSuccess(resp.user, resp.token);
    } catch (err) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally { setLoading(false); }
  };

  const handleVerifyBackup = async (e) => {
    e.preventDefault();
    if (!backupCode || backupCode.length !== 8) { setError('Enter your 8-character backup code'); return; }
    setLoading(true); setError('');
    try {
      const resp = await apiService.twoFactorVerifyBackup({ otp_session_token: otpSessionToken, backup_code: backupCode.toUpperCase(), trust_device: trustDevice });
      if (resp.backup_codes_remaining <= 3) {
        // Could show a warning but proceed
      }
      onSuccess(resp.user, resp.token);
    } catch (err) {
      setError(err.message || 'Invalid backup code.');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
          <i className="fas fa-shield-alt text-blue-600 text-xl" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Two-Factor Authentication</h3>
        <p className="text-slate-500 text-sm mt-1">Enter the code from your authenticator app</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        {[['totp', 'Authenticator'], ['backup', 'Backup Code']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setError(''); setCode(''); setBackupCode(''); }}
            className={`flex-1 py-2 text-sm font-medium transition ${activeTab === key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700">
          <i className="fas fa-circle-exclamation flex-shrink-0" />
          {error}
        </div>
      )}

      {activeTab === 'totp' ? (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full text-center text-2xl tracking-widest font-mono border-2 border-gray-200 rounded-xl py-4 outline-none focus:border-blue-500 transition"
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} className="rounded" />
            Trust this device for 30 days
          </label>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyBackup} className="space-y-4">
          <input
            type="text"
            maxLength={8}
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            className="w-full text-center text-xl tracking-widest font-mono border-2 border-gray-200 rounded-xl py-4 outline-none focus:border-blue-500 transition"
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} className="rounded" />
            Trust this device
          </label>
          <button
            type="submit"
            disabled={loading || backupCode.length !== 8}
            className="w-full py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {loading ? 'Verifying...' : 'Use Backup Code'}
          </button>
        </form>
      )}

      <button onClick={onCancel} className="w-full py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition">
        &larr; Back to login
      </button>
    </div>
  );
}
