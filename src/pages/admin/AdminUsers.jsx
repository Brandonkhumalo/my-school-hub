import React, { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import PaginationControls from "../../components/PaginationControls";

const PAGE_SIZE = 20;
const STAFF_ROLES = new Set(["teacher", "admin", "hr", "accountant", "security", "cleaner", "librarian"]);

const ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "parent", label: "Parent" },
  { value: "admin", label: "Admin" },
  { value: "hr", label: "HR" },
  { value: "accountant", label: "Accountant" },
  { value: "security", label: "Security" },
  { value: "cleaner", label: "Cleaner" },
  { value: "librarian", label: "Librarian" },
];

const STAFF_POSITION_OPTIONS = {
  teacher: ["teacher"],
  admin: ["admin", "principal", "secretary"],
  hr: ["hr", "maintenance"],
  accountant: ["accountant"],
  security: ["security"],
  cleaner: ["cleaner"],
  librarian: ["librarian"],
};

const getDefaultPositionForRole = (role) => {
  const options = STAFF_POSITION_OPTIONS[role] || [];
  return options[0] || "";
};

const getInitialFormData = () => ({
  first_name: "",
  last_name: "",
  email: "",
  username: "",
  password: "",
  role: "parent",
  phone_number: "",
  student_number: "",
  salary: "",
  hire_date: new Date().toISOString().split("T")[0],
  department: "",
  staff_position: "",
  is_active: true,
});

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState(getInitialFormData());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const isStaffRole = STAFF_ROLES.has(formData.role);
  const positionOptions = STAFF_POSITION_OPTIONS[formData.role] || [];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersData, departmentsData] = await Promise.all([
        apiService.fetchUsers(),
        apiService.getDepartments(),
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  };

  const startCreate = () => {
    setEditingUser(null);
    setFormData(getInitialFormData());
    setFormError("");
    setShowForm(true);
  };

  const startEdit = (user) => {
    const isStaff = STAFF_ROLES.has(user.role);
    setEditingUser(user);
    setFormData({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      username: user.username || "",
      password: "",
      role: user.role || "parent",
      phone_number: user.phone_number || "",
      student_number: user.student_number || "",
      salary: isStaff && user.salary != null ? String(user.salary) : "",
      hire_date: isStaff && user.staff_hire_date ? user.staff_hire_date : new Date().toISOString().split("T")[0],
      department: isStaff && user.staff_department_id ? String(user.staff_department_id) : "",
      staff_position: isStaff ? (user.staff_position || getDefaultPositionForRole(user.role)) : "",
      is_active: user.is_active !== false,
    });
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData(getInitialFormData());
    setFormError("");
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;
    setFormData((prev) => {
      const updated = { ...prev, [name]: nextValue };
      if (name === "role") {
        if (STAFF_ROLES.has(value)) {
          updated.staff_position = getDefaultPositionForRole(value);
        } else {
          updated.staff_position = "";
          updated.salary = "";
          updated.department = "";
        }
      }
      return updated;
    });
  };

  const buildPayload = () => {
    const payload = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim(),
      role: formData.role,
      phone_number: formData.phone_number.trim() || null,
      student_number: formData.student_number.trim() || null,
      is_active: formData.is_active,
    };

    if (formData.username.trim()) {
      payload.username = formData.username.trim();
    }

    if (formData.password.trim()) {
      payload.password = formData.password;
    }

    if (STAFF_ROLES.has(formData.role)) {
      payload.salary = formData.salary === "" ? null : parseFloat(formData.salary);
      payload.hire_date = formData.hire_date || null;
      payload.department = formData.department ? parseInt(formData.department, 10) : null;
      payload.staff_position = formData.staff_position || getDefaultPositionForRole(formData.role);
    }

    if (formData.role !== "student") {
      payload.student_number = null;
    }

    return payload;
  };

  const validateForm = () => {
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      return "First name and last name are required.";
    }
    if (!formData.email.trim()) {
      return "Email is required.";
    }
    if (!editingUser && !formData.password.trim()) {
      return "Password is required for new users.";
    }
    if (formData.role === "student" && !formData.student_number.trim()) {
      return "Student number is required for student users.";
    }
    if (STAFF_ROLES.has(formData.role)) {
      if (formData.salary === "") return "Salary is required for staff roles.";
      if (!formData.hire_date) return "Hire date is required for staff roles.";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = buildPayload();
      if (editingUser) {
        await apiService.updateManagedUser(editingUser.id, payload);
      } else {
        await apiService.createManagedUser(payload);
      }
      closeForm();
      await fetchData();
    } catch (error) {
      console.error("Error saving user:", error);
      setFormError(error.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await apiService.deleteUser(userId);
      await fetchData();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    }
  };

  const filteredUsers = useMemo(
    () => (filterRole === "all" ? users : users.filter((user) => user.role === filterRole)),
    [filterRole, users]
  );

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterRole]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  if (isLoading) {
    return (
      <div>
        <Header title="User Management" />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="User Management" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterRole("all")}
              className={`px-4 py-2 rounded ${filterRole === "all" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
            >
              All ({users.length})
            </button>
            {["student", "teacher", "parent", "admin", "hr", "accountant"].map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`px-4 py-2 rounded ${filterRole === role ? "bg-blue-500 text-white" : "bg-gray-200"}`}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)} ({users.filter((u) => u.role === role).length})
              </button>
            ))}
          </div>
          <button
            onClick={() => (showForm ? closeForm() : startCreate())}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center"
          >
            <i className={`fas ${showForm ? "fa-times" : "fa-plus"} mr-2`}></i>
            {showForm ? "Cancel" : "Create New User"}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">
              {editingUser ? "Edit User Account" : "Create New User Account"}
            </h3>

            {formError && (
              <div className="mb-4 rounded bg-red-100 text-red-800 px-4 py-3 text-sm">{formError}</div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Auto-generated if left blank"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingUser ? "" : "*"}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={editingUser ? "Leave blank to keep current password" : ""}
                  required={!editingUser}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {formData.role === "student" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student Number *</label>
                  <input
                    type="text"
                    name="student_number"
                    value={formData.student_number}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {isStaffRole && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salary *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="salary"
                      value={formData.salary}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date *</label>
                    <input
                      type="date"
                      name="hire_date"
                      value={formData.hire_date}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Staff Position</label>
                    <select
                      name="staff_position"
                      value={formData.staff_position}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {positionOptions.map((position) => (
                        <option key={position} value={position}>
                          {position}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">None</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {editingUser && (
                <div className="col-span-full">
                  <label className="inline-flex items-center text-sm text-gray-700">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    Active account
                  </label>
                </div>
              )}

              <div className="col-span-full">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-60 w-full md:w-auto"
                >
                  {saving ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {filteredUsers.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salary</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.role === "admin"
                                ? "bg-red-100 text-red-800"
                                : user.role === "teacher"
                                ? "bg-green-100 text-green-800"
                                : user.role === "student"
                                ? "bg-blue-100 text-blue-800"
                                : user.role === "parent"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.phone_number || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.salary != null ? Number(user.salary).toFixed(2) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm flex items-center gap-3">
                          <button onClick={() => startEdit(user)} className="text-blue-600 hover:text-blue-900">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900">
                            <i className="fas fa-trash"></i>
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
                totalItems={filteredUsers.length}
                pageSize={PAGE_SIZE}
                onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              />
            </>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-users text-gray-400 text-5xl mb-4"></i>
              <p className="text-gray-500 text-lg">No users found</p>
              <p className="text-gray-400 text-sm mt-2">
                {filterRole === "all" ? "Create your first user to get started" : `No ${filterRole}s in the system`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
