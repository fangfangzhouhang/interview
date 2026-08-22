import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured


def _env_bool(name, default):
    """Read a strict boolean from the environment."""
    value = os.environ.get(name)
    if value is None:
        return default

    normalized = value.strip().lower()
    if normalized in {'1', 'true', 'yes', 'on'}:
        return True
    if normalized in {'0', 'false', 'no', 'off'}:
        return False
    raise ImproperlyConfigured(
        f'{name} must be one of: 1/0, true/false, yes/no, on/off.'
    )


def _env_list(name, default):
    """Read a comma-separated list without retaining empty entries."""
    value = os.environ.get(name)
    if value is None:
        return list(default)
    return [item.strip() for item in value.split(',') if item.strip()]

BASE_DIR = Path(__file__).resolve().parent.parent

# Local development works without a .env file. Production must override these
# values in the process environment.
SECRET_KEY = os.environ.get(
    'SECRET_KEY',
    'django-insecure-local-development-only-change-before-production-2026',
)
DEBUG = _env_bool('DEBUG', default=True)
ALLOWED_HOSTS = _env_list(
    'ALLOWED_HOSTS',
    default=[
        '127.0.0.1', 'localhost', 'testserver',
        # 同一 WiFi/路由器下的「局域网访问」（本机当前 WiFi 网卡 IP）
        '192.168.3.72',
        # 常见家用路由器网段兜底，方便你换 WiFi 后仍能局域网访问
        '192.168.0.*', '192.168.1.*', '192.168.2.*', '192.168.3.*',
        '10.0.0.*', '10.0.2.*',
        # 内网穿透工具（cpolar / ngrok / 花生壳 等）域名通配：你拿到啥域名就自动放行
        '*.cpolar.cn', '*.cpolar.com',
        '*.ngrok.io', '*.ngrok-free.app',
        '*.gicp.net',  # 花生壳国内免费域名
        # 仅作为「最后兜底」：本机临时开发测试时想省事直接全通过
        # '*',
    ],
)

# 基础设置
LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True

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
    # 放在最外层（调用栈最后执行 response 替换）：保证任何权限 403 / 路由 404 / 500
    # 只要属于 /api/* 且响应是 HTML，就会被换成 JSON，杜绝前端 response.json() 遇到
    # '<!DOCTYPE html>' 抛 SyntaxError → Trae 壳 Minified React error #185 白屏。
    'interview.middleware.enforce_json_api_middleware.EnforceJsonApiResponseMiddleware',
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

# 叫号看板管理员密码（生产环境应通过环境变量覆盖）
BOARD_ADMIN_PASSWORD = os.environ.get(
    'BOARD_ADMIN_PASSWORD',
    'ecust2026',
)

'''
# 使用CDN
if not DEBUG:
    STATIC_URL = 'https://cdn.yourdomain.com/static/'
    MEDIA_URL = 'https://cdn.yourdomain.com/media/'
'''
