import React, { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import PaginationControls from "../../components/PaginationControls";

const POSITIONS = [
  "teacher",
  "admin",
  "hr",
  "accountant",
  "principal",
  "secretary",
  "maintenance",
  "security",
  "cleaner",
  "librarian",
];

const PAGE_SIZE = 20;

const getInitialForm = () => ({
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  position: "teacher",
  department: "",
  hire_date: new Date().toISOString().split("T")[0],
  salary: "",
  is_active: true,
});

export default function AdminStaff() {
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(getInitialForm());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [staffData, departmentData] = await Promise.all([
        apiService.getStaffList(),
        apiService.getDepartments(),
      ]);
      setStaff(Array.isArray(staffData) ? staffData : []);
      setDepartments(Array.isArray(departmentData) ? departmentData : []);
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredStaff = useMemo(() => {
    if (!searchQuery) return staff;
    const q = searchQuery.toLowerCase();
    return staff.filter((member) => {
      const fullName = `${member.user?.first_name || ""} ${member.user?.last_name || ""}`.trim().toLowerCase();
      const email = member.user?.email?.toLowerCase() || "";
      const employeeId = member.employee_id?.toLowerCase() || "";
      const position = member.position?.toLowerCase() || "";
      const departmentName = member.department_name?.toLowerCase() || "";
      return (
        fullName.includes(q) ||
        email.includes(q) ||
        employeeId.includes(q) ||
        position.includes(q) ||
        departmentName.includes(q)
      );
    });
  }, [staff, searchQuery]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE)),
    [filteredStaff.length]
  );

  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStaff.slice(start, start + PAGE_SIZE);
  }, [filteredStaff, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const closeForm = () => {
    setShowForm(false);
    setEditingStaff(null);
    setForm(getInitialForm());
  };

  const openCreateForm = () => {
    setEditingStaff(null);
    setForm(getInitialForm());
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const handleEdit = (member) => {
    setEditingStaff(member);
    setForm({
      first_name: member.user?.first_name || "",
      last_name: member.user?.last_name || "",
      email: member.user?.email || "",
      phone_number: member.user?.phone_number || "",
      position: member.position || "teacher",
      department: member.department ? String(member.department) : "",
      hire_date: member.hire_date || new Date().toISOString().split("T")[0],
      salary: member.salary ? String(member.salary) : "",
      is_active: member.is_active !== false,
    });
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (editingStaff) {
        const updatePayload = {
          user: {
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            phone_number: form.phone_number,
          },
          position: form.position,
          department: form.department ? parseInt(form.department, 10) : null,
          hire_date: form.hire_date,
          is_active: form.is_active,
        };
        if (form.salary !== "") {
          updatePayload.salary = form.salary;
        }

        await apiService.updateStaff(editingStaff.id, updatePayload);
        setSuccess("Staff member updated successfully.");
      } else {
        const createPayload = {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone_number: form.phone_number,
          position: form.position,
          department: form.department ? parseInt(form.department, 10) : null,
          hire_date: form.hire_date,
          salary: form.salary,
        };

        const res = await apiService.createStaff(createPayload);
        const username = res?.credentials?.username || "(generated)";
        const password = res?.credentials?.password || "(not returned)";
        setSuccess(`Staff created successfully. Username: ${username}, Password: ${password}`);
      }

      closeForm();
      load();
    } catch (err) {
      setError(err.message || "Failed to save staff member");
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
    return `px-2 py-1 rounded-full text-xs ${colorMap[position] || "bg-gray-100 text-gray-700"}`;
  };

  if (loading) {
    return (
      <div>
        <Header title="Staff Management" />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Staff Management" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">All Staff ({staff.length})</h1>
          <button
            onClick={() => {
              if (showForm) {
                closeForm();
              } else {
                openCreateForm();
              }
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "+ Add Staff Member"}
          </button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 text-green-800 p-3 rounded mb-4 font-medium">{success}</div>}

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Staff</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, employee ID, department, or position..."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              </div>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="ml-4 mt-6 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Showing {filteredStaff.length} of {staff.length} staff members
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredStaff.length === 0 ? (
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
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedStaff.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{member.employee_id || "—"}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {`${member.user?.first_name || ""} ${member.user?.last_name || ""}`.trim() || member.user?.email || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{member.user?.email || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{member.user?.phone_number || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={positionBadge(member.position)}>{member.position}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{member.department_name || "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              member.is_active !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {member.is_active !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleEdit(member)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <i className="fas fa-edit mr-1"></i>Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredStaff.length}
                pageSize={PAGE_SIZE}
                onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              />
            </>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-xl relative my-4">
              <button
                onClick={closeForm}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
              <h2 className="text-lg font-bold mb-4">{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
                {[
                  ["First Name", "first_name", "text", true],
                  ["Last Name", "last_name", "text", true],
                  ["Email", "email", "email", true],
                  ["Phone", "phone_number", "tel", false],
                  ["Hire Date", "hire_date", "date", true],
                  ["Salary ($)", "salary", "number", !editingStaff],
                ].map(([label, key, type, required]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-600 mb-1 block">
                      {label}
                      {required ? " *" : ""}
                    </label>
                    <input
                      required={required}
                      type={type}
                      className="border rounded w-full p-2 text-sm"
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Position *</label>
                  <select
                    required
                    className="border rounded w-full p-2 text-sm"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                  >
                    {POSITIONS.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Department</label>
                  <select
                    className="border rounded w-full p-2 text-sm"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  >
                    <option value="">None</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                {editingStaff && (
                  <div className="col-span-2">
                    <label className="flex items-center text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      />
                      Active employee
                    </label>
                  </div>
                )}
                <div className="col-span-2 flex gap-3 mt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700"
                  >
                    {editingStaff ? "Save Changes" : "Create Staff Member"}
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 border border-gray-300 rounded py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
