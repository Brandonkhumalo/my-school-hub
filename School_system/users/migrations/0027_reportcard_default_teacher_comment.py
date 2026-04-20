from django.db import migrations, models


DEFAULT_TEACHER_COMMENT = "when the teacher adds report feedback thats what must be there"


def populate_blank_teacher_comments(apps, schema_editor):
    ReportCardConfig = apps.get_model("users", "ReportCardConfig")
    ReportCardConfig.objects.filter(teacher_comments_default__isnull=True).update(
        teacher_comments_default=DEFAULT_TEACHER_COMMENT
    )
    ReportCardConfig.objects.filter(teacher_comments_default="").update(
        teacher_comments_default=DEFAULT_TEACHER_COMMENT
    )


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0026_rename_users_acctpg_page_key_idx_users_accou_page_ke_db8c84_idx_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="reportcardconfig",
            name="teacher_comments_default",
            field=models.TextField(
                blank=True,
                default=DEFAULT_TEACHER_COMMENT,
                help_text="Default teacher comment on every report",
            ),
        ),
        migrations.RunPython(populate_blank_teacher_comments, migrations.RunPython.noop),
    ]

