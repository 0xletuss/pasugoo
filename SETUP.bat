@echo off
REM CORDOVA QUICK START - Run this to set up your environment

echo ===============================================
echo  Pasugo Cordova Setup - Quick Start
echo ===============================================
echo.

REM Set Node.js path permanently for this session
set PATH=C:\Program Files\nodejs;%PATH%

echo [1/3] Verifying Node.js installation...
node --version
if errorlevel 1 (
    echo ERROR: Node.js not found! Please install from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo [2/3] Verifying npm installation...
npm --version
if errorlevel 1 (
    echo ERROR: npm not found!
    pause
    exit /b 1
)

echo.
echo [3/3] Verifying Cordova installation...
call npm list cordova --depth=0
if errorlevel 1 (
    echo ERROR: Cordova not found! Run: npm install
    pause
    exit /b 1
)

echo.
echo ===============================================
echo  SETUP COMPLETE!
echo ===============================================
echo.
echo Available commands:
echo   npm run build         - Build for all platforms
echo   npm run build-android - Build Android APK
echo   npm run build-ios     - Build iOS IPA
echo   npm run prepare       - Prepare platforms
echo   npm run clean         - Clean build artifacts
echo.
echo To build Android:
echo   npm run build-android
echo   APK will be at: platforms\android\app\build\outputs\apk\debug\
echo.
echo ===============================================
pause
