@echo off
REM Build Android APK

echo ===============================================
echo  Building Android APK
echo ===============================================

set PATH=C:\Program Files\nodejs;%PATH%

echo Preparing Android platform...
call npm run prepare

echo.
echo Building APK (this may take a few minutes)...
call npm run build-android

echo.
echo.
if %errorlevel% equ 0 (
    echo ===============================================
    echo  BUILD SUCCESS!
    echo ===============================================
    echo APK Location:
    echo   platforms\android\app\build\outputs\apk\debug\app-debug.apk
    echo.
) else (
    echo ===============================================
    echo  BUILD FAILED
    echo ===============================================
    echo Check the errors above for details.
)

pause
