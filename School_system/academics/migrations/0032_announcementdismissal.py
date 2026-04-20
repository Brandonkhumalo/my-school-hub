from django.db import migrations, models
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0031_announcement_expires_at'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AnnouncementDismissal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('dismissed_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('announcement', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='dismissals', to='academics.announcement')),
                ('user', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='dismissed_announcements', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('user', 'announcement')},
            },
        ),
        migrations.AddIndex(
            model_name='announcementdismissal',
            index=models.Index(fields=['user', 'dismissed_at'], name='academics_a_user_id_2de620_idx'),
        ),
    ]

