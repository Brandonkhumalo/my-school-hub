import React, { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { formatDate } from "../../utils/dateFormat";

export default function StudentLibrary() {
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const [booksData, loansData, requestsData] = await Promise.all([
        apiService.getBooks(),
        apiService.getLoans(),
        apiService.getLoanRequests(),
      ]);
      setBooks(Array.isArray(booksData) ? booksData : []);
      setLoans(Array.isArray(loansData) ? loansData : []);
      setRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch (err) {
      setMessage({ text: err.message || "Failed to load library data.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const requestBook = async (bookId) => {
    try {
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 14);
      await apiService.createLoanRequest({
        book_id: bookId,
        requested_due_date: defaultDue.toISOString().slice(0, 10),
      });
      setMessage({ text: "Book request submitted. Librarian review is pending.", type: "success" });
      await loadData();
    } catch (err) {
      setMessage({ text: err.message || "Could not submit request.", type: "error" });
    }
  };

  const activeLoanBookIds = useMemo(
    () => new Set(loans.filter((l) => l.status === "issued" || l.status === "overdue").map((l) => l.book)),
    [loans]
  );

  const pendingRequestBookIds = useMemo(
    () => new Set(requests.filter((r) => r.status === "pending").map((r) => r.book)),
    [requests]
  );

  if (loading) {
    return (
      <div>
        <Header title="Library" />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Library" subtitle="Request books and track your loans" />
      <div className="p-6 space-y-6">
        {message.text && (
          <div className={`p-3 rounded ${message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold mb-4">Available Books</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Author</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {books.map((book) => {
                  const alreadyBorrowed = activeLoanBookIds.has(book.id);
                  const pendingRequest = pendingRequestBookIds.has(book.id);
                  const canRequest = book.available_copies > 0 && !alreadyBorrowed && !pendingRequest;

                  return (
                    <tr key={book.id}>
                      <td className="px-3 py-2 font-medium">{book.title}</td>
                      <td className="px-3 py-2">{book.author}</td>
                      <td className="px-3 py-2 capitalize">{String(book.category || "other").replace("_", " ")}</td>
                      <td className="px-3 py-2">{book.available_copies}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => requestBook(book.id)}
                          disabled={!canRequest}
                          className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {alreadyBorrowed ? "Already Borrowed" : pendingRequest ? "Request Pending" : "Request Book"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {books.length === 0 && <p className="text-gray-500 text-sm py-4">No books found.</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold mb-4">My Loan Requests</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2">Book</th>
                  <th className="px-3 py-2">Requested</th>
                  <th className="px-3 py-2">Preferred Due Date</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Review Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-3 py-2 font-medium">{req.book_title}</td>
                    <td className="px-3 py-2">{formatDate(req.requested_at)}</td>
                    <td className="px-3 py-2">{req.requested_due_date ? formatDate(req.requested_due_date) : "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${req.status === "approved" ? "bg-green-100 text-green-700" : req.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{req.review_note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {requests.length === 0 && <p className="text-gray-500 text-sm py-4">No requests yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
