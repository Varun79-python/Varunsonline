@echo off
REM ============================================================
REM  VarunsOnline APK Builder
REM  Stack: Java 17 + Gradle 8.11.1 + AGP 8.9.1
REM  Run from: c:\Users\venka\.gemini\antigravity\scratch\varunsonline
REM ============================================================

echo.
echo ============================================================
echo  VarunsOnline APK Builder  [Java 17 + Gradle 8.11.1 + AGP 8.9.1]
echo ============================================================
echo.

REM ---- Set Java 17 and Android SDK BEFORE anything else ----
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"

REM ---- Verify Java 17 ----
echo [CHECK] Verifying Java 17...
"%JAVA_HOME%\bin\java.exe" -version 2>&1 | findstr /i "17" >nul
if errorlevel 1 (
    echo ERROR: Java 17 not found at: %JAVA_HOME%
    echo Check the folder exists and contains bin\java.exe
    pause & exit /b 1
)
echo Java 17 OK.
echo.

REM ---- Stop ALL stale Gradle daemons ----
echo [1/5] Stopping stale Gradle daemons...
cd android
call gradlew.bat --stop 2>nul
cd ..
echo Done.
echo.

REM ---- Capacitor sync ----
echo [2/5] Syncing Capacitor...
call npx cap sync android
echo.

REM ============================================================
REM  CRITICAL: cap sync regenerates capacitor.build.gradle with
REM  VERSION_21 every time. This PowerShell one-liner patches ALL
REM  five Gradle files back to VERSION_17 after every sync.
REM ============================================================
echo [3/5] Patching Gradle files: VERSION_21 --> VERSION_17...

powershell -NoProfile -Command ^
  "Get-ChildItem -Path 'android','node_modules\@capacitor' -Recurse -Filter '*.gradle' | ForEach-Object { $c = Get-Content $_.FullName -Raw; $n = $c -replace 'JavaVersion\.VERSION_21','JavaVersion.VERSION_17' -replace 'gradle:8\.13\.0','gradle:8.9.1'; if ($c -ne $n) { Set-Content $_.FullName $n -NoNewline; Write-Host ('  Patched: ' + $_.FullName) } }"

echo Patch done.
echo.

REM ---- Build APK ----
echo [4/5] Building debug APK...
echo       (First run: downloads Gradle 8.11.1 ~160MB, takes 3-5 min)
echo.
cd android
call gradlew.bat assembleDebug --stacktrace 2>&1

if errorlevel 1 (
    cd ..
    echo.
    echo ============================================================
    echo  BUILD FAILED
    echo ============================================================
    echo.
    echo  Common fixes:
    echo.
    echo  1. SDK Platform 34 or 36 missing?
    echo     Android Studio ^> SDK Manager ^> SDK Platforms
    echo     Install: API 34 AND API 36
    echo.
    echo  2. First-time Gradle sync issue?
    echo     Open Android Studio ^> File ^> Open ^> select android\ folder
    echo     Wait for sync to complete, then run build-apk.bat again.
    echo.
    echo  3. Cache corruption?
    echo     rmdir /s /q "%USERPROFILE%\.gradle\caches"
    echo     Then run build-apk.bat again.
    echo.
    echo  4. Still VERSION_21 somewhere?
    echo     Run this in PowerShell to check:
    echo     Select-String "VERSION_21" android\**\*.gradle,node_modules\@capacitor\**\*.gradle
    echo ============================================================
    pause & exit /b 1
)

cd ..
echo.
echo ============================================================
echo  BUILD SUCCESSFUL!
echo.
echo  APK location:
echo  android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo  Install on your phone:
echo   1. Transfer APK to phone (USB / WhatsApp / Google Drive)
echo   2. Settings ^> Install Unknown Apps ^> Allow
echo   3. Tap the APK file to install
echo ============================================================
echo.
pause
