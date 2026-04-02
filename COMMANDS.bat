@echo off
REM =====================================================
REM CORDOVA COMMAND REFERENCE
REM =====================================================
REM Run this file to see all available Cordova commands
REM =====================================================

setlocal enabledelayedexpansion
set PATH=C:\Program Files\nodejs;%PATH%

cls
echo.
echo =====================================================
echo  PASUGO CORDOVA - COMMAND REFERENCE
echo =====================================================
echo.
echo ENVIRONMENT:
echo   Node.js: v25.8.2
echo   npm: v11.11.1
echo   Cordova: 13.0.0
echo   Windows 11
echo.
echo =====================================================
echo  BUILD COMMANDS
echo =====================================================
echo.
echo 1. Build for Android:
echo    npm run build-android
echo    Output: platforms\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo 2. Build for iOS (macOS only):
echo    npm run build-ios
echo    Output: platforms\ios\build\
echo.
echo 3. Build for all platforms:
echo    npm run build
echo.
echo =====================================================
echo  RUN/TEST COMMANDS (requires device/emulator)
echo =====================================================
echo.
echo 1. Run on Android:
echo    npm run run-android
echo    (requires Android device with USB debug OR AVD running)
echo.
echo 2. Run on iOS (macOS only):
echo    npm run run-ios
echo.
echo 3. Emulate Android:
echo    npm run emulate-android
echo.
echo =====================================================
echo  PLATFORM MANAGEMENT
echo =====================================================
echo.
echo Check installed platforms:
echo    cordova platform list
echo.
echo Add a platform:
echo    cordova platform add android@14.0.1
echo    cordova platform add ios@8.0.0
echo.
echo Remove a platform:
echo    cordova platform remove android
echo    cordova platform remove ios
echo.
echo =====================================================
echo  PLUGIN MANAGEMENT
echo =====================================================
echo.
echo List all installed plugins:
echo    cordova plugin list
echo.
echo Add a plugin:
echo    cordova plugin add <plugin-name>
echo    Example: cordova plugin add cordova-plugin-camera
echo.
echo Remove a plugin:
echo    cordova plugin remove <plugin-name>
echo.
echo =====================================================
echo  PROJECT MAINTENANCE
echo =====================================================
echo.
echo Prepare (copy files to platforms):
echo    npm run prepare
echo.
echo Clean build artifacts:
echo    npm run clean
echo.
echo Get project info:
echo    cordova info
echo.
echo Check requirements:
echo    cordova requirements
echo.
echo =====================================================
echo  HELPFUL SCRIPTS
echo =====================================================
echo.
echo SETUP.bat          - Verify your environment
echo BUILD_ANDROID.bat  - Easy Android APK builder
echo this file          - Command reference
echo.
echo =====================================================
echo  QUICK START EXAMPLE - BUILD ANDROID APK
echo =====================================================
echo.
echo 1. Navigate to project:
echo    cd c:\Users\Earl Lawrence Banawa\Documents\frontnend\pasugoo
echo.
echo 2. Prepare:
echo    npm run prepare
echo.
echo 3. Build:
echo    npm run build-android
echo.
echo 4. Find APK in:
echo    platforms\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo =====================================================
echo  DEBUGGING
echo =====================================================
echo.
echo For verbose output, add -d flag:
echo    cordova -d build android
echo.
echo Check environment requirements:
echo    cordova requirements android
echo.
echo View recent errors:
echo    Check: %AppData%\npm-cache\_logs\
echo.
echo =====================================================
echo  DOCUMENTATION
echo =====================================================
echo.
echo Local docs:
echo   - SETUP_COMPLETE.md (full setup guide)
echo   - CORDOVA_SETUP.md (original guide)
echo   - config.xml (Cordova configuration)
echo   - package.json (npm settings)
echo.
echo Online docs:
echo   - https://cordova.apache.org/docs/
echo   - https://developer.android.com/
echo   - https://developer.apple.com/
echo.
echo =====================================================
echo.
pause
