import React, { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate } from "../../utils/dateFormat";
import SearchableSelect from "../../components/SearchableSelect";

export default function AdminSuspensions() {
  const [suspensions, setSuspensions] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    student: "",
    teacher: "",
    reason: "",
    start_date: "",
    end_date: "",
  });

  const sortedSuspensions = useMemo(
    () => [...suspensions].sort((a, b) => new Date(b.date_created || b.start_date) - new Date(a.date_created || a.start_date)),
    [suspensions]
  );

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [suspensionData, studentsData, teachersData] = await Promise.all([
        apiService.fetchSuspensions(),
        apiService.fetchStudents(),
        apiService.fetchTeachers(),
      ]);
      setSuspensions(Array.isArray(suspensionData) ? suspensionData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
    } catch (err) {
      setError(err.message || "Failed to load suspensions data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const validateForm = () => {
    if (!form.student || !form.reason || !form.start_date || !form.end_date) {
      return "Student, reason, start date, and end date are required.";
    }
    if (!form.teacher) {
      return "Teacher is required unless the selected class has a class teacher configured.";
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      return "End date cannot be before start date.";
    }
    return "";
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await apiService.createSuspension({
        student: Number(form.student),
        teacher: form.teacher ? Number(form.teacher) : null,
        reason: form.reason,
        start_date: form.start_date,
        end_date: form.end_date,
      });
      setMessage("Suspension recorded successfully.");
      setForm({ student: "", teacher: "", reason: "", start_date: "", end_date: "" });
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to create suspension.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Suspensions" />

      {error && <div className="mb-4 bg-red-100 text-red-700 p-3 rounded">{error}</div>}
      {message && <div className="mb-4 bg-green-100 text-green-700 p-3 rounded">{message}</div>}

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Add Suspension</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelect
              options={students.map((s) => ({
                id: s.id,
                label: `${s.user?.full_name || `${s.user?.first_name || ""} ${s.user?.last_name || ""}`.trim()}${s.class_name ? ` - ${s.class_name}` : ""}`,
                searchText: `${s.user?.full_name || ""} ${s.user?.student_number || ""} ${s.class_name || ""}`,
              }))}
              value={form.student}
              onChange={(id) => setForm((prev) => ({ ...prev, student: id }))}
              placeholder="Search student..."
              label="Student"
              required
            />

            <SearchableSelect
              options={teachers.map((t) => ({
                id: t.id,
                label: t.user?.full_name || `${t.user?.first_name || ""} ${t.user?.last_name || ""}`.trim(),
                searchText: `${t.user?.full_name || ""} ${t.user?.email || ""}`,
              }))}
              value={form.teacher}
              onChange={(id) => setForm((prev) => ({ ...prev, teacher: id }))}
              placeholder="Search teacher..."
              label="Teacher"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Describe why the suspension is being issued..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Record Suspension"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Suspension History</h2>
        {sortedSuspensions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Teacher</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedSuspensions.map((item) => {
                  const now = new Date();
                  const isActive = item.is_active && new Date(item.end_date) >= now;
                  return (
                    <tr key={item.id} className="border-b align-top">
                      <td className="px-3 py-2">{item.id}</td>
                      <td className="px-3 py-2">{item.student_name}</td>
                      <td className="px-3 py-2">{item.teacher_name || "-"}</td>
                      <td className="px-3 py-2 max-w-xs whitespace-pre-wrap">{item.reason}</td>
                      <td className="px-3 py-2">{formatDate(item.start_date)}</td>
                      <td className="px-3 py-2">{formatDate(item.end_date)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${isActive ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                          {isActive ? "Active" : "Ended"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No suspensions available.</p>
        )}
      </div>
    </div>
  );
}
