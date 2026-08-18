# 05_update_settings.py
# 校验生产环境变量，不再改写 Django 源码

import os
import sys

from config import LOG_DIR, PROJECT_ROOT


def update_settings():
    """Validate production configuration supplied by the process environment."""
    print("=" * 50)
    print("步骤 5: 校验Django生产环境变量")
    print("=" * 50)

    settings_path = PROJECT_ROOT / 'interview_system' / 'settings.py'
    if not settings_path.exists():
        print(f"✗ 未找到settings.py: {settings_path}")
        print(f"  当前项目根目录: {PROJECT_ROOT}")
        return False

    missing = [
        name for name in ('SECRET_KEY', 'DEBUG', 'ALLOWED_HOSTS')
        if not os.environ.get(name, '').strip()
    ]
    if missing:
        print("✗ 缺少生产环境变量: " + ', '.join(missing))
        print("  请在启动 Daphne/NSSM 的同一进程环境中设置这些变量。")
        return False

    if os.environ['DEBUG'].strip().lower() not in {'0', 'false', 'no', 'off'}:
        print("✗ 生产环境 DEBUG 必须设置为 false/0/no/off。")
        return False

    allowed_hosts = [
        host.strip() for host in os.environ['ALLOWED_HOSTS'].split(',')
        if host.strip()
    ]
    if not allowed_hosts:
        print("✗ ALLOWED_HOSTS 至少需要一个主机名或IP。")
        return False

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"✓ settings.py 保持不变: {settings_path}")
    print(f"✓ 日志目录已创建: {LOG_DIR}")
    print("✓ SECRET_KEY 已设置（内容不回显）")
    print("✓ DEBUG=false")
    print("✓ ALLOWED_HOSTS: " + ', '.join(allowed_hosts))
    return True


if __name__ == '__main__':
    sys.exit(0 if update_settings() else 1)
