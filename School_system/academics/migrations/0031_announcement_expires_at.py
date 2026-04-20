from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0030_add_house_to_student'),
    ]

    operations = [
        migrations.AddField(
            model_name='announcement',
            name='expires_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]

