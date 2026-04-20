from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0027_rename_academics_r_school__f2bfdb_idx_academics_r_school__84b184_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='reportcardapprovalrequest',
            name='teacher_comment',
            field=models.TextField(blank=True, help_text='Class teacher remark for the report card'),
        ),
    ]
