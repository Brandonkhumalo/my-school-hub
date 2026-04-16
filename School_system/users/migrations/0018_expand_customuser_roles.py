from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0017_alter_customuser_whatsapp_pin'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customuser',
            name='role',
            field=models.CharField(
                choices=[
                    ('student', 'Student'),
                    ('parent', 'Parent'),
                    ('teacher', 'Teacher'),
                    ('admin', 'Admin'),
                    ('hr', 'HR'),
                    ('accountant', 'Accountant'),
                    ('security', 'Security'),
                    ('cleaner', 'Cleaner'),
                    ('librarian', 'Librarian'),
                    ('superadmin', 'Super Admin'),
                ],
                db_index=True,
                max_length=20,
            ),
        ),
    ]
