# ECUST 面试系统 - 一键启动脚本 (PowerShell版本)
# 如果bat文件无法运行，请使用此脚本

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ECUST 学生会招新面试系统" -ForegroundColor Cyan
Write-Host "  一键启动" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 检查虚拟环境
if (-not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "[错误] 未找到 venv\Scripts\python.exe" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit
}

# 检查端口
$portInUse = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "[提示] 端口8000已被占用，直接打开浏览器..." -ForegroundColor Yellow
    Start-Process "http://127.0.0.1:8000/login/"
    Read-Host "按回车键退出"
    exit
}

Write-Host "[1/2] 正在启动服务器 (Daphne)..." -ForegroundColor Green
$proc = Start-Process -FilePath "venv\Scripts\python.exe" -ArgumentList "-m", "daphne", "-p", "8000", "interview_system.asgi:application" -PassThru -NoNewWindow

# 等待服务器启动
Write-Host "      等待服务器启动..." -ForegroundColor Gray
$tries = 0
while ($tries -lt 15) {
    Start-Sleep -Seconds 1
    $portCheck = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
    if ($portCheck) { break }
    $tries++
}

if ($tries -ge 15) {
    Write-Host "[警告] 等待超时，服务器可能启动失败" -ForegroundColor Yellow
    Write-Host "       进程ID: $($proc.Id)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/2] 启动完成！" -ForegroundColor Green
Write-Host ""
Start-Process "http://127.0.0.1:8000/login/"
Write-Host "浏览器即将打开..." -ForegroundColor Gray
Write-Host ""
Write-Host "如需停止服务器，按 Ctrl+C 或关闭此窗口" -ForegroundColor Yellow
Write-Host "如需后台运行，请使用 '停止网站.bat'" -ForegroundColor Yellow
Write-Host ""

# 保持窗口打开，让用户可以看到日志
Write-Host "服务器日志输出:" -ForegroundColor Cyan
Write-Host "----------------" -ForegroundColor Cyan
$proc.WaitForExit()
