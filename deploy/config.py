# config.py
# 所有可配置参数集中管理

import os
from pathlib import Path

DEBUG = False

# ============================================
# 项目路径配置
# ============================================
PROJECT_NAME = 'interview_system'
PROJECT_ROOT = Path(__file__).resolve().parent.parent  # C:\test6
DEPLOY_ROOT = Path(__file__).resolve().parent  # C:\test6\deploy

# 虚拟环境路径 - 在项目根目录下
VENV_PATH = PROJECT_ROOT / 'venv'  # C:\test6\venv

# ============================================
# Django 设置
# ============================================
DJANGO_SETTINGS_MODULE = 'interview_system.settings'

# ============================================
# 允许的主机（添加你的外网 IP 和域名）
# ============================================
ALLOWED_HOSTS = [
    '127.0.0.1',
    'localhost',
    # 外网 IP
    '43.129.213.164',
    # 添加你的域名（如果有）
    # 'your-domain.com',
    # 'www.your-domain.com',
]

# ============================================
# Nginx 配置
# ============================================
NGINX_HOST = '0.0.0.0'
NGINX_PORT = 80
NGINX_SSL_PORT = 443
NGINX_CONF_PATH = Path(r'C:\nginx\conf\nginx.conf')
NGINX_SITES_ENABLED = Path(r'C:\nginx\conf\sites-enabled')

# ============================================
# SSL 证书配置
# ============================================
SSL_CERT_PATH = Path(r'C:\nginx\ssl\server.crt')
SSL_KEY_PATH = Path(r'C:\nginx\ssl\server.key')
SSL_DAYS = 365

# ============================================
# Redis 配置
# ============================================
REDIS_HOST = '127.0.0.1'
REDIS_PORT = 6379
REDIS_PASSWORD = ''
REDIS_DB = 0

# ============================================
# Daphne 配置
# ============================================
DAPHNE_HOST = '127.0.0.1'
DAPHNE_PORT = 8000
DAPHNE_WORKERS = 4
DAPHNE_THREADS = 10

# ============================================
# 静态文件和媒体文件
# ============================================
STATIC_ROOT = PROJECT_ROOT / 'staticfiles'
MEDIA_ROOT = PROJECT_ROOT / 'media'

# ============================================
# 日志配置
# ============================================
LOG_DIR = PROJECT_ROOT / 'logs'
LOG_LEVEL = 'INFO'

# ============================================
# Python 可执行文件路径
# ============================================
PYTHON_EXE = VENV_PATH / 'Scripts' / 'python.exe'
PIP_EXE = VENV_PATH / 'Scripts' / 'pip.exe'