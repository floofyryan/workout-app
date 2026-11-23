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

echo.
echo [2/4] Installing packages...
call npm install
if errorlevel 1 goto :fail

echo.
echo [3/4] Preparing the Android project...
call npx expo prebuild -p android --clean --no-install
if errorlevel 1 goto :fail
REM Clear compiled native code left over from earlier builds (it can hold mismatched versions).
for %%m in (expo-modules-core react-native-worklets react-native-reanimated react-native-gesture-handler react-native-screens) do (
  if exist "node_modules\%%m\android\.cxx" rmdir /s /q "node_modules\%%m\android\.cxx"
  if exist "node_modules\%%m\android\build" rmdir /s /q "node_modules\%%m\android\build"
)

echo.
echo [4/4] Building the app (can take ~10 minutes the first time)...
pushd android
REM Phones use arm64 chips; building only that is much faster and avoids emulator-only code.
call gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
set BUILD_RESULT=%errorlevel%
popd
if not "%BUILD_RESULT%"=="0" goto :fail
if not exist "android\app\build\outputs\apk\release\app-release.apk" (
  echo The build finished but the app file is missing.
  goto :fail
)
copy /y "android\app\build\outputs\apk\release\app-release.apk" "Workout.apk" >nul

echo.
echo Built! The app file is also saved as Workout.apk in this folder.
node scripts\serve-apk.mjs "Workout.apk"
pause
exit /b 0

:fail
echo.
echo Something went wrong - scroll up for the error, or copy the last ~30 lines and send them over.
pause
exit /b 1
