from pathlib import Path
from decouple import config, Csv
import dj_database_url

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------
# Core settings — loaded from .env
# ---------------------------------------------------------------
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)

# ALLOWED_HOSTS — Railway auto-assigns a domain; '*' is safe because
# CORS and authentication guard the actual API.
# Override with a comma-separated list in .env for stricter production configs.
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*', cast=Csv())


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'rest_framework.authtoken',
    'django_celery_results',
    'drf_spectacular',
    'storages',
    'users',
    'academics',
    'staff',
    'finances',
    'whatsapp_intergration',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'School_system.middleware.AuditMiddleware',  # audit trail
]

ROOT_URLCONF = 'School_system.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'School_system.wsgi.application'

# Custom User Model
AUTH_USER_MODEL = 'users.CustomUser'


# ---------------------------------------------------------------
# Database — SQLite by default, PostgreSQL via DATABASE_URL
# ---------------------------------------------------------------
_db_url = config('DATABASE_URL', default='')
if _db_url:
    DATABASES = {'default': dj_database_url.parse(_db_url, conn_max_age=600)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'users.token.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# ---------------------------------------------------------------
# drf-spectacular (Swagger / OpenAPI)
# ---------------------------------------------------------------
SPECTACULAR_SETTINGS = {
    'TITLE': 'My School Hub API',
    'DESCRIPTION': 'Multi-tenant SaaS school management platform API (v1)',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}


# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Harare'
USE_I18N = True
USE_TZ = True


# ---------------------------------------------------------------
# Static files — served by WhiteNoise from the container
# ---------------------------------------------------------------
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# ---------------------------------------------------------------
# Media files — S3 in production, local filesystem in dev
# Set AWS_STORAGE_BUCKET_NAME in .env to enable S3.
# ---------------------------------------------------------------
_s3_bucket = config('AWS_STORAGE_BUCKET_NAME', default='')

if _s3_bucket:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_STORAGE_BUCKET_NAME = _s3_bucket
    AWS_S3_REGION_NAME = config('AWS_S3_REGION_NAME', default='af-south-1')
    AWS_DEFAULT_ACL = None  # use bucket policy
    AWS_S3_FILE_OVERWRITE = False
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_CUSTOM_DOMAIN = None  # use default S3 URL
    MEDIA_URL = f'https://{_s3_bucket}.s3.amazonaws.com/'
else:
    MEDIA_URL = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------
# CORS — allow the frontend origin + dev origins
# ---------------------------------------------------------------
_cors_origins = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5000,http://127.0.0.1:5000,https://myschoolhub.co.zw,https://www.myschoolhub.co.zw',
    cast=Csv(),
)
CORS_ALLOWED_ORIGINS = list(_cors_origins)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False

# CSRF trusted origins — required when behind ALB/reverse proxy
CSRF_TRUSTED_ORIGINS = list(config(
    'CSRF_TRUSTED_ORIGINS',
    default=','.join(_cors_origins),
    cast=Csv(),
))

# ---------------------------------------------------------------
# Security Headers
# ALB / Nginx / Railway terminate SSL at the edge and forward plain
# HTTP to the container — do NOT use SECURE_SSL_REDIRECT or every
# request will loop.  Trust the X-Forwarded-Proto header instead.
# ---------------------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    # Do NOT set SECURE_SSL_REDIRECT — the reverse proxy handles it
    SECURE_HSTS_SECONDS = 31536000       # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

# ---------------------------------------------------------------
# Redis Cache — optional
# If REDIS_URL is set (Railway Redis plugin or external), use Redis.
# Otherwise fall back to in-memory cache so the app starts without Redis.
# ---------------------------------------------------------------
_redis_url = config('REDIS_URL', default='')

if _redis_url:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': _redis_url,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            },
            'TIMEOUT': 300,
            'KEY_PREFIX': 'schoolhub',
        }
    }
    # Use Redis for sessions when Redis is available
    SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
    SESSION_CACHE_ALIAS = 'default'
else:
    # No Redis — use Django's database-backed sessions and local memory cache
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'schoolhub-locmem',
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'

# Rate limiting storage (uses Django's cache backend)
RATELIMIT_USE_CACHE = 'default'

# ---------------------------------------------------------------
# WhatsApp API settings
# ---------------------------------------------------------------
WHATSAPP_API_URL = config('WHATSAPP_API_URL', default='')
WHATSAPP_ACCESS_TOKEN = config('WHATSAPP_ACCESS_TOKEN', default='')
WHATSAPP_VERIFY_TOKEN = config('WHATSAPP_VERIFY_TOKEN', default='webhook_verify_token')
WHATSAPP_APP_SECRET = config('WHATSAPP_APP_SECRET', default='')

# ---------------------------------------------------------------
# PayNow Zimbabwe
# ---------------------------------------------------------------
PAYNOW_INTEGRATION_ID = config('PAYNOW_INTEGRATION_ID', default='')
PAYNOW_INTEGRATION_KEY = config('PAYNOW_INTEGRATION_KEY', default='')
PAYNOW_RETURN_URL = config('PAYNOW_RETURN_URL', default='http://localhost:5000/payment/return')
PAYNOW_RESULT_URL = config('PAYNOW_RESULT_URL', default='')

# ---------------------------------------------------------------
# Email — Resend (https://resend.com)
# ---------------------------------------------------------------
RESEND_API_KEY     = config('ResendEmailApiKey', default='')
RESEND_FROM_EMAIL  = config('ResendFromEmail', default='noreply@myschoolhub.co.zw')
RESEND_DESTINATION = config('Destination', default='')

# ---------------------------------------------------------------
# Celery Configuration
# Falls back to memory broker when Redis is not available so the
# Django app boots without a Celery worker (tasks run synchronously).
# ---------------------------------------------------------------
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default=_redis_url or 'memory://')
CELERY_RESULT_BACKEND = 'django-db' if _redis_url else 'cache+memory://'
CELERY_CACHE_BACKEND = 'default'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_MAX_RETRIES = 3
CELERY_TASK_DEFAULT_RETRY_DELAY = 30
CELERY_TASK_SOFT_TIME_LIMIT = 300
CELERY_TASK_TIME_LIMIT = 600

# ---------------------------------------------------------------
# Logging
# ---------------------------------------------------------------
_log_level = 'DEBUG' if DEBUG else 'INFO'

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name} {process:d} {thread:d} — {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'simple': {
            'format': '[{asctime}] {levelname} {name} — {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'app.log',
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'error_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'errors.log',
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
            'level': 'ERROR',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console', 'file', 'error_file'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'WARNING',
            'propagate': False,
        },
        'academics': {'handlers': ['console', 'file', 'error_file'], 'level': _log_level, 'propagate': False},
        'finances': {'handlers': ['console', 'file', 'error_file'], 'level': _log_level, 'propagate': False},
        'users': {'handlers': ['console', 'file', 'error_file'], 'level': _log_level, 'propagate': False},
        'staff': {'handlers': ['console', 'file', 'error_file'], 'level': _log_level, 'propagate': False},
        'whatsapp_intergration': {'handlers': ['console', 'file', 'error_file'], 'level': _log_level, 'propagate': False},
        'celery': {'handlers': ['console', 'file', 'error_file'], 'level': 'INFO', 'propagate': False},
    },
}
