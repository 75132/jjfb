[MODE: 计划]
实施计划（按文件/模块分组，后附检查清单）：
物品配置
更新 server/data/Items.json 与 assets/resources/json/Items.json：为 ID 6/7 填充 effect（如 PET_EVOLVE:2 / PET_EVOLVE:3），补充 effecttext 描述；确保 UsageTarget 仍为 Pet。
服务器效果扩展
在 server/handlers/item_effect.py 注册新效果 PET_EVOLVE，解析目标形态参数 2/3。
逻辑：加载宠物（校验 user/character/pet_id），校验禁用 RobotID 列表，校验等级（L2≥25，L3≥45），校验当前 Form（1->2，2->3，>3 拒绝），校验 AniID 映射到下一形态。
基础属性获取：从 robotpet 备份/基础数据推导目标等级属性，调用 RobotUpgradeManager 按 Level=25/45 计算基础值；增量 = 目标等级基础值 * 系数（L2:0.2，L3:0.3），加到当前对应字段（含 HP/MP/战斗属性及 Max/Current 同步）。
更新字段：Form、AniID 切 L2/L3，必要时写回 RobotName（若名称含形态可按规则改，不改则原样），属性数值写回，Level/EXP 不变，保存并返回效果结果；失败不消耗物品。
形态上限：Form≥3 直接失败。
重生/还原修正：在已有 PET_RESET / PET_REBORN 末尾强制 Form=1、AniID=L1（或基础形态）、同步属性为初级，确保备份初级。
服务器路由与响应
bag_handler.handle_bag_use_item 无需改动消耗逻辑（已有失败不消耗），但可在成功时附带进化后的宠物信息字段（Form/AniID/属性）供客户端刷新。
若已有宠物广播机制，可复用；若无，先返回给客户端由其主动刷新列表。
客户端使用流程
BagItem.ts 在 useItemResponse 中：若 effect_result 包含进化成功，触发进化动画（调用新函数），然后请求刷新背包与机甲列表（已有逻辑）。
进化动画控制：新增脚本（或扩展 Game 控制脚本）管理 RobotJinHua 节点，默认隐藏；方法 playEvolution(oldSpriteFrame, newSpriteFrame, onDone) 使用 tween：快速闪烁切换 old/new，叠加 position/rotation/scale 抖动逐渐减弱，定格 new，2 秒后关闭。
资源获取：根据 AniID 组装 SpriteFrame 名（AniID + '-0'），从 cc.SpriteAtlas 或资源加载获得；old 用当前 AniID，new 用目标形态 AniID。
形态与 AniID 映射
规则：AniID 前缀相同，形态切换为 L2/L3（如当前 AniID=L1-x，下一为 L2-x；若已是 L2-x，下一为 L3-x）；在服务器生成新 AniID 时遵循此规则，客户端同样按规则取 SpriteFrame 名。
禁用与失败反馈
客户端收到失败仅日志（按需求），不播放动画，不刷新（可保留背包刷新已有流程）。
测试用例
等级不足使用中/高进化晶体：应失败且不消耗。
禁用 RobotID 使用：失败不消耗。
Form=1 + 等级25，使用中级：成功，Form=2，AniID→L2，属性增量符合公式。
Form=2 + 等级45，使用高级：成功，Form=3，AniID→L3，属性增量符合公式。
Form=3 再用：失败不消耗。
重生/还原后形态强制回 L1，AniID=L1，属性为初级。
客户端动画：成功后面板显示并关闭；失败无动画。
实施检查清单（顺序）：
1) 更新 server/data/Items.json 与 assets/resources/json/Items.json 中 ID 6/7 的 effect/effecttext。
2) 在 item_effect.py 注册 PET_EVOLVE 处理器，完成校验与属性/形态更新逻辑，返回结果。
3) 调整 PET_RESET / PET_REBORN 结尾逻辑，强制 Form/AniID/属性回初级。
4) 服务器返回进化后宠物信息（保持 bag_use_item 响应兼容）。
5) 客户端新增/扩展进化动画控制（RobotJinHua 脚本），提供 play 接口。
6) BagItem.ts onUseItemResponse 中接入进化成功动画触发，使用 AniID 映射取 SpriteFrame（old/new）。
7) 验证禁用ID、等级不足、形态上限、重生/还原后形态，跑通测试用例。