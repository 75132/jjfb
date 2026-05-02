# 压力测试工具安装指南

## 问题：ModuleNotFoundError: No module named 'websockets'

如果遇到此错误，说明当前 Python 环境缺少 `websockets` 模块。

## 解决方案

### 方法1：使用 pip 安装（推荐）

```bash
# 确保使用正确的 Python 环境
python -m pip install websockets

# 或者直接使用 pip
pip install websockets

# 或者安装所有依赖
pip install -r requirements.txt
```

### 方法2：检查 Python 环境

如果系统中有多个 Python 环境，需要确保使用正确的 Python：

```bash
# 检查当前 Python 路径
python --version
where python

# 如果路径不对，使用完整路径
C:\Users\ZYF\AppData\Local\Programs\Python\Python39\python.exe -m pip install websockets
```

### 方法3：使用虚拟环境（推荐用于开发）

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境（Windows）
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 运行测试
python stress_test.py --users 100 --duration 60
```

## 验证安装

安装完成后，验证是否成功：

```bash
python -c "import websockets; print('websockets 安装成功，版本:', websockets.__version__)"
```

如果显示版本号，说明安装成功。

## 常见问题

### Q: 提示 "No module named pip"

A: 说明当前 Python 环境没有 pip。可以：
1. 使用其他 Python 环境（如 Python39）
2. 重新安装 Python 并勾选 "Add Python to PATH"
3. 使用虚拟环境

### Q: 安装后仍然报错

A: 可能是 Python 环境不一致：
1. 检查 `python --version` 和 `pip --version` 是否指向同一个 Python
2. 使用 `python -m pip install websockets` 确保使用正确的 Python
3. 检查 PATH 环境变量，确保优先使用正确的 Python

### Q: 如何确认使用的 Python 环境？

A: 运行以下命令：
```bash
python -c "import sys; print(sys.executable)"
```

这会显示当前使用的 Python 解释器路径。

## 快速修复脚本

如果遇到问题，可以运行以下命令：

```bash
# Windows PowerShell
$pythonPath = (Get-Command python).Source
& $pythonPath -m pip install websockets

# 验证
& $pythonPath -c "import websockets; print('OK')"
```

