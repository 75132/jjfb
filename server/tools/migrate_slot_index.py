#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据迁移脚本：为现有机甲分配 slot_index（1-10）

使用方法：
    python migrate_slot_index.py

说明：
    - 为每个角色的现有机甲按创建时间分配 slot_index（1-10）
    - 如果机甲数量超过10个，只给前10个分配编号
    - 编号不回收，简单可靠
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

# MongoDB 连接配置（与 ws_server.py 保持一致）
MONGO_URL = "mongodb://jifbol:jifbol13579@8.140.236.16:27017/?authSource=admin&authMechanism=SCRAM-SHA-256"
DB_NAME = "jjfb"
COLLECTION_NAME = "RobotPet"

def migrate_slot_index():
    """为现有机甲分配 slot_index"""
    print("🚀 开始迁移 slot_index...")
    
    try:
        # 连接 MongoDB
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        robotpet_col = db[COLLECTION_NAME]
        
        # 统计信息
        total_migrated = 0
        total_skipped = 0
        total_errors = 0
        
        # 按 user_id 和 character_id 分组处理
        # 使用聚合管道获取所有唯一的 (user_id, character_id) 组合
        pipeline = [
            {
                '$group': {
                    '_id': {
                        'user_id': '$user_id',
                        'character_id': '$character_id'
                    }
                }
            }
        ]
        
        groups = list(robotpet_col.aggregate(pipeline))
        print(f"📊 找到 {len(groups)} 个角色需要处理")
        
        for group in groups:
            user_id = group['_id']['user_id']
            character_id = group['_id'].get('character_id')
            
            if not user_id or not character_id:
                continue
            
            try:
                # 查询该角色的所有机甲，按创建时间排序（最早的优先分配编号）
                pets = list(robotpet_col.find(
                    {
                        'user_id': user_id,
                        'character_id': character_id
                    }
                ).sort('created_at', 1).limit(10))  # 最多10个
                
                if not pets:
                    continue
                
                # 为前10个机甲分配编号（1-10）
                for idx, pet in enumerate(pets):
                    slot_index = idx + 1  # 1-10
                    pet_id = pet['_id']
                    
                    # 检查是否已有编号
                    if pet.get('slot_index') is not None:
                        total_skipped += 1
                        continue
                    
                    # 分配编号
                    result = robotpet_col.update_one(
                        {'_id': pet_id},
                        {'$set': {'slot_index': slot_index}}
                    )
                    
                    if result.modified_count > 0:
                        total_migrated += 1
                        print(f"✅ 机甲 {pet.get('RobotName', '未知')} (pet_id: {pet_id}) 分配编号: {slot_index}")
                    else:
                        total_errors += 1
                        print(f"⚠️ 机甲 {pet.get('RobotName', '未知')} (pet_id: {pet_id}) 分配编号失败")
                
            except Exception as e:
                print(f"❌ 处理角色 {character_id} 失败: {e}")
                total_errors += 1
                continue
        
        print(f"\n📊 迁移完成:")
        print(f"  ✅ 成功分配: {total_migrated} 个")
        print(f"  ⏭️  已跳过: {total_skipped} 个（已有编号）")
        print(f"  ❌ 失败: {total_errors} 个")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("机甲 slot_index 数据迁移脚本")
    print("=" * 60)
    print()
    
    # 确认执行
    confirm = input("⚠️  此操作将为现有机甲分配编号，是否继续？(yes/no): ")
    if confirm.lower() != 'yes':
        print("❌ 已取消")
        sys.exit(0)
    
    print()
    success = migrate_slot_index()
    
    if success:
        print("\n✅ 迁移完成！")
        sys.exit(0)
    else:
        print("\n❌ 迁移失败！")
        sys.exit(1)
