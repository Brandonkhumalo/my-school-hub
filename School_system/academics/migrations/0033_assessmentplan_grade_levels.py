from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0032_announcementdismissal'),
    ]

    operations = [
        migrations.AddField(
            model_name='assessmentplan',
            name='grade_levels',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Optional list of grade/form levels this plan applies to, e.g. [1,2]. Empty = all grades.',
            ),
        ),
    ]
