from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0036_superadmin_control_center_models"),
    ]

    operations = [
        migrations.CreateModel(
            name="SuperadminPlatformNotice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("message", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "created_by",
                    models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="platform_notices", to="users.customuser"),
                ),
                ("schools", models.ManyToManyField(blank=True, related_name="platform_notices", to="users.school")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
