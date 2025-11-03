import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminParents() {
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCredentials, setShowCredentials] = useState(null);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    contact_number: '',
    email: '',
    address: '',
    occupation: '',
    password: '',
    student_ids: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [parentsData, studentsData, pendingData] = await Promise.all([
        apiService.fetchParents(),
        apiService.fetchStudents(),
        apiService.getPendingParentLinkRequests()
      ]);
      setParents(parentsData);
      setStudents(studentsData);
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
      [e.target.name]: e.target.value
    });
  };

  const handleStudentToggle = (studentId) => {
    setFormData(prev => ({
      ...prev,
      student_ids: prev.student_ids.includes(studentId)
        ? prev.student_ids.filter(id => id !== studentId)
        : [...prev.student_ids, studentId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await apiService.createParent(formData);
      setShowCredentials(response);
      setShowForm(false);
      setFormData({
        full_name: '',
        contact_number: '',
        email: '',
        address: '',
        occupation: '',
        password: '',
        student_ids: []
      });
      fetchData();
    } catch (error) {
      console.error("Error creating parent:", error);
      alert("Failed to create parent: " + (error.message || "Unknown error"));
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

  if (isLoading) return (
    <div>
      <Header title="Parents" />
      <LoadingSpinner />
    </div>
  );

  return (
    <div>
      <Header title="Parents" />
      <div className="p-6">
        {/* Pending Parent-Child Link Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <i className="fas fa-exclamation-triangle text-yellow-600 text-2xl mr-3"></i>
              <h3 className="text-xl font-semibold text-gray-800">
                Pending Parent-Child Link Requests ({pendingRequests.length})
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              The following parents have requested to link their accounts to students. Please review and approve or decline each request.
            </p>
            
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="bg-white rounded-lg border border-yellow-300 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1">
                            <i className="fas fa-user-circle text-purple-500 mr-2"></i>
                            Parent
                          </h4>
                          <p className="text-sm text-gray-700">{request.parent_name}</p>
                          <p className="text-sm text-gray-500">{request.parent_email}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1">
                            <i className="fas fa-graduation-cap text-blue-500 mr-2"></i>
                            Student
                          </h4>
                          <p className="text-sm text-gray-700">{request.student_name}</p>
                          <p className="text-sm text-gray-500">
                            {request.student_class} | {request.student_number}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        <i className="fas fa-clock mr-1"></i>
                        Requested: {new Date(request.requested_date).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApproveRequest(request.id)}
                        disabled={processingRequest === request.id}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {processingRequest === request.id ? (
                          <span>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Processing...
                          </span>
                        ) : (
                          <span>
                            <i className="fas fa-check mr-2"></i>
                            Approve
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(request.id)}
                        disabled={processingRequest === request.id}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {processingRequest === request.id ? (
                          <span>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Processing...
                          </span>
                        ) : (
                          <span>
                            <i className="fas fa-times mr-2"></i>
                            Decline
                          </span>
                        )}
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
            onClick={() => setShowForm(!showForm)}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 flex items-center"
          >
            <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'} mr-2`}></i>
            {showForm ? 'Cancel' : 'Add Parent'}
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
                  <p className="text-sm text-green-700 mt-2">Use the username and password to log in</p>
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
            <h3 className="text-xl font-semibold mb-4">Add New Parent</h3>
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
                  placeholder="+1234567890"
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
                  placeholder="e.g., Doctor, Engineer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength="6"
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                ></textarea>
              </div>

              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Children (Students)</label>
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3">
                  {Array.isArray(students) && students.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {students.map((student) => (
                        <label key={student.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                          <input
                            type="checkbox"
                            checked={formData.student_ids.includes(student.id)}
                            onChange={() => handleStudentToggle(student.id)}
                            className="mr-2"
                          />
                          <span className="text-sm">
                            {student.user.full_name} ({student.user.student_number}) - {student.class_name}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No students available. Add students first.</p>
                  )}
                </div>
              </div>

              <div className="col-span-full">
                <button
                  type="submit"
                  className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600"
                >
                  Add Parent
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {parents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occupation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Children</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parents.map((parent) => (
                    <tr key={parent.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{parent.user.full_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parent.user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parent.user.phone_number || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parent.occupation || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {parent.children_details && parent.children_details.length > 0 
                          ? parent.children_details.map(child => child.name).join(', ')
                          : 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-users text-gray-400 text-6xl mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No parents found</h3>
              <p className="text-gray-500 mb-4">Add parents to get started</p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600"
              >
                <i className="fas fa-plus mr-2"></i>
                Add Parent
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
