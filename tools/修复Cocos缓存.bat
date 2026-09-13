@echo off
chcp 65001 >nul
set "SCRIPT=%~dp0fix_cocos_cache.ps1"
set "LOG=%~dp0..\temp\cocos_fix.log"
if not exist "%~dp0..\temp" mkdir "%~dp0..\temp" >nul 2>&1
echo 正在请求管理员权限修复 Cocos Creator 缓存...
echo 请在 UAC 弹窗中点击“是”。
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=New-Object -ComObject Shell.Application; $s.ShellExecute('powershell.exe','-NoProfile -ExecutionPolicy Bypass -File \"\"%SCRIPT%\"\"','','runas',1)"
echo 等待修复脚本执行...
timeout /t 12 /nobreak >nul
if exist "%LOG%" (
  echo.
  echo ===== 修复日志 =====
  type "%LOG%"
) else (
  echo 未检测到修复日志。若 UAC 被拒绝，请右键“以管理员身份运行”本脚本。
)
echo.
pause
