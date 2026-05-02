# slot_index 字段实施说明

## 📋 实施内容

已按照推荐方案实施，保持独立集合结构，添加 `slot_index` 字段优化编号管理。

## ✅ 已完成的修改

### 1. **工具函数** (`server/handlers/utils.py`)
- ✅ `allocate_slot_index(user_id, character_id)`: 为新的机甲分配 slot_index（1-10）
- ✅ `clear_slot_index(pet_id)`: 清空机甲的 slot_index（放生时调用）

### 2. **创建机甲逻辑** (`server/ws_server.py`, `server/handlers/character_handler.py`)
- ✅ 创建机甲时自动分配 `slot_index`（1-10）
- ✅ 如果编号已满（10个），不分配编号（向后兼容）

### 3. **查询优化** (`server/handlers/robot_handler.py`)
- ✅ `handle_get_robot_pets`: 按 `slot_index` 排序返回
- ✅ 返回数据中包含 `slot_index` 字段

### 4. **出战队伍逻辑** (`server/handlers/robot_handler.py`)
- ✅ `handle_get_battle_team`: 如果没有手动设置，自动按 `slot_index` 选择前2个
- ✅ `handle_set_battle_team`: 支持 `auto_battle_team` 参数，自动按 `slot_index` 选择
- ✅ 设置出战队伍后，更新机甲的 `is_in_battle_team` 和 `battle_team_position` 字段

### 5. **索引优化** (`server/ws_server.py`)
- ✅ 添加复合索引：`[('user_id', 1), ('character_id', 1), ('slot_index', 1)]`
- ✅ 优化按 `slot_index` 排序的查询性能

### 6. **数据迁移脚本** (`server/tools/migrate_slot_index.py`)
- ✅ 为现有机甲分配 `slot_index`（按创建时间，前10个分配编号1-10）

## 📝 新增字段说明

### `slot_index: int` (1-10, 可空)
- **用途**：机甲编号，用于排序和自动出战
- **分配规则**：入伍时自动分配最小未使用的编号（1-10）
- **回收规则**：不回收（放生时清空，但不回收，避免并发问题）
- **默认值**：`None`（表示未分配）

### `is_in_battle_team: bool` (可选)
- **用途**：标记机甲是否在出战队伍中
- **更新时机**：设置出战队伍时自动更新

### `battle_team_position: int` (可选)
- **用途**：出战位置（1=主战，2=副战，0=未出战）
- **更新时机**：设置出战队伍时自动更新

## 🎯 自动出战逻辑

### 获取出战队伍时
```python
# 如果没有手动设置出战队伍，自动按 slot_index 选择前2个
if not battle_team:
    auto_pets = find(
        {'user_id': X, 'character_id': Y, 'slot_index': {'$exists': True, '$ne': None}}
    ).sort('slot_index', 1).limit(2)
    battle_team = [pet['_id'] for pet in auto_pets]
```

### 设置出战队伍时
```python
# 支持 auto_battle_team 参数
if auto_battle_team and not battle_team:
    # 自动按 slot_index 选择前2个
```

## 📊 编号管理策略

### 入伍时
1. 查询该角色下所有已分配的 `slot_index`
2. 找到最小未使用的编号（1-10）
3. 分配给新机甲
4. 如果都满了，不分配编号（向后兼容）

### 放生时
1. 删除机甲（完全删除）
2. 编号不回收（简单可靠，避免并发问题）

### 更新时
- `slot_index` 保持不变（除非手动修改）

## 🚀 使用步骤

### 1. 运行数据迁移脚本
```bash
cd server/tools
python migrate_slot_index.py
```

### 2. 重启服务器
- 新的创建逻辑会自动分配编号
- 查询会自动按 `slot_index` 排序

### 3. 客户端更新（可选）
- 客户端可以按 `slot_index` 排序显示
- 支持自动出战功能

## ⚠️ 注意事项

1. **向后兼容**：现有机甲如果没有 `slot_index`，仍然可以正常使用
2. **编号限制**：每个角色最多10个机甲有编号（1-10）
3. **不回收编号**：放生后编号不回收，避免并发问题
4. **自动出战**：如果没有手动设置，自动按 `slot_index` 选择前2个

## 🔍 性能优化

- ✅ 复合索引：`[('user_id', 1), ('character_id', 1), ('slot_index', 1)]`
- ✅ 查询时按 `slot_index` 排序，确保顺序统一
- ✅ 自动出战逻辑在服务器端实现，避免客户端竞态条件

## 📈 预期效果

1. **查询性能**：5-10ms（已有索引，性能已很好）
2. **顺序统一**：按 `slot_index` 排序，确保每次查询顺序一致
3. **自动出战**：按编号自动选择，无需手动设置
4. **可靠性**：编号不回收，避免并发问题
