import django.db.models.deletion
from django.db import migrations, models


def backfill_complaint_school(apps, schema_editor):
    Complaint = apps.get_model('academics', 'Complaint')
    for complaint in Complaint.objects.select_related('student__user').all():
        if not complaint.school_id and complaint.student_id:
            student_user = getattr(complaint.student, 'user', None)
            school_id = getattr(student_user, 'school_id', None)
            if school_id:
                complaint.school_id = school_id
        if not getattr(complaint, 'complaint_type', None):
            complaint.complaint_type = 'general'
        complaint.save(update_fields=['school', 'complaint_type'])


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0018_expand_customuser_roles'),
        ('academics', '0016_split_attendance_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='complaint',
            name='complaint_type',
            field=models.CharField(choices=[('parent', 'Parent'), ('teacher', 'Teacher'), ('general', 'General')], default='general', max_length=20),
        ),
        migrations.AddField(
            model_name='complaint',
            name='school',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='complaints', to='users.school'),
        ),
        migrations.AlterField(
            model_name='complaint',
            name='student',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='complaints', to='academics.student'),
        ),
        migrations.RunPython(backfill_complaint_school, migrations.RunPython.noop),
    ]
