import React, { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";

export default function HRStaff() {
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([apiService.getStaffList(), apiService.getDepartments()])
      .then(([s, d]) => { setStaff(s); setDepartments(d); })
      .catch(() => setError("Failed to load staff"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = staff.filter((s) => {
    const name = `${s.user?.first_name} ${s.user?.last_name}`.toLowerCase();
    return (
      name.includes(search.toLowerCase()) &&
      (!filterDept || String(s.department) === filterDept)
    );
  });

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this staff member?")) return;
    try {
      await apiService.deleteStaff(id);
      load();
    } catch {
      setError("Failed to delete staff member");
    }
  };

  const positionBadge = (pos) => {
    const colors = { teacher: "blue", hr: "purple", accountant: "green", admin: "red" };
    return colors[pos] || "gray";
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Staff Management</h1>
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          className="border rounded px-3 py-2 text-sm w-64"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2 text-sm"
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={String(d.id)}>{d.name}</option>
          ))}
        </select>
      </div>

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
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No staff found</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {s.user?.first_name} {s.user?.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.user?.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${positionBadge(s.position)}-100 text-${positionBadge(s.position)}-700`}>
                      {s.position}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.department_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.hire_date ? formatDate(s.hire_date) : (s.user?.date_joined ? formatDate(s.user.date_joined) : '—')}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(s)}
                      className="text-blue-600 hover:text-blue-800 mr-3 text-xs">View</button>
                    <button onClick={() => handleDelete(s.id)}
                      className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
            <button onClick={() => setSelected(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <h2 className="text-lg font-bold mb-4">
              {selected.user?.first_name} {selected.user?.last_name}
            </h2>
            <dl className="text-sm space-y-2">
              {[
                ["Email", selected.user?.email],
                ["Phone", selected.user?.phone_number || "—"],
                ["Position", selected.position],
                ["Department", selected.department_name || "—"],
                ["Qualification", selected.qualification || "—"],
                ["Salary", selected.salary ? `$${selected.salary}` : "—"],
                ["Contract Type", selected.contract_type || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-1">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium text-gray-800">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
