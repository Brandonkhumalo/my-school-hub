from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0034_schoolsettings_late_assignment_penalty_mode_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="school",
            name="student_limit",
            field=models.PositiveIntegerField(default=500),
        ),
    ]
