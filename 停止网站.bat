@echo off
title ECUST Interview System - Stop
echo 正在停止 Django 服务器...

set found=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo 找到进程 PID: %%a，正在终止...
    taskkill /F /PID %%a >nul 2>&1
    set found=1
)

if "%found%" == "1" (
    echo [完成] Django 服务器已停止，端口 8000 已释放。
) else (
    echo [提示] 没有发现运行中的 Django 服务器（端口 8000 未被占用）。
)

echo.
echo 本窗口 2 秒后自动关闭...
timeout /t 2 /nobreak >nul
exit
