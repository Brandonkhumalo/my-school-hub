from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0016_bootstrap_admin_users_and_remove_admin_password'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customuser',
            name='whatsapp_pin',
            field=models.CharField(blank=True, max_length=128, null=True),
        ),
    ]
