# Set environment variables
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21.0.10"
$env:ANDROID_HOME = "$env:USERPROFILE\AppData\Local\Android\Sdk"
$env:GRADLE_HOME = "C:\gradle-8.13"
$env:PATH = "C:\gradle-8.13\bin;C:\Program Files\Java\jdk-21.0.10\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools\bin;$env:PATH"

Write-Host "Environment Variables Set:"
Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "GRADLE_HOME=$env:GRADLE_HOME"
Write-Host "PATH includes gradle, java, adb"
Write-Host ""

# Change to project directory
cd "c:\Users\Earl Lawrence Banawa\Documents\frontnend\pasugoo"

# Verify gradle is available
Write-Host "Verifying gradle..."
gradle --version
Write-Host ""

# Verify adb is available
Write-Host "Checking ADB devices..."
adb devices
Write-Host ""

# Run cordova build for android
Write-Host "Starting Cordova build for Android..."
& "C:\Program Files\nodejs\node.exe" "c:\Users\Earl Lawrence Banawa\Documents\frontnend\pasugoo\node_modules\cordova\bin\cordova" run android

Write-Host "Build complete!"
