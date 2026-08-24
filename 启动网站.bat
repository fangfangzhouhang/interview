@echo off
chcp 65001 >nul
title ECUST Interview System
cd /d "%~dp0"

echo ============================================
echo   ECUST Interview System - Auto Start
echo   PC + Mobile Access
echo ============================================
echo.

if not exist "venv\Scripts\python.exe" (
    echo [ERROR] venv\Scripts\python.exe not found
    pause
    exit /b 1
)

echo [1/4] Cleaning old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo        Found old PID: %%a, terminating...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo [2/4] Configuring firewall (port 8000)...
netsh advfirewall firewall delete rule name="ECUST-8000" >nul 2>&1
netsh advfirewall firewall add rule name="ECUST-8000" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>&1
if %errorlevel% == 0 (
    echo        Firewall rule added
) else (
    echo        [WARN] Firewall failed, run as Administrator
)
timeout /t 1 /nobreak >nul

echo [3/4] Starting server...
echo.
start "ECUST-Server" /MIN cmd /k "cd /d %~dp0 && echo Server running. Close this window to stop. && echo. && venv\Scripts\python.exe -m daphne -b 0.0.0.0 -p 8000 interview_system.asgi:application"

echo        Waiting for server...
set tries=0

:wait
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 goto ready
set /a tries+=1
if %tries% lss 20 goto wait

echo.
echo [WARN] Timeout. Server may have failed.
echo        Check the "ECUST-Server" window for errors.
echo.
pause
exit /b 1

:ready
echo.
echo [4/4] Server is ready!
echo.

echo ============================================
echo   Generating access info...
echo ============================================
echo.
venv\Scripts\python.exe "%~dp0start_helper.py"

echo.
start "" "http://127.0.0.1:8000/login/"
echo Browser opened.
echo.
echo Tips:
echo   - PC: browser auto-opened
echo   - Mobile: scan QR code above or use LAN URL
echo   - Keep "ECUST-Server" window running
echo.
echo Auto-close in 15 seconds...
timeout /t 15 /nobreak >nul
exit