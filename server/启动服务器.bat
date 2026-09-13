@echo off
REM 中文入口：逻辑在 start_ws_server.bat
call "%~dp0start_ws_server.bat" %*
exit /b %ERRORLEVEL%
