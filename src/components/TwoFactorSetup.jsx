import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-xs text-blue-600 hover:text-blue-700 ml-2">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

export default function TwoFactorSetup({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backupSaved, setBackupSaved] = useState(false);

  useEffect(() => {
    initSetup();
  }, []);

  const initSetup = async () => {
    setLoading(true);
    try {
      const data = await apiService.twoFactorSetup();
      setSecret(data.secret);
      setQrCode(data.qr_code);
    } catch {
      setError('Failed to initialize 2FA setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (verifyCode.length !== 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true); setError('');
    try {
      const data = await apiService.twoFactorVerifySetup({ code: verifyCode });
      setBackupCodes(data.backup_codes);
      setStep(3);
    } catch {
      setError('Invalid code. Please try again with the current code from your app.');
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = backupCodes.join('\n');
    const blob = new Blob([`My School Hub - 2FA Backup Codes\nSave these in a safe place.\n\n${content}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '2fa-backup-codes.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && step === 1) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <React.Fragment key={s}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{s}</div>
            {s < 3 && <div className={`flex-1 h-1 rounded ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700">
          <i className="fas fa-circle-exclamation flex-shrink-0" />{error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Scan QR Code</h3>
            <p className="text-sm text-gray-500 mt-1">Scan this with Google Authenticator, Authy, or any TOTP app.</p>
          </div>
          {qrCode && <img src={qrCode} alt="QR Code" className="w-48 h-48 mx-auto border-2 border-gray-200 rounded-xl p-2" />}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Manual entry key:</p>
            <div className="flex items-center">
              <code className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">{secret}</code>
              <CopyButton text={secret} />
            </div>
          </div>
          <button onClick={() => setStep(2)} className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition">
            I&apos;ve scanned it &rarr; Next
          </button>
          {onCancel && (
            <button onClick={onCancel} className="w-full py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancel</button>
          )}
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Verify Code</h3>
            <p className="text-sm text-gray-500 mt-1">Enter the 6-digit code from your authenticator app to confirm setup.</p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full text-center text-2xl tracking-widest font-mono border-2 border-gray-200 rounded-xl py-4 outline-none focus:border-blue-500 transition"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || verifyCode.length !== 6}
            className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {loading ? 'Verifying...' : 'Verify & Enable 2FA'}
          </button>
          <button type="button" onClick={() => setStep(1)} className="w-full py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">&larr; Back</button>
        </form>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-check text-green-600 text-xl" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">2FA Enabled!</h3>
            <p className="text-sm text-gray-500 mt-1">Save these backup codes before closing.</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 mb-3 flex items-center gap-1">
              <i className="fas fa-triangle-exclamation" /> Store these somewhere safe — each can only be used once
            </p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <code key={i} className="text-sm font-mono bg-white border border-amber-200 rounded px-2 py-1 text-center">{code}</code>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadBackupCodes} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition">
              <i className="fas fa-download mr-1" /> Download
            </button>
            <button onClick={() => { navigator.clipboard.writeText(backupCodes.join('\n')); }} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition">
              <i className="fas fa-copy mr-1" /> Copy All
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={backupSaved} onChange={(e) => setBackupSaved(e.target.checked)} className="rounded" />
            <span className="text-gray-600">I&apos;ve saved my backup codes</span>
          </label>
          <button
            onClick={onComplete}
            disabled={!backupSaved}
            className="w-full py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 transition"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
