@echo off
chcp 65001 >nul
title ECUST Interview System

REM 切换到父目录（项目根目录）
cd /d "%~dp0\.."

echo ============================================
echo   ECUST Interview System
echo   East China University of Science and Technology
echo ============================================
echo.

if not exist "venv\Scripts\python.exe" (
    echo [ERROR] venv not found.
    echo Please run setup first (install Python, then run setup).
    echo.
    pause
    exit /b 1
)

echo [1/4] Checking dependencies...
if not exist "venv\.deps_installed" (
    echo       Installing dependencies...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed. Check requirements.txt.
        pause
        exit /b 1
    )
    echo. > venv\.deps_installed
    echo       Done.
) else (
    echo       Dependencies OK.
)

echo.
echo [2/4] Database...
if not exist "db.sqlite3" (
    venv\Scripts\python.exe manage.py migrate --run-syncdb
    if errorlevel 1 (
        echo [ERROR] Database init failed.
        pause
        exit /b 1
    )
    echo       Created.
) else (
    echo       OK.
)

echo.
echo [3/4] Cleaning old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo.
echo [4/4] Configuring firewall...
netsh advfirewall firewall delete rule name="ECUST-8000" >nul 2>&1
netsh advfirewall firewall add rule name="ECUST-8000" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>&1

echo.
echo ============================================
echo   Starting server...
echo ============================================
echo.

start "ECUST-Server" /MIN cmd /k "cd /d %CD% && echo Server running. Close this window to stop. && echo. && venv\Scripts\python.exe -m daphne -b 0.0.0.0 -p 8000 interview_system.asgi:application"

echo       Waiting for server...
set WAIT=0

:wait_loop
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto server_ready
set /a WAIT+=1
if %WAIT% lss 15 goto wait_loop

echo.
echo [WARNING] Server timeout. Check ECUST-Server window.
echo.
pause
exit /b 1

:server_ready
echo.
echo ============================================
echo   Server started!
echo ============================================
echo.

venv\Scripts\python.exe "%~dp0start_helper.py"

echo.
start "" "http://127.0.0.1:8000/login/"

echo Browser opened.
echo.
echo Quick URLs:
echo   This PC:    http://127.0.0.1:8000/login/
echo   Mobile:     see IP above
echo   Board:      http://127.0.0.1:8000/board/
echo   Admin:      http://127.0.0.1:8000/board/admin/
echo   Admin PW:   ecust2026
echo.
echo Press any key to close...
pause >nul
exit