import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import toast from 'react-hot-toast';

export default function TrustedDevices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDevices(); }, []);

  const loadDevices = async () => {
    try {
      const data = await apiService.twoFactorTrustedDevices();
      setDevices(data.devices);
    } catch { toast.error('Failed to load trusted devices.'); }
    finally { setLoading(false); }
  };

  const revokeDevice = async (id) => {
    if (!confirm('Remove this trusted device?')) return;
    try {
      await apiService.twoFactorRevokeTrustedDevice(id);
      setDevices(d => d.filter(dev => dev.id !== id));
      toast.success('Device removed.');
    } catch { toast.error('Failed to remove device.'); }
  };

  const revokeAll = async () => {
    if (!confirm('Remove all trusted devices? You will need to verify 2FA on next login from all devices.')) return;
    try {
      await apiService.twoFactorRevokeTrustedDevice(null);
      setDevices([]);
      toast.success('All devices removed.');
    } catch { toast.error('Failed to remove devices.'); }
  };

  if (loading) return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-white">Trusted Devices</h3>
        {devices.length > 0 && (
          <button onClick={revokeAll} className="text-xs text-red-600 hover:text-red-700 font-medium">Revoke All</button>
        )}
      </div>
      {devices.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No trusted devices.</p>
      ) : (
        <div className="space-y-2">
          {devices.map(dev => (
            <div key={dev.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{dev.device_name}</p>
                <p className="text-xs text-gray-400">{dev.ip_address} · Last seen {new Date(dev.last_seen).toLocaleDateString()}</p>
              </div>
              <button onClick={() => revokeDevice(dev.id)} className="text-xs text-red-500 hover:text-red-600 font-medium ml-3">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
