from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0042_generated_tests"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="pending_activation_due_to_limit",
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
