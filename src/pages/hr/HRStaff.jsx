import React, { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import PaginationControls from "../../components/PaginationControls";
import { formatDate } from "../../utils/dateFormat";

const PAGE_SIZE = 20;

export default function HRStaff() {
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [selected, setSelected] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([apiService.getStaffList({ include_directory: 1 }), apiService.getDepartments()])
      .then(([s, d]) => { setStaff(s); setDepartments(d); })
      .catch(() => setError("Failed to load staff"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      const name = `${s.user?.first_name || ""} ${s.user?.last_name || ""}`.toLowerCase();
      const email = (s.user?.email || "").toLowerCase();
      const q = search.toLowerCase();
      return (
        (name.includes(q) || email.includes(q)) &&
        (!filterDept || String(s.department) === filterDept)
      );
    });
  }, [staff, search, filterDept]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [search, filterDept]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this staff member?")) return;
    try {
      await apiService.deleteStaff(id);
      load();
    } catch {
      setError("Failed to delete staff member");
    }
  };

  const positionBadge = (position) => {
    const colorMap = {
      teacher: "bg-blue-100 text-blue-700",
      hr: "bg-purple-100 text-purple-700",
      accountant: "bg-green-100 text-green-700",
      admin: "bg-red-100 text-red-700",
      principal: "bg-yellow-100 text-yellow-800",
      secretary: "bg-indigo-100 text-indigo-700",
      maintenance: "bg-orange-100 text-orange-700",
      security: "bg-gray-200 text-gray-800",
      cleaner: "bg-teal-100 text-teal-700",
      librarian: "bg-cyan-100 text-cyan-700",
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${colorMap[position] || "bg-gray-100 text-gray-700"}`;
  };

  if (loading) return (
    <div>
      <Header title="Staff Management" />
      <LoadingSpinner />
    </div>
  );

  return (
    <div>
      <Header title="Staff Management" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">All Staff ({staff.length})</h1>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Staff</label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
            </div>
            {(search || filterDept) && (
              <button
                onClick={() => { setSearch(""); setFilterDept(""); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Showing {filtered.length} of {staff.length} staff members
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No staff members found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left">Employee ID</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-left">Position</th>
                      <th className="px-4 py-3 text-left">Department</th>
                      <th className="px-4 py-3 text-left">Joined</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{s.employee_id || "—"}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {`${s.user?.first_name || ""} ${s.user?.last_name || ""}`.trim() || s.user?.email || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{s.user?.email || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{s.user?.phone_number || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={positionBadge(s.position)}>{s.position}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{s.department_name || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {s.hire_date ? formatDate(s.hire_date) : (s.user?.date_joined ? formatDate(s.user.date_joined) : "—")}
                        </td>
                        <td className="px-4 py-3 space-x-3">
                          <button onClick={() => setSelected(s)}
                            className="text-blue-600 hover:text-blue-800 text-xs">
                            <i className="fas fa-eye mr-1"></i>View
                          </button>
                          {s.has_staff_profile === false ? (
                            <span className="text-xs text-gray-400">User account only</span>
                          ) : (
                            <button onClick={() => handleDelete(s.id)}
                              className="text-red-500 hover:text-red-700 text-xs">
                              <i className="fas fa-trash mr-1"></i>Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
                onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              />
            </>
          )}
        </div>

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
    </div>
  );
}
