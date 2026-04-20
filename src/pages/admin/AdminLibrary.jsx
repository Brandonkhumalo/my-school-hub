import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import SearchableSelect from "../../components/SearchableSelect";
import { formatDate } from "../../utils/dateFormat";

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "textbook", label: "Textbook" },
  { value: "fiction", label: "Fiction" },
  { value: "non_fiction", label: "Non-Fiction" },
  { value: "reference", label: "Reference" },
  { value: "science", label: "Science" },
  { value: "history", label: "History" },
  { value: "mathematics", label: "Mathematics" },
  { value: "literature", label: "Literature" },
  { value: "other", label: "Other" },
];

export default function AdminLibrary() {
  const [activeTab, setActiveTab] = useState("books");
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [overdueLoans, setOverdueLoans] = useState([]);
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showBookForm, setShowBookForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [issueBookId, setIssueBookId] = useState(null);
  const [message, setMessage] = useState({ text: "", type: "" });

  const [bookForm, setBookForm] = useState({
    title: "", author: "", isbn: "", category: "other",
    description: "", total_copies: 1, available_copies: 1,
  });
  const [issueForm, setIssueForm] = useState({
    student_id: "", due_date: "", notes: "",
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "books") {
        const params = {};
        if (search) params.search = search;
        if (categoryFilter) params.category = categoryFilter;
        const data = await apiService.getBooks(params);
        setBooks(Array.isArray(data) ? data : []);
      } else if (activeTab === "loans") {
        const data = await apiService.getLoans({ status: "issued" });
        setLoans(Array.isArray(data) ? data : []);
      } else if (activeTab === "overdue") {
        const data = await apiService.getOverdueLoans();
        setOverdueLoans(Array.isArray(data) ? data : []);
      } else if (activeTab === "stats") {
        const data = await apiService.getLibraryStats();
        setStats(data);
      }
    } catch (error) {
      // Gracefully handle API errors (endpoint may not be deployed yet)
      setBooks([]);
      setLoans([]);
      setOverdueLoans([]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchBooks = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const data = await apiService.getBooks(params);
      setBooks(Array.isArray(data) ? data : []);
    } catch (error) {
      setBooks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "books") {
      const timer = setTimeout(() => searchBooks(), 400);
      return () => clearTimeout(timer);
    }
  }, [search, categoryFilter]);

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBook) {
        await apiService.updateBook(editingBook.id, bookForm);
        setMessage({ text: "Book updated successfully", type: "success" });
      } else {
        await apiService.createBook(bookForm);
        setMessage({ text: "Book added successfully", type: "success" });
      }
      setShowBookForm(false);
      setEditingBook(null);
      setBookForm({ title: "", author: "", isbn: "", category: "other", description: "", total_copies: 1, available_copies: 1 });
      loadData();
    } catch (error) {
      setMessage({ text: error.message || "Failed to save book", type: "error" });
    }
  };

  const handleDeleteBook = async (id) => {
    if (!window.confirm("Are you sure you want to delete this book?")) return;
    try {
      await apiService.deleteBook(id);
      setMessage({ text: "Book deleted", type: "success" });
      loadData();
    } catch (error) {
      setMessage({ text: error.message || "Failed to delete book", type: "error" });
    }
  };

  const openEditBook = (book) => {
    setEditingBook(book);
    setBookForm({
      title: book.title, author: book.author, isbn: book.isbn || "",
      category: book.category, description: book.description || "",
      total_copies: book.total_copies, available_copies: book.available_copies,
    });
    setShowBookForm(true);
  };

  const openIssueForm = async (bookId) => {
    setIssueBookId(bookId);
    setIssueForm({ student_id: "", due_date: "", notes: "" });
    try {
      const data = await apiService.fetchStudents();
      setStudents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
    setShowIssueForm(true);
  };

  const handleIssueBook = async (e) => {
    e.preventDefault();
    try {
      await apiService.issueBook(issueBookId, issueForm);
      setMessage({ text: "Book issued successfully", type: "success" });
      setShowIssueForm(false);
      loadData();
    } catch (error) {
      setMessage({ text: error.message || "Failed to issue book", type: "error" });
    }
  };

  const handleReturnBook = async (loanId) => {
    try {
      await apiService.returnBook(loanId);
      setMessage({ text: "Book returned successfully", type: "success" });
      loadData();
    } catch (error) {
      setMessage({ text: error.message || "Failed to return book", type: "error" });
    }
  };

  const tabs = [
    { id: "books", label: "Books", icon: "fa-book" },
    { id: "loans", label: "Loans", icon: "fa-exchange-alt" },
    { id: "overdue", label: "Overdue", icon: "fa-exclamation-triangle" },
    { id: "stats", label: "Stats", icon: "fa-chart-pie" },
  ];

  if (isLoading && !books.length && !loans.length) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Library Management" />

      {message.text && (
        <div className={`mb-4 p-3 rounded ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.text}
          <button className="float-right font-bold" onClick={() => setMessage({ text: "", type: "" })}>&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === tab.id ? "bg-white text-blue-700 shadow" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <i className={`fas ${tab.icon} mr-2`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Books Tab ── */}
      {activeTab === "books" && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search by title, author, or ISBN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => { setEditingBook(null); setBookForm({ title: "", author: "", isbn: "", category: "other", description: "", total_copies: 1, available_copies: 1 }); setShowBookForm(true); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <i className="fas fa-plus mr-2"></i>Add Book
            </button>
          </div>

          {isLoading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Author</th>
                    <th className="px-4 py-3">ISBN</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Copies</th>
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {books.map((book) => (
                    <tr key={book.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{book.title}</td>
                      <td className="px-4 py-3">{book.author}</td>
                      <td className="px-4 py-3 text-gray-500">{book.isbn || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs capitalize">
                          {book.category?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">{book.total_copies}</td>
                      <td className="px-4 py-3">
                        <span className={book.available_copies > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                          {book.available_copies}
                        </span>
                      </td>
                      <td className="px-4 py-3 space-x-2">
                        {book.available_copies > 0 && (
                          <button onClick={() => openIssueForm(book.id)} className="text-green-600 hover:text-green-800" title="Issue">
                            <i className="fas fa-hand-holding"></i>
                          </button>
                        )}
                        <button onClick={() => openEditBook(book)} className="text-blue-600 hover:text-blue-800" title="Edit">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button onClick={() => handleDeleteBook(book.id)} className="text-red-600 hover:text-red-800" title="Delete">
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {books.length === 0 && <p className="text-center py-8 text-gray-500">No books found.</p>}
            </div>
          )}
        </div>
      )}

      {/* ── Loans Tab ── */}
      {activeTab === "loans" && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Active Loans</h2>
          {isLoading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">Book</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Issued</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{loan.book_title}</td>
                      <td className="px-4 py-3">{loan.student_name}</td>
                      <td className="px-4 py-3">{formatDate(loan.issued_date)}</td>
                      <td className="px-4 py-3">{formatDate(loan.due_date)}</td>
                      <td className="px-4 py-3">
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs capitalize">{loan.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleReturnBook(loan.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                          Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loans.length === 0 && <p className="text-center py-8 text-gray-500">No active loans.</p>}
            </div>
          )}
        </div>
      )}

      {/* ── Overdue Tab ── */}
      {activeTab === "overdue" && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-700">
            <i className="fas fa-exclamation-triangle mr-2"></i>Overdue Loans
          </h2>
          {isLoading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-4 py-3">Book</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Issued</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Days Overdue</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {overdueLoans.map((loan) => {
                    const daysOverdue = Math.ceil((new Date() - new Date(loan.due_date)) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={loan.id} className="hover:bg-red-50">
                        <td className="px-4 py-3 font-medium">{loan.book_title}</td>
                        <td className="px-4 py-3">{loan.student_name}</td>
                        <td className="px-4 py-3">{formatDate(loan.issued_date)}</td>
                        <td className="px-4 py-3 text-red-600 font-semibold">{formatDate(loan.due_date)}</td>
                        <td className="px-4 py-3">
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">{daysOverdue} days</span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleReturnBook(loan.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                            Return
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {overdueLoans.length === 0 && <p className="text-center py-8 text-green-600">No overdue loans. All books returned on time!</p>}
            </div>
          )}
        </div>
      )}

      {/* ── Stats Tab ── */}
      {activeTab === "stats" && stats && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
              <p className="text-sm text-gray-500">Total Books</p>
              <p className="text-3xl font-bold text-blue-700">{stats.total_books}</p>
              <p className="text-xs text-gray-400">{stats.total_titles} titles</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-3xl font-bold text-green-700">{stats.available}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
              <p className="text-sm text-gray-500">Issued</p>
              <p className="text-3xl font-bold text-yellow-700">{stats.issued}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
              <p className="text-sm text-gray-500">Overdue</p>
              <p className="text-3xl font-bold text-red-700">{stats.overdue}</p>
            </div>
          </div>

          {stats.categories && stats.categories.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Books by Category</h3>
              <div className="space-y-3">
                {stats.categories.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="capitalize text-sm text-gray-700">{cat.category?.replace("_", " ") || "Unknown"}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-48 bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full"
                          style={{ width: `${Math.min((cat.count / stats.total_books) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-10 text-right">{cat.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit Book Modal ── */}
      {showBookForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editingBook ? "Edit Book" : "Add New Book"}</h2>
            <form onSubmit={handleBookSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" required value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author *</label>
                <input type="text" required value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                  <input type="text" value={bookForm.isbn}
                    onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={bookForm.category}
                    onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2">
                    {CATEGORY_OPTIONS.filter(o => o.value).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" rows="2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Copies</label>
                  <input type="number" min="1" value={bookForm.total_copies}
                    onChange={(e) => setBookForm({ ...bookForm, total_copies: parseInt(e.target.value) || 1 })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Available Copies</label>
                  <input type="number" min="0" value={bookForm.available_copies}
                    onChange={(e) => setBookForm({ ...bookForm, available_copies: parseInt(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowBookForm(false); setEditingBook(null); }}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingBook ? "Update" : "Add Book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Issue Book Modal ── */}
      {showIssueForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Issue Book</h2>
            <form onSubmit={handleIssueBook} className="space-y-4">
              <div>
                <SearchableSelect
                  options={students.map((s) => ({
                    id: s.id,
                    label: `${s.user?.full_name || s.full_name || `${s.first_name || ""} ${s.last_name || ""}`.trim()} ${s.user?.student_number || s.student_number ? `(${s.user?.student_number || s.student_number})` : ""}`.trim(),
                    searchText: `${s.user?.full_name || s.full_name || `${s.first_name || ""} ${s.last_name || ""}`.trim()} ${s.user?.student_number || s.student_number || ""}`,
                  }))}
                  value={issueForm.student_id}
                  onChange={(studentId) => setIssueForm({ ...issueForm, student_id: studentId })}
                  placeholder="Search student by name or number..."
                  label="Student"
                  required
                  getOptionLabel={(option) => option.label}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                <input type="date" required value={issueForm.due_date}
                  onChange={(e) => setIssueForm({ ...issueForm, due_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={issueForm.notes}
                  onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" rows="2" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowIssueForm(false)}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Issue Book</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
