@echo off
chcp 65001 >nul
title Stop ECUST Interview System

echo Stopping ECUST Interview System...
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo   Killing PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Server stopped.
echo.
timeout /t 2 /nobreak >nul
exit