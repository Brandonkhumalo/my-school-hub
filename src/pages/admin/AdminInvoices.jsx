import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchInvoices = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchInvoices();
        setInvoices(data);
      } catch (error) {
        console.error("Error fetching invoices:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Invoices" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {invoices.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">Invoice #</th>
                <th className="p-3">Student</th>
                <th className="p-3">Total Amount</th>
                <th className="p-3">Paid</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Due Date</th>
                <th className="p-3">Status</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-semibold text-blue-600">{invoice.invoice_number}</td>
                  <td className="p-3">{invoice.student_name}</td>
                  <td className="p-3 font-semibold">${parseFloat(invoice.total_amount).toFixed(2)}</td>
                  <td className="p-3 text-green-600">${parseFloat(invoice.amount_paid).toFixed(2)}</td>
                  <td className="p-3 font-semibold text-red-600">${parseFloat(invoice.balance).toFixed(2)}</td>
                  <td className="p-3 text-gray-600">{new Date(invoice.due_date).toLocaleDateString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-white text-sm ${
                      invoice.is_paid ? 'bg-green-500' : 'bg-orange-500'
                    }`}>
                      {invoice.is_paid ? 'Paid' : 'Pending'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600 text-sm">{invoice.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <i className="fas fa-file-invoice-dollar text-6xl mb-4"></i>
            <p>No invoices available yet.</p>
            <p className="text-sm mt-2">Student invoices will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
