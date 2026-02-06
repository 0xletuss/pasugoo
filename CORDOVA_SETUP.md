# Pasugo Cordova App Setup Guide

This is the Cordova mobile application for Pasugo - Fast & Reliable Bill Payment and Delivery Service.

## Project Structure

```
pasugo-cordova/
├── www/                          # Web assets (HTML, CSS, JS)
│   ├── index.html               # Splash screen
│   ├── css/                      # Stylesheets
│   ├── js/                       # JavaScript files
│   │   ├── main.js              # API configuration
│   │   ├── auth.js              # Authentication logic
│   │   └── splash.js            # Splash screen controller
│   └── pages/                    # App pages
│       ├── login.html
│       ├── register.html
│       ├── dashboard.html
│       └── forgot-password.html
├── platforms/                    # Platform-specific code
│   ├── android/                 # Android project
│   └── ios/                     # iOS project
├── plugins/                      # Cordova plugins
├── config.xml                    # Cordova configuration
├── package.json                  # Dependencies and scripts
└── CORDOVA_SETUP.md             # This file
```

## Prerequisites

Before you can build and run the Cordova app, you need:

### Global Requirements
- **Node.js** (v14+) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Cordova CLI** - Install with: `npm install -g cordova`

### For Android Development
- **Java Development Kit (JDK)** 11+ - [Download](https://adoptium.net/)
- **Android SDK** - [Install via Android Studio](https://developer.android.com/studio)
- **Android Virtual Device (AVD)** or physical Android device

### For iOS Development (macOS only)
- **Xcode** - Available from App Store
- **CocoaPods** - Install with: `sudo gem install cocoapods`

## Installation

1. **Navigate to the project directory:**
   ```bash
   cd pasugo-cordova
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Prepare the project:**
   ```bash
   cordova prepare
   ```

## Building the App

### Build for Android

```bash
npm run build-android
```

Or using Cordova directly:
```bash
cordova build android
```

This generates an APK file in: `platforms/android/app/build/outputs/apk/debug/`

### Build for iOS (macOS only)

```bash
npm run build-ios
```

Or using Cordova directly:
```bash
cordova build ios
```

## Running the App

### Run on Android Device or Emulator

First, make sure you have:
- Android Virtual Device (AVD) running, OR
- Physical Android device connected via USB with USB debugging enabled

Then run:
```bash
npm run run-android
```

Or:
```bash
cordova run android
```

### Emulate Android

```bash
npm run emulate-android
```

### Run on iOS Device or Emulator (macOS only)

```bash
npm run run-ios
```

## Available npm Scripts

- `npm run build-android` - Build APK for Android
- `npm run build-ios` - Build IPA for iOS
- `npm run build` - Build for all platforms
- `npm run run-android` - Run app on Android device/emulator
- `npm run run-ios` - Run app on iOS device/emulator
- `npm run run` - Run on default platform (Android)
- `npm run emulate-android` - Launch Android emulator
- `npm run emulate-ios` - Launch iOS simulator
- `npm run prepare` - Prepare all platform projects
- `npm run clean` - Clean build artifacts
- `npm run serve` - Start a local development server

## Configuration

### Update App Icon and Splash Screen

To customize the app icon and splash screen:

1. **Create icon and splash images** in `res/icon/` and `res/screen/` folders
2. **Update `config.xml`** with paths to your images
3. **Regenerate platform resources:**
   ```bash
   cordova prepare
   ```

### Modify App Settings

Edit `config.xml` to change:
- App name, description, version
- Package ID (com.pasugo.app)
- Permissions and plugins
- Orientation (portrait/landscape)
- Status bar styling

## Plugins Installed

The following Cordova plugins are included:

- **cordova-plugin-whitelist** - Network security
- **cordova-plugin-statusbar** - Status bar customization
- **cordova-plugin-device** - Device information
- **cordova-plugin-file** - File system access
- **cordova-plugin-file-transfer** - File upload/download
- **cordova-plugin-network-information** - Network status
- **cordova-plugin-geolocation** - GPS location

To add more plugins:
```bash
cordova plugin add <plugin-name>
```

## Splash Screen Flow

The app uses a custom splash screen that:

1. Shows for a minimum of 2 seconds
2. Checks if user has valid authentication tokens
3. Routes accordingly:
   - **New user**: Splash → Login
   - **Existing user**: Splash → Token verification → Dashboard
   - **On error**: Splash → Login

See `www/js/splash.js` for implementation details.

## Troubleshooting

### Android Build Fails
- Ensure ANDROID_SDK_ROOT is set: `echo %ANDROID_SDK_ROOT%`
- Check Java version: `java -version` (should be 11+)
- Clear gradle cache: `cd platforms/android && ./gradlew clean`

### iOS Build Fails (macOS)
- Update Xcode: `xcode-select --install`
- Install pods: `cd platforms/ios && pod install`
- Clean Xcode: `cd platforms/ios && rm -rf Pods Podfile.lock`

### App Won't Connect to Backend
- Check API_BASE_URL in `www/js/main.js`
- Ensure backend server is running
- Check network connectivity in app
- Verify CORS settings on backend

### Plugins Not Working
- Run: `cordova plugin list` to see installed plugins
- Remove and re-add plugin: 
  ```bash
  cordova plugin remove <plugin-name>
  cordova plugin add <plugin-name>
  ```
- Clean and rebuild: `cordova clean && cordova build`

## Development Workflow

1. Edit files in `www/` folder (HTML, CSS, JS)
2. Test changes in live server: `npm run serve`
3. When ready, build for target platform:
   ```bash
   npm run build-android
   # or
   npm run build-ios
   ```
4. Deploy to device or app store

## Release Build

For production APK/IPA:

### Android Release APK
```bash
cordova build android --release
```

You'll need to sign it with your keystore:
```bash
jarsigner -verbose -sigalg SHA-256 -digestalg SHA-256 -keystore /path/to/keystore.jks \
  platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk \
  release
```

### iOS Release IPA
```bash
cordova build ios --release
```

Then use Xcode to archive and distribute.

## Resources

- [Cordova Official Documentation](https://cordova.apache.org/docs/)
- [Android Development Guide](https://developer.android.com/guide)
- [iOS Development Guide](https://developer.apple.com/documentation/)
- [Pasugo Backend API](https://pasugo.onrender.com)

## Support

For issues or questions, contact the Pasugo team at support@pasugo.app

---

**Version**: 1.0.0  
**Last Updated**: February 5, 2026
