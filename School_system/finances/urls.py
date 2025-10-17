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
    
    # Financial Report endpoints
    path('reports/', views.FinancialReportListCreateView.as_view(), name='financial-report-list-create'),
    
    # Summary endpoints
    path('students/<int:student_id>/summary/', views.student_financial_summary, name='student-financial-summary'),
]