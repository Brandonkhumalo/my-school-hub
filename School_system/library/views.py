import logging
from datetime import date

from django.db.models import Q, Sum
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Book, BookLoan
from .serializers import BookSerializer, BookLoanSerializer

logger = logging.getLogger(__name__)


# ── Books ─────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def book_list(request):
    """
    GET  — list / search books (all authenticated users)
    POST — add a new book (admin/librarian)
    """
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        qs = Book.objects.filter(school=school)

        # Search
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(author__icontains=search) |
                Q(isbn__icontains=search)
            )

        # Filter by category
        category = request.query_params.get('category', '').strip()
        if category:
            qs = qs.filter(category=category)

        serializer = BookSerializer(qs, many=True)
        return Response(serializer.data)

    # POST — admin/librarian only
    if request.user.role not in ('admin', 'librarian', 'superadmin'):
        return Response({'error': 'Only admin/librarian can add books'}, status=status.HTTP_403_FORBIDDEN)

    serializer = BookSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(school=school)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def book_detail(request, book_id):
    """Retrieve, update, or delete a single book (admin/librarian for write)."""
    school = request.user.school
    try:
        book = Book.objects.get(id=book_id, school=school)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(BookSerializer(book).data)

    if request.user.role not in ('admin', 'librarian', 'superadmin'):
        return Response({'error': 'Only admin/librarian can modify books'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        serializer = BookSerializer(book, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        book.delete()
        return Response({'message': 'Book deleted'}, status=status.HTTP_204_NO_CONTENT)


# ── Issue / Return ────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def issue_book(request, book_id):
    """Issue a book to a student. Admin/librarian only."""
    if request.user.role not in ('admin', 'librarian', 'superadmin'):
        return Response({'error': 'Only admin/librarian can issue books'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    try:
        book = Book.objects.get(id=book_id, school=school)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)

    if book.available_copies <= 0:
        return Response({'error': 'No available copies'}, status=status.HTTP_400_BAD_REQUEST)

    student_id = request.data.get('student_id')
    due_date = request.data.get('due_date')
    notes = request.data.get('notes', '')

    if not student_id or not due_date:
        return Response({'error': 'student_id and due_date are required'}, status=status.HTTP_400_BAD_REQUEST)

    from academics.models import Student
    try:
        student = Student.objects.select_related('user').get(id=student_id)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    loan = BookLoan.objects.create(
        book=book,
        student=student,
        issued_by=request.user,
        due_date=due_date,
        notes=notes,
    )
    book.available_copies -= 1
    book.save()

    return Response(BookLoanSerializer(loan).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def return_book(request, loan_id):
    """Return a book. Admin/librarian only."""
    if request.user.role not in ('admin', 'librarian', 'superadmin'):
        return Response({'error': 'Only admin/librarian can process returns'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    try:
        loan = BookLoan.objects.select_related('book').get(id=loan_id, book__school=school)
    except BookLoan.DoesNotExist:
        return Response({'error': 'Loan not found'}, status=status.HTTP_404_NOT_FOUND)

    if loan.status == 'returned':
        return Response({'error': 'Book already returned'}, status=status.HTTP_400_BAD_REQUEST)

    loan.status = 'returned'
    loan.returned_date = date.today()
    fine = request.data.get('fine_amount', 0)
    if fine:
        loan.fine_amount = fine
    loan.save()

    loan.book.available_copies += 1
    loan.book.save()

    return Response(BookLoanSerializer(loan).data)


# ── Loans ─────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def loan_list(request):
    """
    Admin/librarian sees all school loans. Students see their own.
    Filter by ?status=issued / returned / overdue / lost
    """
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)

    qs = BookLoan.objects.filter(book__school=school).select_related(
        'book', 'student__user', 'issued_by'
    )

    if request.user.role == 'student':
        from academics.models import Student
        try:
            student = request.user.student
            qs = qs.filter(student=student)
        except Student.DoesNotExist:
            return Response([])

    loan_status = request.query_params.get('status', '').strip()
    if loan_status:
        qs = qs.filter(status=loan_status)

    serializer = BookLoanSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def overdue_loans(request):
    """List overdue loans (admin/librarian)."""
    if request.user.role not in ('admin', 'librarian', 'superadmin'):
        return Response({'error': 'Admin/librarian only'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    today = date.today()

    qs = BookLoan.objects.filter(
        book__school=school,
        status='issued',
        due_date__lt=today,
    ).select_related('book', 'student__user', 'issued_by')

    # Auto-mark overdue
    qs.update(status='overdue')

    # Re-fetch after update
    qs = BookLoan.objects.filter(
        book__school=school,
        status='overdue',
    ).select_related('book', 'student__user', 'issued_by')

    serializer = BookLoanSerializer(qs, many=True)
    return Response(serializer.data)


# ── Stats ─────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def library_stats(request):
    """Library dashboard statistics."""
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated'}, status=status.HTTP_400_BAD_REQUEST)

    today = date.today()
    books = Book.objects.filter(school=school)
    total_books = books.aggregate(total=Sum('total_copies'))['total'] or 0
    available = books.aggregate(total=Sum('available_copies'))['total'] or 0
    total_titles = books.count()

    issued = BookLoan.objects.filter(book__school=school, status='issued').count()
    overdue = BookLoan.objects.filter(book__school=school, status='issued', due_date__lt=today).count()
    lost = BookLoan.objects.filter(book__school=school, status='lost').count()

    # Category breakdown
    categories = list(
        books.values('category').annotate(count=Sum('total_copies')).order_by('-count')
    )

    return Response({
        'total_books': total_books,
        'total_titles': total_titles,
        'available': available,
        'issued': issued,
        'overdue': overdue,
        'lost': lost,
        'categories': categories,
    })
