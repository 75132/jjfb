@echo off
chcp 65001 >nul
title Tileset Studio
cd /d "%~dp0"

set "PY=C:\Users\Administrator\.workbuddy\binaries\python\versions\3.13.12\python.exe"
if not exist "%PY%" set "PY=python"

"%PY%" server.py
echo.
echo [server stopped] press any key to close...
pause >nul
