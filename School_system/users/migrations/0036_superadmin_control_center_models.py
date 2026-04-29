from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0035_school_student_limit"),
    ]

    operations = [
        migrations.CreateModel(
            name="SuperadminImpersonationRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.TextField()),
                (
                    "status",
                    models.CharField(
                        choices=[("requested", "Requested"), ("approved", "Approved"), ("revoked", "Revoked")],
                        db_index=True,
                        default="requested",
                        max_length=20,
                    ),
                ),
                ("max_duration_minutes", models.PositiveIntegerField(default=30)),
                ("requested_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "requested_by",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="requested_impersonations", to="users.customuser"),
                ),
                (
                    "reviewed_by",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_impersonations", to="users.customuser"),
                ),
                (
                    "school",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="impersonation_requests", to="users.school"),
                ),
            ],
            options={"ordering": ["-requested_at"]},
        ),
        migrations.CreateModel(
            name="SchoolFeatureFlag",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "flag_key",
                    models.CharField(
                        choices=[
                            ("boarding", "Boarding"),
                            ("library", "Library"),
                            ("advanced_analytics", "Advanced Analytics"),
                            ("whatsapp_alerts", "WhatsApp Alerts"),
                            ("transport", "Transport"),
                        ],
                        max_length=50,
                    ),
                ),
                ("is_enabled", models.BooleanField(default=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "school",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="feature_flags", to="users.school"),
                ),
                (
                    "updated_by",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="users.customuser"),
                ),
            ],
            options={"ordering": ["school_id", "flag_key"], "unique_together": {("school", "flag_key")}},
        ),
        migrations.CreateModel(
            name="SuperadminSupportTicket",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("owner", models.CharField(blank=True, default="", max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[("open", "Open"), ("in_progress", "In Progress"), ("resolved", "Resolved")],
                        db_index=True,
                        default="open",
                        max_length=20,
                    ),
                ),
                (
                    "priority",
                    models.CharField(choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")], default="medium", max_length=20),
                ),
                ("sla_hours", models.PositiveIntegerField(default=24)),
                ("notes", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_support_tickets", to="users.customuser"),
                ),
                (
                    "school",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="support_tickets", to="users.school"),
                ),
                (
                    "updated_by",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="updated_support_tickets", to="users.customuser"),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
