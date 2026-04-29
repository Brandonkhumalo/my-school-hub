import React, { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "/api/v1";
const MODULE_FLAGS = ["boarding", "library", "advanced_analytics", "whatsapp_alerts", "transport"];

export default function TishanyqControlCenter() {
  const [schools, setSchools] = useState([]);
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [detailBySchool, setDetailBySchool] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [featureFlags, setFeatureFlags] = useState([]);
  const [impersonationRequests, setImpersonationRequests] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [platformNotices, setPlatformNotices] = useState([]);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [newTicket, setNewTicket] = useState({ school_id: "", title: "", owner: "", priority: "medium", sla_hours: 24 });
  const [loading, setLoading] = useState(true);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("tishanyq_token")}` });

  const loadAll = async () => {
    try {
      const [schoolsRes, statsRes, healthRes, auditRes, flagsRes, impRes, ticketsRes, noticesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/superadmin/schools/`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/auth/superadmin/stats/`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/auth/superadmin/system-health/`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/auth/superadmin/audit-logs/?page_size=50`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/auth/superadmin/feature-flags/`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/auth/superadmin/impersonation-requests/?page_size=100`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/auth/superadmin/support-tickets/?page_size=100`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/auth/superadmin/platform-notices/?page_size=20`, { headers: authHeaders() }),
      ]);

      const schoolsPayload = schoolsRes.ok ? await schoolsRes.json() : { schools: [] };
      setSchools(schoolsPayload.schools || []);
      if (statsRes.ok) setStats(await statsRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
      if (auditRes.ok) setAuditRows((await auditRes.json()).results || []);
      if (flagsRes.ok) setFeatureFlags((await flagsRes.json()).results || []);
      if (impRes.ok) setImpersonationRequests((await impRes.json()).results || []);
      if (ticketsRes.ok) setSupportTickets((await ticketsRes.json()).results || []);
      if (noticesRes.ok) setPlatformNotices((await noticesRes.json()).results || []);

      const details = await Promise.all(
        (schoolsPayload.schools || []).map(async (school) => {
          try {
            const res = await fetch(`${API_BASE_URL}/auth/superadmin/schools/${school.id}/detail/`, { headers: authHeaders() });
            if (!res.ok) return [school.id, null];
            return [school.id, await res.json()];
          } catch {
            return [school.id, null];
          }
        })
      );
      setDetailBySchool(Object.fromEntries(details.filter(([, value]) => value)));
    } catch (error) {
      console.error("Failed to load control center", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const computedHealthRows = useMemo(() => {
    return schools.map((school) => {
      const detail = detailBySchool[school.id];
      const setup = detail?.setup || {};
      const counts = detail?.counts || {};
      const limit = Number(detail?.capacity?.student_limit || school.student_limit || 1);
      const activeStudents = Number(counts.active_students ?? 0);
      const usage = limit > 0 ? Math.round((activeStudents / limit) * 100) : 0;
      const lockedCount = Number((detail?.locked_accounts || []).length || 0);

      let score = 100;
      if (school.is_suspended) score -= 25;
      if (!setup.two_factor_enforced) score -= 20;
      if (!setup.is_setup_complete) score -= 15;
      if (!setup.has_academic_period) score -= 10;
      if (usage >= 95) score -= 15;
      if (usage >= 85 && usage < 95) score -= 8;
      if (lockedCount > 0) score -= Math.min(lockedCount * 3, 12);

      return { school, setup, usage, lockedCount, score: Math.max(0, score) };
    });
  }, [schools, detailBySchool]);

  const alerts = useMemo(() => {
    const nextAlerts = [];
    if (health) {
      if (!health.database_ok) nextAlerts.push({ severity: "critical", text: "Database health check failed." });
      if (health.debug) nextAlerts.push({ severity: "high", text: "DEBUG is enabled in production configuration." });
      if (!health.superadmin_secret_key_set) nextAlerts.push({ severity: "high", text: "Superadmin secret key is not configured." });
    }
    computedHealthRows.forEach(({ school, usage, lockedCount, score }) => {
      if (usage >= 95) nextAlerts.push({ severity: "high", text: `${school.name} is at ${usage}% student capacity.` });
      if (lockedCount > 0) nextAlerts.push({ severity: "medium", text: `${school.name} has ${lockedCount} locked user account(s).` });
      if (score <= 60) nextAlerts.push({ severity: "medium", text: `${school.name} health score is low (${score}/100).` });
    });
    return nextAlerts;
  }, [health, computedHealthRows]);

  const searchableItems = useMemo(() => {
    const schoolItems = schools.map((school) => ({
      type: "School",
      id: `school-${school.id}`,
      primary: school.name,
      secondary: `${school.city || "-"} · ${school.school_type || "-"}`,
      meta: school.admin_email || "",
    }));

    const auditItems = auditRows.map((log) => ({
      type: "Audit",
      id: `audit-${log.id}`,
      primary: `${log.action} ${log.model_name}`,
      secondary: log.object_repr || "-",
      meta: `${log.school_name || "Platform"} · ${log.user_email || "system"}`,
    }));

    const ticketItems = supportTickets.map((ticket) => ({
      type: "Ticket",
      id: `ticket-${ticket.id}`,
      primary: ticket.title,
      secondary: `${ticket.school_name} · ${ticket.status}`,
      meta: `SLA ${ticket.sla_hours}h · Owner: ${ticket.owner || "Unassigned"}`,
    }));

    return [...schoolItems, ...auditItems, ...ticketItems];
  }, [schools, auditRows, supportTickets]);

  const filteredSearchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return searchableItems.slice(0, 8);
    return searchableItems.filter((item) => `${item.primary} ${item.secondary} ${item.meta}`.toLowerCase().includes(q)).slice(0, 20);
  }, [search, searchableItems]);

  const compliance = useMemo(() => {
    const total = computedHealthRows.length || 1;
    return {
      twoFaEnforced: computedHealthRows.filter((x) => x.setup?.two_factor_enforced).length,
      setupComplete: computedHealthRows.filter((x) => x.setup?.is_setup_complete).length,
      hasAcademicPeriod: computedHealthRows.filter((x) => x.setup?.has_academic_period).length,
      suspended: computedHealthRows.filter((x) => x.school?.is_suspended).length,
      total,
    };
  }, [computedHealthRows]);

  const flagLookup = useMemo(() => {
    const map = {};
    featureFlags.forEach((flag) => {
      map[`${flag.school_id}:${flag.flag_key}`] = flag.is_enabled;
    });
    return map;
  }, [featureFlags]);

  const toggleSelected = (schoolId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });
  };

  const runBulkSuspend = async (suspend) => {
    const schoolIds = [...selected];
    if (schoolIds.length === 0) return;
    await Promise.all(
      schoolIds.map((schoolId) =>
        fetch(`${API_BASE_URL}/auth/superadmin/schools/${schoolId}/suspend/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ suspend, reason: suspend ? "Bulk action from control center" : "" }),
        })
      )
    );
    await loadAll();
    setSelected(new Set());
  };

  const addNotice = async () => {
    const message = prompt("Platform notice message");
    if (!message) return;
    const schoolIds = [...selected];
    const res = await fetch(`${API_BASE_URL}/auth/superadmin/platform-notices/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ message, school_ids: schoolIds, notify_admins: true }),
    });
    if (!res.ok) {
      alert("Failed to send platform notice");
      return;
    }
    await loadAll();
  };

  const createImpersonationRequest = async (school) => {
    const reason = prompt(`Reason for secure impersonation request for ${school.name}`);
    if (!reason) return;
    const res = await fetch(`${API_BASE_URL}/auth/superadmin/impersonation-requests/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ school_id: school.id, reason, max_duration_minutes: 30 }),
    });
    if (!res.ok) {
      alert("Failed to create impersonation request");
      return;
    }
    await loadAll();
  };

  const setImpersonationStatus = async (id, status) => {
    const res = await fetch(`${API_BASE_URL}/auth/superadmin/impersonation-requests/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      alert("Failed to update impersonation request");
      return;
    }
    await loadAll();
  };

  const toggleFeatureFlag = async (schoolId, key) => {
    const isEnabled = !!flagLookup[`${schoolId}:${key}`];
    const res = await fetch(`${API_BASE_URL}/auth/superadmin/feature-flags/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ school_id: schoolId, flag_key: key, is_enabled: !isEnabled }),
    });
    if (!res.ok) {
      alert("Failed to update feature flag");
      return;
    }
    await loadAll();
  };

  const createTicket = async () => {
    if (!newTicket.school_id || !newTicket.title.trim()) {
      alert("School and title are required");
      return;
    }
    const res = await fetch(`${API_BASE_URL}/auth/superadmin/support-tickets/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        school_id: Number(newTicket.school_id),
        title: newTicket.title.trim(),
        owner: newTicket.owner.trim(),
        priority: newTicket.priority,
        sla_hours: Number(newTicket.sla_hours || 24),
      }),
    });
    if (!res.ok) {
      alert("Failed to create support ticket");
      return;
    }
    setNewTicket({ school_id: "", title: "", owner: "", priority: "medium", sla_hours: 24 });
    await loadAll();
  };

  const updateTicket = async (id, updates) => {
    const res = await fetch(`${API_BASE_URL}/auth/superadmin/support-tickets/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      alert("Failed to update ticket");
      return;
    }
    await loadAll();
  };

  const addTicketNote = async (ticketId) => {
    const note = (noteDrafts[ticketId] || "").trim();
    if (!note) return;
    await updateTicket(ticketId, { append_note: note });
    setNoteDrafts((prev) => ({ ...prev, [ticketId]: "" }));
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">System Admin Control Center</h1>
        <p className="text-gray-600 mt-1">Global operations, compliance, support workflows, and school-level controls.</p>
      </div>

      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-800 mb-3">1) Global Search</h2>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search schools, audit actions, or support tickets" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="mt-3 space-y-2">
          {filteredSearchResults.map((item) => (
            <div key={item.id} className="border rounded-lg px-3 py-2 text-sm">
              <p className="font-medium text-gray-800">{item.primary}</p>
              <p className="text-gray-600">{item.secondary}</p>
              <p className="text-xs text-gray-500">{item.type} · {item.meta}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">2) Alert Center</h2>
            <span className="text-xs text-gray-500">{alerts.length} active</span>
          </div>
          <div className="space-y-2">
            {alerts.length === 0 ? <p className="text-sm text-gray-500">No active alerts.</p> : alerts.slice(0, 12).map((alert, idx) => (
              <div key={`${alert.text}-${idx}`} className="border rounded-lg px-3 py-2 text-sm">
                <p className="font-medium text-gray-800">{alert.text}</p>
                <p className={`text-xs mt-1 ${severityClass(alert.severity)}`}>Severity: {alert.severity}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-3">9) Compliance Dashboard</h2>
          <Metric label="2FA Enforced" value={`${compliance.twoFaEnforced}/${compliance.total}`} />
          <Metric label="Setup Complete" value={`${compliance.setupComplete}/${compliance.total}`} />
          <Metric label="Academic Period Configured" value={`${compliance.hasAcademicPeriod}/${compliance.total}`} />
          <Metric label="Suspended Schools" value={compliance.suspended} />
          <Metric label="Locked Admin Accounts" value={stats?.locked_admin_accounts ?? 0} />
          <Metric label="DB Status" value={health?.database_ok ? "OK" : "CHECK"} />
        </section>
      </div>

      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-800 mb-3">3) School Health Score</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">School</th><th className="py-2">Score</th><th className="py-2">Capacity</th><th className="py-2">2FA</th><th className="py-2">Locked</th>
              </tr>
            </thead>
            <tbody>
              {computedHealthRows.sort((a, b) => a.score - b.score).map((row) => (
                <tr key={row.school.id} className="border-b">
                  <td className="py-2">{row.school.name}</td>
                  <td className="py-2 font-semibold">{loading ? "..." : row.score}/100</td>
                  <td className="py-2">{row.usage}%</td>
                  <td className="py-2">{row.setup?.two_factor_enforced ? "Yes" : "No"}</td>
                  <td className="py-2">{row.lockedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">4) Bulk Actions</h2>
          <div className="flex gap-2">
            <button onClick={() => runBulkSuspend(true)} className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">Suspend Selected</button>
            <button onClick={() => runBulkSuspend(false)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm">Unsuspend Selected</button>
            <button onClick={addNotice} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Send Platform Notice</button>
          </div>
        </div>
        <div className="space-y-2 max-h-64 overflow-auto">
          {schools.map((school) => (
            <label key={school.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
              <span>{school.name} <span className="text-gray-500">({school.city || "-"})</span></span>
              <input type="checkbox" checked={selected.has(school.id)} onChange={() => toggleSelected(school.id)} />
            </label>
          ))}
        </div>
        {platformNotices.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs text-gray-500 mb-2">Recent platform notices</p>
            <div className="space-y-1">
              {platformNotices.slice(0, 5).map((notice) => (
                <p key={notice.id} className="text-xs text-gray-700">
                  {new Date(notice.created_at).toLocaleString()} · {notice.message}
                </p>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-3">5) Secure Impersonation Requests</h2>
          <p className="text-xs text-gray-500 mb-3">Controlled workflow with reason capture, approval, and auditability.</p>
          <div className="space-y-2 mb-4">
            {schools.slice(0, 8).map((school) => (
              <button key={school.id} onClick={() => createImpersonationRequest(school)} className="w-full text-left px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">Request access: {school.name}</button>
            ))}
          </div>
          <div className="space-y-2">
            {impersonationRequests.slice(0, 10).map((entry) => (
              <div key={entry.id} className="border rounded-lg p-2 text-sm">
                <p className="font-medium">{entry.school_name}</p>
                <p className="text-gray-600">{entry.reason}</p>
                <p className="text-xs text-gray-500">{entry.status} · Max {entry.max_duration_minutes} min</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setImpersonationStatus(entry.id, "approved")} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Approve</button>
                  <button onClick={() => setImpersonationStatus(entry.id, "revoked")} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Revoke</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-3">8) Feature Flags by School</h2>
          <div className="space-y-3 max-h-[420px] overflow-auto">
            {schools.map((school) => (
              <div key={school.id} className="border rounded-lg p-3">
                <p className="font-medium text-sm mb-2">{school.name}</p>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE_FLAGS.map((flag) => {
                    const enabled = !!flagLookup[`${school.id}:${flag}`];
                    return (
                      <button key={`${school.id}-${flag}`} onClick={() => toggleFeatureFlag(school.id, flag)} className={`px-2 py-1 rounded text-xs border ${enabled ? "bg-green-100 border-green-200 text-green-700" : "bg-gray-50 border-gray-200 text-gray-700"}`}>
                        {flag.replace(/_/g, " ")}: {enabled ? "On" : "Off"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">10) Support Desk Integration</h2>
          <button onClick={createTicket} className="px-3 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-sm">Create Ticket</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
          <select className="border rounded px-2 py-2 text-sm" value={newTicket.school_id} onChange={(e) => setNewTicket((p) => ({ ...p, school_id: e.target.value }))}>
            <option value="">Select school</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input className="border rounded px-2 py-2 text-sm md:col-span-2" placeholder="Ticket title" value={newTicket.title} onChange={(e) => setNewTicket((p) => ({ ...p, title: e.target.value }))} />
          <input className="border rounded px-2 py-2 text-sm" placeholder="Owner" value={newTicket.owner} onChange={(e) => setNewTicket((p) => ({ ...p, owner: e.target.value }))} />
          <div className="flex gap-2">
            <select className="border rounded px-2 py-2 text-sm w-full" value={newTicket.priority} onChange={(e) => setNewTicket((p) => ({ ...p, priority: e.target.value }))}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input type="number" min="1" className="border rounded px-2 py-2 text-sm w-24" value={newTicket.sla_hours} onChange={(e) => setNewTicket((p) => ({ ...p, sla_hours: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-2">
          {supportTickets.length === 0 ? <p className="text-sm text-gray-500">No tickets yet.</p> : supportTickets.slice(0, 20).map((ticket) => (
            <div key={ticket.id} className="border rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{ticket.title}</p>
                <select value={ticket.status} onChange={(e) => updateTicket(ticket.id, { status: e.target.value })} className="border rounded px-2 py-1 text-xs">
                  <option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option>
                </select>
              </div>
              <p className="text-gray-600">{ticket.school_name}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                <input className="border rounded px-2 py-1 text-xs" defaultValue={ticket.owner || ""} placeholder="Owner" onBlur={(e) => updateTicket(ticket.id, { owner: e.target.value })} />
                <select value={ticket.priority} onChange={(e) => updateTicket(ticket.id, { priority: e.target.value })} className="border rounded px-2 py-1 text-xs">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
                <input type="number" min="1" className="border rounded px-2 py-1 text-xs" defaultValue={ticket.sla_hours} onBlur={(e) => updateTicket(ticket.id, { sla_hours: Number(e.target.value || 24) })} />
              </div>
              <p className="text-xs text-gray-500">SLA: {ticket.sla_hours} hours · Created: {new Date(ticket.created_at).toLocaleString()}</p>
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 border rounded px-2 py-1 text-xs"
                  placeholder="Add internal note"
                  value={noteDrafts[ticket.id] || ""}
                  onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                />
                <button onClick={() => addTicketNote(ticket.id)} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded">Add Note</button>
              </div>
              {(ticket.notes || []).length > 0 && (
                <div className="mt-2 space-y-1">
                  {(ticket.notes || []).slice(-3).map((n, idx) => (
                    <p key={`${ticket.id}-note-${idx}`} className="text-xs text-gray-600">
                      {n.at ? new Date(n.at).toLocaleString() : ""} · {n.by || "system"}: {n.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function severityClass(severity) {
  if (severity === "critical") return "text-red-700";
  if (severity === "high") return "text-orange-700";
  return "text-yellow-700";
}

function Metric({ label, value }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
