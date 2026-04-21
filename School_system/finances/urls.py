from django.urls import path
from . import views

urlpatterns = [
    # Fee Type endpoints
    path('fee-types/', views.FeeTypeListCreateView.as_view(), name='fee-type-list-create'),
    path('fee-types/<int:pk>/', views.FeeTypeDetailView.as_view(), name='fee-type-detail'),
    
    # Student Fee endpoints
    path('student-fees/', views.StudentFeeListCreateView.as_view(), name='student-fee-list-create'),
    path('student-fees/<int:pk>/', views.StudentFeeDetailView.as_view(), name='student-fee-detail'),
    
    # Payment endpoints
    path('payments/', views.PaymentListCreateView.as_view(), name='payment-list-create'),
    path('payments/<int:pk>/', views.PaymentDetailView.as_view(), name='payment-detail'),
    path('payments/whatsapp/', views.process_whatsapp_payment, name='whatsapp-payment'),
    
    # Invoice endpoints
    path('invoices/', views.InvoiceListCreateView.as_view(), name='invoice-list-create'),
    path('invoices/<int:pk>/', views.InvoiceDetailView.as_view(), name='invoice-detail'),
    path('invoices/<int:invoice_id>/detail/', views.get_invoice_detail, name='invoice-detail-pdf'),
    path('invoices/parent/', views.parent_invoices, name='parent-invoices'),
    path('transport-preferences/<int:child_id>/', views.parent_transport_preference, name='parent-transport-preference'),
    path('transport-payment-status/', views.transport_payment_status_report, name='transport-payment-status'),
    
    # Financial Report endpoints
    path('reports/', views.FinancialReportListCreateView.as_view(), name='financial-report-list-create'),
    path('summary/', views.finance_summary_view, name='finance-summary'),
    path('expenses/', views.SchoolExpenseListCreateView.as_view(), name='school-expense-list-create'),
    path('expenses/<int:expense_id>/approve/', views.school_expense_approve_view, name='school-expense-approve'),
    
    # Summary endpoints
    path('students/<int:student_id>/summary/', views.student_financial_summary, name='student-financial-summary'),
    
    # School Fees endpoints (admin sets fees per grade/form)
    path('school-fees/', views.SchoolFeesListCreateView.as_view(), name='school-fees-list-create'),
    path('school-fees/<int:pk>/', views.SchoolFeesDetailView.as_view(), name='school-fees-detail'),
    path('school-fees/my-fees/', views.get_my_school_fees, name='my-school-fees'),
    path('grades/', views.get_all_grades, name='all-grades'),
    
    # Payment Records endpoints (new payment system)
    path('payment-records/', views.StudentPaymentRecordListCreateView.as_view(), name='payment-records-list-create'),
    path('payment-records/<int:pk>/', views.StudentPaymentRecordDetailView.as_view(), name='payment-record-detail'),
    path('payment-records/add-payment/', views.add_payment_to_record, name='add-payment-to-record'),
    path('payment-records/<int:record_id>/update-status/', views.update_payment_status, name='update-payment-status'),
    path('payment-records/class-report/', views.class_fees_report, name='class-fees-report'),
    path('payment-records/students/', views.get_students_for_payment, name='students-for-payment'),
    
    # Auto-generated invoices endpoint
    path('invoices/by-class/', views.student_invoices_by_class, name='student-invoices-by-class'),
    
    # Daily Transaction Report
    path('reports/daily/', views.daily_transaction_report, name='daily-transaction-report'),
    
    # Additional Fees endpoints
    path('additional-fees/', views.AdditionalFeeListCreateView.as_view(), name='additional-fees-list-create'),
    path('additional-fees/<int:pk>/', views.AdditionalFeeDetailView.as_view(), name='additional-fee-detail'),

    # PayNow Zimbabwe payments
    path('payments/paynow/initiate/', views.paynow_initiate_payment, name='paynow-initiate'),
    path('payments/paynow/result/', views.paynow_result_callback, name='paynow-result'),
    path('payments/paynow/status/', views.paynow_check_status, name='paynow-status'),

    # Bulk CSV Import
    path('fees/bulk-import/', views.bulk_import_fees, name='bulk-import-fees'),
]
