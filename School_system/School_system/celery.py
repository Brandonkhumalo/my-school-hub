import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'School_system.settings')

app = Celery('School_system')

# Load config from Django settings, using the CELERY_ namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Discover tasks.py in every installed app
app.autodiscover_tasks()
