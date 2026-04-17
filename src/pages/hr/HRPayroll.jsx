import React, { useEffect, useState } from "react";
import apiService from "../../services/apiService";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseMonthInput(value) {
  const [yearStr, monthStr] = (value || "").split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return { year: null, monthName: null };
  }
  return { year, monthName: MONTH_NAMES[monthIndex] };
}

export default function HRPayroll() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [form, setForm] = useState({ staff: "", basic_salary: "", month: month, status: "pending" });

  const load = () => {
    setLoading(true);
    const { monthName, year } = parseMonthInput(month);
    Promise.all([
      apiService.getPayroll({ month: monthName || "", year: year || "" }),
      apiService.getPayrollSummary({ month: monthName || "", year: year || "" }),
      apiService.getStaffList(),
    ])
      .then(([r, s, st]) => { setRecords(r); setSummary(s); setStaffList(st); })
      .catch(() => setError("Failed to load payroll"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [month]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { monthName, year } = parseMonthInput(month);
    try {
      await apiService.createPayrollEntry({
        staff: Number(form.staff),
        basic_salary: Number(form.basic_salary),
        allowances: 0,
        deductions: 0,
        month: monthName,
        year,
        is_paid: form.status === "paid",
      });
      setShowForm(false);
      setForm({ staff: "", basic_salary: "", month, status: "pending" });
      load();
    } catch {
      setError("Failed to create payroll entry");
    }
  };

  const statusBadge = (s) => {
    const c = s === "paid" ? "green" : s === "pending" ? "yellow" : "gray";
    return `px-2 py-1 rounded-full text-xs font-medium bg-${c}-100 text-${c}-700`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Payroll</h1>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          + Add Entry
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm text-gray-600">Month:</label>
        <input type="month" className="border rounded px-3 py-2 text-sm"
          value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
            {[
            { label: "Total Payroll", value: `$${summary.total_gross ?? summary.total_net ?? 0}` },
            { label: "Paid", value: `$${summary.total_paid ?? 0}` },
            { label: "Pending", value: `$${summary.total_pending ?? 0}` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Staff</th>
                <th className="px-4 py-3 text-right">Basic</th>
                <th className="px-4 py-3 text-right">Allowances</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No payroll records for this month</td></tr>
              ) : records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.staff_name}</td>
                  <td className="px-4 py-3 text-right">${r.basic_salary}</td>
                  <td className="px-4 py-3 text-right">${r.allowances ?? 0}</td>
                  <td className="px-4 py-3 text-right">${r.deductions ?? 0}</td>
                  <td className="px-4 py-3 text-right font-semibold">${r.net_salary ?? r.basic_salary}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(r.is_paid ? "paid" : "pending")}>
                      {r.is_paid ? "paid" : "pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
            <button onClick={() => setShowForm(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <h2 className="text-lg font-bold mb-4">New Payroll Entry</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Staff Member</label>
                <select required className="border rounded w-full p-2 text-sm"
                  value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })}>
                  <option value="">Select staff...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.user?.first_name} {s.user?.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Basic Salary ($)</label>
                <input required type="number" min="0" step="0.01" className="border rounded w-full p-2 text-sm"
                  value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Status</label>
                <select className="border rounded w-full p-2 text-sm"
                  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <button type="submit"
                className="w-full bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700 mt-2">
                Save Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
