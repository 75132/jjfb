@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

REM 默认端口（与 config.py / .env.example 一致）
set "WS_PORT=8001"
set "ADMIN_PORT=8080"

REM 从 .env 读取端口（若存在）
if exist ".env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
        if /i "%%a"=="WS_PORT" for /f "tokens=* delims= " %%v in ("%%b") do set "WS_PORT=%%v"
        if /i "%%a"=="ADMIN_PORT" for /f "tokens=* delims= " %%v in ("%%b") do set "ADMIN_PORT=%%v"
    )
)

set /a ADMIN_PORT_ALT=ADMIN_PORT+1

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
    echo [错误] 未找到 Python，请先安装并加入 PATH。
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   JJFB WebSocket 服务器
echo ========================================
echo 工作目录: %CD%
echo WebSocket 端口: %WS_PORT%
echo 管理台端口: %ADMIN_PORT% (备用 %ADMIN_PORT_ALT%)
echo.

echo [1/3] 结束旧的 ws_server.py 进程...
for /f "skip=1 tokens=1" %%p in ('wmic process where "CommandLine like '%%ws_server.py%%'" get ProcessId 2^>nul') do (
    echo %%p| findstr /r "^[0-9][0-9]*$" >nul && (
        echo   结束 PID %%p
        taskkill /F /PID %%p >nul 2>&1
    )
)

echo [2/3] 释放端口占用...
call :KillPort %WS_PORT%
call :KillPort %ADMIN_PORT%
call :KillPort %ADMIN_PORT_ALT%

REM 等待端口释放
timeout /t 1 /nobreak >nul

echo [3/3] 启动 ws_server.py ...
echo.
"%PYEXE%" %PYARGS% ws_server.py
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo [错误] 服务器退出，代码: %EXIT_CODE%
    echo.
    pause
)

endlocal & exit /b %EXIT_CODE%

:KillPort
set "TARGET_PORT=%~1"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%TARGET_PORT% " ^| findstr /I "LISTENING"') do (
    echo %%a| findstr /r "^[0-9][0-9]*$" >nul && (
        echo   端口 %TARGET_PORT% - 结束 PID %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)
exit /b 0
