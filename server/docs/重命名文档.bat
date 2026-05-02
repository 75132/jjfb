@echo off
chcp 65001 >nul
echo 正在重命名文档文件...
echo.

cd /d "%~dp0"

if exist "改进计划-基于PomeloServer架构对齐.md" (
    ren "改进计划-基于PomeloServer架构对齐.md" "架构改进计划.md"
    echo [✓] 改进计划-基于PomeloServer架构对齐.md -^> 架构改进计划.md
) else (
    echo [!] 文件不存在: 改进计划-基于PomeloServer架构对齐.md
)

if exist "消息接口定义-完整版.md" (
    ren "消息接口定义-完整版.md" "消息接口定义.md"
    echo [✓] 消息接口定义-完整版.md -^> 消息接口定义.md
) else (
    echo [!] 文件不存在: 消息接口定义-完整版.md
)

if exist "物品效果系统文档.md" (
    ren "物品效果系统文档.md" "物品效果系统.md"
    echo [✓] 物品效果系统文档.md -^> 物品效果系统.md
) else (
    echo [!] 文件不存在: 物品效果系统文档.md
)

if exist "升星概率计算说明.md" (
    ren "升星概率计算说明.md" "升星系统.md"
    echo [✓] 升星概率计算说明.md -^> 升星系统.md
) else (
    echo [!] 文件不存在: 升星概率计算说明.md
)

if exist "进化系统Plan.md" (
    ren "进化系统Plan.md" "进化系统计划.md"
    echo [✓] 进化系统Plan.md -^> 进化系统计划.md
) else (
    echo [!] 文件不存在: 进化系统Plan.md
)

if exist "equipment_system.md" (
    ren "equipment_system.md" "装备系统设计.md"
    echo [✓] equipment_system.md -^> 装备系统设计.md
) else (
    echo [!] 文件不存在: equipment_system.md
)

if exist "优化清单-全面优化指南.md" (
    ren "优化清单-全面优化指南.md" "优化清单-历史参考.md"
    echo [✓] 优化清单-全面优化指南.md -^> 优化清单-历史参考.md
) else (
    echo [!] 文件不存在: 优化清单-全面优化指南.md
)

echo.
echo 重命名完成！
pause


