import React, { useEffect, useState } from "react";
import apiService from "../../services/apiService";

const POSITIONS = ["teacher", "hr", "accountant", "admin", "librarian", "security", "cleaner", "other"];

export default function AdminStaff() {
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone_number: "",
    position: "teacher", department: "", qualification: "",
    contract_type: "permanent", salary: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([apiService.getStaffList(), apiService.getDepartments()])
      .then(([s, d]) => { setStaff(s); setDepartments(d); })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      const res = await apiService.createStaff(form);
      setSuccess(`Staff created. Temporary password: ${res.temporary_password || "(see console)"}`);
      setShowForm(false);
      setForm({ first_name: "", last_name: "", email: "", phone_number: "", position: "teacher", department: "", qualification: "", contract_type: "permanent", salary: "" });
      load();
    } catch (err) {
      setError(err.message || "Failed to create staff member");
    }
  };

  const positionBadge = (pos) => {
    const map = { teacher: "blue", hr: "purple", accountant: "green", admin: "red" };
    const c = map[pos] || "gray";
    return `px-2 py-1 rounded-full text-xs bg-${c}-100 text-${c}-700`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          + Add Staff Member
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-800 p-3 rounded mb-4 font-medium">{success}</div>}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Position</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Contract</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No staff members yet</td></tr>
              ) : staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.user?.first_name} {s.user?.last_name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.user?.email}</td>
                  <td className="px-4 py-3"><span className={positionBadge(s.position)}>{s.position}</span></td>
                  <td className="px-4 py-3 text-gray-600">{s.department_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{s.contract_type || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg relative my-4">
            <button onClick={() => setShowForm(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <h2 className="text-lg font-bold mb-4">Add Staff Member</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              {[
                ["First Name", "first_name", "text", true],
                ["Last Name", "last_name", "text", true],
                ["Email", "email", "email", true],
                ["Phone", "phone_number", "tel", false],
                ["Qualification", "qualification", "text", false],
                ["Salary ($)", "salary", "number", false],
              ].map(([label, key, type, req]) => (
                <div key={key}>
                  <label className="text-xs text-gray-600 mb-1 block">{label}{req && " *"}</label>
                  <input required={req} type={type} className="border rounded w-full p-2 text-sm"
                    value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Position *</label>
                <select required className="border rounded w-full p-2 text-sm"
                  value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Department</label>
                <select className="border rounded w-full p-2 text-sm"
                  value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Contract Type</label>
                <select className="border rounded w-full p-2 text-sm"
                  value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
                  {["permanent", "contract", "part_time", "intern"].map((c) => (
                    <option key={c} value={c}>{c.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <button type="submit"
                  className="w-full bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700 mt-1">
                  Create Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
