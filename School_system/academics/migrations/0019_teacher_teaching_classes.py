from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0018_boarding_module'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacher',
            name='teaching_classes',
            field=models.ManyToManyField(
                blank=True,
                help_text='Forms/grades this teacher is approved to teach across (in addition to class teacher role).',
                related_name='assigned_subject_teachers',
                to='academics.class',
            ),
        ),
    ]
