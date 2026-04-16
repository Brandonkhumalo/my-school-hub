import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0019_school_accommodation_type'),
        ('academics', '0017_complaint_school_type_nullable_student'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='residence_type',
            field=models.CharField(
                choices=[('day', 'Day Scholar'), ('boarding', 'Boarding Scholar')],
                db_index=True,
                default='day',
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name='Dormitory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('gender', models.CharField(choices=[('mixed', 'Mixed'), ('male', 'Male'), ('female', 'Female')], default='mixed', max_length=20)),
                ('capacity', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dormitories', to='users.school')),
            ],
            options={
                'ordering': ['name'],
                'unique_together': {('school', 'name')},
            },
        ),
        migrations.CreateModel(
            name='DietaryFlag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('allergies', models.TextField(blank=True)),
                ('special_diet', models.CharField(blank=True, max_length=255)),
                ('notes', models.TextField(blank=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('student', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='dietary_flag', to='academics.student')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='MealMenu',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True)),
                ('meal_type', models.CharField(choices=[('breakfast', 'Breakfast'), ('lunch', 'Lunch'), ('supper', 'Supper')], db_index=True, max_length=20)),
                ('menu_text', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('posted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='meal_menus', to='users.school')),
            ],
            options={
                'ordering': ['-date', 'meal_type'],
                'unique_together': {('school', 'date', 'meal_type')},
            },
        ),
        migrations.CreateModel(
            name='MedicationSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('medication_name', models.CharField(max_length=255)),
                ('dosage', models.CharField(max_length=100)),
                ('administration_time', models.TimeField()),
                ('start_date', models.DateField()),
                ('end_date', models.DateField(blank=True, null=True)),
                ('instructions', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='medication_schedules', to='users.school')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='medication_schedules', to='academics.student')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TuckWallet',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('balance', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('student', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='tuck_wallet', to='academics.student')),
            ],
        ),
        migrations.CreateModel(
            name='TuckTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('transaction_type', models.CharField(choices=[('topup', 'Top Up'), ('purchase', 'Purchase')], max_length=20)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('wallet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transactions', to='academics.tuckwallet')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='LaundrySchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('day_of_week', models.CharField(max_length=20)),
                ('time_slot', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('dormitory', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='laundry_schedules', to='academics.dormitory')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='laundry_schedules', to='users.school')),
            ],
            options={
                'ordering': ['day_of_week', 'time_slot'],
            },
        ),
        migrations.CreateModel(
            name='DormAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('room_name', models.CharField(max_length=50)),
                ('bed_name', models.CharField(max_length=50)),
                ('start_date', models.DateField(default=django.utils.timezone.now)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('assigned_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('dormitory', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assignments', to='academics.dormitory')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dorm_assignments', to='academics.student')),
            ],
            options={
                'ordering': ['-assigned_at'],
            },
        ),
        migrations.CreateModel(
            name='MealAttendance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('ate', 'Ate'), ('absent', 'Absent'), ('excused', 'Excused')], default='ate', max_length=20)),
                ('marked_at', models.DateTimeField(auto_now=True)),
                ('marked_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('meal_menu', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attendance_records', to='academics.mealmenu')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='meal_attendance', to='academics.student')),
            ],
            options={
                'ordering': ['-marked_at'],
                'unique_together': {('meal_menu', 'student')},
            },
        ),
        migrations.CreateModel(
            name='DormRollCall',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('call_date', models.DateField(db_index=True)),
                ('call_type', models.CharField(choices=[('morning', 'Morning'), ('evening', 'Evening')], db_index=True, max_length=20)),
                ('status', models.CharField(choices=[('present', 'Present'), ('absent', 'Absent'), ('excused', 'Excused')], default='present', max_length=20)),
                ('remarks', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dorm_roll_calls', to='users.school')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dorm_roll_calls', to='academics.student')),
            ],
            options={
                'ordering': ['-call_date', '-created_at'],
                'unique_together': {('student', 'call_date', 'call_type')},
            },
        ),
        migrations.CreateModel(
            name='LightsOutRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True)),
                ('in_bed_time', models.TimeField()),
                ('remarks', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lights_out_records', to='users.school')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lights_out_records', to='academics.student')),
            ],
            options={
                'ordering': ['-date'],
                'unique_together': {('student', 'date')},
            },
        ),
        migrations.CreateModel(
            name='ExeatRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date_from', models.DateField()),
                ('date_to', models.DateField()),
                ('reason', models.TextField()),
                ('collecting_person', models.CharField(blank=True, max_length=255)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('denied', 'Denied')], db_index=True, default='pending', max_length=20)),
                ('decision_notes', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('requested_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_exeat_requests', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exeat_requests', to='users.school')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exeat_requests', to='academics.student')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ExeatMovementLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('sign_out', 'Sign Out'), ('sign_in', 'Sign In')], max_length=20)),
                ('action_time', models.DateTimeField(default=django.utils.timezone.now)),
                ('notes', models.TextField(blank=True)),
                ('exeat_request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='movement_logs', to='academics.exeatrequest')),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exeat_movement_logs', to='academics.student')),
            ],
            options={
                'ordering': ['-action_time'],
            },
        ),
        migrations.CreateModel(
            name='LostItemReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('item_description', models.TextField()),
                ('status', models.CharField(choices=[('reported', 'Reported'), ('found', 'Found'), ('resolved', 'Resolved')], default='reported', max_length=20)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('reported_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('resolved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='resolved_lost_items', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lost_item_reports', to='users.school')),
                ('student', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='lost_item_reports', to='academics.student')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='PrepAttendance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True)),
                ('status', models.CharField(choices=[('present', 'Present'), ('absent', 'Absent'), ('excused', 'Excused')], default='present', max_length=20)),
                ('remarks', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='prep_attendance', to='users.school')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='prep_attendance', to='academics.student')),
            ],
            options={
                'ordering': ['-date'],
                'unique_together': {('student', 'date')},
            },
        ),
        migrations.CreateModel(
            name='DormInspectionScore',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('inspection_date', models.DateField(db_index=True)),
                ('score', models.IntegerField()),
                ('max_score', models.IntegerField(default=10)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('dormitory', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inspections', to='academics.dormitory')),
                ('inspected_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dorm_inspections', to='users.school')),
            ],
            options={
                'ordering': ['-inspection_date'],
            },
        ),
        migrations.CreateModel(
            name='StudentWellnessCheckIn',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('check_date', models.DateField(db_index=True)),
                ('mood_score', models.IntegerField(help_text='1-5 wellbeing score')),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='wellness_checkins', to='users.school')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='wellness_checkins', to='academics.student')),
            ],
            options={
                'ordering': ['-check_date'],
            },
        ),
    ]
