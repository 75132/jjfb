#!/bin/bash
# Linux/Mac 快速启动压力测试脚本

echo "========================================"
echo "游戏服务器压力测试工具"
echo "========================================"
echo ""

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python3，请先安装 Python 3.7+"
    exit 1
fi

# 检查依赖
echo "检查依赖..."
python3 -c "import websockets" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "[提示] 正在安装 websockets 库..."
    pip3 install websockets
fi

echo ""
echo "请选择测试场景:"
echo "1. 小规模测试 (50用户, 30秒)"
echo "2. 中等规模测试 (100用户, 60秒)"
echo "3. 大规模测试 (200用户, 60秒)"
echo "4. 极限测试 (500用户, 120秒)"
echo "5. 自定义测试"
echo ""
read -p "请输入选项 (1-5): " choice

case $choice in
    1)
        python3 stress_test.py --users 50 --duration 30
        ;;
    2)
        python3 stress_test.py --users 100 --duration 60
        ;;
    3)
        python3 stress_test.py --users 200 --duration 60
        ;;
    4)
        python3 stress_test.py --users 500 --duration 120
        ;;
    5)
        read -p "请输入并发用户数: " users
        read -p "请输入测试时长(秒): " duration
        python3 stress_test.py --users $users --duration $duration
        ;;
    *)
        echo "[错误] 无效选项"
        exit 1
        ;;
esac

