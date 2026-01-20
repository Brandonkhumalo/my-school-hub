import React, { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [searchName, setSearchName] = useState("");
  const [searchInvoiceNumber, setSearchInvoiceNumber] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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

  const filteredAndSortedInvoices = useMemo(() => {
    let result = [...invoices];
    
    if (searchName) {
      result = result.filter(inv => 
        inv.student_name?.toLowerCase().includes(searchName.toLowerCase())
      );
    }
    
    if (searchInvoiceNumber) {
      result = result.filter(inv => 
        inv.invoice_number?.toLowerCase().includes(searchInvoiceNumber.toLowerCase())
      );
    }
    
    if (filterDate) {
      result = result.filter(inv => {
        const invDate = new Date(inv.due_date).toISOString().split('T')[0];
        return invDate === filterDate;
      });
    }
    
    result.sort((a, b) => {
      const dateA = new Date(a.due_date || a.created_at);
      const dateB = new Date(b.due_date || b.created_at);
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
    
    return result;
  }, [invoices, searchName, searchInvoiceNumber, filterDate, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredAndSortedInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const clearFilters = () => {
    setSearchName("");
    setSearchInvoiceNumber("");
    setFilterDate("");
    setSortOrder("newest");
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchName, searchInvoiceNumber, filterDate, sortOrder]);

  if (isLoading) return (
    <div>
      <Header title="Invoices" />
      <LoadingSpinner />
    </div>
  );

  return (
    <div>
      <Header title="Invoices" />
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter & Sort Invoices</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search by name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
              <input
                type="text"
                value={searchInvoiceNumber}
                onChange={(e) => setSearchInvoiceNumber(e.target.value)}
                placeholder="Search by invoice #..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
              >
                <i className="fas fa-times mr-2"></i>
                Clear Filters
              </button>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Showing {paginatedInvoices.length} of {filteredAndSortedInvoices.length} invoices
            {filteredAndSortedInvoices.length !== invoices.length && (
              <span> (filtered from {invoices.length} total)</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {paginatedInvoices.length > 0 ? (
            <>
              <div className="overflow-x-auto">
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
                    {paginatedInvoices.map((invoice, idx) => (
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
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    >
                      <i className="fas fa-chevron-left mr-2"></i>
                      Previous
                    </button>
                    
                    <div className="flex space-x-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 rounded ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    >
                      Next
                      <i className="fas fa-chevron-right ml-2"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <i className="fas fa-file-invoice-dollar text-6xl mb-4"></i>
              <p>No invoices found matching your criteria.</p>
              {(searchName || searchInvoiceNumber || filterDate) && (
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
