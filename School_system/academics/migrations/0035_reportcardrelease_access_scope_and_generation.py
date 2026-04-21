from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0034_housepointentry_matchsquadentry_trainingattendance_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='reportcardrelease',
            name='access_scope',
            field=models.CharField(
                choices=[('all', 'All Students'), ('fully_paid', 'Fully Paid / Approved Plan Only')],
                default='all',
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name='ReportCardGeneration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('academic_year', models.CharField(max_length=20)),
                ('academic_term', models.CharField(max_length=50)),
                ('generated_at', models.DateTimeField(auto_now_add=True)),
                ('class_obj', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_generations', to='academics.class')),
                ('generated_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_generations', to='users.school')),
            ],
            options={
                'ordering': ['-generated_at'],
                'unique_together': {('school', 'class_obj', 'academic_year', 'academic_term')},
            },
        ),
    ]
