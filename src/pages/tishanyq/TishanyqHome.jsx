import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE_URL = "/api/v1";

export default function TishanyqHome() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("tishanyq_token");
      try {
        const [statsRes, healthRes] = await Promise.all([
          fetch(`${API_BASE_URL}/auth/superadmin/stats/`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/auth/superadmin/system-health/`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (healthRes.ok) setHealth(await healthRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpi = [
    ["Schools", stats?.schools],
    ["Admins", stats?.admins],
    ["Students", stats?.total_students],
    ["Teachers", stats?.total_teachers],
    ["HR", stats?.total_hr],
    ["Parents", stats?.total_parents],
    ["Locked Admins", stats?.locked_admin_accounts],
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Platform Overview</h1>
        <p className="text-gray-600 mt-1">Real-time visibility across all schools and security posture.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {kpi.map(([label, value]) => (
          <div key={label} className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-semibold text-gray-800">{loading ? "..." : value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-3">School Distribution</h2>
          <div className="space-y-2 text-sm">
            {(stats?.schools_by_type || []).map((item) => (
              <div key={`type-${item.school_type}`} className="flex justify-between border-b pb-2">
                <span className="text-gray-600">{item.school_type}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
          <h3 className="font-semibold text-gray-800 mt-4 mb-3">Curriculum</h3>
          <div className="space-y-2 text-sm">
            {(stats?.schools_by_curriculum || []).map((item) => (
              <div key={`cur-${item.curriculum}`} className="flex justify-between border-b pb-2">
                <span className="text-gray-600">{item.curriculum}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
          <h3 className="font-semibold text-gray-800 mt-4 mb-3">Monthly Growth</h3>
          <div className="space-y-2">
            {(stats?.schools_created_monthly || []).slice(-6).map((row) => {
              const max = Math.max(...(stats?.schools_created_monthly || [{ count: 1 }]).map((x) => x.count || 0), 1);
              const width = `${Math.max(8, Math.round(((row.count || 0) / max) * 100))}%`;
              return (
                <div key={row.month} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">{row.month}</span>
                    <span className="font-medium">{row.count}</span>
                  </div>
                  <div className="h-2 rounded bg-gray-100">
                    <div className="h-2 rounded bg-blue-500" style={{ width }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-3">System Health</h2>
          <div className="space-y-2 text-sm">
            <HealthRow label="Database" ok={!!health?.database_ok} />
            <HealthRow label="Celery Configured" ok={!!health?.celery_configured} />
            <HealthRow label="Superadmin Secret Set" ok={!!health?.superadmin_secret_key_set} />
            <HealthRow label="DEBUG Off" ok={health ? !health.debug : false} />
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Python</span>
              <span className="font-medium">{health?.python_version || "-"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Blacklisted Tokens</span>
              <span className="font-medium">{health?.blacklisted_tokens ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Assessment Activity</h2>
        <p className="text-xs text-gray-500 mb-3">Recent generated-test lifecycle actions across schools.</p>
        {(stats?.recent_generated_test_activity || []).length === 0 ? (
          <p className="text-sm text-gray-500">No generated-test activity logged yet.</p>
        ) : (
          <div className="space-y-2">
            {(stats?.recent_generated_test_activity || []).map((item) => (
              <div key={item.id} className="text-xs border-b pb-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-gray-800">
                    {item.action} · {item.model_name}
                  </span>
                  <span className="text-gray-500">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : "-"}
                  </span>
                </div>
                <div className="text-gray-600">
                  {item.object_repr || `Object #${item.object_id || "?"}`}
                </div>
                <div className="text-gray-500">
                  School: {item.school_name || "Platform"} · User: {item.user_email || "system"}
                </div>
                <div className="mt-1">
                  <Link
                    to={`/tishanyq/admin/audit-logs?model_name=${encodeURIComponent(item.model_name)}&action=${encodeURIComponent(item.action)}`}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    View in audit logs
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthRow({ label, ok }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-gray-600">{label}</span>
      <span className={`font-medium ${ok ? "text-green-700" : "text-red-700"}`}>{ok ? "OK" : "Check"}</span>
    </div>
  );
}
