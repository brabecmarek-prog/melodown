@echo off
echo ================================================
echo   Melodown Release Tool
echo ================================================
echo.
set /p NEW_VERSION="Enter new version (e.g. 1.3.0): "
if "%NEW_VERSION%"=="" (echo No version entered. Aborting. & pause & exit /b 1)

echo Updating version to %NEW_VERSION%...
echo $content = Get-Content 'package.json' -Raw > %TEMP%\update_version.ps1
echo $content = $content -replace '"version": "[^"]*"', '"version": "%NEW_VERSION%"' >> %TEMP%\update_version.ps1
echo $content ^| Set-Content 'package.json' -NoNewline >> %TEMP%\update_version.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File %TEMP%\update_version.ps1

echo Verifying...
for /f "tokens=2 delims=:, " %%v in ('findstr "version" package.json') do set VER=%%v
echo Version is now: %VER:"=%

echo.
echo Committing and pushing to GitHub...
git add .
git status
git commit -m "Release v%NEW_VERSION%"
if %errorlevel% neq 0 (
    echo Nothing new to commit - checking if tag exists...
)
git tag v%NEW_VERSION%
if %errorlevel% neq 0 (
    echo Tag already exists! Use a different version number.
    pause
    exit /b 1
)
git push origin main
git push origin v%NEW_VERSION%

echo.
echo ================================================
echo   Done! GitHub Actions is now building.
echo   Watch: https://github.com/brabecmarek-prog/melodown/actions
echo ================================================
pause
