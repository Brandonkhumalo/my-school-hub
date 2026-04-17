from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0019_school_accommodation_type'),
        ('academics', '0019_teacher_teaching_classes'),
    ]

    operations = [
        # ── New ReportCardConfig fields ──────────────────────────────
        migrations.AddField(
            model_name='reportcardconfig',
            name='banner_image',
            field=models.ImageField(blank=True, upload_to='report_banners/'),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='gradient_start_color',
            field=models.CharField(default='#1d4ed8', max_length=7),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='gradient_end_color',
            field=models.CharField(default='#3b82f6', max_length=7),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='header_style',
            field=models.CharField(
                choices=[('solid', 'Solid Colour'), ('gradient', 'Gradient'), ('banner', 'Banner Image')],
                default='solid', max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='font_family',
            field=models.CharField(
                choices=[('serif', 'Serif (Classic)'), ('sans', 'Sans-Serif (Modern)'), ('elegant', 'Elegant (Italic Serif)')],
                default='serif', max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='font_size_scale',
            field=models.CharField(
                choices=[('compact', 'Compact'), ('normal', 'Normal'), ('large', 'Large')],
                default='normal', max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='page_size',
            field=models.CharField(choices=[('A4', 'A4'), ('letter', 'Letter')], default='A4', max_length=10),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='page_orientation',
            field=models.CharField(choices=[('portrait', 'Portrait'), ('landscape', 'Landscape')], default='portrait', max_length=10),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='one_page_fit',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='template_preset',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='show_attendance_breakdown',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='show_position',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='show_class_average',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='show_previous_term',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='show_effort_grade',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='show_subject_chart',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='show_promotion_status',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='show_fees_status',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='show_qr_code',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='subject_grouping_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reportcardconfig',
            name='comment_char_limit',
            field=models.IntegerField(default=250),
        ),

        # ── New ReportCardTemplate ────────────────────────────────────
        migrations.CreateModel(
            name='ReportCardTemplate',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=80, unique=True)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('config_json', models.JSONField(default=dict)),
                ('is_builtin', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(
                    blank=True, null=True, on_delete=models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-is_builtin', 'name']},
        ),

        # ── New SubjectGroup ─────────────────────────────────────────
        migrations.CreateModel(
            name='SubjectGroup',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('group_type', models.CharField(
                    choices=[('core', 'Core'), ('elective', 'Electives'), ('language', 'Languages'), ('other', 'Other')],
                    default='core', max_length=20,
                )),
                ('school', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='subject_groups', to='users.school')),
                ('subject', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='groups', to='academics.subject')),
            ],
            options={'unique_together': {('school', 'subject')}},
        ),
    ]
