@echo off
REM Wrapper: keep Chinese filename for convenience; logic lives in ASCII start_dev_launcher.bat
call "%~dp0start_dev_launcher.bat" %*
exit /b %ERRORLEVEL%
