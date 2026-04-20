from django.urls import path
from . import views

urlpatterns = [
    path('books/', views.book_list, name='book-list'),
    path('books/<int:book_id>/', views.book_detail, name='book-detail'),
    path('books/<int:book_id>/issue/', views.issue_book, name='issue-book'),
    path('loan-requests/', views.loan_requests, name='loan-requests'),
    path('loan-requests/<int:request_id>/review/', views.review_loan_request, name='review-loan-request'),
    path('loans/', views.loan_list, name='loan-list'),
    path('loans/<int:loan_id>/return/', views.return_book, name='return-book'),
    path('loans/overdue/', views.overdue_loans, name='overdue-loans'),
    path('stats/', views.library_stats, name='library-stats'),
]
