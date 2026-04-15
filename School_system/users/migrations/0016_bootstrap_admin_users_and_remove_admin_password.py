from django.db import migrations


def bootstrap_admin_users(apps, schema_editor):
    School = apps.get_model('users', 'School')
    CustomUser = apps.get_model('users', 'CustomUser')

    for school in School.objects.exclude(admin_password__isnull=True).exclude(admin_password=''):
        has_admin = CustomUser.objects.filter(school=school, role='admin').exists()
        if has_admin:
            continue

        base_username = f"admin_{(school.code or 'school').lower()}_bootstrap"
        username = base_username
        suffix = 1
        while CustomUser.objects.filter(username=username).exists():
            suffix += 1
            username = f"{base_username}_{suffix}"

        email = f"{username}@bootstrap.local"

        user = CustomUser(
            username=username,
            email=email,
            first_name=school.name[:150] if school.name else 'School',
            last_name='Admin',
            role='admin',
            school=school,
            is_staff=False,
            is_superuser=False,
            is_active=True,
        )
        user.set_password(school.admin_password)
        user.save()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0015_add_logo_position'),
    ]

    operations = [
        migrations.RunPython(bootstrap_admin_users, noop_reverse),
        migrations.RemoveField(
            model_name='school',
            name='admin_password',
        ),
    ]
