from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finances', '0010_paymentintent'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SchoolExpense',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('expense_frequency', models.CharField(choices=[('monthly', 'Monthly'), ('term', 'Per Term')], max_length=20)),
                ('start_date', models.DateField()),
                ('status', models.CharField(choices=[('pending', 'Pending Approval'), ('approved', 'Approved'), ('rejected', 'Rejected')], db_index=True, default='pending', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_school_expenses', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_school_expenses', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='school_expenses', to='users.school')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='schoolexpense',
            index=models.Index(fields=['school', 'status'], name='finances_sc_school__3ef12d_idx'),
        ),
        migrations.AddIndex(
            model_name='schoolexpense',
            index=models.Index(fields=['school', 'expense_frequency'], name='finances_sc_school__d82a0f_idx'),
        ),
        migrations.AddIndex(
            model_name='schoolexpense',
            index=models.Index(fields=['school', 'start_date'], name='finances_sc_school__1a9628_idx'),
        ),
    ]
