@echo off
REM Windows 快速启动压力测试脚本

echo ========================================
echo 游戏服务器压力测试工具
echo ========================================
echo.

REM 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.7+
    pause
    exit /b 1
)

REM 检查依赖
echo 检查依赖...
python -c "import websockets" >nul 2>&1
if errorlevel 1 (
    echo [提示] 正在安装依赖库...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [错误] 依赖安装失败，请手动运行: pip install -r requirements.txt
        pause
        exit /b 1
    )
)

echo.
echo 请选择测试场景:
echo 1. 小规模测试 (50用户, 30秒)
echo 2. 中等规模测试 (100用户, 60秒)
echo 3. 大规模测试 (200用户, 60秒)
echo 4. 极限测试 (500用户, 120秒)
echo 5. 自定义测试
echo.
set /p choice=请输入选项 (1-5): 

if "%choice%"=="1" (
    python stress_test.py --users 50 --duration 30
) else if "%choice%"=="2" (
    python stress_test.py --users 100 --duration 60
) else if "%choice%"=="3" (
    python stress_test.py --users 200 --duration 60
) else if "%choice%"=="4" (
    python stress_test.py --users 500 --duration 120
) else if "%choice%"=="5" (
    set /p users=请输入并发用户数: 
    set /p duration=请输入测试时长(秒): 
    python stress_test.py --users %users% --duration %duration%
) else (
    echo [错误] 无效选项
    pause
    exit /b 1
)

pause

