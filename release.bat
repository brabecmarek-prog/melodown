@echo off
setlocal EnableExtensions

echo ================================================
echo   Melodown Release Tool
echo ================================================
echo.

set "GH_CMD=gh"
where gh >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\bin\gh.exe" (
    set "GH_CMD=%USERPROFILE%\bin\gh.exe"
  ) else (
    echo GitHub CLI ^(`gh`^) was not found on PATH.
    echo Install it or run this script from an environment where `gh` is available.
    pause
    exit /b 1
  )
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found on PATH.
  pause
  exit /b 1
)

for /f "delims=" %%i in ('git branch --show-current 2^>nul') do set CURRENT_BRANCH=%%i
if /I not "%CURRENT_BRANCH%"=="main" (
  echo You are currently on branch "%CURRENT_BRANCH%".
  echo Switch to `main` before creating a release.
  pause
  exit /b 1
)

git diff --quiet
if errorlevel 1 (
  echo Working tree has unstaged changes.
  echo Commit or stash your work before releasing.
  pause
  exit /b 1
)

git diff --cached --quiet
if errorlevel 1 (
  echo Working tree has staged but uncommitted changes.
  echo Commit or unstage them before releasing.
  pause
  exit /b 1
)

call "%GH_CMD%" auth status >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI is not authenticated.
  echo Run: gh auth login
  pause
  exit /b 1
)

echo Choose version bump:
echo   1. patch
echo   2. minor
echo   3. major
echo   4. custom version
echo.
set /p RELEASE_CHOICE="Select 1-4: "

set RELEASE_TARGET=
if "%RELEASE_CHOICE%"=="1" set RELEASE_TARGET=patch
if "%RELEASE_CHOICE%"=="2" set RELEASE_TARGET=minor
if "%RELEASE_CHOICE%"=="3" set RELEASE_TARGET=major

if "%RELEASE_CHOICE%"=="4" (
  set /p CUSTOM_VERSION="Enter version (example: 1.5.0): "
  if "%CUSTOM_VERSION%"=="" (
    echo No version entered. Aborting.
    pause
    exit /b 1
  )
  set RELEASE_TARGET=%CUSTOM_VERSION%
)

if "%RELEASE_TARGET%"=="" (
  echo Invalid selection. Aborting.
  pause
  exit /b 1
)

echo.
echo Running tests...
npm test
if errorlevel 1 (
  echo Tests failed. Release aborted.
  pause
  exit /b 1
)

echo.
echo Fetching latest refs...
git fetch origin
if errorlevel 1 (
  echo Failed to fetch from origin.
  pause
  exit /b 1
)

echo.
echo Syncing local main with origin/main...
git pull --ff-only origin main
if errorlevel 1 (
  echo Could not fast-forward local main.
  pause
  exit /b 1
)

echo.
echo Creating release commit and tag with npm version %RELEASE_TARGET%...
npm version %RELEASE_TARGET% -m "Release v%%s"
if errorlevel 1 (
  echo npm version failed. Release aborted.
  pause
  exit /b 1
)

for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content package.json | ConvertFrom-Json).version"') do set NEW_VERSION=%%i

echo.
echo Pushing commit and tag...
git push origin main --follow-tags
if errorlevel 1 (
  echo Push failed. Your local commit/tag may need manual attention.
  pause
  exit /b 1
)

echo.
echo Checking GitHub release state for v%NEW_VERSION%...
call "%GH_CMD%" release view v%NEW_VERSION% >nul 2>nul
if errorlevel 1 (
  echo Release tag pushed. GitHub Actions should publish v%NEW_VERSION% shortly.
  echo Watch: https://github.com/brabecmarek-prog/melodown/actions
) else (
  echo GitHub release v%NEW_VERSION% already exists.
  echo View: https://github.com/brabecmarek-prog/melodown/releases/tag/v%NEW_VERSION%
)

echo.
echo ================================================
echo   Release flow completed for v%NEW_VERSION%
echo ================================================
pause
