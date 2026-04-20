from django.contrib import admin
from .models import Book, BookLoan, BookLoanRequest


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    """Represents BookAdmin."""
    list_display = ('title', 'author', 'isbn', 'category', 'total_copies', 'available_copies', 'school')
    list_filter = ('category', 'school')
    search_fields = ('title', 'author', 'isbn')


@admin.register(BookLoan)
class BookLoanAdmin(admin.ModelAdmin):
    """Represents BookLoanAdmin."""
    list_display = ('book', 'student', 'status', 'issued_date', 'due_date', 'returned_date')
    list_filter = ('status',)
    search_fields = ('book__title', 'student__user__first_name', 'student__user__last_name')


@admin.register(BookLoanRequest)
class BookLoanRequestAdmin(admin.ModelAdmin):
    list_display = ('book', 'student', 'status', 'requested_at', 'reviewed_at')
    list_filter = ('status',)
    search_fields = ('book__title', 'student__user__first_name', 'student__user__last_name')
