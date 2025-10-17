import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function ParentFees() {
  const { user } = useAuth();
  const [feesData, setFeesData] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const childrenData = await apiService.getParentChildren();
      const confirmedChildren = childrenData.filter(c => c.is_confirmed);
      setChildren(confirmedChildren);
      
      if (confirmedChildren.length > 0) {
        setSelectedChild(confirmedChildren[0]);
        const fees = await apiService.getChildFees(confirmedChildren[0].id);
        setFeesData(fees);
      }
    } catch (error) {
      console.error("Error loading fees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChildChange = async (childId) => {
    const child = children.find(c => c.id === parseInt(childId));
    setSelectedChild(child);
    
    if (child) {
      try {
        setLoading(true);
        const fees = await apiService.getChildFees(child.id);
        setFeesData(fees);
      } catch (error) {
        console.error("Error loading fees:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="School Fees" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div>
        <Header title="School Fees" user={user} />
        <div className="p-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
            <p className="text-yellow-700">
              No confirmed children found. Please confirm your children first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="School Fees" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">School Fees Payment</h2>
          <p className="text-gray-600 mt-2">Manage and pay your child's school fees</p>
        </div>

        {children.length > 1 && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Viewing Fees for:</h3>
              <select
                value={selectedChild?.id || ''}
                onChange={(e) => handleChildChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name} {child.surname} - {child.class}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {feesData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Total Fees</p>
                    <h3 className="text-3xl font-bold mt-2">${feesData.total_fees || 0}</h3>
                  </div>
                  <i className="fas fa-file-invoice-dollar text-4xl opacity-50"></i>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Paid</p>
                    <h3 className="text-3xl font-bold mt-2">${feesData.total_paid || 0}</h3>
                  </div>
                  <i className="fas fa-check-circle text-4xl opacity-50"></i>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Outstanding</p>
                    <h3 className="text-3xl font-bold mt-2">${feesData.outstanding || 0}</h3>
                  </div>
                  <i className="fas fa-exclamation-triangle text-4xl opacity-50"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">Fee Breakdown</h3>
                {feesData.outstanding > 0 && (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center"
                  >
                    <i className="fas fa-credit-card mr-2"></i>
                    Make Payment
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fee Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Due Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {feesData.fees?.map((fee) => (
                      <tr key={fee.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-800">{fee.type}</td>
                        <td className="px-4 py-3 text-gray-800 font-semibold">${fee.amount}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(fee.due_date)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(fee.status)}`}>
                            {fee.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {feesData.payment_history && feesData.payment_history.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-6">Payment History</h3>
                <div className="space-y-3">
                  {feesData.payment_history.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center mr-4">
                          <i className="fas fa-check"></i>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{payment.description}</p>
                          <p className="text-sm text-gray-600">{formatDate(payment.date)}</p>
                        </div>
                      </div>
                      <p className="font-bold text-green-600">${payment.amount}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-credit-card text-3xl text-blue-600"></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Demo Payment Mode</h3>
                <p className="text-gray-600">
                  This is a demonstration interface for school fees payment.
                </p>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                <p className="text-blue-700 text-sm">
                  <i className="fas fa-info-circle mr-2"></i>
                  In a live system, this would integrate with payment gateways like Stripe, PayPal, or local payment providers.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Child:</span>
                  <span className="font-semibold text-gray-800">
                    {selectedChild?.name} {selectedChild?.surname}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Outstanding Amount:</span>
                  <span className="font-bold text-orange-600">${feesData?.outstanding || 0}</span>
                </div>
              </div>

              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
