from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0019_teacher_teaching_classes'),
    ]

    operations = [
        migrations.CreateModel(
            name='SubjectTermFeedback',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('academic_year', models.CharField(db_index=True, max_length=20)),
                ('academic_term', models.CharField(db_index=True, max_length=50)),
                ('comment', models.TextField(blank=True)),
                ('effort_grade', models.CharField(
                    blank=True, max_length=1,
                    choices=[('A', 'Excellent'), ('B', 'Good'), ('C', 'Satisfactory'),
                             ('D', 'Needs Improvement'), ('E', 'Poor')],
                )),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('student', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='subject_feedback', to='academics.student')),
                ('subject', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='term_feedback', to='academics.subject')),
                ('teacher', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, to='academics.teacher')),
            ],
            options={'unique_together': {('student', 'subject', 'academic_year', 'academic_term')}},
        ),
    ]
