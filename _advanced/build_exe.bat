@echo off
chcp 65001 >nul
title ECUST Build Tool (ADVANCED)

echo ============================================
echo   ECUST Build Tool - ADVANCED ONLY
echo   For developers / packaging only
echo   Skip this if you just want to USE the system
echo ============================================
echo.

echo WARNING: This is an advanced tool.
echo It packages the entire system into a standalone .exe
echo that can run WITHOUT Python installed.
echo.
echo Normal users: DO NOT RUN THIS.
echo Just use start.bat / stop.bat.
echo.
pause

cd /d "%~dp0\.."

echo.
echo ============================================
echo   ECUST Interview System - Build Tool
echo ============================================
echo.

if not exist "venv\Scripts\python.exe" (
    echo [ERROR] venv not found. Run setup.bat first.
    pause
    exit /b 1
)

echo [1/5] Checking PyInstaller...
venv\Scripts\python.exe -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo       Installing PyInstaller...
    venv\Scripts\python.exe -m pip install pyinstaller
    if errorlevel 1 (
        echo [ERROR] PyInstaller install failed.
        pause
        exit /b 1
    )
) else (
    echo       PyInstaller OK.
)

echo.
echo [2/5] Collecting static files...
if exist "staticfiles" rmdir /s /q staticfiles
venv\Scripts\python.exe manage.py collectstatic --noinput 2>nul

echo.
echo [3/5] Cleaning old build...
if exist "build" rmdir /s /q build
if exist "dist\ECUST_Interview_System" rmdir /s /q "dist\ECUST_Interview_System"

echo.
echo [4/5] Building EXE (this may take a few minutes)...
echo.

set PYTHONIOENCODING=utf-8

venv\Scripts\python.exe -m PyInstaller --noconfirm --onedir --console --name "ECUST_Interview_System" --hidden-import=interview --hidden-import=interview_system --hidden-import=channels --hidden-import=daphne --hidden-import=django --collect-all=channels --collect-all=daphne --collect-all=django --collect-all=djangorestframework --add-data "templates;templates" --add-data "static;static" --add-data "staticfiles;staticfiles" --add-data "interview;interview" --add-data "interview_system;interview_system" run_server.py

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Check the log above.
    pause
    exit /b 1
)

echo.
echo [5/5] Post-processing...

if exist "db.sqlite3" (
    copy /y "db.sqlite3" "dist\ECUST_Interview_System\db.sqlite3" >nul
)

echo @echo off > "dist\ECUST_Interview_System\start.bat"
echo chcp 65001 ^>nul >> "dist\ECUST_Interview_System\start.bat"
echo title ECUST Interview System >> "dist\ECUST_Interview_System\start.bat"
echo cd /d "%%~dp0" >> "dist\ECUST_Interview_System\start.bat"
echo. >> "dist\ECUST_Interview_System\start.bat"
echo for /f "tokens=5" %%%%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do ( >> "dist\ECUST_Interview_System\start.bat"
echo     taskkill /F /PID %%%%a ^>nul 2^>^&1 >> "dist\ECUST_Interview_System\start.bat"
echo ) >> "dist\ECUST_Interview_System\start.bat"
echo timeout /t 1 /nobreak ^>nul >> "dist\ECUST_Interview_System\start.bat"
echo. >> "dist\ECUST_Interview_System\start.bat"
echo netsh advfirewall firewall delete rule name="ECUST-8000" ^>nul 2^>^&1 >> "dist\ECUST_Interview_System\start.bat"
echo netsh advfirewall firewall add rule name="ECUST-8000" dir=in action=allow protocol=TCP localport=8000 profile=any ^>nul 2^>^&1 >> "dist\ECUST_Interview_System\start.bat"
echo. >> "dist\ECUST_Interview_System\start.bat"
echo start "ECUST-Server" /MIN cmd /k "%%~dp0\ECUST_Interview_System.exe" >> "dist\ECUST_Interview_System\start.bat"
echo. >> "dist\ECUST_Interview_System\start.bat"
echo timeout /t 3 /nobreak ^>nul >> "dist\ECUST_Interview_System\start.bat"
echo start "" "http://127.0.0.1:8000/login/" >> "dist\ECUST_Interview_System\start.bat"

echo @echo off > "dist\ECUST_Interview_System\stop.bat"
echo title Stop ECUST >> "dist\ECUST_Interview_System\stop.bat"
echo for /f "tokens=5" %%%%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do ( >> "dist\ECUST_Interview_System\stop.bat"
echo     taskkill /F /PID %%%%a ^>nul 2^>^&1 >> "dist\ECUST_Interview_System\stop.bat"
echo ) >> "dist\ECUST_Interview_System\stop.bat"
echo echo Server stopped. >> "dist\ECUST_Interview_System\stop.bat"
echo timeout /t 2 /nobreak ^>nul >> "dist\ECUST_Interview_System\stop.bat"

echo ECUST Interview System > "dist\ECUST_Interview_System\README.txt"
echo ============================================ >> "dist\ECUST_Interview_System\README.txt"
echo. >> "dist\ECUST_Interview_System\README.txt"
echo Quick Start: >> "dist\ECUST_Interview_System\README.txt"
echo 1. Double-click start.bat >> "dist\ECUST_Interview_System\README.txt"
echo 2. Wait for browser to open >> "dist\ECUST_Interview_System\README.txt"
echo 3. Mobile: same WiFi, visit the IP shown >> "dist\ECUST_Interview_System\README.txt"
echo 4. Double-click stop.bat when done >> "dist\ECUST_Interview_System\README.txt"
echo. >> "dist\ECUST_Interview_System\README.txt"
echo Need Help? Contact the system administrator. >> "dist\ECUST_Interview_System\README.txt"

echo.
echo ============================================
echo   Build Complete!
echo ============================================
echo.
echo Output: dist\ECUST_Interview_System\
echo.
echo To test:
echo   1. Go to dist\ECUST_Interview_System\
echo   2. Double-click start.bat
echo   3. Wait for browser to open
echo   4. Visit http://127.0.0.1:8000/login/
echo.

echo Press any key to exit...
pause >nul
exit