import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";

export default function TeacherComplaints() {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [form, setForm] = useState({
    student: "",
    complaint_type: "teacher",
    title: "",
    description: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [studentData, complaintData] = await Promise.all([
        apiService.fetchTeacherStudents(),
        apiService.fetchComplaints(),
      ]);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setComplaints(Array.isArray(complaintData) ? complaintData : []);
    } catch (error) {
      console.error("Failed to load teacher complaints", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await apiService.createComplaint({
        student: form.student ? Number(form.student) : null,
        complaint_type: form.complaint_type,
        title: form.title,
        description: form.description,
      });
      setForm({ student: "", complaint_type: "teacher", title: "", description: "" });
      load();
    } catch (error) {
      alert(error.message || "Failed to create complaint");
    }
  };

  return (
    <div>
      <Header title="Teacher Complaints" />
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">File Complaint</h3>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select className="border rounded px-3 py-2" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })}>
              <option value="">General Complaint (No student)</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.user?.first_name} {student.user?.last_name} ({student.user?.student_number || ""})
                </option>
              ))}
            </select>
            <select className="border rounded px-3 py-2" value={form.complaint_type} onChange={(e) => setForm({ ...form, complaint_type: e.target.value })}>
              <option value="teacher">Teacher</option>
              <option value="general">General</option>
            </select>
            <input required className="md:col-span-2 border rounded px-3 py-2" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea required rows={4} className="md:col-span-2 border rounded px-3 py-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button className="md:col-span-2 bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">Submit Complaint</button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">My Complaint History</h3>
          {loading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Student</th>
                    <th className="text-left px-3 py-2">Title</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {complaints.map((complaint) => (
                    <tr key={complaint.id}>
                      <td className="px-3 py-2">{formatDate(complaint.date_submitted)}</td>
                      <td className="px-3 py-2 capitalize">{complaint.complaint_type || "general"}</td>
                      <td className="px-3 py-2">{complaint.student_name || "-"}</td>
                      <td className="px-3 py-2">{complaint.title}</td>
                      <td className="px-3 py-2 capitalize">{complaint.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {complaints.length === 0 && <p className="text-center py-6 text-gray-500">No complaints submitted yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
