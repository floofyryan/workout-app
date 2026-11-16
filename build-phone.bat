@echo off
REM Double-click to build the app and install it on your Android phone.
REM Before running: connect the phone by USB (USB debugging on) or pair it over Wi-Fi in
REM Android Studio's Device Manager. The first build takes ~10 minutes, later ones are faster.
setlocal
cd /d "%~dp0"
title Workout - build and install on phone

REM Use the Java and Android SDK that Android Studio installed.
if not defined JAVA_HOME if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if not defined ANDROID_HOME if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if defined ANDROID_HOME set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"
set EXPO_NO_GIT_STATUS=1

echo.
echo [1/4] Getting the latest code...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo Could not update the code. If it mentions local changes, run this once and try again:
  echo     git checkout -- package.json package-lock.json
  goto :fail
)

echo.
echo [2/4] Installing packages...
call npm install
if errorlevel 1 goto :fail

echo.
echo [3/4] Preparing the Android project...
call npx expo prebuild -p android --clean --no-install
if errorlevel 1 goto :fail

echo.
echo Connected devices:
adb devices
echo.
echo [4/4] Building and installing on your phone...
call npx expo run:android --variant release --no-bundler
if errorlevel 1 goto :fail

echo.
echo Done! The app is installed on your phone.
pause
exit /b 0

:fail
echo.
echo Something went wrong - scroll up for the error, or copy the last ~30 lines and send them over.
pause
exit /b 1
