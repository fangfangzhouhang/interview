# deploy_all.py
# 主部署脚本 - 按顺序执行所有步骤

import sys
import subprocess
from pathlib import Path
from datetime import datetime
from config import PYTHON_EXE

# 添加当前目录到Python路径
sys.path.insert(0, str(Path(__file__).resolve().parent))

def print_header(text):
    """打印标题"""
    print()
    print("=" * 60)
    print(f"  {text}")
    print("=" * 60)
    print()

def run_script(script_name):
    """运行单个脚本"""
    script_path = Path(__file__).resolve().parent / script_name
    if not script_path.exists():
        print(f"✗ 脚本不存在: {script_name}")
        return False
    
    print_header(f"执行: {script_name}")
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=False,
            text=True,
            cwd=script_path.parent
        )
        return result.returncode == 0
    except Exception as e:
        print(f"✗ 执行失败: {e}")
        return False

def main():
    """主部署流程"""
    print_header("Django生产环境部署")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # 检查Python版本
    print(f"Python版本: {sys.version}")
    print()
    
    # 部署步骤
    steps = [
        ('01_setup_env.py', '环境设置'),
        ('02_setup_nginx.py', 'Nginx配置'),
        ('03_setup_redis.py', 'Redis配置'),
        ('04_setup_daphne.py', 'Daphne启动脚本'),
        ('05_update_settings.py', '更新Django配置'),
    ]
    
    failed = []
    for script, description in steps:
        print_header(f"步骤: {description}")
        if run_script(script):
            print(f"✓ {description} 完成")
        else:
            print(f"✗ {description} 失败")
            failed.append(description)
    
    # 显示结果
    print_header("部署结果")
    if failed:
        print("✗ 以下步骤失败:")
        for f in failed:
            print(f"  - {f}")
        print()
        print("请检查错误信息并手动修复")
    else:
        print("✓ 所有步骤执行成功！")
        print()
        print("后续手动操作:")
        print("1. 收集静态文件:")
        print(f"   {PYTHON_EXE} manage.py collectstatic")
        print()
        print("2. 启动Nginx服务")
        print("3. 启动Redis服务")
        print("4. 运行启动脚本: scripts/start_daphne.bat")
        print()
        print("访问: https://localhost")
    
    print(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == '__main__':
    main()