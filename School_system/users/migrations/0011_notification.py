from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_fix_empty_phone_numbers'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('notification_type', models.CharField(choices=[('announcement', 'Announcement'), ('message', 'Message'), ('fee_reminder', 'Fee Reminder'), ('homework', 'Homework'), ('attendance', 'Attendance'), ('result', 'Result'), ('general', 'General')], default='general', max_length=20)),
                ('is_read', models.BooleanField(default=False)),
                ('link', models.CharField(blank=True, max_length=500)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='users.customuser')),
            ],
            options={
                'ordering': ['-date_created'],
            },
        ),
    ]
