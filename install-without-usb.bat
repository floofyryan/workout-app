@echo off
REM Double-click to build the app and install it on your phone over Wi-Fi - no USB cable.
REM It builds the finished app (it doesn't need Metro or the computer to run), then shows a QR code:
REM scan it with the phone (same Wi-Fi as this computer), download, and install over the old app.
REM Your workouts are kept: the app is signed with the same key as before.
setlocal
cd /d "%~dp0"
title Workout - build and install over Wi-Fi

REM Use the Java and Android SDK that Android Studio installed.
if not defined JAVA_HOME if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if not defined ANDROID_HOME if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set EXPO_NO_GIT_STATUS=1
set NODE_ENV=production

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
REM Packages must include the development tools (e.g. the QR code), so don't install in production mode.
set NODE_ENV=
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
echo [4/4] Building the app...
node scripts\build-steps.mjs need apk
if errorlevel 1 (
  echo     Nothing changed since the last build - using Workout.apk.
  goto :share
)
pushd android
REM Phones use arm64 chips; building only that is much faster and avoids emulator-only code.
set NODE_ENV=production
call gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
set BUILD_RESULT=%errorlevel%
set NODE_ENV=
popd
if not "%BUILD_RESULT%"=="0" goto :fail
if not exist "android\app\build\outputs\apk\release\app-release.apk" (
  echo The build finished but the app file is missing.
  goto :fail
)
copy /y "android\app\build\outputs\apk\release\app-release.apk" "Workout.apk" >nul
node scripts\build-steps.mjs done apk
echo.
echo Built! The app file is also saved as Workout.apk in this folder.

:share
node scripts\serve-apk.mjs "Workout.apk"
pause
exit /b 0

:fail
echo.
echo Something went wrong - scroll up for the error, or copy the last ~30 lines and send them over.
pause
exit /b 1
