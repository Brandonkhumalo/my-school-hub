import React, { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate } from "../../utils/dateFormat";

export default function AdminFees() {
  const [feeRecords, setFeeRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchFees = async () => {
      setIsLoading(true);
      try {
        // Primary source: current payment records.
        const records = await apiService.getPaymentRecords();
        const normalized = Array.isArray(records)
          ? records
          : Array.isArray(records?.results)
          ? records.results
          : [];

        if (normalized.length > 0) {
          setFeeRecords(normalized);
          return;
        }

        // Legacy fallback: old student fee rows (kept for backward compatibility).
        const legacy = await apiService.fetchFees();
        setFeeRecords(Array.isArray(legacy) ? legacy : []);
      } catch (error) {
        console.error("Error fetching fee records:", error);
        setFeeRecords([]);
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
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {feeRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Student #</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Amount Due</th>
                    <th className="p-3">Amount Paid</th>
                    <th className="p-3">Balance</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feeRecords.map((record) => {
                    const due = Number(record.total_amount_due ?? record.amount_due ?? 0);
                    const paid = Number(record.amount_paid ?? 0);
                    const balance = Number(record.balance ?? Math.max(due - paid, 0));
                    const status = record.payment_status || (balance <= 0 ? "paid" : "pending");
                    const currency = record.currency || "$";
                    return (
                      <tr key={record.id} className="border-b">
                        <td className="p-3">{record.student_name || "-"}</td>
                        <td className="p-3">{record.student_number || "-"}</td>
                        <td className="p-3">{record.class_name || "-"}</td>
                        <td className="p-3">{currency}{due.toFixed(2)}</td>
                        <td className="p-3 text-green-700">{currency}{paid.toFixed(2)}</td>
                        <td className="p-3 text-red-700">{currency}{balance.toFixed(2)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs capitalize ${
                            status === "paid"
                              ? "bg-green-100 text-green-700"
                              : status === "partial"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td className="p-3">{record.due_date ? formatDate(record.due_date) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No fee records available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
