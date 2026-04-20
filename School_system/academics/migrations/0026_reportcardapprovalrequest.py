from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0025_activityenrollment_review_workflow'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ReportCardApprovalRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('academic_year', models.CharField(max_length=20)),
                ('academic_term', models.CharField(max_length=50)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], db_index=True, default='pending', max_length=20)),
                ('submitted_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('admin_note', models.TextField(blank=True)),
                ('class_obj', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_approval_requests', to='academics.class')),
                ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='report_approval_requests', to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_report_approval_requests', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_approval_requests', to='users.school')),
            ],
            options={
                'ordering': ['-submitted_at'],
                'unique_together': {('school', 'class_obj', 'academic_year', 'academic_term')},
            },
        ),
        migrations.AddIndex(
            model_name='reportcardapprovalrequest',
            index=models.Index(fields=['school', 'status'], name='academics_r_school__f2bfdb_idx'),
        ),
        migrations.AddIndex(
            model_name='reportcardapprovalrequest',
            index=models.Index(fields=['school', 'academic_year', 'academic_term'], name='academics_r_school__2bec84_idx'),
        ),
    ]

