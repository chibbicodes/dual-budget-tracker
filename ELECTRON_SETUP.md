# Electron Desktop App - Testing Guide

The Dual Budget Tracker has been successfully configured as an Electron desktop app for macOS!

## Testing in Development Mode

On your Mac, run:

```bash
npm run dev:electron
```

This will:
- Start the Vite development server
- Launch the Electron app window
- Open DevTools for debugging
- Enable hot-reload (changes appear instantly)

You should see:
- A native macOS window with your budget tracker
- The app running at full screen with native title bar
- DevTools panel on the right side

## Testing Features

### 1. **Native Menu Bar**
Look at the top menu bar:
- **Dual Budget Tracker** menu (app name)
- **File** menu with Logout option
- **Edit** menu with standard editing commands
- **View** menu with navigation options
- **Window** menu with window controls
- **Help** menu

### 2. **Keyboard Shortcuts**
Try these shortcuts:

**Navigation:**
- `Cmd+1` → Dashboard
- `Cmd+2` → Accounts
- `Cmd+3` → Budget
- `Cmd+4` → Transactions
- `Cmd+5` → Projects

**Budget Views:**
- `Cmd+H` → Switch to Household view
- `Cmd+B` → Switch to Business view
- `Cmd+K` → Switch to Combined view

**Actions:**
- `Cmd+,` → Open Settings
- `Cmd+Shift+L` → Logout
- `Cmd+Q` → Quit app

**Standard:**
- `Cmd+W` → Close window
- `Cmd+M` → Minimize
- `Cmd+Z/Y` → Undo/Redo
- `Cmd+C/V/X` → Copy/Paste/Cut

### 3. **Profile System**
- Create a new profile (with optional password)
- Switch between profiles
- Logout returns to profile selector
- All profile features work in desktop mode

### 4. **Window Management**
- Resize window (minimum 1200x700)
- Minimize/maximize using window controls
- Close and reopen app (state persists)
- Multiple windows not allowed (single instance)

## Building for Production

### Build for Current Architecture
```bash
npm run build:mac
```

### Build for Specific Architecture
```bash
# For Apple Silicon (M1/M2/M3)
npm run build:mac:arm64

# For Intel Macs
npm run build:mac:x64
```

### Build Output
After building, find your app in the `release/` folder:
- `Dual Budget Tracker.app` - Double-click to run
- `Dual Budget Tracker-1.0.0.dmg` - Installer for distribution
- `Dual Budget Tracker-1.0.0-mac.zip` - Zipped app bundle

## Installing the App

### Option 1: Direct Installation
1. Open `release/Dual Budget Tracker.app`
2. Drag to Applications folder
3. Double-click to run

### Option 2: DMG Installer
1. Open `Dual Budget Tracker-1.0.0.dmg`
2. Drag app icon to Applications folder
3. Eject DMG
4. Open from Applications

## macOS Security

When first running the app, macOS may show a security warning:
1. Right-click the app and select "Open"
2. Click "Open" in the dialog
3. Or go to System Preferences → Security & Privacy → Allow

## Troubleshooting

### "App is damaged" error
```bash
xattr -cr "/Applications/Dual Budget Tracker.app"
```

### Build fails
```bash
# Clean and rebuild
rm -rf node_modules dist dist-electron release
npm install
npm run build:mac
```

### Electron binary issues
```bash
# Reinstall Electron
npm uninstall electron
npm install electron --save-dev
```

## What's Working

✅ Native macOS window with title bar
✅ Full menu bar integration
✅ Keyboard shortcuts
✅ Profile system (localStorage)
✅ All budget tracking features
✅ Window management
✅ External links open in browser
✅ macOS-specific behaviors (dock, etc.)

## What's Next (Phase 3)

⏳ SQLite database (replacing localStorage)
⏳ Network drive support for shared data
⏳ Multi-user file locking
⏳ Database migration tools
⏳ Backup/restore functionality

## Technical Details

**Architecture:**
- React 18 for UI
- Electron for desktop wrapper
- Vite for building and bundling
- TypeScript for type safety

**File Structure:**
- `electron/main.ts` - Main process (Node.js)
- `electron/preload.ts` - IPC bridge
- `src/hooks/useElectron.ts` - React integration
- `build/` - Build resources and entitlements

**Storage:**
- Currently uses localStorage
- Data stored in: `~/Library/Application Support/dual-budget-tracker/`
- Each profile has separate storage key

## Support

The app is fully functional! If you encounter any issues:
1. Check the console (Cmd+Option+I) for errors
2. Try running `npm run dev:electron` for detailed logs
3. Verify all dependencies are installed: `npm install`

Enjoy your native macOS budget tracker! 🎉
