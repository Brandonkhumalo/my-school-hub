import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function AdminPayments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("records");
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [classReport, setClassReport] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [students, setStudents] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");

  const currentYear = new Date().getFullYear();
  const academicYears = [`${currentYear}`, `${currentYear - 1}`, `${currentYear + 1}`];

  const [formData, setFormData] = useState({
    student: "",
    payment_type: "school_fees",
    payment_plan: "one_term",
    academic_year: `${currentYear}`,
    academic_term: "term_1",
    total_amount_due: "",
    amount_paid: "",
    currency: "USD",
    payment_method: "cash",
    due_date: "",
    next_payment_due: "",
    notes: ""
  });

  const [addPaymentData, setAddPaymentData] = useState({
    payment_record_id: "",
    amount: "",
    payment_method: "cash",
    transaction_reference: "",
    notes: "",
    next_payment_due: ""
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === "records") {
      loadPaymentRecords();
    } else if (activeTab === "report") {
      loadClassReport();
    } else if (activeTab === "invoices") {
      loadInvoices();
    }
  }, [activeTab, selectedClass, statusFilter]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [classesData, studentsData] = await Promise.all([
        apiService.fetchClasses(),
        apiService.getStudentsForPayment()
      ]);
      setClasses(classesData || []);
      setStudents(studentsData?.students || []);
    } catch (error) {
      console.error("Error loading initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentRecords = async () => {
    try {
      const params = {};
      if (selectedClass) params.class_id = selectedClass;
      if (statusFilter) params.status = statusFilter;
      const data = await apiService.getPaymentRecords(params);
      setPaymentRecords(data || []);
    } catch (error) {
      console.error("Error loading payment records:", error);
    }
  };

  const loadClassReport = async () => {
    try {
      const params = {};
      if (selectedClass) params.class_id = selectedClass;
      const data = await apiService.getClassFeesReport(params);
      setClassReport(data?.reports || []);
    } catch (error) {
      console.error("Error loading class report:", error);
    }
  };

  const loadInvoices = async () => {
    try {
      if (!selectedClass) {
        setInvoices([]);
        return;
      }
      const params = { class_id: selectedClass };
      const data = await apiService.getInvoicesByClass(params);
      setInvoices(data?.invoices || []);
    } catch (error) {
      console.error("Error loading invoices:", error);
    }
  };

  const handleCreatePaymentRecord = async (e) => {
    e.preventDefault();
    try {
      await apiService.createPaymentRecord(formData);
      setShowAddModal(false);
      setFormData({
        student: "",
        payment_type: "school_fees",
        payment_plan: "one_term",
        academic_year: `${currentYear}`,
        academic_term: "term_1",
        total_amount_due: "",
        amount_paid: "",
        currency: "USD",
        payment_method: "cash",
        due_date: "",
        next_payment_due: "",
        notes: ""
      });
      loadPaymentRecords();
      loadInvoices();
    } catch (error) {
      console.error("Error creating payment record:", error);
      alert("Failed to create payment record: " + error.message);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const paymentAmount = addPaymentData.amount;
      const paymentMethod = addPaymentData.payment_method;
      const paymentRef = addPaymentData.transaction_reference;
      const recordForReceipt = selectedRecord;
      
      await apiService.addPaymentToRecord(addPaymentData);
      setShowPaymentModal(false);
      setAddPaymentData({
        payment_record_id: "",
        amount: "",
        payment_method: "cash",
        transaction_reference: "",
        notes: "",
        next_payment_due: ""
      });
      loadPaymentRecords();
      loadInvoices();
      
      if (window.confirm('Payment recorded! Would you like to print a receipt?')) {
        printPaymentReceipt(recordForReceipt, paymentAmount, paymentMethod, paymentRef);
      }
    } catch (error) {
      console.error("Error adding payment:", error);
      alert("Failed to add payment: " + error.message);
    }
  };

  const handleUpdateStatus = async (recordId, newStatus) => {
    try {
      await apiService.updatePaymentStatus(recordId, newStatus);
      loadPaymentRecords();
      loadClassReport();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status: " + error.message);
    }
  };

  const openAddPaymentModal = (record) => {
    setSelectedRecord(record);
    setAddPaymentData({
      payment_record_id: record.id,
      amount: "",
      payment_method: "cash",
      transaction_reference: "",
      notes: "",
      next_payment_due: ""
    });
    setShowPaymentModal(true);
  };

  const openInvoiceModal = async (invoice) => {
    try {
      const detail = await apiService.getInvoiceDetail(invoice.id);
      setSelectedInvoice(detail);
      setShowInvoiceModal(true);
    } catch (error) {
      console.error("Error loading invoice detail:", error);
    }
  };

  const handleStudentSelect = (studentId) => {
    const student = students.find(s => s.id === parseInt(studentId));
    if (student && student.school_fee) {
      setFormData({
        ...formData,
        student: studentId,
        total_amount_due: student.school_fee.total_fee,
        currency: student.school_fee.currency,
        academic_year: student.school_fee.academic_year,
        academic_term: student.school_fee.academic_term
      });
    } else {
      setFormData({ ...formData, student: studentId });
    }
  };

  const printReceipt = (invoice) => {
    const inv = invoice || selectedInvoice;
    if (!inv) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
      <head>
        <title>Receipt - ${inv.invoice_number || 'Invoice'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #16a34a; padding-bottom: 20px; }
          .school-info h1 { font-size: 22px; color: #1e3a5f; margin-bottom: 4px; }
          .school-info p { font-size: 12px; color: #666; line-height: 1.5; }
          .invoice-label { text-align: right; }
          .invoice-label h2 { font-size: 28px; color: #16a34a; font-weight: 800; letter-spacing: 2px; }
          .invoice-label p { font-size: 12px; color: #555; margin-top: 4px; }
          .invoice-label .inv-num { font-family: monospace; font-size: 14px; font-weight: 600; color: #333; }
          .bill-to { background: #f8f9fa; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
          .bill-to h3 { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
          .bill-to .name { font-size: 16px; font-weight: 700; color: #1e3a5f; }
          .bill-to p { font-size: 13px; color: #555; margin-top: 2px; }
          .details-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .details-table th { background: #f1f5f9; text-align: left; padding: 10px 14px; font-size: 12px; text-transform: uppercase; color: #555; letter-spacing: 0.5px; }
          .details-table td { padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; }
          .details-table td:last-child { text-align: right; }
          .totals { border-top: 2px solid #e5e7eb; padding-top: 12px; }
          .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
          .totals .row.total { font-size: 18px; font-weight: 700; border-top: 2px solid #333; padding-top: 10px; margin-top: 6px; }
          .totals .row.total.paid { color: #16a34a; }
          .totals .row.total.due { color: #dc2626; }
          .status-badge { text-align: center; padding: 10px; border-radius: 6px; font-size: 16px; font-weight: 700; margin-top: 20px; letter-spacing: 1px; }
          .status-paid { background: #dcfce7; color: #166534; }
          .status-unpaid { background: #fee2e2; color: #991b1b; }
          .notes { margin-top: 16px; padding: 12px; background: #fffbeb; border-left: 3px solid #f59e0b; font-size: 12px; color: #92400e; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 16px; }
          @media print {
            body { padding: 15px; }
            @page { margin: 10mm; size: A4; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="school-info">
            <h1>${inv.school_name || 'MySchoolHub'}</h1>
            ${inv.school_address ? `<p>${inv.school_address}</p>` : ''}
            ${inv.school_phone ? `<p>Tel: ${inv.school_phone}</p>` : ''}
            ${inv.school_email ? `<p>${inv.school_email}</p>` : ''}
          </div>
          <div class="invoice-label">
            <h2>RECEIPT</h2>
            <p class="inv-num">${inv.invoice_number || ''}</p>
            <p>Date: ${inv.issue_date || new Date().toLocaleDateString()}</p>
            ${inv.due_date ? `<p>Due: ${inv.due_date}</p>` : ''}
          </div>
        </div>

        <div class="bill-to">
          <h3>Issued To</h3>
          <p class="name">${inv.student_name || ''}</p>
          ${inv.student_number ? `<p>Student #: ${inv.student_number}</p>` : ''}
          ${inv.class_name ? `<p>Class: ${inv.class_name}</p>` : ''}
        </div>

        ${inv.payment_details ? `
          <table class="details-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align:right">Details</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Payment Type</td><td>${inv.payment_details.payment_type || ''}</td></tr>
              <tr><td>Payment Plan</td><td>${inv.payment_details.payment_plan || ''}</td></tr>
              <tr><td>Academic Year</td><td>${inv.payment_details.academic_year || ''}</td></tr>
              ${inv.payment_details.academic_term ? `<tr><td>Term</td><td>${inv.payment_details.academic_term}</td></tr>` : ''}
            </tbody>
          </table>
        ` : ''}

        <div class="totals">
          <div class="row"><span>Total Amount:</span><span>$${parseFloat(inv.total_amount || 0).toFixed(2)}</span></div>
          <div class="row"><span>Amount Paid:</span><span style="color:#16a34a">$${parseFloat(inv.amount_paid || 0).toFixed(2)}</span></div>
          <div class="row total ${inv.is_paid ? 'paid' : 'due'}">
            <span>Balance Due:</span>
            <span>$${parseFloat(inv.balance || 0).toFixed(2)}</span>
          </div>
        </div>

        <div class="status-badge ${inv.is_paid ? 'status-paid' : 'status-unpaid'}">
          ${inv.is_paid ? 'PAID IN FULL' : 'BALANCE OUTSTANDING'}
        </div>

        ${inv.notes ? `<div class="notes"><strong>Notes:</strong> ${inv.notes}</div>` : ''}

        <div class="footer">
          <p>Thank you for your payment</p>
          <p>Generated by MySchoolHub &bull; ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 300);
  };

  const printPaymentReceipt = (record, paymentAmount, paymentMethod, reference) => {
    if (!record || !paymentAmount) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const amount = parseFloat(paymentAmount) || 0;
    const student = students.find(s => s.id === record.student);
    const studentName = record.student_name || student?.name || 'Student';
    const studentNumber = record.student_number || student?.student_number || '';
    const className = record.class_name || student?.class_name || '';
    const now = new Date();
    const receiptNo = `RCP-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    
    const methodLabels = { cash: 'Cash', bank_transfer: 'Bank Transfer', card: 'Card', mobile_money: 'Mobile Money', ecocash: 'EcoCash', innbucks: 'InnBucks', other: 'Other' };
    
    printWindow.document.write(`
      <html>
      <head>
        <title>Payment Receipt - ${receiptNo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #16a34a; padding-bottom: 20px; }
          .school-info h1 { font-size: 22px; color: #1e3a5f; margin-bottom: 4px; }
          .school-info p { font-size: 12px; color: #666; line-height: 1.5; }
          .receipt-label { text-align: right; }
          .receipt-label h2 { font-size: 28px; color: #16a34a; font-weight: 800; letter-spacing: 2px; }
          .receipt-label p { font-size: 12px; color: #555; margin-top: 4px; }
          .receipt-label .rec-num { font-family: monospace; font-size: 14px; font-weight: 600; color: #333; }
          .student-info { background: #f8f9fa; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
          .student-info h3 { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
          .student-info .name { font-size: 16px; font-weight: 700; color: #1e3a5f; }
          .student-info p { font-size: 13px; color: #555; margin-top: 2px; }
          .payment-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
          .payment-box .amount { font-size: 36px; font-weight: 800; color: #16a34a; }
          .payment-box .label { font-size: 14px; color: #555; margin-bottom: 8px; }
          .details { margin: 20px 0; }
          .details .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
          .details .row .label { color: #666; }
          .details .row .value { font-weight: 600; }
          .balance-section { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 16px; margin-top: 20px; }
          .balance-section .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
          .balance-section .remaining { font-size: 18px; font-weight: 700; color: #dc2626; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f59e0b; }
          .balance-section .remaining.clear { color: #16a34a; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 16px; }
          @media print {
            body { padding: 15px; }
            @page { margin: 10mm; size: A4; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="school-info">
            <h1>MySchoolHub</h1>
            <p>School Fee Payment Receipt</p>
          </div>
          <div class="receipt-label">
            <h2>RECEIPT</h2>
            <p class="rec-num">${receiptNo}</p>
            <p>Date: ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>Time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <div class="student-info">
          <h3>Received From</h3>
          <p class="name">${studentName}</p>
          ${studentNumber ? `<p>Student #: ${studentNumber}</p>` : ''}
          ${className ? `<p>Class: ${className}</p>` : ''}
        </div>

        <div class="payment-box">
          <div class="label">Amount Received</div>
          <div class="amount">${record.currency || 'USD'} ${amount.toFixed(2)}</div>
        </div>

        <div class="details">
          <div class="row"><span class="label">Payment Method:</span><span class="value">${methodLabels[paymentMethod] || paymentMethod}</span></div>
          ${reference ? `<div class="row"><span class="label">Reference:</span><span class="value">${reference}</span></div>` : ''}
          <div class="row"><span class="label">Academic Year:</span><span class="value">${record.academic_year || ''}</span></div>
          <div class="row"><span class="label">Term:</span><span class="value">${(record.academic_term || '').replace('_', ' ')}</span></div>
        </div>

        <div class="balance-section">
          <div class="row"><span>Total Fees Due:</span><span>${record.currency || 'USD'} ${parseFloat(record.total_amount_due || 0).toFixed(2)}</span></div>
          <div class="row"><span>Previously Paid:</span><span>${record.currency || 'USD'} ${parseFloat(record.amount_paid || 0).toFixed(2)}</span></div>
          <div class="row"><span>This Payment:</span><span>${record.currency || 'USD'} ${amount.toFixed(2)}</span></div>
          <div class="row remaining ${(parseFloat(record.total_amount_due || 0) - parseFloat(record.amount_paid || 0) - amount) <= 0 ? 'clear' : ''}">
            <span>Remaining Balance:</span>
            <span>${record.currency || 'USD'} ${Math.max(0, parseFloat(record.total_amount_due || 0) - parseFloat(record.amount_paid || 0) - amount).toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for your payment</p>
          <p>Generated by MySchoolHub &bull; ${now.toLocaleString()}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 300);
  };

  const getStatusBadge = (status) => {
    const styles = {
      paid: "bg-green-100 text-green-800",
      partial: "bg-yellow-100 text-yellow-800",
      unpaid: "bg-red-100 text-red-800"
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-800"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div>
        <Header title="Payments" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Payments" user={user} />
      
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Fee Payments Management</h2>
                <p className="text-green-100 mt-1">Record and track student fee payments</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-50 transition"
              >
                <i className="fas fa-plus mr-2"></i>
                Record Payment
              </button>
            </div>
          </div>

          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab("records")}
                className={`px-6 py-4 text-sm font-medium ${activeTab === "records" ? "border-b-2 border-green-500 text-green-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                <i className="fas fa-list mr-2"></i>
                Payment Records
              </button>
              <button
                onClick={() => setActiveTab("report")}
                className={`px-6 py-4 text-sm font-medium ${activeTab === "report" ? "border-b-2 border-green-500 text-green-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                <i className="fas fa-chart-bar mr-2"></i>
                Class Fees Report
              </button>
              <button
                onClick={() => setActiveTab("invoices")}
                className={`px-6 py-4 text-sm font-medium ${activeTab === "invoices" ? "border-b-2 border-green-500 text-green-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                <i className="fas fa-file-invoice mr-2"></i>
                Invoices
              </button>
            </nav>
          </div>

          <div className="p-4 bg-gray-50 border-b flex gap-4 flex-wrap">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            {activeTab === "records" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>
            )}
          </div>

          <div className="p-6">
            {activeTab === "records" && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Class</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Plan</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total Due</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Paid</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Balance</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Due Date</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paymentRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{record.student_name}</div>
                          <div className="text-xs text-gray-500">{record.student_number}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{record.class_name}</td>
                        <td className="px-4 py-3 text-gray-700 capitalize">{record.payment_type?.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-gray-700 capitalize">{record.payment_plan?.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-right font-medium">{record.currency}{parseFloat(record.total_amount_due).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{record.currency}{parseFloat(record.amount_paid).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-medium">{record.currency}{parseFloat(record.balance).toFixed(2)}</td>
                        <td className="px-4 py-3">{getStatusBadge(record.payment_status)}</td>
                        <td className="px-4 py-3 text-gray-700">{record.due_date || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            {record.payment_status !== 'paid' && (
                              <button
                                onClick={() => openAddPaymentModal(record)}
                                className="text-green-600 hover:text-green-800"
                                title="Add Payment"
                              >
                                <i className="fas fa-plus-circle"></i>
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateStatus(record.id, record.payment_status === 'paid' ? 'unpaid' : 'paid')}
                              className="text-blue-600 hover:text-blue-800"
                              title={record.payment_status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                            >
                              <i className={`fas ${record.payment_status === 'paid' ? 'fa-times-circle' : 'fa-check-circle'}`}></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paymentRecords.length === 0 && (
                      <tr>
                        <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                          No payment records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "report" && (
              <div className="space-y-6">
                {!selectedClass && (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <i className="fas fa-search text-4xl text-gray-400 mb-4"></i>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Class</h3>
                    <p className="text-gray-500">Please select a class from the dropdown above to view the fees report</p>
                  </div>
                )}
                {selectedClass && classReport.map((report) => (
                  <div key={report.class_id} className="border rounded-lg overflow-hidden">
                    <div className="bg-blue-50 p-4 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{report.class_name}</h3>
                        <p className="text-sm text-gray-600">{report.total_students} students</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{report.paid_count}</div>
                          <div className="text-xs text-gray-500">Paid</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">{report.partial_count}</div>
                          <div className="text-xs text-gray-500">Partial</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">{report.unpaid_count}</div>
                          <div className="text-xs text-gray-500">Unpaid</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 border-t grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-gray-900">${report.total_due?.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">Total Due</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">${report.total_collected?.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">Collected</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-600">${report.total_outstanding?.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">Outstanding</div>
                      </div>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Student</th>
                          <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Total Due</th>
                          <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Paid</th>
                          <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Balance</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {report.students?.map((student) => (
                          <tr key={student.student_id} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <div className="font-medium text-gray-900">{student.student_name}</div>
                              <div className="text-xs text-gray-500">{student.student_number}</div>
                            </td>
                            <td className="px-4 py-2 text-right">${student.total_due?.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-green-600">${student.total_paid?.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-red-600">${student.balance?.toFixed(2)}</td>
                            <td className="px-4 py-2">{getStatusBadge(student.status?.toLowerCase() || 'unpaid')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {selectedClass && classReport.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No students found in this class
                  </div>
                )}
              </div>
            )}

            {activeTab === "invoices" && (
              <div className="overflow-x-auto">
                {!selectedClass ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-filter text-4xl mb-3 text-gray-300"></i>
                    <p>Please select a class to view invoices</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Invoice #</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Issue Date</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Paid</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Balance</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">
                            {invoice.invoice_number}
                            {invoice.is_auto_generated && (
                              <span className="ml-2 text-xs text-gray-400">(Auto)</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{invoice.student_name}</div>
                            <div className="text-xs text-gray-500">{invoice.student_number}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{invoice.issue_date}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            {invoice.currency || '$'}{parseFloat(invoice.total_amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-green-600">
                            {invoice.currency || '$'}{parseFloat(invoice.amount_paid).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-red-600">
                            {invoice.currency || '$'}{parseFloat(invoice.balance).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(invoice.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => openInvoiceModal(invoice)}
                                className="text-blue-600 hover:text-blue-800"
                                title="View Invoice"
                              >
                                <i className="fas fa-eye"></i>
                              </button>
                              <button
                                onClick={() => openInvoiceModal(invoice)}
                                className="text-green-600 hover:text-green-800"
                                title="Download PDF"
                              >
                                <i className="fas fa-download"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {invoices.length === 0 && (
                        <tr>
                          <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                            No students found with school fees in this class
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-green-600 text-white px-6 py-4 rounded-t-xl">
              <h3 className="text-xl font-bold">Record Student Payment</h3>
            </div>
            <form onSubmit={handleCreatePaymentRecord} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                  <select
                    value={formData.student}
                    onChange={(e) => handleStudentSelect(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select Student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} - {student.class_name} ({student.student_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type *</label>
                  <select
                    value={formData.payment_type}
                    onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="school_fees">School Fees</option>
                    <option value="other">Other Payment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Plan *</label>
                  <select
                    value={formData.payment_plan}
                    onChange={(e) => setFormData({ ...formData, payment_plan: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="full_year">Full Year Payment</option>
                    <option value="two_terms">Two Terms Payment</option>
                    <option value="one_term">One Term Payment</option>
                    <option value="batch">Batch Payment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
                  <select
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    {academicYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                  <select
                    value={formData.academic_term}
                    onChange={(e) => setFormData({ ...formData, academic_term: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">N/A (Full Year)</option>
                    <option value="term_1">Term 1</option>
                    <option value="term_2">Term 2</option>
                    <option value="term_3">Term 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="USD">USD ($)</option>
                    <option value="ZWL">ZWL (ZiG)</option>
                    <option value="ZAR">ZAR (R)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount Due *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_amount_due}
                    onChange={(e) => setFormData({ ...formData, total_amount_due: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter total amount"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid Now</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount_paid}
                    onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter amount paid"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="ecocash">EcoCash</option>
                    <option value="innbucks">InnBucks</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {formData.payment_plan === 'batch' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Next Payment Due</label>
                    <input
                      type="date"
                      value={formData.next_payment_due}
                      onChange={(e) => setFormData({ ...formData, next_payment_due: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows="2"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-xl">
              <h3 className="text-xl font-bold">Add Payment</h3>
              <p className="text-blue-100 text-sm">{selectedRecord.student_name}</p>
            </div>
            <div className="p-4 bg-blue-50 border-b">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Balance:</span>
                  <span className="ml-2 font-bold text-red-600">{selectedRecord.currency}{parseFloat(selectedRecord.balance).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Due:</span>
                  <span className="ml-2 font-bold">{selectedRecord.currency}{parseFloat(selectedRecord.total_amount_due).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedRecord.balance}
                  value={addPaymentData.amount}
                  onChange={(e) => setAddPaymentData({ ...addPaymentData, amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter payment amount"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                <select
                  value={addPaymentData.payment_method}
                  onChange={(e) => setAddPaymentData({ ...addPaymentData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="ecocash">EcoCash</option>
                  <option value="innbucks">InnBucks</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Reference</label>
                <input
                  type="text"
                  value={addPaymentData.transaction_reference}
                  onChange={(e) => setAddPaymentData({ ...addPaymentData, transaction_reference: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Reference number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Payment Due</label>
                <input
                  type="date"
                  value={addPaymentData.next_payment_due}
                  onChange={(e) => setAddPaymentData({ ...addPaymentData, next_payment_due: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={addPaymentData.notes}
                  onChange={(e) => setAddPaymentData({ ...addPaymentData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-8 print:p-4" id="invoice-content">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedInvoice.school_name || 'MySchoolHub'}</h2>
                  <p className="text-gray-600">{selectedInvoice.school_address}</p>
                  <p className="text-gray-600">{selectedInvoice.school_phone}</p>
                  <p className="text-gray-600">{selectedInvoice.school_email}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-3xl font-bold text-green-600">INVOICE</h3>
                  <p className="text-gray-700 font-mono mt-2">{selectedInvoice.invoice_number}</p>
                  <p className="text-gray-600 mt-1">Date: {selectedInvoice.issue_date}</p>
                  <p className="text-gray-600">Due: {selectedInvoice.due_date}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-gray-700 mb-2">Bill To:</h4>
                <p className="font-bold text-gray-900">{selectedInvoice.student_name}</p>
                <p className="text-gray-600">Student #: {selectedInvoice.student_number}</p>
                <p className="text-gray-600">Class: {selectedInvoice.class_name}</p>
              </div>

              {selectedInvoice.payment_details && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-700 mb-2">Payment Details:</h4>
                  <table className="w-full">
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 text-gray-600">Type:</td>
                        <td className="py-2 font-medium">{selectedInvoice.payment_details.payment_type}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 text-gray-600">Plan:</td>
                        <td className="py-2 font-medium">{selectedInvoice.payment_details.payment_plan}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 text-gray-600">Academic Year:</td>
                        <td className="py-2 font-medium">{selectedInvoice.payment_details.academic_year}</td>
                      </tr>
                      {selectedInvoice.payment_details.academic_term && (
                        <tr className="border-b">
                          <td className="py-2 text-gray-600">Term:</td>
                          <td className="py-2 font-medium">{selectedInvoice.payment_details.academic_term}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t border-b py-4 mb-6">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-bold">${parseFloat(selectedInvoice.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-bold text-green-600">${parseFloat(selectedInvoice.amount_paid).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 text-lg">
                  <span className="font-bold">Balance Due:</span>
                  <span className="font-bold text-red-600">${parseFloat(selectedInvoice.balance).toFixed(2)}</span>
                </div>
              </div>

              <div className={`text-center py-2 rounded ${selectedInvoice.is_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <span className="font-bold text-lg">{selectedInvoice.is_paid ? 'PAID' : 'UNPAID'}</span>
              </div>

              {selectedInvoice.notes && (
                <div className="mt-4 text-sm text-gray-600">
                  <strong>Notes:</strong> {selectedInvoice.notes}
                </div>
              )}
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => printReceipt()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <i className="fas fa-print mr-2"></i>
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
