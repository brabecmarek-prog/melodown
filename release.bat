@echo off
echo ================================================
echo   Melodown Release Tool
echo ================================================
echo.
set /p NEW_VERSION="Enter new version (e.g. 1.2.0): "
if "%NEW_VERSION%"=="" (echo No version entered. Aborting. & pause & exit /b 1)

echo Updating version to %NEW_VERSION%...
powershell -Command "(Get-Content package.json) -replace '\"version\": \"[^\"]*\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content package.json"

echo Pushing to GitHub...
git add .
git commit -m "Release v%NEW_VERSION%"
git tag v%NEW_VERSION%
git push origin main
git push origin v%NEW_VERSION%

echo.
echo ================================================
echo   Done! GitHub Actions is now building:
echo     - Windows ZIP
echo     - macOS ZIP
echo.
echo   Watch the build progress at:
echo   https://github.com/brabecmarek-prog/melodown/actions
echo.
echo   When done (~5 min), both ZIPs will appear at:
echo   https://github.com/brabecmarek-prog/melodown/releases
echo ================================================
pause
