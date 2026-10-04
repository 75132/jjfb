@echo off
chcp 65001 >nul
setlocal

REM ============================================================
REM  PVP 真人模拟端 · 一键启动
REM  1) 起一个本地静态服务（端口 8899）
REM  2) 用默认浏览器打开模拟端页面
REM  注意：WebSocket 直连游戏服务端 ws://127.0.0.1:8001
REM ============================================================

set PORT=8899
set DIR=%~dp0

echo.
echo  [PVP 模拟端] 目录: %DIR%
echo  [PVP 模拟端] 静态服务端口: %PORT%
echo.

REM 优先用 WorkBuddy 托管 Python，其次系统 Python
set PY=C:\Users\Administrator\.workbuddy\binaries\python\versions\3.13.12\python.exe
if not exist "%PY%" set PY=C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PY%" set PY=python

echo  [PVP 模拟端] 使用 Python: %PY%
start "" "%PY%" -m http.server %PORT% --directory "%DIR%"

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/index.html"

echo.
echo  已启动。若不自动打开，手动访问: http://127.0.0.1:%PORT%/index.html
echo  关闭本窗口即可停止静态服务（若未随之关闭，可手动结束 python 进程）。
echo.
pause
endlocal
