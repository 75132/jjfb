"""
批量修改 Items.json 工具脚本
用于批量更新物品的效果配置
"""
import json
import os
import sys
from typing import List, Dict, Optional

# 添加父目录到路径，以便导入
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

def find_items_json():
    """查找 Items.json 文件"""
    base_dir = os.path.dirname(os.path.dirname(__file__))  # server
    possible_paths = [
        os.path.join(base_dir, 'data', 'Items.json'),
        os.path.join(base_dir, 'handlers', 'json', 'Items.json'),
        os.path.join(base_dir, 'assets', 'resources', 'json', 'Items.json'),
        'assets/resources/json/Items.json',
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    return None

def load_items():
    """加载 Items.json"""
    path = find_items_json()
    if not path:
        print('❌ 未找到 Items.json 文件')
        return None, None
    
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f), path

def save_items(items: List[Dict], path: str):
    """保存 Items.json"""
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print(f'✅ 已保存到: {path}')

def update_items_by_id(item_ids: List[int], effect: str, backup: bool = True):
    """
    根据物品ID批量更新效果
    
    Args:
        item_ids: 物品ID列表
        effect: 效果字符串
        backup: 是否备份原文件
    """
    items, path = load_items()
    if not items:
        return
    
    if backup:
        backup_path = path + '.backup'
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f'📦 已备份到: {backup_path}')
    
    updated_count = 0
    for item in items:
        if item.get('id') in item_ids:
            old_effect = item.get('effect', '')
            item['effect'] = effect
            updated_count += 1
            print(f'  ✅ ID {item["id"]} ({item.get("name", "")}): "{old_effect}" -> "{effect}"')
    
    if updated_count > 0:
        save_items(items, path)
        print(f'✅ 共更新 {updated_count} 个物品')
    else:
        print('⚠️ 没有找到匹配的物品')

def update_items_by_name(item_names: List[str], effect: str, backup: bool = True):
    """
    根据物品名称批量更新效果
    
    Args:
        item_names: 物品名称列表
        effect: 效果字符串
        backup: 是否备份原文件
    """
    items, path = load_items()
    if not items:
        return
    
    if backup:
        backup_path = path + '.backup'
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f'📦 已备份到: {backup_path}')
    
    updated_count = 0
    for item in items:
        if item.get('name') in item_names:
            old_effect = item.get('effect', '')
            item['effect'] = effect
            updated_count += 1
            print(f'  ✅ {item["name"]} (ID: {item.get("id", "")}): "{old_effect}" -> "{effect}"')
    
    if updated_count > 0:
        save_items(items, path)
        print(f'✅ 共更新 {updated_count} 个物品')
    else:
        print('⚠️ 没有找到匹配的物品')

def update_items_by_pattern(name_pattern: str, effect: str, backup: bool = True):
    """
    根据名称模式批量更新效果
    
    Args:
        name_pattern: 名称模式（包含此字符串的物品都会被更新）
        effect: 效果字符串
        backup: 是否备份原文件
    """
    items, path = load_items()
    if not items:
        return
    
    if backup:
        backup_path = path + '.backup'
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f'📦 已备份到: {backup_path}')
    
    updated_count = 0
    for item in items:
        if name_pattern in item.get('name', ''):
            old_effect = item.get('effect', '')
            item['effect'] = effect
            updated_count += 1
            print(f'  ✅ {item["name"]} (ID: {item.get("id", "")}): "{old_effect}" -> "{effect}"')
    
    if updated_count > 0:
        save_items(items, path)
        print(f'✅ 共更新 {updated_count} 个物品')
    else:
        print('⚠️ 没有找到匹配的物品')

def list_items_without_effect():
    """列出所有没有效果配置的物品"""
    items, path = load_items()
    if not items:
        return
    
    items_without_effect = []
    for item in items:
        if not item.get('effect') or item.get('effect', '').strip() == '':
            items_without_effect.append(item)
    
    if items_without_effect:
        print(f'\n📋 共有 {len(items_without_effect)} 个物品没有效果配置:\n')
        for item in items_without_effect:
            print(f'  - ID: {item.get("id")}, 名称: {item.get("name")}, 目标: {item.get("UsageTarget", "Player")}')
    else:
        print('✅ 所有物品都已配置效果')

def show_item_effect(item_id: int):
    """显示指定物品的效果配置"""
    items, path = load_items()
    if not items:
        return
    
    for item in items:
        if item.get('id') == item_id:
            print(f'\n📦 物品信息:')
            print(f'  ID: {item.get("id")}')
            print(f'  名称: {item.get("name")}')
            print(f'  效果: {item.get("effect", "(无)")}')
            print(f'  目标: {item.get("UsageTarget", "Player")}')
            print(f'  可堆叠: {item.get("CanStack", True)}')
            print(f'  堆叠上限: {item.get("StackLimit", 99)}')
            return
    
    print(f'❌ 未找到ID为 {item_id} 的物品')

# ========== 使用示例 ==========

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='批量修改 Items.json 工具')
    parser.add_argument('--by-id', nargs='+', type=int, help='根据物品ID更新（可多个ID）')
    parser.add_argument('--by-name', nargs='+', help='根据物品名称更新（可多个名称）')
    parser.add_argument('--by-pattern', type=str, help='根据名称模式更新（包含此字符串）')
    parser.add_argument('--effect', type=str, required=True, help='效果字符串，如 "EXP:50000"')
    parser.add_argument('--no-backup', action='store_true', help='不备份原文件')
    parser.add_argument('--list-empty', action='store_true', help='列出所有没有效果配置的物品')
    parser.add_argument('--show', type=int, help='显示指定ID的物品信息')
    
    args = parser.parse_args()
    
    if args.list_empty:
        list_items_without_effect()
    elif args.show:
        show_item_effect(args.show)
    elif args.by_id:
        update_items_by_id(args.by_id, args.effect, backup=not args.no_backup)
    elif args.by_name:
        update_items_by_name(args.by_name, args.effect, backup=not args.no_backup)
    elif args.by_pattern:
        update_items_by_pattern(args.by_pattern, args.effect, backup=not args.no_backup)
    else:
        parser.print_help()
        print('\n📖 使用示例:')
        print('  # 根据ID更新')
        print('  python batch_update_items.py --by-id 202 203 204 --effect "EXP:50000"')
        print('  # 根据名称更新')
        print('  python batch_update_items.py --by-name "生命药水" "大生命药水" --effect "HP:1000"')
        print('  # 根据模式更新')
        print('  python batch_update_items.py --by-pattern "经验" --effect "EXP:50000"')
        print('  # 列出没有效果配置的物品')
        print('  python batch_update_items.py --list-empty')
        print('  # 显示物品信息')
        print('  python batch_update_items.py --show 202')

