import React, { useState } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import { formatDate } from "../../utils/dateFormat";

export default function AdminPastStudents() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setIsLoading(true);
    setError("");
    setResults(null);
    setSelectedStudent(null);
    try {
      const data = await apiService.searchPastStudents(q);
      setResults(data);
    } catch (err) {
      setError("Search failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Header title="Past Students" />
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto">
        <div className="mb-6">
          <p className="text-gray-500 text-sm mb-4">
            Search for students who have transferred out. Enter a student number, first name, or last name.
          </p>
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Student number, first name, or last name..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {isLoading ? (
                <span><i className="fas fa-spinner fa-spin mr-2"></i>Searching...</span>
              ) : (
                <span><i className="fas fa-search mr-2"></i>Search</span>
              )}
            </button>
          </form>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {selectedStudent ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button
              onClick={() => setSelectedStudent(null)}
              className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              <i className="fas fa-arrow-left mr-2"></i>Back to Results
            </button>

            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-orange-700 text-sm">
              <i className="fas fa-exchange-alt"></i>
              <span>
                Transferred on{" "}
                {selectedStudent.transferred_at
                  ? new Date(selectedStudent.transferred_at).toLocaleDateString()
                  : "unknown date"}
                {selectedStudent.transferred_by_name && ` by ${selectedStudent.transferred_by_name}`}
                {selectedStudent.transfer_note && ` — ${selectedStudent.transfer_note}`}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <i className="fas fa-user-graduate text-blue-500 mr-2"></i>
                  Personal Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Full Name:</span>
                    <span className="text-gray-800">{selectedStudent.user?.first_name} {selectedStudent.user?.last_name}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Student Number:</span>
                    <span className="font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{selectedStudent.user?.student_number}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Email:</span>
                    <span className="text-gray-800">{selectedStudent.user?.email || "-"}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Phone:</span>
                    <span className="text-gray-800">{selectedStudent.user?.phone_number || selectedStudent.parent_contact || "-"}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Address:</span>
                    <span className="text-gray-800">{selectedStudent.address || "-"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <i className="fas fa-school text-green-500 mr-2"></i>
                  Academic Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Last Class:</span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs">{selectedStudent.class_name || "-"}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Admission Date:</span>
                    <span className="text-gray-800">{selectedStudent.admission_date}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Residence:</span>
                    <span className="text-gray-800 capitalize">{selectedStudent.residence_type || "-"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <i className="fas fa-info-circle text-orange-500 mr-2"></i>
                  Additional Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Date of Birth:</span>
                    <span className="text-gray-800">{selectedStudent.date_of_birth ? formatDate(selectedStudent.date_of_birth) : "-"}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Gender:</span>
                    <span className="text-gray-800">{selectedStudent.gender || "-"}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-500 font-medium">Emergency Contact:</span>
                    <span className="text-gray-800">{selectedStudent.emergency_contact || "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : results !== null ? (
          results.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <i className="fas fa-search text-gray-400 text-5xl mb-4"></i>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">No transferred students found</h3>
              <p className="text-gray-400 text-sm">Try a different name or student number.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-3 border-b bg-gray-50 text-sm text-gray-500">
                {results.length} result{results.length !== 1 ? "s" : ""} found
              </div>
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transferred</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">{student.user?.student_number}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {student.user?.first_name} {student.user?.last_name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{student.class_name || "-"}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {student.transferred_at
                          ? new Date(student.transferred_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {student.transfer_note || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <i className="fas fa-eye mr-1"></i>View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
