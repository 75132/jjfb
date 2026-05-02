## Meta 备份/还原小工具（assets/.meta）

### 功能
- **一键备份**：扫描 `assets/` 下所有 `.meta`，按原目录结构备份到时间戳目录
- **记录时间**：每次备份生成 `manifest.json`（包含创建时间、文件清单）
- **单个还原**：从某次备份里选择一个 `.meta` 覆盖还原
- **全部还原**：从某次备份里把所有 `.meta` 覆盖还原

### 备份目录
默认生成在项目根目录下：

- `.meta_backups/<时间戳>/assets/***.meta`
- `.meta_backups/<时间戳>/manifest.json`

### 运行方式（Windows）
在项目根目录执行：

```bash
python tools/meta_backup_tool.py
```

如果脚本找不到 `assets/`，也可以手动传入仓库根目录：

```bash
python tools/meta_backup_tool.py E:\jjfbol-cocos\jjfb
```

### 注意
- 还原操作会**覆盖**当前 `.meta`，界面里会弹出确认框。
- 本工具只处理 `assets/` 下的 `.meta`（不会动其他目录）。

