import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function ParentFeeSummary() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchParentFeeSummary();
        setSummary(data);
      } catch (error) {
        console.error("Error fetching fee summary:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Fee Summary" />
      {summary ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-100 p-4 rounded-md">
              <p>Total Fees Due</p>
              <h3>${summary.total_fees_due}</h3>
            </div>
            <div className="bg-green-100 p-4 rounded-md">
              <p>Total Fees Paid</p>
              <h3>${summary.total_fees_paid}</h3>
            </div>
            <div className="bg-red-100 p-4 rounded-md">
              <p>Balance</p>
              <h3>${summary.balance}</h3>
            </div>
          </div>

          <h4 className="text-lg font-semibold mb-2">Pending Fees</h4>
          <ul>
            {summary.pending_fees.map((fee, idx) => (
              <li key={idx}>{fee.fee_type}: ${fee.balance}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p>No fee summary available.</p>
      )}
    </div>
  );
}
