@echo off
echo ================================================
echo   Melodown Release Tool
echo ================================================
echo.
set /p NEW_VERSION="Enter new version (e.g. 1.4.1): "
if "%NEW_VERSION%"=="" (echo No version entered. Aborting. & pause & exit /b 1)

echo Updating version to %NEW_VERSION%...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$f='package.json'; $c=[IO.File]::ReadAllText($f); $c=$c -replace '\"version\": \"[^\"]+\"', '\"version\": \"%NEW_VERSION%\"'; [IO.File]::WriteAllText($f,$c)"

echo Verifying...
type package.json | findstr version

echo.
echo Committing and pushing to GitHub...
git add .
git commit --allow-empty -m "Release v%NEW_VERSION%"
git tag v%NEW_VERSION%
if %errorlevel% neq 0 (
    echo Tag already exists! Delete it with: git tag -d v%NEW_VERSION%
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