from django.db import migrations, models


def backfill_target_audiences(apps, schema_editor):
    Announcement = apps.get_model('academics', 'Announcement')
    for announcement in Announcement.objects.all().iterator():
        audiences = announcement.target_audiences or []
        if not audiences:
            legacy = (announcement.target_audience or '').strip()
            announcement.target_audiences = [legacy or 'all']
            announcement.save(update_fields=['target_audiences'])


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0020_subject_term_feedback'),
    ]

    operations = [
        migrations.AddField(
            model_name='announcement',
            name='target_audiences',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(backfill_target_audiences, migrations.RunPython.noop),
    ]
