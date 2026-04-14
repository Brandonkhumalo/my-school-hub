from django.db import models
from django.conf import settings


class Book(models.Model):
    """Represents Book."""
    CATEGORY_CHOICES = [
        ('textbook', 'Textbook'),
        ('fiction', 'Fiction'),
        ('non_fiction', 'Non-Fiction'),
        ('reference', 'Reference'),
        ('science', 'Science'),
        ('history', 'History'),
        ('mathematics', 'Mathematics'),
        ('literature', 'Literature'),
        ('other', 'Other'),
    ]
    title = models.CharField(max_length=300)
    author = models.CharField(max_length=200)
    isbn = models.CharField(max_length=20, blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    description = models.TextField(blank=True)
    total_copies = models.IntegerField(default=1)
    available_copies = models.IntegerField(default=1)
    school = models.ForeignKey('users.School', on_delete=models.CASCADE, related_name='books')
    date_added = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Represents Meta."""
        ordering = ['title']

    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.title} by {self.author}"


class BookLoan(models.Model):
    """Represents BookLoan."""
    STATUS_CHOICES = [
        ('issued', 'Issued'),
        ('returned', 'Returned'),
        ('overdue', 'Overdue'),
        ('lost', 'Lost'),
    ]
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='loans')
    student = models.ForeignKey('academics.Student', on_delete=models.CASCADE, related_name='book_loans')
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    issued_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()
    returned_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='issued')
    fine_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        """Represents Meta."""
        ordering = ['-issued_date']

    def __str__(self):
        """Return a human-readable string representation."""
        return f"{self.student.user.full_name} - {self.book.title} ({self.status})"
