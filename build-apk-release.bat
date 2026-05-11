@echo off
REM ============================================================
REM  VarunsOnline — Capacitor Android RELEASE APK Build Script
REM  Prerequisites: Run build-apk.bat (debug) first to confirm it works
REM  Run from: c:\Users\venka\.gemini\antigravity\scratch\varunsonline
REM ============================================================

echo.
echo ============================================================
echo  VarunsOnline — Release APK Builder
echo ============================================================
echo.

REM --- Set Java 17 (Temurin) ---
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

REM --- Set Android SDK ---
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools\bin;%PATH%"

REM --- Keystore settings (edit these before running) ---
set "KEYSTORE_PATH=varunsonline-release.jks"
set "KEYSTORE_ALIAS=varunsonline"
set "KEYSTORE_PASS=YourKeystorePassword"
set "KEY_PASS=YourKeyPassword"

echo STEP 1: Generating release keystore (skip if already exists)...
if not exist "%KEYSTORE_PATH%" (
    keytool -genkey -v ^
        -keystore "%KEYSTORE_PATH%" ^
        -alias "%KEYSTORE_ALIAS%" ^
        -keyalg RSA ^
        -keysize 2048 ^
        -validity 10000 ^
        -storepass "%KEYSTORE_PASS%" ^
        -keypass "%KEY_PASS%" ^
        -dname "CN=Varun, OU=VarunsOnline, O=VarunsOnline, L=Vizag, S=AP, C=IN"
    echo Keystore created: %KEYSTORE_PATH%
    echo IMPORTANT: Back up this file — you need it to update the app!
) else (
    echo Keystore already exists: %KEYSTORE_PATH%
)

echo.
echo STEP 2: Building release APK...
cd android
call gradlew.bat assembleRelease ^
    -Pandroid.injected.signing.store.file="..\%KEYSTORE_PATH%" ^
    -Pandroid.injected.signing.store.password="%KEYSTORE_PASS%" ^
    -Pandroid.injected.signing.key.alias="%KEYSTORE_ALIAS%" ^
    -Pandroid.injected.signing.key.password="%KEY_PASS%"

if errorlevel 1 (
    echo BUILD FAILED.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  RELEASE APK READY:
echo  app\build\outputs\apk\release\app-release.apk
echo ============================================================
echo.
pause
