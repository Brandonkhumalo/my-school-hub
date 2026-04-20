import React, { useCallback, useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import { useAuth } from "../../context/AuthContext";

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
  const { user } = useAuth();
  const isRootHrHead = Boolean(user?.role === "hr" && user?.hr_is_root_boss);
  const isAccountant = user?.role === "accountant";
  const isAdmin = user?.role === "admin" && !isRootHrHead;
  const canAddExpense = Boolean(isAccountant || isRootHrHead);
  const canApproveExpense = Boolean(isAdmin);
  const canSignoffPayroll = Boolean(isAdmin);
  // Only accountants submit payroll entries / sign-off requests. Admin approves.
  const canSubmitPayroll = Boolean(isAccountant);

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [payRequests, setPayRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [form, setForm] = useState({ staff: "", basic_salary: "", status: "pending" });
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    description: "",
    amount: "",
    expense_frequency: "monthly",
    start_date: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(() => {
    setLoading(true);
    const { monthName, year } = parseMonthInput(month);
    Promise.all([
      apiService.getPayroll({ month: monthName || "", year: year || "", search }),
      apiService.getPayrollSummary({ month: monthName || "", year: year || "" }),
      apiService.getStaffList(),
      apiService.getSchoolExpenses().catch(() => []),
      apiService.getPayrollPaymentRequests({ month: monthName || "", year: year || "" }).catch(() => []),
    ])
      .then(([r, s, st, ex, reqs]) => {
        setRecords(Array.isArray(r) ? r : []);
        setSummary(s || null);
        setStaffList(Array.isArray(st) ? st : []);
        setExpenses(Array.isArray(ex) ? ex : []);
        setPayRequests(Array.isArray(reqs) ? reqs : []);
      })
      .catch((err) => setError(err.message || "Failed to load payroll"))
      .finally(() => setLoading(false));
  }, [month, search]);

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [load]);

  const payableRecords = useMemo(
    () => records.filter((r) => !r.is_paid),
    [records]
  );

  const visibleRecords = useMemo(() => {
    if (statusFilter === "paid") return records.filter((r) => r.is_paid);
    if (statusFilter === "unpaid") return records.filter((r) => !r.is_paid);
    return records;
  }, [records, statusFilter]);

  const selectedPayableCount = useMemo(
    () => records.filter((r) => !r.is_paid && selectedStaffIds.includes(r.staff)).length,
    [records, selectedStaffIds]
  );

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
      setForm({ staff: "", basic_salary: "", status: "pending" });
      setSelectedStaffIds([]);
      load();
    } catch (err) {
      setError(err.message || "Failed to create payroll entry");
    }
  };

  const handleStaffSelect = (id) => {
    const match = staffList.find((s) => String(s.id) === String(id));
    setForm((f) => ({
      ...f,
      staff: id,
      basic_salary: match?.salary != null ? String(match.salary) : f.basic_salary,
    }));
  };

  const handleGenerate = async () => {
    const { monthName, year } = parseMonthInput(month);
    if (!monthName || !year) {
      setError("Pick a valid month first.");
      return;
    }
    if (!confirm(`Generate payroll entries for ${monthName} ${year}? Existing entries are skipped.`)) return;
    try {
      const result = await apiService.generatePayroll({ month: monthName, year });
      setError("");
      alert(`Created ${result.created} entries. Skipped ${result.skipped_existing} existing and ${result.skipped_no_salary} with no salary set.`);
      load();
    } catch (err) {
      setError(err.message || "Failed to generate payroll.");
    }
  };

  const handleMarkPaid = async (all = false) => {
    const { monthName, year } = parseMonthInput(month);
    if (!monthName || !year) {
      setError("Pick a valid month first.");
      return;
    }
    const payload = { month: monthName, year };
    if (!all) {
      if (selectedStaffIds.length === 0) {
        setError("Select at least one unpaid staff member.");
        return;
      }
      payload.staff_ids = selectedStaffIds;
    }
    try {
      const res = await apiService.markPayrollPaid(payload);
      alert(`Submitted request #${res.request_id} for admin sign-off. Matched: ${res.matched_records}`);
      setSelectedStaffIds([]);
      load();
    } catch (err) {
      setError(err.message || "Failed to update payment status.");
    }
  };

  const handlePayrollRequestReview = async (requestId, status) => {
    try {
      const res = await apiService.reviewPayrollPaymentRequest(requestId, { status });
      const label = status === "approved" ? "approved and salaries marked paid" : "rejected";
      alert(`Request #${requestId} ${label}. Updated records: ${res.updated ?? 0}`);
      load();
    } catch (err) {
      setError(err.message || "Failed to review payroll request.");
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiService.createSchoolExpense({
        title: expenseForm.title,
        description: expenseForm.description,
        amount: Number(expenseForm.amount),
        expense_frequency: expenseForm.expense_frequency,
        start_date: expenseForm.start_date,
      });
      setExpenseForm({
        title: "",
        description: "",
        amount: "",
        expense_frequency: "monthly",
        start_date: new Date().toISOString().slice(0, 10),
      });
      load();
    } catch (err) {
      setError(err.message || "Failed to create expense.");
    }
  };

  const handleExpenseDecision = async (expenseId, status) => {
    try {
      await apiService.approveSchoolExpense(expenseId, { status });
      load();
    } catch (err) {
      setError(err.message || "Failed to update expense approval.");
    }
  };

  const toggleSelected = (staffId) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const toggleSelectAllVisibleUnpaid = () => {
    const unpaidIds = payableRecords.map((r) => r.staff);
    const allSelected = unpaidIds.length > 0 && unpaidIds.every((id) => selectedStaffIds.includes(id));
    if (allSelected) {
      setSelectedStaffIds((prev) => prev.filter((id) => !unpaidIds.includes(id)));
    } else {
      setSelectedStaffIds((prev) => Array.from(new Set([...prev, ...unpaidIds])));
    }
  };

  const statusBadge = (s) => {
    const c = s === "paid" ? "green" : "yellow";
    return `px-2 py-1 rounded-full text-xs font-medium bg-${c}-100 text-${c}-700`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Accounting</h1>
        {canSubmitPayroll && (
          <div className="flex gap-2">
            <button onClick={handleGenerate} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm hover:bg-emerald-700">
              <i className="fas fa-bolt mr-2"></i>Generate for Month
            </button>
            <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              + Add Entry
            </button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Month:</label>
          <input type="month" className="border rounded px-3 py-2 text-sm" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <input
          type="text"
          className="border rounded px-3 py-2 text-sm"
          placeholder="Search employee by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="text-sm text-gray-600 flex items-center md:justify-end">
          Paid: <span className="font-semibold ml-1">{summary?.paid_count ?? 0}</span> | Unpaid: <span className="font-semibold ml-1">{summary?.unpaid_count ?? 0}</span>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Payroll", value: `$${Number(summary.total_gross ?? summary.total_net ?? 0).toLocaleString()}` },
            { label: "Paid", value: `$${Number(summary.total_paid ?? 0).toLocaleString()}` },
            { label: "Pending", value: `$${Number(summary.total_pending ?? 0).toLocaleString()}` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {canSubmitPayroll && (
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-2 items-center">
          <button
            onClick={toggleSelectAllVisibleUnpaid}
            className="px-3 py-2 rounded text-sm bg-slate-100 text-slate-800 hover:bg-slate-200"
          >
            {selectedPayableCount === payableRecords.length && payableRecords.length > 0 ? "Clear Selection" : "Select All Unpaid"}
          </button>
          <button
            onClick={() => handleMarkPaid(false)}
            className="px-3 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-700"
          >
            Submit Selected for Admin Sign-off ({selectedPayableCount})
          </button>
          <button
            onClick={() => handleMarkPaid(true)}
            className="px-3 py-2 rounded text-sm bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Submit All for Admin Sign-off ({payableRecords.length})
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-2 items-center">
          <label className="text-sm text-gray-600">Filter status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <span className="text-xs text-gray-500 ml-2">
            Unpaid entries await accountant submission / admin sign-off (see Sign-off Requests below).
          </span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-lg font-semibold mb-4">Payroll Sign-off Requests</h2>
        {payRequests.length === 0 ? (
          <p className="text-sm text-gray-500">No requests for the selected month.</p>
        ) : (
          <div className="space-y-3">
            {payRequests.map((req) => (
              <div key={req.id} className="border rounded p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">#{req.id} • {req.month} {req.year}</p>
                  <p className="text-xs text-gray-500">
                    Requested by {req.requested_by_name || "Unknown"} • Target: {req.target_type} • Status: {req.status}
                  </p>
                  {req.admin_note ? <p className="text-xs text-gray-600 mt-1">Note: {req.admin_note}</p> : null}
                </div>
                {canSignoffPayroll && req.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => handlePayrollRequestReview(req.id, "approved")} className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">
                      Final Sign-off
                    </button>
                    <button onClick={() => handlePayrollRequestReview(req.id, "rejected")} className="text-xs px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Select</th>
                <th className="px-4 py-3 text-left">Staff</th>
                <th className="px-4 py-3 text-right">Basic</th>
                <th className="px-4 py-3 text-right">Allowances</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleRecords.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No payroll records for this month</td></tr>
              ) : visibleRecords.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      disabled={r.is_paid}
                      checked={selectedStaffIds.includes(r.staff)}
                      onChange={() => toggleSelected(r.staff)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.staff_name}</td>
                  <td className="px-4 py-3 text-right">${r.basic_salary}</td>
                  <td className="px-4 py-3 text-right">${r.allowances ?? 0}</td>
                  <td className="px-4 py-3 text-right">${r.deductions ?? 0}</td>
                  <td className="px-4 py-3 text-right font-semibold">${r.net_salary ?? r.basic_salary}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(r.is_paid ? "paid" : "pending")}>{r.is_paid ? "paid" : "pending"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold mb-4">School Expenses</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {expenses.length === 0 ? (
              <p className="text-sm text-gray-500">No expenses submitted yet.</p>
            ) : expenses.map((expense) => (
              <div key={expense.id} className="border rounded p-3">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{expense.title}</p>
                    <p className="text-xs text-gray-500">{expense.expense_frequency} from {expense.start_date}</p>
                    {expense.description && <p className="text-sm text-gray-600 mt-1">{expense.description}</p>}
                  </div>
                  <p className="font-bold text-gray-800">${Number(expense.amount).toLocaleString()}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    expense.status === "approved" ? "bg-green-100 text-green-700" :
                    expense.status === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {expense.status}
                  </span>
                  {canApproveExpense && expense.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => handleExpenseDecision(expense.id, "approved")} className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">Approve</button>
                      <button onClick={() => handleExpenseDecision(expense.id, "rejected")} className="text-xs px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold mb-4">Add Expense (Needs Admin Approval)</h2>
          {!canAddExpense && (
            <p className="text-sm text-gray-500">Only accountant and HR head can submit expenses.</p>
          )}
          {canAddExpense && (
            <form onSubmit={handleExpenseSubmit} className="space-y-3">
              <input
                required
                type="text"
                placeholder="Expense title"
                className="border rounded w-full p-2 text-sm"
                value={expenseForm.title}
                onChange={(e) => setExpenseForm((f) => ({ ...f, title: e.target.value }))}
              />
              <textarea
                placeholder="Description"
                className="border rounded w-full p-2 text-sm"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
              />
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                className="border rounded w-full p-2 text-sm"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="border rounded w-full p-2 text-sm"
                  value={expenseForm.expense_frequency}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, expense_frequency: e.target.value }))}
                >
                  <option value="monthly">Monthly</option>
                  <option value="term">Term</option>
                </select>
                <input
                  required
                  type="date"
                  className="border rounded w-full p-2 text-sm"
                  value={expenseForm.start_date}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700">
                Submit Expense
              </button>
            </form>
          )}
        </div>
      </div>

      {showForm && canSubmitPayroll && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
            <button onClick={() => setShowForm(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <h2 className="text-lg font-bold mb-4">New Payroll Entry</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Staff Member</label>
                <select required className="border rounded w-full p-2 text-sm" value={form.staff} onChange={(e) => handleStaffSelect(e.target.value)}>
                  <option value="">Select staff...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.user?.first_name} {s.user?.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Basic Salary ($)</label>
                <input required type="number" min="0" step="0.01" className="border rounded w-full p-2 text-sm" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Status</label>
                <select className="border rounded w-full p-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700 mt-2">
                Save Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
