@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

set "PYEXE="
set "PYARGS="

where python >nul 2>&1
if not errorlevel 1 set "PYEXE=python"

if not defined PYEXE (
    where py >nul 2>&1
    if not errorlevel 1 set "PYEXE=py"
    if not errorlevel 1 set "PYARGS=-3"
)

if not defined PYEXE (
    echo.
    echo [ERROR] Python 3.9+ not found in PATH.
    echo Install from https://www.python.org/downloads/
    echo Enable "Add python.exe to PATH" during setup.
    echo.
    pause
    exit /b 1
)

echo.
echo JJFB Dev Launcher
echo ==================
echo First run may install Python/npm deps; please wait...
echo Closing this window exits the launcher UI only (services keep running).
echo.

"%PYEXE%" %PYARGS% -m tools.dev_launcher %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
    echo.
    echo [ERROR] Dev launcher exited with code %EXIT_CODE%
    echo See [bootstrap] messages above. Manual fix:
    echo   %PYEXE% %PYARGS% -m pip install -r tools\dev_launcher\requirements.txt
    echo   cd Juben
    echo   npm install
    echo.
    pause
    exit /b %EXIT_CODE%
)

endlocal
exit /b 0
