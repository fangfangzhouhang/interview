# 05_update_settings.py
# 更新Django settings.py为生产配置

import os
import re
from pathlib import Path
from config import (
    PROJECT_ROOT, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB,
    ALLOWED_HOSTS, LOG_DIR, LOG_LEVEL
)


def update_settings():
    """更新Django设置文件"""
    print("=" * 50)
    print("步骤 5: 更新Django生产配置")
    print("=" * 50)

    settings_path = PROJECT_ROOT / 'interview_system' / 'settings.py'
    if not settings_path.exists():
        print(f"✗ 未找到settings.py: {settings_path}")
        print(f"  当前项目根目录: {PROJECT_ROOT}")
        return False

    # 读取当前配置
    with open(settings_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 更新配置
    updates = [
        # 关闭调试模式
        (r"DEBUG\s*=\s*True", "DEBUG = False"),
        # 更新允许的主机 - 格式化列表
        (r"ALLOWED_HOSTS\s*=\s*\[.*?\]", f"ALLOWED_HOSTS = {format_allowed_hosts(ALLOWED_HOSTS)}"),
    ]

    for pattern, replacement in updates:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)

    # 创建日志目录
    log_dir = LOG_DIR
    log_dir.mkdir(parents=True, exist_ok=True)

    # 日志文件路径
    log_file = (LOG_DIR / 'django.log').as_posix()

    # 添加生产环境配置（如果不存在）
    production_config = f'''
# 生产环境配置
if not DEBUG:
    # 安全配置 - Nginx 处理 SSL
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

    # 告诉 Django 我们通过 HTTPS 访问
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

    # 日志配置
    LOGGING = {{
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {{
            'verbose': {{
                'format': '[{{levelname}}] {{asctime}} {{module}} {{message}}',
                'style': '{{',
            }},
        }},
        'handlers': {{
            'file': {{
                'level': '{LOG_LEVEL}',
                'class': 'logging.handlers.RotatingFileHandler',
                'filename': '{log_file}',
                'maxBytes': 1024 * 1024 * 100,
                'backupCount': 10,
                'formatter': 'verbose',
            }},
        }},
        'root': {{
            'handlers': ['file'],
            'level': '{LOG_LEVEL}',
        }},
    }}
'''

    # 如果配置不存在，添加
    if 'SECURE_PROXY_SSL_HEADER' not in content:
        content += production_config

    # 备份原文件
    backup_path = settings_path.with_suffix('.py.bak')
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)

    # 写入新配置
    with open(settings_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✓ Django配置已更新: {settings_path}")
    print(f"✓ 原配置已备份: {backup_path}")
    print(f"✓ 日志目录已创建: {log_dir}")
    print()
    print("=" * 50)
    print("ALLOWED_HOSTS 配置:")
    print("=" * 50)
    for host in ALLOWED_HOSTS:
        print(f"  - {host}")
    print()
    return True


def format_allowed_hosts(hosts):
    """格式化 ALLOWED_HOSTS 列表"""
    if not hosts:
        return '[]'
    # 用双引号包裹每个字符串
    formatted = ', '.join([f"'{h}'" for h in hosts])
    return f'[{formatted}]'


if __name__ == '__main__':
    update_settings()