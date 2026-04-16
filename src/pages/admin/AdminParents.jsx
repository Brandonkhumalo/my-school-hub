import React, { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import PaginationControls from "../../components/PaginationControls";

function normalizeStudent(student) {
  return {
    id: student.id,
    full_name:
      student.user?.full_name ||
      `${student.user?.first_name || ""} ${student.user?.last_name || ""}`.trim() ||
      "Unnamed Student",
    student_number: student.user?.student_number || "",
    class_name: student.class_name || "Not Assigned",
  };
}

function normalizeChild(child) {
  return {
    id: child.id,
    full_name: child.name || "Unnamed Student",
    student_number: child.student_number || "",
    class_name: child.class || "Not Assigned",
  };
}

export default function AdminParents() {
  const PAGE_SIZE = 20;
  const [parents, setParents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingParent, setEditingParent] = useState(null);
  const [showCredentials, setShowCredentials] = useState(null);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    full_name: "",
    contact_number: "",
    email: "",
    address: "",
    occupation: "",
    password: "",
    student_ids: [],
  });

  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [studentLookup, setStudentLookup] = useState({});
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const query = studentSearchQuery.trim();
    if (query.length < 2) {
      setStudentSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingStudents(true);
        const data = await apiService.searchAcademicStudents(query);
        const normalized = (Array.isArray(data) ? data : []).map(normalizeStudent);
        setStudentSearchResults(normalized);
        setStudentLookup((prev) => {
          const next = { ...prev };
          normalized.forEach((s) => {
            next[s.id] = s;
          });
          return next;
        });
      } catch (error) {
        console.error("Error searching students:", error);
        setStudentSearchResults([]);
      } finally {
        setIsSearchingStudents(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [studentSearchQuery, showForm]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(parents.length / PAGE_SIZE)),
    [parents.length]
  );

  const paginatedParents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return parents.slice(start, start + PAGE_SIZE);
  }, [parents, currentPage]);

  const selectedStudents = useMemo(
    () => formData.student_ids.map((id) => studentLookup[id]).filter(Boolean),
    [formData.student_ids, studentLookup]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetForm = () => {
    setFormData({
      full_name: "",
      contact_number: "",
      email: "",
      address: "",
      occupation: "",
      password: "",
      student_ids: [],
    });
    setStudentSearchQuery("");
    setStudentSearchResults([]);
    setStudentLookup({});
    setEditingParent(null);
    setShowForm(false);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [parentsData, pendingData] = await Promise.all([
        apiService.fetchParents(),
        apiService.getPendingParentLinkRequests(),
      ]);
      setParents(parentsData);
      setPendingRequests(pendingData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleStudentToggle = (student) => {
    setStudentLookup((prev) => ({ ...prev, [student.id]: student }));
    setFormData((prev) => ({
      ...prev,
      student_ids: prev.student_ids.includes(student.id)
        ? prev.student_ids.filter((id) => id !== student.id)
        : [...prev.student_ids, student.id],
    }));
  };

  const handleEditParent = (parent) => {
    const children = (parent.children_details || []).map(normalizeChild);
    const lookup = {};
    children.forEach((child) => {
      lookup[child.id] = child;
    });
    setStudentLookup(lookup);

    setEditingParent(parent);
    setFormData({
      full_name: parent.user?.full_name || `${parent.user?.first_name || ""} ${parent.user?.last_name || ""}`.trim(),
      contact_number: parent.user?.phone_number || "",
      email: parent.user?.email || "",
      address: "",
      occupation: parent.occupation || "",
      password: "",
      student_ids: children.map((c) => c.id),
    });
    setStudentSearchQuery("");
    setStudentSearchResults([]);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingParent) {
        const payload = {
          full_name: formData.full_name,
          contact_number: formData.contact_number,
          email: formData.email,
          occupation: formData.occupation,
          student_ids: formData.student_ids,
        };
        if (formData.password) payload.password = formData.password;
        await apiService.updateParent(editingParent.id, payload);
        alert("Parent updated successfully.");
      } else {
        const response = await apiService.createParent(formData);
        setShowCredentials(response);
      }
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving parent:", error);
      alert("Failed to save parent: " + (error.message || "Unknown error"));
    }
  };

  const handleApproveRequest = async (linkId) => {
    if (!confirm("Are you sure you want to approve this parent-child link request?")) {
      return;
    }

    try {
      setProcessingRequest(linkId);
      await apiService.approveParentLinkRequest(linkId);
      alert("Parent-child link approved successfully!");
      fetchData();
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Failed to approve request: " + (error.message || "Unknown error"));
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDeclineRequest = async (linkId) => {
    if (!confirm("Are you sure you want to decline this parent-child link request? This action cannot be undone.")) {
      return;
    }

    try {
      setProcessingRequest(linkId);
      await apiService.declineParentLinkRequest(linkId);
      alert("Parent-child link request declined.");
      fetchData();
    } catch (error) {
      console.error("Error declining request:", error);
      alert("Failed to decline request: " + (error.message || "Unknown error"));
    } finally {
      setProcessingRequest(null);
    }
  };

  if (isLoading)
    return (
      <div>
        <Header title="Parents" />
        <LoadingSpinner />
      </div>
    );

  return (
    <div>
      <Header title="Parents" />
      <div className="p-6">
        {pendingRequests.length > 0 && (
          <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <i className="fas fa-exclamation-triangle text-yellow-600 text-2xl mr-3"></i>
              <h3 className="text-xl font-semibold text-gray-800">
                Pending Parent-Child Link Requests ({pendingRequests.length})
              </h3>
            </div>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="bg-white rounded-lg border border-yellow-300 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">
                        <strong>Parent:</strong> {request.parent_name} ({request.parent_email})
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Student:</strong> {request.student_name} ({request.student_number})
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Requested: {formatDate(request.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApproveRequest(request.id)}
                        disabled={processingRequest === request.id}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition disabled:bg-gray-400"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(request.id)}
                        disabled={processingRequest === request.id}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:bg-gray-400"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">All Parents ({parents.length})</h2>
          <button
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setShowForm(true);
              }
            }}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 flex items-center"
          >
            <i className={`fas ${showForm ? "fa-times" : "fa-plus"} mr-2`}></i>
            {showForm ? "Cancel" : "Add Parent"}
          </button>
        </div>

        {showCredentials && (
          <div className="bg-green-50 border border-green-400 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-3">Parent Created Successfully!</h3>
                <div className="space-y-2">
                  <p className="text-gray-700"><strong>Name:</strong> {showCredentials.full_name}</p>
                  <p className="text-gray-700"><strong>Username:</strong> <span className="font-mono bg-green-100 px-2 py-1 rounded">{showCredentials.username}</span></p>
                  <p className="text-gray-700"><strong>Email:</strong> {showCredentials.email}</p>
                  <p className="text-gray-700"><strong>Password:</strong> <span className="font-mono bg-green-100 px-2 py-1 rounded">{showCredentials.password}</span></p>
                </div>
              </div>
              <button onClick={() => setShowCredentials(null)} className="text-green-600 hover:text-green-800">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">
              {editingParent ? "Edit Parent" : "Add New Parent"}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
                <input
                  type="tel"
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {!editingParent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    minLength="6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              {editingParent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password (Optional)</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    minLength="6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              {!editingParent && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  ></textarea>
                </div>
              )}

              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Children (Students)
                </label>
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="Search by student number or name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Search to add students. We do not show the full student list here.
                </p>

                {selectedStudents.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedStudents.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleStudentToggle(student)}
                        className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs hover:bg-purple-200"
                        title="Click to remove"
                      >
                        {student.full_name} ({student.student_number}) - {student.class_name} ×
                      </button>
                    ))}
                  </div>
                )}

                {studentSearchQuery.trim().length >= 2 && (
                  <div className="mt-3 border border-gray-300 rounded-md max-h-48 overflow-y-auto">
                    {isSearchingStudents ? (
                      <p className="p-3 text-sm text-gray-500">Searching students...</p>
                    ) : studentSearchResults.length > 0 ? (
                      studentSearchResults.map((student) => {
                        const selected = formData.student_ids.includes(student.id);
                        return (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => handleStudentToggle(student)}
                            className={`w-full text-left px-3 py-2 border-b last:border-b-0 ${
                              selected ? "bg-purple-50" : "hover:bg-gray-50"
                            }`}
                          >
                            <span className="text-sm font-medium text-gray-800">
                              {student.full_name} ({student.student_number})
                            </span>
                            <span className="block text-xs text-gray-500">
                              {student.class_name} {selected ? "• Selected" : ""}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="p-3 text-sm text-gray-500">No matching students found.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="col-span-full flex gap-3">
                <button
                  type="submit"
                  className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600"
                >
                  {editingParent ? "Save Changes" : "Add Parent"}
                </button>
                {editingParent && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {parents.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occupation</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Children</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedParents.map((parent) => (
                      <tr key={parent.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {parent.user.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parent.user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {parent.user.phone_number || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parent.occupation || "-"}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {parent.children_details && parent.children_details.length > 0
                            ? parent.children_details.map((child) => child.name).join(", ")
                            : "None"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleEditParent(parent)}
                            className="text-purple-600 hover:text-purple-800"
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
                totalItems={parents.length}
                pageSize={PAGE_SIZE}
                onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              />
            </>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-users text-gray-400 text-6xl mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No parents found</h3>
              <p className="text-gray-500 mb-4">Add parents to get started</p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600"
              >
                <i className="fas fa-plus mr-2"></i>Add Parent
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
