# 🎯 CORDOVA - QUICK REFERENCE CARD

## ✅ Your Setup Status
```
Environment: Windows 11
Node.js: v25.8.2 ✓
npm: v11.11.1 ✓
Cordova: 13.0.0 ✓

Platforms: Android 14.0.1 ✓, iOS 8.0.0 ✓
Plugins: 6 core plugins ✓
Frontend: Cordova-compatible ✓
```

---

## 🚀 Most Used Commands

### Build APK (Android)
```bash
npm run build-android
```
📦 Output: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`

### Run on Device/Emulator
```bash
npm run run-android
```

### Clean Build
```bash
npm run clean && npm run build-android
```

### Check Status
```bash
cordova info
cordova platform list
cordova plugin list
```

---

## 🔧 Directory Structure

```
pasugoo/
├── www/                    ← Your frontend code
│   ├── index.html
│   ├── pages/             ← HTML pages
│   ├── js/                ← JavaScript (13 files)
│   └── css/               ← Stylesheets
├── config.xml             ← Cordova config
├── package.json           ← NPM config
├── platforms/
│   ├── android/           ← Android project
│   └── ios/               ← iOS project
└── node_modules/          ← Dependencies (198 packages)
```

---

## 📝 Helper Scripts

| File | Purpose |
|------|---------|
| `SETUP.bat` | Verify environment is set up correctly |
| `BUILD_ANDROID.bat` | Easy APK builder with instructions |
| `COMMANDS.bat` | Full command reference |
| `SETUP_COMPLETE.md` | Detailed setup guide |

---

## 🛠️ Common Tasks

### Update App Version
Edit `config.xml` and `package.json`:
```xml
<widget id="com.pasugo.app" version="1.1.0" ...>
```

### Add New Plugin
```bash
cordova plugin add <plugin-name>
npm install
```

### Remove Unused Plugin
```bash
cordova plugin remove <plugin-name>
```

### Release Build (Android)
```bash
cordova build android --release
```
Then sign with keystore (see CORDOVA_SETUP.md)

---

## ⚠️ Troubleshooting

### npm command not found
```bash
# Set PATH permanently
[Environment]::SetEnvironmentVariable("PATH", "C:\Program Files\nodejs;$env:PATH", [EnvironmentVariableTarget]::User)
```

### Build fails
```bash
npm run clean
npm run prepare
npm run build-android
```

### Need to reinstall platforms
```bash
cordova platform remove android
cordova platform add android@14.0.1
```

---

## 📚 Important Files

- `config.xml` - Cordova configuration (app name, permissions, etc.)
- `package.json` - NPM scripts and dependencies
- `www/js/main.js` - API endpoint configuration
- `www/js/auth.js` - Authentication logic

---

## 🌐 API Connection

Backend: https://pasugo.onrender.com
Check `www/js/main.js` for API_BASE_URL configuration

---

## 📱 Frontend Features (Ready for Cordova)

✅ Login & Registration system  
✅ Dashboard for users and riders  
✅ Real-time chat (WebSocket)  
✅ Map integration (Google Maps)  
✅ File upload (Cloudinary)  
✅ Request management system  
✅ Mobile-responsive design  

---

## 💡 Pro Tips

1. **Always run `npm run prepare` before building** to update platform files
2. **Use `cordova info` to debug environment issues**
3. **Test on actual device** - emulator may not show all features
4. **Keep `config.xml` in sync** with package.json version
5. **Check app logs** on device using Android Studio debugger

---

## 📞 Need Help?

- Official Docs: https://cordova.apache.org/docs/
- Android Docs: https://developer.android.com/
- iOS Docs: https://developer.apple.com/
- Check system requirements: `cordova requirements android`

---

**Setup Date:** March 26, 2026  
**Status:** ✅ READY TO BUILD  
**Next Step:** Run `npm run build-android` to create your first APK!
