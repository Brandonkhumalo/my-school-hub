from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0024_customuser_gender'),
    ]

    operations = [
        migrations.CreateModel(
            name='AccountantPermissionProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_root_head', models.BooleanField(default=False, help_text='Accountant Head has full access to all accounting pages.')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='accountant_permission_profiles', to='users.school')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='accountant_permission_profile', to='users.customuser')),
            ],
        ),
        migrations.CreateModel(
            name='AccountantPagePermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('page_key', models.CharField(choices=[('dashboard', 'Dashboard'), ('fees', 'Fees'), ('invoices', 'Invoices'), ('payments', 'Payments'), ('reports', 'Reports'), ('payroll', 'Payroll'), ('expenses', 'Expenses')], max_length=50)),
                ('can_read', models.BooleanField(default=False)),
                ('can_write', models.BooleanField(default=False)),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='page_permissions', to='users.accountantpermissionprofile')),
            ],
        ),
        migrations.AddIndex(
            model_name='accountantpermissionprofile',
            index=models.Index(fields=['school', 'is_root_head'], name='users_acctp_school_is_hd_idx'),
        ),
        migrations.AddIndex(
            model_name='accountantpagepermission',
            index=models.Index(fields=['page_key'], name='users_acctpg_page_key_idx'),
        ),
        migrations.AddIndex(
            model_name='accountantpagepermission',
            index=models.Index(fields=['profile', 'page_key'], name='users_acctpg_profile_pk_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='accountantpagepermission',
            unique_together={('profile', 'page_key')},
        ),
    ]
