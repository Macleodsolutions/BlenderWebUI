@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo ========================================
echo Building Blender WebView2 Overlay ^& Addon Bundle
echo ========================================

set "ROOT=%~dp0"
set "UI_DIR=%ROOT%UIFrontend"
set "PY_DIR=%ROOT%PythonScript"
set "CPP_EXE=%ROOT%WebView2Control\x64\Release\WebView2Control.exe"
set "STAGING_ROOT=%TEMP%\RemoteBlenderServer_build_!RANDOM!"
set "STAGING=%STAGING_ROOT%\RemoteBlenderServer"
set "ZIP_PATH=%ROOT%addon.zip"

echo.
echo [1/5] Building Vite Frontend...
echo ========================================

pushd "%UI_DIR%" >nul 2>&1
if not exist "node_modules" (
    echo Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install npm dependencies
        popd
        exit /b 1
    )
)

echo Building Vite project...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build Vite project
    popd
    exit /b 1
)
popd >nul 2>&1

echo ✓ Vite frontend build completed successfully

echo.
echo [2/5] Building C++ WebView2 Application...
echo ========================================
pushd "%ROOT%WebView2Control" >nul 2>&1

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" (
    echo ERROR: vswhere.exe not found at "%VSWHERE%".
    echo Install Visual Studio Installer or ensure vswhere is present.
    popd
    exit /b 1
)
set "VS_PATH="
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.Component.MSBuild Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
    set "VS_PATH=%%i"
)
if not defined VS_PATH (
    echo ERROR: Visual Studio with MSBuild and VC Tools not found.
    echo Install the "Desktop development with C++" workload in Visual Studio or VS Build Tools.
    popd
    exit /b 1
)
set "MSBUILD_CMD=%VS_PATH%\MSBuild\Current\Bin\MSBuild.exe"

:build_cpp
echo Restoring packages with MSBuild...
"%MSBUILD_CMD%" "WebView2Control.sln" -t:Restore -p:RestorePackagesConfig=true /m
if errorlevel 1 (
    echo ERROR: Failed to restore packages via MSBuild
    popd
    exit /b 1
)
echo Building C++ project...
"%MSBUILD_CMD%" "WebView2Control.sln" /p:Configuration=Release /p:Platform=x64 /m
if errorlevel 1 (
    echo ERROR: Failed to build C++ project
    popd
    exit /b 1
)
popd >nul 2>&1

echo ✓ C++ WebView2 application build completed successfully

echo.
echo [3/5] Preparing addon staging folder...
echo ========================================

if exist "%STAGING_ROOT%" rmdir /s /q "%STAGING_ROOT%"
mkdir "%STAGING%" 2>nul
if errorlevel 1 (
    echo ERROR: Failed to create staging directory: %STAGING%
    exit /b 1
)

echo Copying Python addon file...
if not exist "%PY_DIR%\install_in_blender.py" (
    echo ERROR: Python addon file not found: %PY_DIR%\install_in_blender.py
    exit /b 1
)
copy /y "%PY_DIR%\install_in_blender.py" "%STAGING%\__init__.py" >nul
if errorlevel 1 (
    echo ERROR: Failed to copy Python addon file
    exit /b 1
)

echo Copying web UI assets...
if exist "%UI_DIR%\dist" (
    xcopy /e /i /y "%UI_DIR%\dist\*" "%STAGING%\web_ui\" >nul
) else (
    echo WARNING: UI build output not found at %UI_DIR%\dist. Skipping web assets.
)

echo Copying UI scripts...
if exist "%UI_DIR%\scripts" (
    xcopy /e /i /y "%UI_DIR%\scripts\*" "%STAGING%\web_ui\scripts\" >nul
) else (
    echo WARNING: UI scripts folder not found at %UI_DIR%\scripts. Skipping scripts copy.
)

echo Copying WebView2 executable if present...
if exist "%CPP_EXE%" (
    mkdir "%STAGING%\bin" 2>nul
    copy /y "%CPP_EXE%" "%STAGING%\bin\" >nul
    set "LOADER_SRC=%ROOT%WebView2Control\x64\Release\WebView2Loader.dll"
    if exist "!LOADER_SRC!" (
        copy /y "!LOADER_SRC!" "%STAGING%\bin\" >nul
        echo Copied WebView2Loader.dll from: !LOADER_SRC!
    ) else (
        echo ERROR: WebView2Loader.dll not found at !LOADER_SRC!.
        echo Aborting build: required runtime DLL missing from build output.
        exit /b 1
    )
) else (
    echo ERROR: WebView2Control.exe not found at %CPP_EXE%.
    echo Aborting build: application binary missing.
    exit /b 1
)

echo.
echo Creating blender_manifest.toml...
(
    echo schema_version = "1.0.0"
    echo id = "remote_blender_server"
    echo version = "1.1.0"
    echo name = "WebView Panel Tracker"
    echo tagline = "WebView overlay and tools for Blender"
    echo maintainer = "William Macleod"
    echo type = "add-on"
    echo blender_version_min = "4.5.1"
    echo license = ["SPDX:GPL-3.0-or-later"]
    echo platforms = ["windows-x64"]
) > "%STAGING%\blender_manifest.toml"
if not exist "%STAGING%\blender_manifest.toml" (
    echo ERROR: Failed to write blender_manifest.toml
    exit /b 1
)

echo.
echo [4/5] Creating Blender Addon ZIP...
echo ========================================

if exist "%ZIP_PATH%" del /q "%ZIP_PATH%" >nul 2>&1

powershell -NoLogo -NoProfile -Command ^
  "Compress-Archive -Path '%STAGING%' -DestinationPath '%ZIP_PATH%' -Force" 
if errorlevel 1 (
    echo ERROR: Failed to create addon ZIP
    exit /b 1
)

if exist "%STAGING_ROOT%" rmdir /s /q "%STAGING_ROOT%"

echo.
echo [5/5] Build Summary
echo ========================================
echo ✓ Vite Frontend: Built successfully
echo ✓ C++ Application: Built successfully
echo ✓ Addon Bundle: Created successfully
echo.
echo Build output locations:
echo   Frontend: %UI_DIR%\dist\
echo   C++ App:  %ROOT%WebView2Control\x64\Release\
echo   Addon ZIP: %ZIP_PATH%
echo.
echo ========================================
echo BUILD COMPLETED SUCCESSFULLY!
echo ========================================

endlocal
exit /b 0
