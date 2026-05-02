"""
批量更新 Items.json：
1. 为所有物品添加 effecttext 字段（复制 effect 的值）
2. 更新重生晶体和还原晶体的 effect 字段
3. 更新还原晶体的 UsageTarget 为 Pet
"""
import json
import os

def process_items_json(path):
    """处理 Items.json"""
    with open(path, 'r', encoding='utf-8') as f:
        items = json.load(f)
    
    updated_count = 0
    
    for item in items:
        item_id = item.get('id')
        
        # 1. 添加 effecttext 字段（复制 effect 的值）
        if 'effect' in item and 'effecttext' not in item:
            item['effecttext'] = item['effect']
            updated_count += 1
        
        # 2. 更新重生晶体（ID: 12）
        if item_id == 12:
            old_effect = item.get('effect', '')
            item['effect'] = 'PET_REBORN'
            item['effecttext'] = old_effect  # 保持原有的描述文本
            print(f'[更新] 重生晶体 (ID: 12): effect="{old_effect}" -> "PET_REBORN"')
        
        # 3. 更新还原晶体（ID: 57）
        if item_id == 57:
            old_effect = item.get('effect', '')
            item['effect'] = 'PET_RESET'
            item['effecttext'] = old_effect  # 保持原有的描述文本
            item['UsageTarget'] = 'Pet'  # 修正为 Pet
            print(f'[更新] 还原晶体 (ID: 57): effect="{old_effect}" -> "PET_RESET", UsageTarget="Player" -> "Pet"')
    
    # 保存
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    
    print(f'[完成] 已为 {updated_count} 个物品添加 effecttext 字段')
    return path

if __name__ == '__main__':
    import sys
    # 设置输出编码为 UTF-8
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    base_dir = os.path.dirname(os.path.dirname(__file__))
    possible_paths = [
        os.path.join(base_dir, 'data', 'Items.json'),
        os.path.join(base_dir, 'assets', 'resources', 'json', 'Items.json'),
    ]
    
    paths_processed = []
    for path in possible_paths:
        if os.path.exists(path):
            print(f'\n处理: {path}')
            process_items_json(path)
            paths_processed.append(path)
    
    if not paths_processed:
        print('[错误] 未找到 Items.json 文件')
    else:
        print(f'\n[完成] 共处理 {len(paths_processed)} 个文件')

