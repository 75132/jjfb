"""
批量添加 effecttext 字段到 Items.json
将 effect 字段的值复制到 effecttext 字段
"""
import json
import os
import sys

def find_items_json():
    """查找 Items.json 文件"""
    base_dir = os.path.dirname(os.path.dirname(__file__))  # server
    possible_paths = [
        os.path.join(base_dir, 'data', 'Items.json'),
        os.path.join(base_dir, 'assets', 'resources', 'json', 'Items.json'),
        'assets/resources/json/Items.json',
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    return None

def process_items_json(path):
    """处理 Items.json，添加 effecttext 字段"""
    with open(path, 'r', encoding='utf-8') as f:
        items = json.load(f)
    
    updated_count = 0
    for item in items:
        if 'effect' in item and 'effecttext' not in item:
            # 复制 effect 到 effecttext
            item['effecttext'] = item['effect']
            updated_count += 1
    
    # 保存
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    
    print(f'✅ 已为 {updated_count} 个物品添加 effecttext 字段')
    return path

if __name__ == '__main__':
    # 处理所有找到的 Items.json
    paths_processed = []
    
    base_dir = os.path.dirname(os.path.dirname(__file__))
    possible_paths = [
        os.path.join(base_dir, 'data', 'Items.json'),
        os.path.join(base_dir, 'assets', 'resources', 'json', 'Items.json'),
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            print(f'处理: {path}')
            process_items_json(path)
            paths_processed.append(path)
    
    if not paths_processed:
        print('❌ 未找到 Items.json 文件')
    else:
        print(f'✅ 共处理 {len(paths_processed)} 个文件')

