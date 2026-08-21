@echo off
title ECUST Interview System Launcher
cd /d "%~dp0"

echo ============================================
echo   华东理工大学学生会招新面试系统
echo   一键启动器
echo ============================================
echo.

REM ---- 检查端口 8000 是否已有服务器在运行 ----
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo [检测] 服务器已在运行，直接打开浏览器...
    goto open_browser
)

REM ---- 检查虚拟环境是否存在 ----
if not exist "venv\Scripts\python.exe" (
    echo [错误] 未找到 venv\Scripts\python.exe
    echo 请确认虚拟环境创建在项目根目录下。
    pause
    exit /b 1
)

echo [1/2] 正在后台启动 Django 服务器...
start "Django服务器（请勿关闭）" /MIN venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000

echo       正在等待服务器就绪（最多 20 秒）...
set /a tries=0

:wait_loop
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 goto open_browser
set /a tries+=1
if %tries% lss 20 goto wait_loop

echo [警告] 服务器 20 秒内未就绪，仍尝试打开浏览器。
echo        若页面打不开，请还原任务栏里"Django服务器"窗口查看报错。

:open_browser
start "" "http://127.0.0.1:8000/login/"

echo.
echo [2/2] 已打开浏览器！
echo.
echo 提示：任务栏最小化的"Django服务器"窗口是网站进程，请勿关闭。
echo       需要停止时双击项目目录下的"停止网站.bat"。
echo.
echo 本窗口 3 秒后自动关闭...
timeout /t 3 /nobreak >nul
exit
