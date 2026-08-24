@echo off
chcp 65001 >nul
title ECUST Interview System - Stop
echo ============================================
echo   Stopping ECUST Interview System...
echo ============================================
echo.

set found=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Found PID: %%a, terminating...
    taskkill /F /PID %%a >nul 2>&1
    set found=1
)

if "%found%"=="1" (
    echo.
    echo Server stopped. Port 8000 freed.
) else (
    echo No running server found on port 8000.
)

echo.
echo Auto-close in 2 seconds...
timeout /t 2 /nobreak >nul
exit