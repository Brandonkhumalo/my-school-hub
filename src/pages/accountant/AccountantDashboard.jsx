import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function AccountantDashboard() {
  const [loading, setLoading] = useState(true);
  const [finance, setFinance] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const financeData = await apiService.getFinanceSummary().catch(() => null);
        setFinance(financeData);
      } catch (error) {
        console.error("Accountant dashboard load failed", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <Header title="Accountant Dashboard" />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Accountant Dashboard" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-blue-500 text-white p-6 rounded-lg shadow"><p className="text-sm">Monthly Salaries</p><h3 className="text-3xl font-bold mt-2">${Number(finance?.monthly_salary_total ?? 0).toLocaleString()}</h3></div>
          <div className="bg-green-500 text-white p-6 rounded-lg shadow"><p className="text-sm">Term Revenue</p><h3 className="text-3xl font-bold mt-2">${Number(finance?.term_revenue ?? 0).toLocaleString()}</h3></div>
          <div className="bg-purple-500 text-white p-6 rounded-lg shadow"><p className="text-sm">Term Profit</p><h3 className="text-3xl font-bold mt-2">${Number(finance?.term_profit ?? 0).toLocaleString()}</h3></div>
          <div className="bg-amber-500 text-white p-6 rounded-lg shadow"><p className="text-sm">Unpaid Salaries</p><h3 className="text-3xl font-bold mt-2">{finance?.monthly_unpaid_count ?? 0}</h3></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Link to="/accountant/fees" className="p-4 bg-white rounded-lg shadow hover:bg-gray-50"><i className="fas fa-money-bill mr-2 text-blue-600"></i>Fees</Link>
          <Link to="/accountant/payments" className="p-4 bg-white rounded-lg shadow hover:bg-gray-50"><i className="fas fa-credit-card mr-2 text-green-600"></i>Payments</Link>
          <Link to="/accountant/invoices" className="p-4 bg-white rounded-lg shadow hover:bg-gray-50"><i className="fas fa-file-invoice mr-2 text-purple-600"></i>Invoices</Link>
          <Link to="/accountant/accounting" className="p-4 bg-white rounded-lg shadow hover:bg-gray-50"><i className="fas fa-calculator mr-2 text-indigo-600"></i>Accounting</Link>
          <Link to="/accountant/reports" className="p-4 bg-white rounded-lg shadow hover:bg-gray-50"><i className="fas fa-chart-bar mr-2 text-amber-600"></i>Reports</Link>
        </div>
      </div>
    </div>
  );
}
