from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0031_schoolsettings_hidden_pages_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='account_locked_until',
            field=models.DateTimeField(blank=True, help_text='Account lockout expiry time', null=True),
        ),
        migrations.AddField(
            model_name='customuser',
            name='failed_login_attempts',
            field=models.PositiveIntegerField(default=0, help_text='Consecutive failed login attempts'),
        ),
        migrations.AddField(
            model_name='customuser',
            name='last_failed_login_at',
            field=models.DateTimeField(blank=True, help_text='Timestamp of latest failed login attempt', null=True),
        ),
    ]
