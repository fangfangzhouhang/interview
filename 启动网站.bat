@echo off
chcp 65001 >nul
title ECUST 学生会招新面试系统 - 启动
cd /d "%~dp0"

echo ============================================
echo   ECUST 学生会招新面试系统
echo   一键启动
echo ============================================
echo.

rem ===== 检查虚拟环境 =====
if not exist "venv\Scripts\python.exe" (
    echo [错误] 未找到 venv\Scripts\python.exe
    echo        请确保虚拟环境已正确创建。
    pause
    exit /b 1
)

rem ===== 先停止已存在的服务 =====
echo [1/3] 检查并清理旧进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo        发现旧进程 PID: %%a，正在终止...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

rem ===== 启动 Daphne 服务器 =====
echo [2/3] 正在启动服务器...
echo.
start "ECUST面试系统-服务器" /MIN cmd /k "cd /d %~dp0 && echo 服务器运行中，关闭此窗口将停止服务... && echo. && venv\Scripts\python.exe -m daphne -b 0.0.0.0 -p 8000 interview_system.asgi:application"

echo        等待服务器就绪...
set tries=0

:wait
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 goto ready
set /a tries+=1
if %tries% lss 20 goto wait

echo.
echo [警告] 等待超时（20秒），服务器可能启动失败。
echo        请查看"ECUST面试系统-服务器"窗口中的错误信息。
echo.
pause
exit /b 1

:ready
echo.
echo [3/3] 服务器已就绪！
echo.
echo ============================================
echo   启动成功！
echo   访问地址: http://127.0.0.1:8000/login/
echo ============================================
echo.

rem ===== 打开浏览器 =====
start "" "http://127.0.0.1:8000/login/"
echo 浏览器已打开，请在浏览器中访问系统。
echo.
echo 提示：关闭"ECUST面试系统-服务器"窗口即可停止服务。
echo       或运行"停止网站.bat"来停止服务。
echo.
echo 此窗口将在 5 秒后自动关闭...
timeout /t 5 /nobreak >nul
exit
