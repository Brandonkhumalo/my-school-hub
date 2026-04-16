from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0018_expand_customuser_roles'),
    ]

    operations = [
        migrations.AddField(
            model_name='school',
            name='accommodation_type',
            field=models.CharField(
                choices=[
                    ('day', 'Day School'),
                    ('boarding', 'Boarding School'),
                    ('both', 'Day & Boarding School'),
                ],
                db_index=True,
                default='day',
                max_length=20,
            ),
        ),
    ]
