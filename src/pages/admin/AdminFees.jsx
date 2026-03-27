import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminFees() {
  const [fees, setFees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchFees = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchFees();
        setFees(data);
      } catch (error) {
        console.error("Error fetching fees:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFees();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Fee Management" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {fees.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th>Student</th>
                <th>Fee Type</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-2 px-3">{fee.student_name}</td>
                  <td className="py-2 px-3">{fee.fee_type_name}</td>
                  <td className="py-2 px-3">{fee.currency || '$'}{parseFloat(fee.amount_due).toFixed(2)}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${fee.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {fee.is_paid ? 'Paid' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No fee records available.</p>
        )}
      </div>
    </div>
  );
}
