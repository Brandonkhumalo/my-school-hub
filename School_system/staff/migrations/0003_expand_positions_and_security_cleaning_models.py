import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0018_expand_customuser_roles'),
        ('staff', '0002_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='staff',
            name='position',
            field=models.CharField(
                choices=[
                    ('teacher', 'Teacher'),
                    ('admin', 'Administrator'),
                    ('hr', 'HR Personnel'),
                    ('accountant', 'Accountant'),
                    ('principal', 'Principal'),
                    ('secretary', 'Secretary'),
                    ('maintenance', 'Maintenance'),
                    ('security', 'Security'),
                    ('cleaner', 'Cleaner'),
                    ('librarian', 'Librarian'),
                ],
                max_length=50,
            ),
        ),
        migrations.CreateModel(
            name='IncidentReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('incident_type', models.CharField(choices=[('theft', 'Theft'), ('trespass', 'Trespass'), ('fight', 'Fight'), ('damage', 'Damage'), ('other', 'Other')], default='other', max_length=20)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField()),
                ('location', models.CharField(blank=True, max_length=255)),
                ('date_of_incident', models.DateTimeField()),
                ('action_taken', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('open', 'Open'), ('investigating', 'Investigating'), ('closed', 'Closed')], default='open', max_length=20)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('reported_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='incident_reports', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='incident_reports', to='users.school')),
            ],
            options={
                'ordering': ['-date_created'],
            },
        ),
        migrations.CreateModel(
            name='VisitorLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('visitor_name', models.CharField(max_length=255)),
                ('visitor_id_number', models.CharField(blank=True, max_length=100)),
                ('purpose', models.CharField(max_length=255)),
                ('host_name', models.CharField(blank=True, max_length=255)),
                ('check_in_time', models.DateTimeField(auto_now_add=True)),
                ('check_out_time', models.DateTimeField(blank=True, null=True)),
                ('vehicle_reg', models.CharField(blank=True, max_length=50)),
                ('notes', models.TextField(blank=True)),
                ('date', models.DateField(auto_now_add=True)),
                ('logged_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='logged_visitors', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='visitor_logs', to='users.school')),
            ],
            options={
                'ordering': ['-check_in_time'],
            },
        ),
        migrations.CreateModel(
            name='CleaningSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('area_name', models.CharField(max_length=255)),
                ('frequency', models.CharField(choices=[('daily', 'Daily'), ('weekly', 'Weekly'), ('monthly', 'Monthly')], default='daily', max_length=20)),
                ('scheduled_time', models.TimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cleaning_schedules', to='staff.staff')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_cleaning_schedules', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cleaning_schedules', to='users.school')),
            ],
            options={
                'ordering': ['-date_created'],
            },
        ),
        migrations.CreateModel(
            name='CleaningTask',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('is_done', models.BooleanField(default=False)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cleaning_tasks', to='staff.staff')),
                ('schedule', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tasks', to='staff.cleaningschedule')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cleaning_tasks', to='users.school')),
            ],
            options={
                'ordering': ['-date', 'schedule__area_name'],
                'unique_together': {('schedule', 'date')},
            },
        ),
    ]
