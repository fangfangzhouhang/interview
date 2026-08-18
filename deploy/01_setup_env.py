# 01_setup_env.py
# 设置环境变量和创建必要目录

import os
import sys
from pathlib import Path
from config import PROJECT_ROOT, LOG_DIR, STATIC_ROOT, MEDIA_ROOT

def setup_environment():
    """设置环境变量和创建目录"""
    print("=" * 50)
    print("步骤 1: 环境设置")
    print("=" * 50)
    
    # 创建日志目录
    LOG_DIR.mkdir(exist_ok=True)
    print(f"✓ 创建日志目录: {LOG_DIR}")
    
    # 创建静态文件目录
    STATIC_ROOT.mkdir(exist_ok=True)
    print(f"✓ 创建静态文件目录: {STATIC_ROOT}")
    
    # 创建媒体文件目录
    MEDIA_ROOT.mkdir(exist_ok=True)
    print(f"✓ 创建媒体文件目录: {MEDIA_ROOT}")
    
    # 设置环境变量
    os.environ['DJANGO_SETTINGS_MODULE'] = 'interview_system.settings'
    
    # 添加项目根目录到Python路径
    project_path = str(PROJECT_ROOT)
    if project_path not in sys.path:
        sys.path.insert(0, project_path)
    
    print("✓ 环境变量设置完成")
    print()
    return True

if __name__ == '__main__':
    setup_environment()