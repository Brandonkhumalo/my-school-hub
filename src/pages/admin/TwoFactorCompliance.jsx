import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import Header from '../../components/Header';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

const AVAILABLE_ROLES = ['admin', 'teacher', 'student', 'parent', 'hr', 'accountant', 'security', 'cleaner', 'librarian'];

export default function TwoFactorCompliance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEnforceModal, setShowEnforceModal] = useState(false);
  const [enforceForm, setEnforceForm] = useState({ roles: [], grace_period_days: 14 });
  const [enforcing, setEnforcing] = useState(false);
  const [expandedRole, setExpandedRole] = useState(null);

  useEffect(() => { loadCompliance(); }, []);

  const loadCompliance = async () => {
    try {
      const resp = await apiService.twoFactorCompliance();
      setData(resp);
      if (resp.enforced_roles?.length) {
        setEnforceForm({ roles: resp.enforced_roles, grace_period_days: resp.grace_period_days });
      }
    } catch { toast.error('Failed to load compliance data.'); }
    finally { setLoading(false); }
  };

  const handleEnforce = async () => {
    if (enforceForm.roles.length === 0) { toast.error('Select at least one role.'); return; }
    setEnforcing(true);
    try {
      const resp = await apiService.enforce2FA({ enforce: true, roles: enforceForm.roles, grace_period_days: enforceForm.grace_period_days });
      toast.success(resp.message);
      setShowEnforceModal(false);
      loadCompliance();
    } catch { toast.error('Failed to enforce 2FA.'); }
    finally { setEnforcing(false); }
  };

  const handleDisableEnforcement = async () => {
    if (!confirm('Disable 2FA enforcement? Users will no longer be required to set up 2FA.')) return;
    setEnforcing(true);
    try {
      const resp = await apiService.enforce2FA({ enforce: false, roles: [], grace_period_days: 14 });
      toast.success(resp.message);
      loadCompliance();
    } catch { toast.error('Failed to disable enforcement.'); }
    finally { setEnforcing(false); }
  };

  const toggleRole = (role) => {
    setEnforceForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role]
    }));
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="2FA Compliance" />
      <div className="p-8"><LoadingSpinner /></div>
    </div>
  );

  const deadline = data?.deadline ? new Date(data.deadline) : null;
  const now = new Date();
  const deadlinePassed = deadline && deadline < now;
  const daysRemaining = deadline ? Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="2FA Compliance" />
      <div className="p-6 max-w-5xl space-y-6">

        {/* Status card */}
        <div className={`rounded-2xl p-6 ${data?.enforce_2fa ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <i className={`fas fa-shield-${data?.enforce_2fa ? 'check' : 'slash'} text-xl`} />
                <h2 className={`text-lg font-bold ${data?.enforce_2fa ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  2FA Enforcement {data?.enforce_2fa ? 'Active' : 'Inactive'}
                </h2>
              </div>
              {data?.enforce_2fa && deadline && (
                <p className={`text-sm ${deadlinePassed ? 'text-red-200' : 'text-blue-100'}`}>
                  {deadlinePassed ? 'Grace period has ended — enforcement is active' : `Grace period ends in ${daysRemaining} day(s) — ${deadline.toLocaleDateString()}`}
                </p>
              )}
              {data?.enforce_2fa && <p className="text-sm text-blue-100 mt-0.5">Roles: {data.enforced_roles.join(', ')}</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {data?.enforce_2fa ? (
                <>
                  <button onClick={() => setShowEnforceModal(true)} className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition">
                    Edit Settings
                  </button>
                  <button onClick={handleDisableEnforcement} disabled={enforcing} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition disabled:opacity-60">
                    Disable Enforcement
                  </button>
                </>
              ) : (
                <button onClick={() => setShowEnforceModal(true)} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition">
                  <i className="fas fa-shield-alt mr-1.5" /> Enforce 2FA
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Per-role compliance */}
        {data?.compliance_by_role?.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900 dark:text-white">Compliance by Role</h3>
            {data.compliance_by_role.map(role => (
              <div key={role.role} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition"
                  onClick={() => setExpandedRole(expandedRole === role.role ? null : role.role)}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-gray-900 dark:text-white capitalize">{role.role}</span>
                      <span className="text-sm text-gray-500">{role.compliant}/{role.total} ({role.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${role.percentage >= 80 ? 'bg-green-500' : role.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${role.percentage}%` }}
                      />
                    </div>
                  </div>
                  <i className={`fas fa-chevron-${expandedRole === role.role ? 'up' : 'down'} text-gray-400 text-xs`} />
                </div>
                {expandedRole === role.role && role.non_compliant_users.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Non-compliant users ({role.non_compliant}):</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {role.non_compliant_users.map(u => (
                        <div key={u.id} className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                            <i className="fas fa-user text-red-400 text-xs" />
                          </div>
                          <span className="text-gray-700 dark:text-gray-300">{u.name}</span>
                          <span className="text-gray-400 text-xs">{u.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enforce Modal */}
      {showEnforceModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {data?.enforce_2fa ? 'Edit 2FA Enforcement' : 'Enforce Two-Factor Authentication'}
            </h3>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Require 2FA for these roles:</p>
              <div className="grid grid-cols-3 gap-2">
                {AVAILABLE_ROLES.map(role => (
                  <label key={role} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition ${enforceForm.roles.includes(role) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    <input type="checkbox" className="hidden" checked={enforceForm.roles.includes(role)} onChange={() => toggleRole(role)} />
                    <i className={`fas fa-${enforceForm.roles.includes(role) ? 'check-circle text-blue-500' : 'circle text-gray-300'} text-xs`} />
                    <span className="capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Grace period: <span className="text-blue-600">{enforceForm.grace_period_days} days</span></p>
              <input
                type="range" min="0" max="30" step="7"
                value={enforceForm.grace_period_days}
                onChange={(e) => setEnforceForm(f => ({ ...f, grace_period_days: parseInt(e.target.value) }))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Immediate</span><span>1 week</span><span>2 weeks</span><span>3 weeks</span><span>30 days</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowEnforceModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleEnforce} disabled={enforcing} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 transition">
                {enforcing ? 'Activating...' : data?.enforce_2fa ? 'Update' : 'Enforce 2FA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
