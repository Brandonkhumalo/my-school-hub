import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function StudentFeeSummary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchStudentSummary(user.id);
        setSummary(data);
      } catch (error) {
        console.error("Error fetching fee summary:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Fee Summary" user={user} />
      {summary ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
              <p>Total Fees Due</p>
              <h3 className="text-3xl font-bold">${summary.total_fees_due}</h3>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
              <p>Total Fees Paid</p>
              <h3 className="text-3xl font-bold">${summary.total_fees_paid}</h3>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
              <p>Balance</p>
              <h3 className="text-3xl font-bold">${summary.total_balance}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold mb-2">Pending Fees</h3>
              <table className="w-full text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th>Fee Type</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.pending_fees.map((fee, idx) => (
                    <tr key={idx}>
                      <td>{fee.fee_type_name}</td>
                      <td>${fee.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold mb-2">Recent Payments</h3>
              <table className="w-full text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th>ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent_payments.map((payment, idx) => (
                    <tr key={idx}>
                      <td>{payment.id}</td>
                      <td>${payment.amount}</td>
                      <td>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                          {payment.payment_status}
                        </span>
                      </td>
                      <td>{payment.payment_date || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <p>No fee summary available yet.</p>
      )}
    </div>
  );
}
