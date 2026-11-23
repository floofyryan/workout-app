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

REM Steps whose files haven't changed since the last successful run are skipped, so repeat runs are quick.
echo.
echo [2/4] Packages...
node scripts\build-steps.mjs need install
if errorlevel 1 (
  echo     Up to date - skipped.
) else (
  REM Only when the package versions really changed: clear compiled native code built against the
  REM old ones (otherwise keep it - recompiling it is the slowest part of the build).
  node scripts\build-steps.mjs changed install
  if not errorlevel 1 (
    for %%m in (expo-modules-core react-native-worklets react-native-reanimated react-native-gesture-handler react-native-screens) do (
      if exist "node_modules\%%m\android\.cxx" rmdir /s /q "node_modules\%%m\android\.cxx"
      if exist "node_modules\%%m\android\build" rmdir /s /q "node_modules\%%m\android\build"
    )
  )
  call npm install --include=dev --no-audit --no-fund
  if errorlevel 1 goto :fail
  node scripts\build-steps.mjs done install
)

echo.
echo [3/4] Android project...
node scripts\build-steps.mjs need prebuild
if errorlevel 1 (
  echo     Up to date - skipped.
) else (
  call npx expo prebuild -p android --clean --no-install
  if errorlevel 1 goto :fail
  node scripts\build-steps.mjs done prebuild
)

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
