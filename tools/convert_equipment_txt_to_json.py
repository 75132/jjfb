#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
将Excel转换的txt文件转换为JSON格式
支持Weapon, Gun, Wing, Dun, Armor等装备类型
"""

import json
import os
from typing import Dict, List, Any

# 装备类型映射：文件名 -> (itypeId, 类型名称)
EQUIPMENT_TYPE_MAP = {
    'Weapon': (2, '武器'),
    'Gun': (3, '枪械'),
    'Wing': (4, '翅膀'),
    'Dun': (5, '盾牌'),
    'Armor': (6, '护甲')
}

# 属性名称映射（中文）
ATTRIBUTE_NAMES = {
    'HP': '生命值',
    'MP': '能量值',
    'Melee': '格斗',
    'Shoot': '射击',
    'Armor': '护甲',
    'Evasion': '闪避',
    'Accuracy': '命中',
    'Lethality': '致命',
    'Corrosion': '腐蚀',
    'Resistance': '抗性',
    'Initiative': '先攻',
    'Counterattack': '反击',
    'Block': '格挡',
    'Armor Penetration': '穿透',
    'Particle Shield': '粒子护盾',
    'Energy Recovery': '能量恢复',
    'Life Recovery': '生命恢复',
    'Attack Times': '攻击次数'
}


def parse_txt_file(file_path: str) -> List[Dict[str, Any]]:
    """
    解析txt文件，返回数据列表
    """
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
        if len(lines) < 2:
            return data
        
        # 解析表头
        header = lines[0].strip().split('\t')
        header = [col.strip() for col in header]
        
        # 解析数据行
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            
            values = line.split('\t')
            if len(values) < len(header):
                continue
            
            row_data = {}
            for i, col_name in enumerate(header):
                if i < len(values):
                    value = values[i].strip()
                    # 尝试转换为数字
                    if col_name in ['Equipment ID', 'Type', 'Img', 'Required Level', 'Price',
                                   'HP', 'MP', 'Melee', 'Shoot', 'Armor', 'Evasion', 'Accuracy',
                                   'Lethality', 'Corrosion', 'Resistance', 'Initiative',
                                   'Counterattack', 'Block', 'Armor Penetration', 'Particle Shield',
                                   'Energy Recovery', 'Life Recovery', 'Attack Times']:
                        try:
                            row_data[col_name] = int(value) if value else 0
                        except ValueError:
                            row_data[col_name] = 0
                    else:
                        row_data[col_name] = value
            
            if row_data:
                data.append(row_data)
    
    return data


def generate_effect_text(row_data: Dict[str, Any]) -> str:
    """
    生成装备效果描述文本
    """
    effects = []
    
    # 基础属性
    if row_data.get('HP', 0) > 0:
        effects.append(f"生命值+{row_data['HP']}")
    if row_data.get('MP', 0) > 0:
        effects.append(f"能量值+{row_data['MP']}")
    if row_data.get('Melee', 0) > 0:
        effects.append(f"格斗+{row_data['Melee']}")
    if row_data.get('Shoot', 0) > 0:
        effects.append(f"射击+{row_data['Shoot']}")
    if row_data.get('Armor', 0) > 0:
        effects.append(f"护甲+{row_data['Armor']}")
    if row_data.get('Evasion', 0) > 0:
        effects.append(f"闪避+{row_data['Evasion']}")
    if row_data.get('Accuracy', 0) > 0:
        effects.append(f"命中+{row_data['Accuracy']}")
    if row_data.get('Lethality', 0) > 0:
        effects.append(f"致命+{row_data['Lethality']}")
    if row_data.get('Corrosion', 0) > 0:
        effects.append(f"腐蚀+{row_data['Corrosion']}")
    if row_data.get('Resistance', 0) > 0:
        effects.append(f"抗性+{row_data['Resistance']}")
    if row_data.get('Initiative', 0) > 0:
        effects.append(f"先攻+{row_data['Initiative']}")
    if row_data.get('Counterattack', 0) > 0:
        effects.append(f"反击+{row_data['Counterattack']}")
    if row_data.get('Block', 0) > 0:
        effects.append(f"格挡+{row_data['Block']}")
    if row_data.get('Armor Penetration', 0) > 0:
        effects.append(f"穿透+{row_data['Armor Penetration']}")
    if row_data.get('Particle Shield', 0) > 0:
        effects.append(f"粒子护盾+{row_data['Particle Shield']}")
    if row_data.get('Energy Recovery', 0) > 0:
        effects.append(f"能量恢复+{row_data['Energy Recovery']}")
    if row_data.get('Life Recovery', 0) > 0:
        effects.append(f"生命恢复+{row_data['Life Recovery']}")
    if row_data.get('Attack Times', 0) > 0:
        effects.append(f"攻击次数+{row_data['Attack Times']}")
    
    # 等级要求
    required_level = row_data.get('Required Level', 0)
    if required_level > 0:
        effects.append(f"需要等级{required_level}")
    
    return "|".join(effects) if effects else ""


def convert_to_json_item(row_data: Dict[str, Any], itype_id: int) -> Dict[str, Any]:
    """
    将单行数据转换为JSON格式的物品对象
    """
    effect_text = generate_effect_text(row_data)
    
    item = {
        "id": row_data.get('Equipment ID', 0),
        "name": row_data.get('Name', ''),
        "effect": effect_text,
        "iconIndex": row_data.get('Icon', ''),
        "price": row_data.get('Price', 0),
        "consumable": False,  # 武器装备不可消耗
        "itypeId": itype_id,  # 用于区分装备类型
        "UsageTarget": "Pet",  # 机甲装备
        "CanStack": False,  # 武器装备不可堆叠
        "StackLimit": 1,
        "effecttext": effect_text,
        # 额外属性（用于服务器端处理）
        "requiredLevel": row_data.get('Required Level', 0),
        "type": row_data.get('Type', 0),
        "img": row_data.get('Img', 0),
        # 战斗属性
        "hp": row_data.get('HP', 0),
        "mp": row_data.get('MP', 0),
        "melee": row_data.get('Melee', 0),
        "shoot": row_data.get('Shoot', 0),
        "armor": row_data.get('Armor', 0),
        "evasion": row_data.get('Evasion', 0),
        "accuracy": row_data.get('Accuracy', 0),
        "lethality": row_data.get('Lethality', 0),
        "corrosion": row_data.get('Corrosion', 0),
        "resistance": row_data.get('Resistance', 0),
        "initiative": row_data.get('Initiative', 0),
        "counterattack": row_data.get('Counterattack', 0),
        "block": row_data.get('Block', 0),
        "armorPenetration": row_data.get('Armor Penetration', 0),
        "particleShield": row_data.get('Particle Shield', 0),
        "energyRecovery": row_data.get('Energy Recovery', 0),
        "lifeRecovery": row_data.get('Life Recovery', 0),
        "attackTimes": row_data.get('Attack Times', 0)
    }
    
    return item


def convert_file(input_file: str, output_file: str, itype_id: int):
    """
    转换单个文件
    """
    print(f"正在转换: {input_file} -> {output_file}")
    
    # 解析txt文件
    data = parse_txt_file(input_file)
    
    if not data:
        print(f"警告: {input_file} 没有数据")
        return
    
    # 转换为JSON格式
    json_items = []
    for row_data in data:
        item = convert_to_json_item(row_data, itype_id)
        json_items.append(item)
    
    # 确保输出目录存在
    output_dir = os.path.dirname(output_file)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 写入JSON文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(json_items, f, ensure_ascii=False, indent=2)
    
    print(f"完成: 转换了 {len(json_items)} 个物品")


def main():
    """
    主函数：转换所有装备文件
    """
    # 输入和输出目录
    input_dir = 'server/data/txt'
    output_dir = 'server/data'
    
    # 转换每个装备类型
    for file_name, (itype_id, type_name) in EQUIPMENT_TYPE_MAP.items():
        input_file = os.path.join(input_dir, f'{file_name}.txt')
        output_file = os.path.join(output_dir, f'{file_name}.json')
        
        if os.path.exists(input_file):
            convert_file(input_file, output_file, itype_id)
        else:
            print(f"警告: 文件不存在 {input_file}")
    
    print("\n所有转换完成！")


if __name__ == '__main__':
    main()

