from rest_framework import serializers
from .models import Book, BookLoan, BookLoanRequest


class BookSerializer(serializers.ModelSerializer):
    """Represents BookSerializer."""
    class Meta:
        """Represents Meta."""
        model = Book
        fields = [
            'id', 'title', 'author', 'isbn', 'category', 'description',
            'total_copies', 'available_copies', 'date_added',
        ]
        read_only_fields = ['id', 'date_added']


class BookLoanSerializer(serializers.ModelSerializer):
    """Represents BookLoanSerializer."""
    book_title = serializers.CharField(source='book.title', read_only=True)
    book_author = serializers.CharField(source='book.author', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    issued_by_name = serializers.SerializerMethodField()

    class Meta:
        """Represents Meta."""
        model = BookLoan
        fields = [
            'id', 'book', 'book_title', 'book_author',
            'student', 'student_name', 'student_number',
            'issued_by', 'issued_by_name',
            'issued_date', 'due_date', 'returned_date',
            'status', 'fine_amount', 'notes',
        ]
        read_only_fields = ['id', 'issued_date', 'issued_by', 'issued_by_name']

    def get_issued_by_name(self, obj):
        """Return issued by name."""
        if obj.issued_by:
            return obj.issued_by.full_name
        return ''


class BookLoanRequestSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source='book.title', read_only=True)
    book_author = serializers.CharField(source='book.author', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True)
    loan_id = serializers.IntegerField(source='loan.id', read_only=True)

    class Meta:
        model = BookLoanRequest
        fields = [
            'id',
            'book', 'book_title', 'book_author',
            'student', 'student_name', 'student_number',
            'requested_by', 'requested_by_name',
            'requested_due_date', 'notes',
            'status', 'review_note', 'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'loan', 'loan_id',
            'requested_at',
        ]
        read_only_fields = [
            'id', 'student', 'requested_by', 'requested_by_name',
            'status', 'review_note', 'reviewed_by', 'reviewed_by_name',
            'reviewed_at', 'loan', 'loan_id', 'requested_at',
        ]
