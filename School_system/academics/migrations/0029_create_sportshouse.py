# Generated manually to create SportsHouse model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0028_add_reportcard_teacher_comment'),
        ('users', '0029_alter_customuser_role'),
    ]

    operations = [
        migrations.CreateModel(
            name='SportsHouse',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('color', models.CharField(default='#2563eb', max_length=7)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='users.school')),
                ('captain', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='house_captaincy', to='academics.student')),
            ],
        ),
    ]