@echo off
REM Pasugo App Installation Script

REM Set environment variables
set JAVA_HOME=C:\Program Files\Java\jdk-21.0.10
set ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools\bin;%PATH%

REM Verify paths exist
if not exist "%JAVA_HOME%" (
    echo ERROR: Java not found at %JAVA_HOME%
    pause
    exit /b 1
)

if not exist "%ANDROID_HOME%" (
    echo ERROR: Android SDK not found at %ANDROID_HOME%
    echo Please complete Android Studio setup wizard first
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Pasugo Cordova App Installer
echo ============================================
echo.
echo JAVA_HOME: %JAVA_HOME%
echo ANDROID_HOME: %ANDROID_HOME%
echo.
echo Building and deploying to Android device...
echo.

REM Make sure device is connected
echo Checking for connected devices...
adb devices
echo.

REM Change to project directory
cd /d "c:\Users\Earl Lawrence Banawa\Documents\frontnend\pasugoo"

REM Build and run
echo.
echo Building APK and deploying to device...
call "C:\Program Files\nodejs\node.exe" "c:\Users\Earl Lawrence Banawa\Documents\frontnend\pasugoo\node_modules\cordova\bin\cordova" run android

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo  SUCCESS! App installed on your device
    echo ============================================
    echo.
    echo Check your Android device for the Pasugo app
    echo.
) else (
    echo.
    echo ============================================
    echo  ERROR during installation
    echo ============================================
    echo.
)

pause
