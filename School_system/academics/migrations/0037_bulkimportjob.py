from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0032_customuser_login_lockout_fields'),
        ('academics', '0036_merge_20260421_0001'),
    ]

    operations = [
        migrations.CreateModel(
            name='BulkImportJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('import_type', models.CharField(db_index=True, max_length=50)),
                ('file_name', models.CharField(blank=True, max_length=255)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('validated', 'Validated'), ('completed', 'Completed'), ('failed', 'Failed'), ('rolled_back', 'Rolled Back')], db_index=True, default='pending', max_length=20)),
                ('selected_parameters', models.JSONField(blank=True, default=list)),
                ('mapping', models.JSONField(blank=True, default=dict)),
                ('options', models.JSONField(blank=True, default=dict)),
                ('total_rows', models.PositiveIntegerField(default=0)),
                ('created_count', models.PositiveIntegerField(default=0)),
                ('updated_count', models.PositiveIntegerField(default=0)),
                ('error_count', models.PositiveIntegerField(default=0)),
                ('errors', models.JSONField(blank=True, default=list)),
                ('changes', models.JSONField(blank=True, default=list, help_text='Replay log for rollback')),
                ('rolled_back_at', models.DateTimeField(blank=True, null=True)),
                ('rollback_notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('initiated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bulk_import_jobs', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bulk_import_jobs', to='users.school')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='bulkimportjob',
            index=models.Index(fields=['school', 'import_type'], name='academics_b_school_e96b85_idx'),
        ),
        migrations.AddIndex(
            model_name='bulkimportjob',
            index=models.Index(fields=['school', 'status'], name='academics_b_school_3dbbd9_idx'),
        ),
    ]
