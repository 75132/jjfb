# 压力测试快速开始

## 已修复的问题

✅ **认证问题**：现在所有请求都会自动携带 token  
✅ **消息处理**：正确处理心跳和推送消息  
✅ **响应匹配**：支持多种响应类型格式  
✅ **角色创建**：如果没有角色会自动创建  

## 快速测试

### 1. 确保服务器正在运行

```bash
# 在 server 目录下启动服务器
python ws_server.py
```

### 2. 运行压力测试

**Windows:**
```bash
cd server/tools
run_stress_test.bat
```

**命令行:**
```bash
cd server/tools

# 小规模测试（推荐先运行这个）
python stress_test.py --users 50 --duration 30

# 中等规模
python stress_test.py --users 100 --duration 60

# 大规模（测试500并发）
python stress_test.py --users 500 --duration 120
```

## 测试流程

每个测试用户会：
1. ✅ 连接 WebSocket
2. ✅ 注册/登录（账号: `test_user_XXXX`）
3. ✅ 获取角色列表
4. ✅ 选择或创建角色
5. ✅ 执行游戏操作（随机）：
   - `get_character_info` (30%)
   - `get_robot_pets` (20%)
   - `bag_get` (20%)
   - `get_player` (15%)
   - `get_friend_list` (10%)
   - `get_robot_pet_info` (5%)

## 预期结果

### 良好性能指标
- ✅ 连接成功率 > 99%
- ✅ 登录成功率 > 95%
- ✅ 请求成功率 > 99%
- ✅ 平均响应时间 < 100ms
- ✅ P95 响应时间 < 200ms

### 如果看到认证错误

如果仍然看到 "路由需要认证,但 current_user_id 为空" 的警告：

1. **检查 token 是否正确保存**
   - 查看测试脚本输出，确认登录成功
   
2. **检查服务器日志**
   - 确认 token 验证逻辑正常

3. **尝试单个用户测试**
   ```bash
   python stress_test.py --users 1 --duration 10
   ```

## 常见问题

### Q: 测试账号会创建很多吗？
A: 是的，每个测试用户会创建一个账号（格式: `test_user_XXXX`）。如需清理，可以手动删除或编写清理脚本。

### Q: 如何查看详细日志？
A: 测试脚本默认只显示错误（前3个）。如需更多信息，可以修改代码中的错误打印逻辑。

### Q: 测试时服务器很卡？
A: 这是正常的，说明测试有效果。可以：
- 减少并发用户数
- 缩短测试时长
- 检查服务器资源使用情况

## 下一步

测试完成后，根据结果：
1. ✅ 如果性能良好 → 可以支持500并发
2. ⚠️ 如果性能不佳 → 查看瓶颈（数据库、网络、CPU等）
3. 📊 分析统计报告 → 找出慢查询和错误

