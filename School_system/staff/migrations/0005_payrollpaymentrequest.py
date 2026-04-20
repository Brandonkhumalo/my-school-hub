from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0004_add_ordering_staff_payroll'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PayrollPaymentRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('month', models.CharField(max_length=20)),
                ('year', models.IntegerField()),
                ('target_type', models.CharField(choices=[('all', 'All Staff'), ('selected', 'Selected Staff')], default='all', max_length=20)),
                ('staff_ids', models.JSONField(blank=True, default=list)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], db_index=True, default='pending', max_length=20)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('admin_note', models.TextField(blank=True)),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_payroll_payments', to=settings.AUTH_USER_MODEL)),
                ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='requested_payroll_payments', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payroll_payment_requests', to='users.school')),
            ],
            options={
                'ordering': ['-requested_at'],
            },
        ),
        migrations.AddIndex(
            model_name='payrollpaymentrequest',
            index=models.Index(fields=['school', 'status'], name='staff_payro_school__f6f611_idx'),
        ),
        migrations.AddIndex(
            model_name='payrollpaymentrequest',
            index=models.Index(fields=['school', 'month', 'year'], name='staff_payro_school__d9fbfd_idx'),
        ),
    ]
