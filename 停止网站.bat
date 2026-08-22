@echo off
chcp 65001 >nul
title ECUST 面试系统 - 停止服务
echo ============================================
echo   正在停止 ECUST 面试系统...
echo ============================================
echo.

set found=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [提示] 发现进程 PID: %%a，正在终止...
    taskkill /F /PID %%a >nul 2>&1
    set found=1
)

if "%found%"=="1" (
    echo.
    echo [成功] 服务已停止，端口 8000 已释放。
) else (
    echo [提示] 没有发现运行中的服务，端口 8000 未被占用。
)

echo.
echo 窗口将在 2 秒后自动关闭...
timeout /t 2 /nobreak >nul
exit
