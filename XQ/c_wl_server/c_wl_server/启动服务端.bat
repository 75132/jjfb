@echo off
chcp 65001 >nul
title XunQin Server
cd /d "%~dp0"
echo ============================================
echo   Starting XunQin Game Server (port 9668)
echo   Project dir: %cd%
echo ============================================
"C:\xunqin_server\jdk8u504-b01\bin\java.exe" -jar target\c_wl_server.jar
pause
