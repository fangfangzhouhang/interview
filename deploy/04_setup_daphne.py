# 04_setup_daphne.py
# Generate Daphne startup scripts

import os
from pathlib import Path
from datetime import datetime
from config import (
    PROJECT_ROOT, DAPHNE_HOST, DAPHNE_PORT,
    DAPHNE_WORKERS, DAPHNE_THREADS,
    VENV_PATH, LOG_DIR
)


def generate_daphne_scripts():
    """Generate Daphne startup and shutdown scripts"""
    print("=" * 50)
    print("Step 4: Generate Daphne startup scripts")
    print("=" * 50)

    # Create scripts directory
    scripts_dir = PROJECT_ROOT / 'scripts'
    scripts_dir.mkdir(exist_ok=True)

    # Generate startup script
    start_script = generate_start_script()
    start_path = scripts_dir / 'start_daphne.bat'
    with open(start_path, 'w', encoding='utf-8') as f:
        f.write(start_script)
    print(f"[OK] Startup script generated: {start_path}")

    # Generate hidden startup script (for service)
    start_hidden_script = generate_start_hidden_script()
    start_hidden_path = scripts_dir / 'start_daphne_hidden.bat'
    with open(start_hidden_path, 'w', encoding='utf-8') as f:
        f.write(start_hidden_script)
    print(f"[OK] Hidden startup script generated: {start_hidden_path}")

    # Generate stop script
    stop_script = generate_stop_script()
    stop_path = scripts_dir / 'stop_daphne.bat'
    with open(stop_path, 'w', encoding='utf-8') as f:
        f.write(stop_script)
    print(f"[OK] Stop script generated: {stop_path}")

    # Generate service script (optional)
    service_script = generate_service_script()
    service_path = scripts_dir / 'install_service.bat'
    with open(service_path, 'w', encoding='utf-8') as f:
        f.write(service_script)
    print(f"[OK] Service install script generated: {service_path}")

    print()
    print("=" * 50)
    print("Path Validation:")
    print("=" * 50)
    validate_paths()

    print()
    return start_path


def validate_paths():
    """Validate all paths used in scripts"""
    print(f"PROJECT_ROOT: {PROJECT_ROOT}")
    print(f"  Exists: {PROJECT_ROOT.exists()}")
    print(f"  Absolute: {PROJECT_ROOT.absolute()}")
    print()

    print(f"VENV_PATH: {VENV_PATH}")
    print(f"  Exists: {VENV_PATH.exists()}")
    print(f"  Absolute: {VENV_PATH.absolute()}")
    print()

    daphne_exe = VENV_PATH / 'Scripts' / 'daphne.exe'
    print(f"DAPHNE_EXE: {daphne_exe}")
    print(f"  Exists: {daphne_exe.exists()}")
    print(f"  Absolute: {daphne_exe.absolute()}")
    print()

    print(f"LOG_DIR: {LOG_DIR}")
    print(f"  Exists: {LOG_DIR.exists()}")
    print(f"  Absolute: {LOG_DIR.absolute()}")
    print()


def generate_start_script():
    """Generate Daphne startup script with correct parameters"""
    daphne_cmd = str(VENV_PATH / 'Scripts' / 'daphne.exe')
    log_dir = str(LOG_DIR)
    project_root = str(PROJECT_ROOT)

    script = f"""@echo off
REM ============================================
REM Daphne Startup Script - Production
REM Project: {PROJECT_ROOT.name}
REM Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
REM ============================================

setlocal enabledelayedexpansion

echo ============================================
echo Starting Daphne Server
echo ============================================
echo.

REM Set paths
set "DAPHNE_CMD={daphne_cmd}"
set "PROJECT_ROOT={project_root}"
set "LOG_DIR={log_dir}"

REM Check if Daphne exists
if not exist "!DAPHNE_CMD!" (
    echo [ERROR] Cannot find daphne.exe
    echo    Path: !DAPHNE_CMD!
    pause
    exit /b 1
)

REM Set environment variables
set "DJANGO_SETTINGS_MODULE=interview_system.settings"
set "PYTHONPATH=!PROJECT_ROOT!"

REM Change to project directory
cd /d "!PROJECT_ROOT!"

REM Create log directory
if not exist "!LOG_DIR!" mkdir "!LOG_DIR!"

REM Create log file
set "LOG_FILE=!LOG_DIR!\\daphne_access.log"
if not exist "!LOG_FILE!" type nul > "!LOG_FILE!"

echo [INFO] Project directory: !PROJECT_ROOT!
echo [INFO] Listening on: {DAPHNE_HOST}:{DAPHNE_PORT}
echo [INFO] Log file: !LOG_FILE!
echo.
echo ============================================
echo Starting Daphne...
echo ============================================
echo.

REM Start Daphne with correct parameters
"!DAPHNE_CMD!" ^
    -b {DAPHNE_HOST} ^
    -p {DAPHNE_PORT} ^
    --ping-interval 30 ^
    --ping-timeout 60 ^
    --access-log "!LOG_FILE!" ^
    --verbosity 2 ^
    interview_system.asgi:application

echo.
echo [ERROR] Daphne server stopped
pause
"""
    return script


def generate_start_hidden_script():
    """Generate hidden startup script (for service)"""
    daphne_cmd = str(VENV_PATH / 'Scripts' / 'daphne.exe')
    log_dir = str(LOG_DIR)
    project_root = str(PROJECT_ROOT)

    script = f"""@echo off
REM ============================================
REM Daphne Startup Script - Hidden Version
REM For service or background running
REM ============================================

set "DJANGO_SETTINGS_MODULE=interview_system.settings"
set "PYTHONPATH={project_root}"

cd /d "{project_root}"

if not exist "{log_dir}" mkdir "{log_dir}"

"{daphne_cmd}" ^
    -b {DAPHNE_HOST} ^
    -p {DAPHNE_PORT} ^
    --ping-interval 30 ^
    --ping-timeout 60 ^
    --access-log "{log_dir}\\daphne_access.log" ^
    --verbosity 2 ^
    interview_system.asgi:application
"""
    return script


def generate_stop_script():
    """Generate Daphne stop script"""
    script = """@echo off
REM ============================================
REM Daphne Stop Script
REM ============================================

setlocal enabledelayedexpansion

echo ============================================
echo Stopping Daphne Server
echo ============================================
echo.

echo Looking for Daphne processes...

REM Method 1: Kill daphne.exe directly
taskkill /F /IM daphne.exe 2>nul
if !errorlevel!==0 (
    echo [OK] Daphne.exe process terminated
) else (
    echo [INFO] No daphne.exe process found
)

REM Method 2: Find python processes running daphne
echo.
echo Looking for Python processes running daphne...
set "found=0"
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq python.exe" /fo csv /nh 2^>nul') do (
    set "pid=%%i"
    set "pid=!pid:"=!"
    tasklist /fi "pid eq !pid!" /fo csv /nh 2>nul | findstr /i "daphne" >nul
    if !errorlevel!==0 (
        echo Terminating Python process PID: !pid!
        taskkill /F /PID !pid! 2>nul
        set "found=1"
    )
)

if !found!==1 (
    echo [OK] Daphne Python processes terminated
) else (
    echo [INFO] No Daphne Python processes found
)

echo.
echo ============================================
echo Done!
echo ============================================
pause
"""
    return script


def generate_service_script():
    """Generate Windows service installation script"""
    project_root = str(PROJECT_ROOT)
    start_hidden_script = str(PROJECT_ROOT / 'scripts' / 'start_daphne_hidden.bat')

    script = f"""@echo off
REM ============================================
REM Install Daphne as Windows Service
REM Requires administrator privileges
REM ============================================

echo ============================================
echo Installing Daphne Windows Service
echo ============================================
echo.

REM Check administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator privileges required!
    echo    Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Check NSSM
set "NSSM_PATH=C:\\nssm\\nssm.exe"

if not exist "%NSSM_PATH%" (
    echo [ERROR] NSSM not found: %NSSM_PATH%
    echo.
    echo Please download NSSM from: https://nssm.cc/download
    echo And extract to C:\\nssm\\
    pause
    exit /b 1
)

echo [OK] NSSM found: %NSSM_PATH%
echo.

REM Remove old service if exists
echo Checking and removing old service...
%NSSM_PATH% remove DaphneServer confirm 2>nul

echo.
echo Installing DaphneServer service...

REM Install service using hidden startup script
set "START_SCRIPT={start_hidden_script}"
%NSSM_PATH% install DaphneServer "%START_SCRIPT%"

REM Set service parameters
%NSSM_PATH% set DaphneServer AppDirectory "{project_root}"
%NSSM_PATH% set DaphneServer AppEnvironmentExtra DJANGO_SETTINGS_MODULE=interview_system.settings PYTHONPATH={project_root}

REM Set service to auto-start
%NSSM_PATH% set DaphneServer Start SERVICE_AUTO_START

REM Set service display name and description
%NSSM_PATH% set DaphneServer DisplayName "Daphne ASGI Server"
%NSSM_PATH% set DaphneServer Description "Daphne ASGI Server for Interview System"

REM Set failure recovery
%NSSM_PATH% set DaphneServer FailureAction restart 60000
%NSSM_PATH% set DaphneServer FailureResetTimeout 300

echo.
echo [OK] Service installed successfully!
echo.
echo ============================================
echo Service Management Commands:
echo   Start: net start DaphneServer
echo   Stop:  net stop DaphneServer
echo   Remove: %NSSM_PATH% remove DaphneServer confirm
echo   Status: sc query DaphneServer
echo ============================================
echo.
echo Start service now? (Y/N)
choice /c YN /n /m "Select: "
if errorlevel 2 goto :end
if errorlevel 1 goto :start

:start
echo.
echo Starting service...
net start DaphneServer
if %errorlevel%==0 (
    echo [OK] Service started
) else (
    echo [ERROR] Service failed to start, check logs
)

:end
pause
"""
    return script


if __name__ == '__main__':
    generate_daphne_scripts()