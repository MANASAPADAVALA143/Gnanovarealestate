@echo off
echo.
echo ============================================
echo   GNANOVA SERVERS - STARTING...
echo ============================================
echo.

REM Change to project directory
cd /d "%~dp0"

echo [1/2] Starting Frontend (Port 3000)...
start "Gnanova Frontend" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Backend (Port 3001)...
start "Gnanova Backend" cmd /k "npm run webhook"

echo.
echo ============================================
echo   SERVERS STARTED!
echo ============================================
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:3001
echo.
echo IMPORTANT: Two new windows opened
echo DO NOT CLOSE those windows!
echo.
echo Press any key to close this window...
pause >nul
