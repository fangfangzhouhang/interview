# 02_setup_nginx.py
# Generate Nginx configuration with SSL

import os
import subprocess
from pathlib import Path
from datetime import datetime
from config import (
    PROJECT_ROOT, NGINX_HOST, NGINX_PORT, NGINX_SSL_PORT,
    DAPHNE_HOST, DAPHNE_PORT,
    STATIC_ROOT, MEDIA_ROOT, LOG_DIR
)

# Fixed Nginx installation directory
NGINX_BASE = Path(r'C:\nginx')


def generate_nginx_config():
    """Generate Nginx site configuration with SSL"""
    print("=" * 50)
    print("Step 2: Generate Nginx Configuration (SSL Required)")
    print("=" * 50)

    # Ensure Nginx base directories exist
    (NGINX_BASE / 'conf' / 'sites-enabled').mkdir(parents=True, exist_ok=True)
    (NGINX_BASE / 'logs').mkdir(parents=True, exist_ok=True)
    (NGINX_BASE / 'temp').mkdir(parents=True, exist_ok=True)
    (NGINX_BASE / 'ssl').mkdir(parents=True, exist_ok=True)

    # Check SSL certificates
    cert_path = NGINX_BASE / 'ssl' / 'server.crt'
    key_path = NGINX_BASE / 'ssl' / 'server.key'

    if not cert_path.exists() or not key_path.exists():
        print("[WARNING] SSL certificates not found!")
        print("Please run the SSL certificate generation script first:")
        print("  python deploy/generate_ssl_cert.py")
        print()
        print("[ERROR] Cannot continue without SSL certificates")
        return False

    # Generate nginx site configuration
    config_content = generate_site_config()

    # Write configuration to sites-enabled
    config_path = NGINX_BASE / 'conf' / 'sites-enabled' / 'interview_system.conf'
    with open(config_path, 'w', encoding='utf-8') as f:
        f.write(config_content)

    print(f"[OK] Nginx site configuration generated: {config_path}")

    # Generate main nginx.conf
    generate_main_nginx_conf()

    # Generate startup scripts
    generate_start_scripts()

    print()
    print("=" * 50)
    print("Nginx Startup Instructions (SSL Required):")
    print("=" * 50)
    print("Please use one of the following methods to start Nginx:")
    print()
    print("  Method 1 - Using startup script (recommended):")
    print(f"    {PROJECT_ROOT}\\scripts\\start_nginx.bat")
    print()
    print("  Method 2 - Manual startup:")
    print("    cd C:\\nginx")
    print("    nginx.exe")
    print()
    print("  [WARNING] Do NOT start nginx.exe from other directories")
    print()
    print("  Access URL: https://localhost")
    print("  (Your browser will show a security warning - this is normal)")
    print()

    return config_path


def generate_main_nginx_conf():
    """Generate main nginx.conf configuration file"""
    nginx_conf_path = NGINX_BASE / 'conf' / 'nginx.conf'
    nginx_base = str(NGINX_BASE).replace('\\', '/')

    config = f"""
# Nginx Main Configuration File
# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
# Location: {nginx_conf_path}

# Set working directory - CRITICAL for Windows
working_directory {nginx_base};

# Worker processes
worker_processes  1;

# Error log - absolute path
error_log  {nginx_base}/logs/error.log  error;

# PID file - absolute path
pid        {nginx_base}/logs/nginx.pid;

# Events module
events {{
    worker_connections  1024;
}}

# HTTP module
http {{
    # Basic settings
    include       {nginx_base}/conf/mime.types;
    default_type  application/octet-stream;

    # Log format
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    # Access log - absolute path
    access_log  {nginx_base}/logs/access.log  main;

    # Performance optimizations
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout  65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip compression
    gzip  on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml application/json;

    # Include site configurations
    include {nginx_base}/conf/sites-enabled/*.conf;
}}
"""

    with open(nginx_conf_path, 'w', encoding='utf-8') as f:
        f.write(config)

    print(f"[OK] Nginx main configuration generated: {nginx_conf_path}")

    # Check mime.types
    mime_types_path = NGINX_BASE / 'conf' / 'mime.types'
    if not mime_types_path.exists():
        print(f"[WARNING] mime.types not found: {mime_types_path}")
        print("  Please ensure Nginx is properly installed")


def generate_start_scripts():
    """Generate Nginx startup, stop, and reload scripts"""
    scripts_dir = PROJECT_ROOT / 'scripts'
    scripts_dir.mkdir(exist_ok=True)

    # Generate startup script
    start_content = f"""@echo off
REM ============================================
REM Nginx Startup Script (SSL Required)
REM Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
REM ============================================

echo ============================================
echo Starting Nginx Server (SSL Enabled)
echo ============================================
echo.

REM Important: Change to Nginx directory
cd /d C:\\nginx

echo [INFO] Current directory: %cd%
echo [INFO] Configuration: C:\\nginx\\conf\\nginx.conf
echo.

REM Check SSL certificates
if not exist "C:\\nginx\\ssl\\server.crt" (
    echo [ERROR] SSL certificate not found!
    echo Please run: python deploy/generate_ssl_cert.py
    pause
    exit /b 1
)

if not exist "C:\\nginx\\ssl\\server.key" (
    echo [ERROR] SSL private key not found!
    echo Please run: python deploy/generate_ssl_cert.py
    pause
    exit /b 1
)

echo [OK] SSL certificates found
echo.

REM Test configuration
echo Testing configuration...
nginx.exe -t
if %errorlevel% neq 0 (
    echo [ERROR] Configuration test failed!
    echo Please check C:\\nginx\\logs\\error.log
    pause
    exit /b 1
)

echo [OK] Configuration test passed!
echo.

REM Start Nginx
echo Starting Nginx...
start "" nginx.exe

if %errorlevel% equ 0 (
    echo [OK] Nginx started successfully!
    echo.
    echo Access URL:
    echo   https://localhost
    echo.
    echo Management Commands:
    echo   Reload: nginx -s reload
    echo   Stop:   nginx -s stop
    echo   Quit:   nginx -s quit
) else (
    echo [ERROR] Nginx failed to start
    echo Please check C:\\nginx\\logs\\error.log
)

pause
"""

    start_path = scripts_dir / 'start_nginx.bat'
    with open(start_path, 'w', encoding='utf-8') as f:
        f.write(start_content)
    print(f"[OK] Nginx startup script generated: {start_path}")

    # Generate stop script
    stop_content = """@echo off
REM ============================================
REM Nginx Stop Script
REM ============================================

echo ============================================
echo Stopping Nginx Server
echo ============================================
echo.

cd /d C:\\nginx

echo Stopping Nginx...
nginx.exe -s stop

if %errorlevel% equ 0 (
    echo [OK] Nginx stopped
) else (
    echo [INFO] Nginx may not be running
)

pause
"""

    stop_path = scripts_dir / 'stop_nginx.bat'
    with open(stop_path, 'w', encoding='utf-8') as f:
        f.write(stop_content)
    print(f"[OK] Nginx stop script generated: {stop_path}")

    # Generate reload script
    reload_content = """@echo off
REM ============================================
REM Nginx Reload Configuration Script
REM ============================================

echo ============================================
echo Reloading Nginx Configuration
echo ============================================
echo.

cd /d C:\\nginx

echo Testing new configuration...
nginx.exe -t
if %errorlevel% neq 0 (
    echo [ERROR] Configuration test failed!
    echo Please check C:\\nginx\\logs\\error.log
    pause
    exit /b 1
)

echo [OK] Configuration test passed!
echo Reloading configuration...
nginx.exe -s reload

if %errorlevel% equ 0 (
    echo [OK] Configuration reloaded
) else (
    echo [ERROR] Reload failed
)

pause
"""

    reload_path = scripts_dir / 'reload_nginx.bat'
    with open(reload_path, 'w', encoding='utf-8') as f:
        f.write(reload_content)
    print(f"[OK] Nginx reload script generated: {reload_path}")


def generate_site_config():
    """Generate Nginx site configuration with SSL - Support external access"""
    # Convert paths to Nginx format
    static_root = str(STATIC_ROOT).replace('\\', '/')
    media_root = str(MEDIA_ROOT).replace('\\', '/')

    # SSL certificate paths
    ssl_cert = 'C:/nginx/ssl/server.crt'
    ssl_key = 'C:/nginx/ssl/server.key'

    # ============================================
    # 重要：添加你的外网 IP 和域名到 server_name
    # ============================================
    # 获取外网 IP（从 config.py 或手动指定）
    # 这里使用变量，你可以直接替换为实际 IP
    EXTERNAL_IP = '你的外网IP'  # 替换为实际 IP
    DOMAIN = 'your-domain.com'  # 替换为实际域名（如果有）

    # 构建 server_name
    server_names = ['localhost', '127.0.0.1']
    if EXTERNAL_IP and EXTERNAL_IP != '你的外网IP':
        server_names.append(EXTERNAL_IP)
    if DOMAIN and DOMAIN != 'your-domain.com':
        server_names.append(DOMAIN)
        server_names.append(f'www.{DOMAIN}')

    server_name_str = ' '.join(server_names)
    config = f"""
    # Django Site Configuration - {PROJECT_ROOT.name} (SSL Required)
    # Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}    

    upstream daphne {{
        server {DAPHNE_HOST}:{DAPHNE_PORT};
        keepalive 32;
    }}        

    # 宝塔面板 upstream
    upstream btpanel {{
        server 127.0.0.1:8888;
        keepalive 32;
    }}

    # HTTPS Server - Main server
    server {{
        listen {NGINX_SSL_PORT} ssl;
        http2 on;
        server_name {server_name_str};

        # SSL Configuration
        ssl_certificate {ssl_cert};
        ssl_certificate_key {ssl_key};
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security Headers
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Client settings
        client_max_body_size 10M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;

        # 宝塔面板代理（通过 /bt/ 路径访问）
        location /bt/ {{
            proxy_pass http://btpanel/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;
            proxy_set_header X-Forwarded-Port $server_port;

            # 重写路径，去掉 /bt 前缀
            rewrite ^/bt/(.*)$ /$1 break;
            proxy_redirect off;
        }}
        
        # 宝塔面板静态资源
        location /bt/static/ {{
            proxy_pass http://btpanel/static/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }}
        
        # Static files
        location /static/ {{
            alias {static_root}/;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }}

        # Media files
        location /media/ {{
            alias {media_root}/;
            expires 7d;
            add_header Cache-Control "public, immutable";
        }}

        # WebSocket support
        location /ws/ {{
            proxy_pass http://daphne;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }}

        # Django application
        location / {{
            proxy_pass http://daphne;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;
            proxy_set_header X-Forwarded-Port $server_port;
            proxy_redirect off;
            
            # Buffer optimization
            proxy_buffering off;
            proxy_buffer_size 8k;
            proxy_buffers 8 8k;
            proxy_busy_buffers_size 16k;
        }}
        
        # Health check
        location /health/ {{
            access_log off;
            return 200 "healthy\\n";
            add_header Content-Type text/plain;
        }}

        # Error pages
        error_page 500 502 503 504 /50x.html;
        location = /50x.html {{
            root html;
        }}
    }}

    # HTTP to HTTPS redirect
    server {{
        listen {NGINX_PORT};
        server_name {server_name_str};
        return 301 https://$host$request_uri;
    }}
"""

    return config