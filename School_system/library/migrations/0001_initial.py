from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('users', '0001_initial'),
        ('academics', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Book',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=300)),
                ('author', models.CharField(max_length=200)),
                ('isbn', models.CharField(blank=True, max_length=20)),
                ('category', models.CharField(choices=[('textbook', 'Textbook'), ('fiction', 'Fiction'), ('non_fiction', 'Non-Fiction'), ('reference', 'Reference'), ('science', 'Science'), ('history', 'History'), ('mathematics', 'Mathematics'), ('literature', 'Literature'), ('other', 'Other')], default='other', max_length=20)),
                ('description', models.TextField(blank=True)),
                ('total_copies', models.IntegerField(default=1)),
                ('available_copies', models.IntegerField(default=1)),
                ('date_added', models.DateTimeField(auto_now_add=True)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='books', to='users.school')),
            ],
            options={
                'ordering': ['title'],
            },
        ),
        migrations.CreateModel(
            name='BookLoan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('issued_date', models.DateField(auto_now_add=True)),
                ('due_date', models.DateField()),
                ('returned_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('issued', 'Issued'), ('returned', 'Returned'), ('overdue', 'Overdue'), ('lost', 'Lost')], default='issued', max_length=20)),
                ('fine_amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('notes', models.TextField(blank=True)),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='loans', to='library.book')),
                ('issued_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='book_loans', to='academics.student')),
            ],
            options={
                'ordering': ['-issued_date'],
            },
        ),
    ]
