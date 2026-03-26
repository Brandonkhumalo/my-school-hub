from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('academics', '0010_result_weight_subject_ca_weight_subject_deleted_at_and_more'),
        ('users', '0010_fix_empty_phone_numbers'),
    ]

    operations = [
        # PromotionRecord
        migrations.CreateModel(
            name='PromotionRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('academic_year', models.CharField(max_length=20)),
                ('action', models.CharField(choices=[('promote', 'Promoted'), ('repeat', 'Repeating'), ('graduate', 'Graduated')], default='promote', max_length=20)),
                ('date_processed', models.DateTimeField(auto_now_add=True)),
                ('notes', models.TextField(blank=True)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='promotions', to='academics.student')),
                ('from_class', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='promotions_from', to='academics.class')),
                ('to_class', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='promotions_to', to='academics.class')),
                ('decided_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='users.school')),
            ],
            options={
                'unique_together': {('student', 'academic_year')},
            },
        ),
        # Activity
        migrations.CreateModel(
            name='Activity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('activity_type', models.CharField(choices=[('sport', 'Sport'), ('club', 'Club'), ('society', 'Society'), ('arts', 'Arts')], max_length=20)),
                ('description', models.TextField(blank=True)),
                ('schedule_day', models.CharField(blank=True, max_length=20)),
                ('schedule_time', models.TimeField(blank=True, null=True)),
                ('location', models.CharField(blank=True, max_length=200)),
                ('max_participants', models.IntegerField(default=30)),
                ('is_active', models.BooleanField(default=True)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activities', to='users.school')),
                ('coach', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='coached_activities', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name_plural': 'Activities',
                'ordering': ['name'],
            },
        ),
        # ActivityEnrollment
        migrations.CreateModel(
            name='ActivityEnrollment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('member', 'Member'), ('captain', 'Captain'), ('vice_captain', 'Vice Captain')], default='member', max_length=20)),
                ('date_joined', models.DateField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activity_enrollments', to='academics.student')),
                ('activity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='enrollments', to='academics.activity')),
            ],
            options={
                'unique_together': {('student', 'activity')},
            },
        ),
        # ActivityEvent
        migrations.CreateModel(
            name='ActivityEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('event_type', models.CharField(choices=[('practice', 'Practice'), ('match', 'Match'), ('competition', 'Competition'), ('performance', 'Performance'), ('meeting', 'Meeting')], max_length=20)),
                ('event_date', models.DateTimeField()),
                ('location', models.CharField(blank=True, max_length=200)),
                ('opponent', models.CharField(blank=True, max_length=200)),
                ('result', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('activity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='academics.activity')),
            ],
            options={
                'ordering': ['-event_date'],
            },
        ),
        # Accolade
        migrations.CreateModel(
            name='Accolade',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('icon', models.CharField(default='fa-trophy', max_length=50)),
                ('category', models.CharField(choices=[('academic', 'Academic'), ('sports', 'Sports'), ('conduct', 'Conduct'), ('attendance', 'Attendance'), ('extracurricular', 'Extracurricular'), ('leadership', 'Leadership')], max_length=20)),
                ('points_value', models.IntegerField(default=10)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='accolades', to='users.school')),
            ],
        ),
        # StudentAccolade
        migrations.CreateModel(
            name='StudentAccolade',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date_awarded', models.DateTimeField(auto_now_add=True)),
                ('reason', models.TextField(blank=True)),
                ('academic_term', models.CharField(blank=True, max_length=50)),
                ('academic_year', models.CharField(blank=True, max_length=20)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='accolades', to='academics.student')),
                ('accolade', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='awards', to='academics.accolade')),
                ('awarded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-date_awarded'],
            },
        ),
        # ConferenceSlot
        migrations.CreateModel(
            name='ConferenceSlot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('start_time', models.TimeField()),
                ('end_time', models.TimeField()),
                ('is_booked', models.BooleanField(default=False)),
                ('teacher', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='conference_slots', to='academics.teacher')),
                ('school', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to='users.school')),
            ],
            options={
                'ordering': ['date', 'start_time'],
                'unique_together': {('teacher', 'date', 'start_time')},
            },
        ),
        # ConferenceBooking
        migrations.CreateModel(
            name='ConferenceBooking',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('purpose', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('confirmed', 'Confirmed'), ('cancelled', 'Cancelled'), ('completed', 'Completed')], default='confirmed', max_length=20)),
                ('date_booked', models.DateTimeField(auto_now_add=True)),
                ('notes', models.TextField(blank=True)),
                ('slot', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='booking', to='academics.conferenceslot')),
                ('parent', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='conference_bookings', to='academics.parent')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='conference_bookings', to='academics.student')),
            ],
            options={
                'ordering': ['-date_booked'],
            },
        ),
        # DisciplinaryRecord
        migrations.CreateModel(
            name='DisciplinaryRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('incident_type', models.CharField(max_length=100)),
                ('severity', models.CharField(choices=[('minor', 'Minor'), ('major', 'Major'), ('critical', 'Critical')], default='minor', max_length=20)),
                ('description', models.TextField()),
                ('action_taken', models.TextField(blank=True)),
                ('date_of_incident', models.DateField()),
                ('parent_notified', models.BooleanField(default=False)),
                ('follow_up_notes', models.TextField(blank=True)),
                ('is_resolved', models.BooleanField(default=False)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='disciplinary_records', to='academics.student')),
                ('reported_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to='users.school')),
            ],
            options={
                'ordering': ['-date_of_incident'],
            },
        ),
        # HealthRecord
        migrations.CreateModel(
            name='HealthRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('blood_type', models.CharField(blank=True, choices=[('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'), ('AB+', 'AB+'), ('AB-', 'AB-'), ('O+', 'O+'), ('O-', 'O-')], max_length=5)),
                ('allergies', models.TextField(blank=True, help_text='Comma-separated list of allergies')),
                ('chronic_conditions', models.TextField(blank=True)),
                ('medications', models.TextField(blank=True)),
                ('emergency_contact_name', models.CharField(blank=True, max_length=100)),
                ('emergency_contact_phone', models.CharField(blank=True, max_length=20)),
                ('emergency_contact_relationship', models.CharField(blank=True, max_length=50)),
                ('medical_aid_name', models.CharField(blank=True, max_length=100)),
                ('medical_aid_number', models.CharField(blank=True, max_length=50)),
                ('notes', models.TextField(blank=True)),
                ('last_updated', models.DateTimeField(auto_now=True)),
                ('student', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='health_record', to='academics.student')),
            ],
        ),
        # ClinicVisit
        migrations.CreateModel(
            name='ClinicVisit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('visit_date', models.DateTimeField(auto_now_add=True)),
                ('complaint', models.TextField()),
                ('diagnosis', models.TextField(blank=True)),
                ('treatment', models.TextField(blank=True)),
                ('nurse_notes', models.TextField(blank=True)),
                ('parent_notified', models.BooleanField(default=False)),
                ('follow_up_required', models.BooleanField(default=False)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='clinic_visits', to='academics.student')),
                ('recorded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to='users.school')),
            ],
            options={
                'ordering': ['-visit_date'],
            },
        ),
    ]
