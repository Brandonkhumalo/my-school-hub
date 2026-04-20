# Generated manually to add missing house field to Student model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0029_create_sportshouse'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='house',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='students', to='academics.SportsHouse'),
        ),
    ]