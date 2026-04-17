from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0024_assessmentplan_assignments_weight_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='activityenrollment',
            name='requested_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='activity_enrollment_requests',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='activityenrollment',
            name='review_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='activityenrollment',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='activityenrollment',
            name='reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='activity_enrollment_reviews',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='activityenrollment',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('approved', 'Approved'), ('declined', 'Declined')],
                default='approved',
                max_length=20,
            ),
        ),
    ]
