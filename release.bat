@echo off
echo ================================================
echo   Melodown Release Tool
echo ================================================
echo.
set /p NEW_VERSION="Enter new version (e.g. 1.3.0): "
if "%NEW_VERSION%"=="" (echo No version entered. Aborting. & pause & exit /b 1)

echo Updating version to %NEW_VERSION%...
python -c "import json,sys; d=json.load(open('package.json')); d['version']='%NEW_VERSION%'; json.dump(d,open('package.json','w'),indent=2)"

echo Verifying...
python -c "import json; print('Version is now:', json.load(open('package.json'))['version'])"

echo.
echo Committing and pushing to GitHub...
git add package.json
git commit -m "Release v%NEW_VERSION%"
git tag v%NEW_VERSION%
git push origin main
git push origin v%NEW_VERSION%

echo.
echo ================================================
echo   Done! GitHub Actions is now building.
echo   Watch: https://github.com/brabecmarek-prog/melodown/actions
echo ================================================
pause
