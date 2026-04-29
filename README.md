# Budget Planner — Android App

A personal budget management app built with React + Capacitor, ready for Google Play.

## Prerequisites

Before you start, install these on your computer:

1. **Node.js** (v18 or newer) — https://nodejs.org
2. **Android Studio** — https://developer.android.com/studio
   - During setup, make sure to install the **Android SDK** (API 34+)
   - Open Android Studio → Settings → SDK Manager → install at least one SDK platform
3. **Java JDK 17** — usually bundled with Android Studio

Verify everything works by running:
```bash
node --version    # should show v18+
npm --version     # should show 9+
```

---

## Setup (one time only)

Open a terminal in this project folder and run these commands in order:

### Step 1: Install dependencies
```bash
npm install
```

### Step 2: Build the web app
```bash
npm run build
```

### Step 3: Initialize Capacitor (only first time)
```bash
npx cap init "Budget Planner" com.budgetplanner.app --web-dir dist
```
If it says capacitor.config already exists, that's fine — skip this step.

### Step 4: Add Android platform
```bash
npx cap add android
```

### Step 5: Sync web assets to Android
```bash
npx cap sync
```

### Step 6: Open in Android Studio
```bash
npx cap open android
```

Android Studio will open. Wait for Gradle sync to finish (bottom progress bar), then:
- Click the **green play button** ▶ to run on an emulator or connected device
- Or go to **Build → Build Bundle(s) / APK(s) → Build APK(s)** to generate an APK

---

## Making changes

When you update the React code (src/App.jsx):

```bash
npm run cap:build
npx cap open android
```

This rebuilds the web app and syncs it to Android in one step.

---

## Quick commands reference

| Command | What it does |
|---------|-------------|
| `npm run dev` | Run in browser for development (http://localhost:3000) |
| `npm run build` | Build for production |
| `npx cap sync` | Copy built files to Android project |
| `npx cap open android` | Open Android project in Android Studio |
| `npm run deploy` | Build + sync + open Android Studio (all in one) |

---

## Publishing to Google Play

### Step 1: Generate a signed APK/AAB

In Android Studio:
1. Go to **Build → Generate Signed Bundle / APK**
2. Choose **Android App Bundle** (recommended by Google)
3. Create a new keystore (first time) or use your existing one
4. Choose **release** build variant
5. Click **Finish**

The signed `.aab` file will be in `android/app/release/`

### Step 2: Google Play Console

1. Go to https://play.google.com/console
2. Create a developer account ($25 one-time fee)
3. Create a new app
4. Upload your `.aab` file
5. Fill in the store listing (description, screenshots, icons)
6. Submit for review

---

## App Icons

Replace the placeholder icons before publishing:

- `public/icons/icon.svg` — SVG icon (used in dev)
- `public/icons/icon-192.png` — 192×192px PNG (create this)
- `public/icons/icon-512.png` — 512×512px PNG (create this)

For the Android launcher icon, after running `npx cap add android`:
- Replace `android/app/src/main/res/mipmap-*/ic_launcher.png` with your icons
- Or use Android Studio → right-click `res` → New → Image Asset

---

## Project structure

```
budget-planner/
├── index.html              # HTML entry point
├── package.json            # Dependencies & scripts
├── vite.config.js          # Build config
├── capacitor.config.ts     # Android/Capacitor config
├── public/
│   ├── manifest.json       # PWA manifest
│   └── icons/              # App icons
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Main app component (all the UI)
    └── storage.js          # Portable storage layer
```

---

## Storage

The app stores all data locally on the device:
- **On Android** (Capacitor): uses `@capacitor/preferences` (native key-value storage)
- **In browser** (dev): uses `localStorage`

No data leaves the device. No server, no account required.

---

## Customization

**Change the app ID** (for your own Play Store listing):
- In `capacitor.config.ts`: change `com.budgetplanner.app` to your own ID
- In `package.json`: update the `cap:init` script accordingly
- After `npx cap add android`, also update `android/app/build.gradle` → `applicationId`

**Change the app name**:
- In `capacitor.config.ts`: change `appName`
- In `index.html`: change `<title>`
- In `public/manifest.json`: change `name` and `short_name`

**Change the accent color**:
- In `src/App.jsx`: search for `--accent` in the CSS variables section
