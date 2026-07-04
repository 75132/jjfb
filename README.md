# jjfb
机甲风暴

## 开发控制台

基于 **CustomTkinter** 的本地开发控制台：左侧六页导航（总览 / 服务 / 文件夹 / 工具 / 端口 / 设置），底部固定日志坞，管理 Juben 与 ws_server。

```bash
# 仓库根目录（首次会自动 pip install customtkinter）
pip install -r tools/dev_launcher/requirements.txt
python -m tools.dev_launcher
```

Windows 也可双击 [`tools/启动开发控制台.bat`](tools/启动开发控制台.bat)。

配置见 [`tools/dev_launcher_config.json`](tools/dev_launcher_config.json)：`auto_start`、`theme`（dark/system）、`log_panel_height`、`nav_page` 等。

```bash
python -m unittest discover -s tools/dev_launcher/tests -v
```
