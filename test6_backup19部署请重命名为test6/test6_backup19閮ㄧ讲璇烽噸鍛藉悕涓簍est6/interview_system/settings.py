import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# 调试模式
DEBUG = True

# 基础设置
LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True

SECRET_KEY = 'django-insecure-your-secret-key-here'

# 登录页面重定向
LOGIN_URL = '/'
LOGIN_REDIRECT_URL = '/profile/'
LOGOUT_REDIRECT_URL = '/login/'

# Redis 配置
REDIS_HOST = os.environ.get('REDIS_HOST', '127.0.0.1')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD', '')
REDIS_DB = int(os.environ.get('REDIS_DB', 0))

# 静态文件配置
STATIC_URL = 'static/'
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# 媒体文件配置
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
DATA_UPLOAD_MAX_MEMORY_SIZE = 3 * 1024 * 1024  # 3MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 3 * 1024 * 1024  # 3MB

ALLOWED_HOSTS = []

# 应用
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    'rest_framework',
    'interview',
]

# 中间层
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'interview.middleware.permission_middleware.PermissionMiddleware',
]

ROOT_URLCONF = 'interview_system.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'interview_system.wsgi.application'
ASGI_APPLICATION = 'interview_system.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]



DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework设置
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

if DEBUG:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer"
        }
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                "hosts": [
                    {
                        "address": f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}",
                        "password": REDIS_PASSWORD,
                    }
                ],
                "capacity": 500,
                "expiry": 60,
                "group_expiry": 21600,
                "channel_capacity": {
                    "http.request": 200,
                    "websocket.send": 100,
                },
            },
        },
    }

# 图片缓存头
IMAGE_CACHE_HEADERS = {
    'Cache-Control': 'public, max-age=86400',
    'Expires': 'Thu, 01 Dec 2026 16:00:00 GMT',
}

'''
# 使用CDN
if not DEBUG:
    STATIC_URL = 'https://cdn.yourdomain.com/static/'
    MEDIA_URL = 'https://cdn.yourdomain.com/media/'
'''