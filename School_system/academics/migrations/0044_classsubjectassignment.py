from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0043_student_pending_activation_due_to_limit'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ClassSubjectAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('academic_year', models.CharField(max_length=20)),
                ('is_core', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('class_obj', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subject_assignments', to='academics.class')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='class_subject_assignments', to='users.school')),
                ('subject', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='class_assignments', to='academics.subject')),
                ('teacher', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='class_subject_assignments', to='academics.teacher')),
            ],
            options={
                'ordering': ['class_obj__name', 'subject__name'],
                'unique_together': {('school', 'class_obj', 'subject', 'academic_year')},
            },
        ),
    ]

