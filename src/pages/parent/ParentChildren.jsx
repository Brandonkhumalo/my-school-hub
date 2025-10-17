import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function ParentChildren() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [availableChildren, setAvailableChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildren = async () => {
    try {
      setLoading(true);
      const [childrenData, availableData] = await Promise.all([
        apiService.getParentChildren(),
        apiService.getAvailableChildren()
      ]);
      setChildren(childrenData);
      setAvailableChildren(availableData);
    } catch (error) {
      console.error("Error loading children:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmChild = async (childId) => {
    try {
      setConfirming(childId);
      await apiService.confirmChild(childId);
      await loadChildren();
    } catch (error) {
      console.error("Error confirming child:", error);
      alert("Failed to confirm child. Please try again.");
    } finally {
      setConfirming(null);
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="My Children" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="My Children" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">My Children</h2>
          <p className="text-gray-600 mt-2">Manage your linked children and confirm new ones</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirmed Children</h3>
            
            {children.filter(c => c.is_confirmed).length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-child text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No confirmed children yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {children.filter(c => c.is_confirmed).map((child) => (
                  <div
                    key={child.id}
                    className="p-4 bg-green-50 border-l-4 border-green-500 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center mr-4">
                          <i className="fas fa-user text-xl"></i>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            {child.name} {child.surname}
                          </h4>
                          <p className="text-sm text-gray-600">Class: {child.class}</p>
                          <p className="text-sm text-gray-600">Student #: {child.student_number}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full">
                        Confirmed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Children to Confirm</h3>
            
            {availableChildren.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-check-circle text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No children available to confirm</p>
                <p className="text-sm text-gray-400 mt-2">
                  Contact the school if you believe there's an error
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableChildren.map((child) => (
                  <div
                    key={child.id}
                    className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center mr-4">
                          <i className="fas fa-user text-xl"></i>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            {child.name} {child.surname}
                          </h4>
                          <p className="text-sm text-gray-600">Class: {child.class}</p>
                          <p className="text-sm text-gray-600">Student #: {child.student_number}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleConfirmChild(child.id)}
                        disabled={confirming === child.id}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:bg-gray-400"
                      >
                        {confirming === child.id ? (
                          <span>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Confirming...
                          </span>
                        ) : (
                          <span>
                            <i className="fas fa-check mr-2"></i>
                            Confirm Child
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <div className="flex">
            <i className="fas fa-info-circle text-blue-600 text-xl mr-3"></i>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">How it works</h4>
              <p className="text-blue-700 text-sm">
                The school admin links children to parent accounts based on the parent ID. 
                You need to confirm that each child shown in the "Available Children" section 
                is actually your child. Once confirmed, you can view their academic performance 
                and receive updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
