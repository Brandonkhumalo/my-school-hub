import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminParentLinkRequests() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getPendingParentLinkRequests();
      setRequests(data);
    } catch (error) {
      console.error("Error fetching parent link requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (linkId) => {
    if (!confirm("Are you sure you want to approve this parent-child link request?")) return;
    
    setProcessing(linkId);
    try {
      await apiService.approveParentLinkRequest(linkId);
      await fetchRequests();
      alert("Link request approved successfully!");
    } catch (error) {
      console.error("Error approving link:", error);
      alert("Failed to approve link request");
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (linkId) => {
    if (!confirm("Are you sure you want to decline this parent-child link request?")) return;
    
    setProcessing(linkId);
    try {
      await apiService.declineParentLinkRequest(linkId);
      await fetchRequests();
      alert("Link request declined successfully!");
    } catch (error) {
      console.error("Error declining link:", error);
      alert("Failed to decline link request");
    } finally {
      setProcessing(null);
    }
  };

  if (isLoading) return (
    <div>
      <Header title="Parent Link Requests" />
      <LoadingSpinner />
    </div>
  );

  return (
    <div>
      <Header title="Parent-Child Link Requests" />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Pending Link Requests</h2>
          <p className="text-gray-600 mt-1">Review and approve/decline parent requests to link with students</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {requests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {request.parent_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {request.parent_email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {request.student_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {request.student_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {request.class_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {request.created_at ? new Date(request.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApprove(request.id)}
                            disabled={processing === request.id}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 transition"
                          >
                            {processing === request.id ? (
                              <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                              <>
                                <i className="fas fa-check mr-1"></i>
                                Approve
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDecline(request.id)}
                            disabled={processing === request.id}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 transition"
                          >
                            {processing === request.id ? (
                              <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                              <>
                                <i className="fas fa-times mr-1"></i>
                                Decline
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-link text-gray-400 text-6xl mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Pending Requests</h3>
              <p className="text-gray-500">
                There are no pending parent-child link requests at this time.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <div className="flex">
            <i className="fas fa-info-circle text-blue-600 text-xl mr-3"></i>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">About Parent-Child Links</h4>
              <p className="text-blue-700 text-sm">
                Parents can request to link with students through their portal. Once approved, 
                parents can view their child's academic information, fees, and messages. 
                Please verify the relationship before approving requests.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
