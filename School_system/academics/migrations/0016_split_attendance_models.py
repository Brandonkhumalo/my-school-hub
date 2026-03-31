# Custom migration: split Attendance into ClassAttendance + SubjectAttendance
# Preserves existing attendance data by migrating into ClassAttendance.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def migrate_attendance_data(apps, schema_editor):
    """Copy old Attendance rows into ClassAttendance, filling class_assigned from Student."""
    OldAttendance = apps.get_model('academics', 'Attendance')
    ClassAttendance = apps.get_model('academics', 'ClassAttendance')

    rows = OldAttendance.objects.select_related('student').all()
    batch = []
    for r in rows:
        class_id = r.student.student_class_id
        if not class_id:
            continue  # skip records where student has no class
        batch.append(ClassAttendance(
            student_id=r.student_id,
            class_assigned_id=class_id,
            date=r.date,
            status=r.status,
            remarks=r.remarks,
            recorded_by_id=r.recorded_by_id,
            date_recorded=r.date_recorded,
        ))
    if batch:
        ClassAttendance.objects.bulk_create(batch, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0015_announcement_target_class_and_report_release'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Create new tables first
        migrations.CreateModel(
            name='ClassAttendance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True)),
                ('status', models.CharField(choices=[('present', 'Present'), ('absent', 'Absent'), ('late', 'Late'), ('excused', 'Excused')], db_index=True, max_length=20)),
                ('remarks', models.TextField(blank=True)),
                ('date_recorded', models.DateTimeField(auto_now_add=True)),
                ('class_assigned', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='class_attendance_records', to='academics.class')),
                ('recorded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('student', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='class_attendance_records', to='academics.student')),
            ],
            options={
                'unique_together': {('student', 'date')},
            },
        ),
        migrations.CreateModel(
            name='SubjectAttendance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True)),
                ('status', models.CharField(choices=[('present', 'Present'), ('absent', 'Absent'), ('late', 'Late'), ('excused', 'Excused')], db_index=True, max_length=20)),
                ('remarks', models.TextField(blank=True)),
                ('date_recorded', models.DateTimeField(auto_now_add=True)),
                ('class_assigned', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subject_attendance_records', to='academics.class')),
                ('recorded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('student', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='subject_attendance_records', to='academics.student')),
                ('subject', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subject_attendance_records', to='academics.subject')),
            ],
            options={
                'unique_together': {('student', 'date', 'subject')},
            },
        ),
        # 2. Copy data from old Attendance -> ClassAttendance
        migrations.RunPython(migrate_attendance_data, migrations.RunPython.noop),
        # 3. Drop old table
        migrations.DeleteModel(
            name='Attendance',
        ),
    ]
