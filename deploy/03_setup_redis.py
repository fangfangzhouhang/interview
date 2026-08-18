# 03_setup_redis.py
# 生成Redis配置文件

import os
from pathlib import Path
from datetime import datetime
from config import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB, LOG_DIR


def generate_redis_config():
    """生成Redis配置文件"""
    print("=" * 50)
    print("Step 3: Generate Redis Configuration")
    print("=" * 50)

    # Redis配置路径（Windows）
    redis_conf_path = Path(r'C:\Redis\redis.windows.conf')
    redis_conf_path.parent.mkdir(parents=True, exist_ok=True)

    config_content = generate_redis_conf()

    # 写入配置文件
    with open(redis_conf_path, 'w', encoding='utf-8') as f:
        f.write(config_content)

    print(f"[OK] Redis configuration generated: {redis_conf_path}")

    # 创建Redis数据目录
    data_dir = Path(r'C:\Redis\data')
    data_dir.mkdir(exist_ok=True)
    print(f"[OK] Redis data directory created: {data_dir}")

    # 创建Redis日志目录
    log_dir = LOG_DIR / 'redis'
    log_dir.mkdir(exist_ok=True)
    print(f"[OK] Redis log directory created: {log_dir}")

    print()
    print("Redis Configuration:")
    print(f"  Host: {REDIS_HOST}")
    print(f"  Port: {REDIS_PORT}")
    print(f"  Database: {REDIS_DB}")
    if REDIS_PASSWORD:
        print(f"  Password: [SET]")
    else:
        print("  Password: [NOT SET] (recommended for production)")
    print()
    return redis_conf_path


def generate_redis_conf():
    """生成Redis配置内容 - 兼容老版本Redis"""
    # 将路径转换为Windows格式
    log_file = str(LOG_DIR / 'redis' / 'redis.log').replace('\\', '/')
    data_dir = 'C:/Redis/data'

    # 处理密码配置
    if REDIS_PASSWORD:
        password_line = f"requirepass {REDIS_PASSWORD}"
    else:
        password_line = "# requirepass your_strong_password"

    config = f"""
# Redis Configuration File - Auto Generated
# Compatible with older Redis versions
# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

# ============================================
# NETWORK
# ============================================
bind {REDIS_HOST}
port {REDIS_PORT}

# ============================================
# SECURITY
# ============================================
{password_line}

# ============================================
# GENERAL
# ============================================
databases 16

# ============================================
# SNAPSHOTTING (RDB)
# ============================================
save 900 1
save 300 10
save 60 10000

stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir {data_dir}

# ============================================
# APPEND ONLY FILE (AOF)
# ============================================
appendonly no
appendfilename "appendonly.aof"
appendfsync everysec

# ============================================
# MEMORY MANAGEMENT
# ============================================
maxmemory 512mb
maxmemory-policy allkeys-lru

# ============================================
# LOGGING
# ============================================
loglevel notice
logfile {log_file}

# ============================================
# PERFORMANCE
# ============================================
timeout 0
tcp-keepalive 0
"""
    return config


if __name__ == '__main__':
    generate_redis_config()