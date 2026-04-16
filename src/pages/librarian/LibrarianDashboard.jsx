import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function LibrarianDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiService.getLibraryStats();
        setStats(data || {});
      } catch (error) {
        console.error("Failed to load library stats", error);
        setStats({});
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <Header title="Librarian Dashboard" />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Librarian Dashboard" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-blue-500 text-white p-6 rounded-lg shadow"><p className="text-sm">Total Titles</p><h3 className="text-3xl font-bold mt-2">{stats.total_titles || 0}</h3></div>
          <div className="bg-emerald-500 text-white p-6 rounded-lg shadow"><p className="text-sm">Available Copies</p><h3 className="text-3xl font-bold mt-2">{stats.available || 0}</h3></div>
          <div className="bg-yellow-500 text-white p-6 rounded-lg shadow"><p className="text-sm">Issued</p><h3 className="text-3xl font-bold mt-2">{stats.issued || 0}</h3></div>
          <div className="bg-red-500 text-white p-6 rounded-lg shadow"><p className="text-sm">Overdue</p><h3 className="text-3xl font-bold mt-2">{stats.overdue || 0}</h3></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/librarian/books" className="p-4 bg-white rounded-lg shadow hover:bg-gray-50"><i className="fas fa-book mr-2 text-blue-600"></i>Manage Books</Link>
          <Link to="/librarian/loans" className="p-4 bg-white rounded-lg shadow hover:bg-gray-50"><i className="fas fa-exchange-alt mr-2 text-green-600"></i>Manage Loans</Link>
        </div>
      </div>
    </div>
  );
}
