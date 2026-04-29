import { readFileSync, writeFileSync, existsSync } from 'fs';

const files = [
    'node_modules/@capacitor/app/android/build.gradle',
    'node_modules/@capacitor/preferences/android/build.gradle',
    'node_modules/@capacitor/splash-screen/android/build.gradle',
    'node_modules/@capacitor/status-bar/android/build.gradle',
];

let patched = 0;
files.forEach(f => {
    if (!existsSync(f)) return;
    let content = readFileSync(f, 'utf8');
    if (content.includes("proguard-android.txt")) {
        content = content.replace(/proguard-android\.txt/g, 'proguard-android-optimize.txt');
        writeFileSync(f, content);
        patched++;
        console.log(`  Patched ${f}`);
    }
});
console.log(`Capacitor patch: ${patched} file(s) fixed.`);