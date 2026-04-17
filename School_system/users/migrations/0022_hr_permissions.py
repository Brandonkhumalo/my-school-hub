from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0021_fix_at_risk_alert_status_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='HRPermissionProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_root_boss', models.BooleanField(default=False, help_text='Root HR Boss has full admin-equivalent access.')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='hr_permission_profiles', to='users.school')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='hr_permission_profile', to='users.customuser')),
            ],
        ),
        migrations.CreateModel(
            name='HRPagePermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('page_key', models.CharField(choices=[('dashboard', 'Dashboard'), ('students', 'Students'), ('teachers', 'Teachers'), ('parents', 'Parents'), ('parent_requests', 'Parent Requests'), ('users', 'User Management'), ('staff', 'Staff'), ('classes', 'Classes'), ('subjects', 'Subjects'), ('results', 'Results'), ('at_risk_students', 'At-Risk Students'), ('timetable', 'Timetable'), ('fees', 'Fees'), ('invoices', 'Invoices'), ('payments', 'Payments'), ('reports', 'Reports'), ('leaves', 'Leave Requests'), ('payroll', 'Payroll'), ('attendance', 'Attendance'), ('meetings', 'Meetings'), ('visitor_logs', 'Visitor Logs'), ('incidents', 'Incidents'), ('cleaning', 'Cleaning'), ('discipline', 'Discipline'), ('promotions', 'Promotions'), ('suspensions', 'Suspensions'), ('activities', 'Activities'), ('library', 'Library'), ('health', 'Health Records'), ('complaints', 'Complaints'), ('announcements', 'Announcements'), ('boarding', 'Boarding'), ('extras', 'Extras'), ('report_config', 'Report Config'), ('settings', 'Settings'), ('analytics', 'Analytics'), ('audit_logs', 'Audit Logs')], max_length=50)),
                ('can_read', models.BooleanField(default=False)),
                ('can_write', models.BooleanField(default=False)),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='page_permissions', to='users.hrpermissionprofile')),
            ],
        ),
        migrations.AddIndex(
            model_name='hrpermissionprofile',
            index=models.Index(fields=['school', 'is_root_boss'], name='users_hrper_school_5cad95_idx'),
        ),
        migrations.AddIndex(
            model_name='hrpagepermission',
            index=models.Index(fields=['page_key'], name='users_hrpag_page_ke_11a534_idx'),
        ),
        migrations.AddIndex(
            model_name='hrpagepermission',
            index=models.Index(fields=['profile', 'page_key'], name='users_hrpag_profile_330a26_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='hrpagepermission',
            unique_together={('profile', 'page_key')},
        ),
    ]
