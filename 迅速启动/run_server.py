# -*- coding: utf-8 -*-
"""
ECUST Interview System - 启动入口
双击 exe 即可启动服务（无需 Python 环境）
"""
import os
import sys
import webbrowser
import time
import threading
import socket
import signal

def get_base_dir():
    """获取项目根目录"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def get_local_ip():
    """获取本机局域网 IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def print_banner():
    """打印启动信息"""
    local_ip = get_local_ip()
    port = 8000
    
    print()
    print("=" * 55)
    print("  ECUST Interview System 运行中")
    print("  华东理工大学学生会 · 面试工作平台")
    print("=" * 55)
    print()
    print(f"  本地访问 (本电脑):")
    print(f"    http://127.0.0.1:{port}/login/")
    print()
    print(f"  局域网访问 (同一 WiFi 下所有设备):")
    print(f"    http://{local_ip}:{port}/login/")
    print()
    print(f"  叫号看板 (大屏展示):")
    print(f"    http://127.0.0.1:{port}/board/")
    print()
    print(f"  叫号管理员控制台:")
    print(f"    http://127.0.0.1:{port}/board/admin/")
    print(f"    预设密码: ecust2026")
    print()
    print("-" * 55)
    print("  提示:")
    print("  1. 关闭此窗口将停止服务")
    print("  2. 手机需连接同一 WiFi")
    print("  3. 如需帮助请联系技术支持")
    print("-" * 55)
    print()

def open_browser(url, delay=3):
    """延迟打开浏览器"""
    def _open():
        time.sleep(delay)
        try:
            webbrowser.open(url)
        except Exception:
            pass
    threading.Thread(target=_open, daemon=True).start()

def ensure_database(base_dir):
    """确保数据库存在"""
    db_path = os.path.join(base_dir, 'db.sqlite3')
    if not os.path.exists(db_path):
        print("  首次启动，正在初始化数据库...")
        os.environ['DJANGO_SETTINGS_MODULE'] = 'interview_system.settings'
        import django
        from django.core.management import call_command
        django.setup()
        call_command('migrate', '--run-syncdb', verbosity=0)
        print("  ✓ 数据库初始化完成")
        print()

def main():
    base_dir = get_base_dir()
    os.chdir(base_dir)
    
    # 设置环境
    os.environ['DJANGO_SETTINGS_MODULE'] = 'interview_system.settings'
    
    # 确保数据库
    ensure_database(base_dir)
    
    # 打印信息
    print_banner()
    
    # 打开浏览器
    browser_url = "http://127.0.0.1:8000/login/"
    open_browser(browser_url, 3)
    
    # 启动服务器
    print("  服务器启动中...")
    
    import django
    django.setup()
    
    # 导入 ASGI application
    from interview_system.asgi import application
    
    # 使用 daphne Server 启动
    from daphne.server import Server
    
    # 处理信号
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    signal.signal(signal.SIGTERM, signal.SIG_DFL)
    
    # 创建服务器
    server = Server(
        application,
        endpoints=[
            'tcp:port=8000:interface=0.0.0.0',
        ],
        signal_handlers=True,
    )
    
    print("  ✓ 服务器已就绪")
    print()
    print("  按 Ctrl+C 停止服务器")
    print()
    
    try:
        server.run()
    except KeyboardInterrupt:
        print("\n  正在停止服务器...")
    except Exception as e:
        print(f"\n  [错误] 服务器异常: {e}")
    finally:
        print("  服务器已停止")
        print()
        input("按回车键退出...")

if __name__ == '__main__':
    main()