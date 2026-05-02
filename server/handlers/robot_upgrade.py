"""
机甲升级模块
负责机甲经验增加、等级计算、属性计算等功能
"""
import json
import os
import re
import random
from typing import Dict, Tuple, Optional, List

# 机甲最大等级
MAX_ROBOT_LEVEL = 60

# 1~60 级累计总经验表（索引从 0 开始，对应等级 = index + 1）
ROBOT_LEVEL_TOTAL_EXP = [
    290,        # 1
    370,        # 2
    472,        # 3
    603,        # 4
    770,        # 5
    983,        # 6
    1256,       # 7
    1604,       # 8
    2048,       # 9
    2614,       # 10
    3338,       # 11
    4262,       # 12
    5442,       # 13
    6948,       # 14
    8872,       # 15
    11328,      # 16
    14463,      # 17
    18466,      # 18
    23577,      # 19
    30103,      # 20
    38436,      # 21
    49074,      # 22
    62657,      # 23
    80000,      # 24
    89608,      # 25
    100371,     # 26
    112427,     # 27
    125931,     # 28
    141057,     # 29
    158000,     # 30
    182364,     # 31
    210485,     # 32
    242942,     # 33
    280404,     # 34
    323644,     # 35
    373550,     # 36
    431153,     # 37
    497638,     # 38
    574375,     # 39
    662945,     # 40
    765174,     # 41
    883165,     # 42
    1019352,    # 43
    1176539,    # 44
    1357965,    # 45
    1567367,    # 46
    1809059,    # 47
    2088021,    # 48
    2410000,    # 49
    2580000,    # 50
    4696700,    # 51
    8550000,    # 52
    12220000,   # 53
    15890000,   # 54
    19560000,   # 55
    19877424,   # 56
    20200000,   # 57
    20448471,   # 58
    20700000,   # 59
    20950000,   # 60
]

# 属性映射表（公式中的字母 -> 数据库字段名）
# 新的属性映射
ATTRIBUTE_MAPPING = {
    'a': 'HP',                  # 生命
    'b': 'MP',                  # 能量
    'c': 'Melee',               # 格斗
    'd': 'Shooting',            # 射击
    'e': 'Armor',               # 护甲
    'f': 'Evasion',             # 闪避
    'g': 'Accuracy',           # 命中
    'h': 'Lethality',           # 致命
    'i': 'Corrosion',           # 侵蚀
    'j': 'Resistance',          # 抗性
    'k': 'Initiative',          # 出手
    'l': 'Counterattack',       # 反击
    'm': 'Block',               # 格挡
    'n': 'ArmorPenetration',    # 护甲穿透
    'o': 'ParticleShield',      # 粒子护盾
}

# Current前缀属性映射（用于当前值）
# 注意：HP和MP通常使用MaxHP/MaxMP和CurrentHP/CurrentMP，不需要在这里映射
CURRENT_ATTRIBUTE_MAPPING = {
    'c': 'CurrentMelee',
    'd': 'CurrentShooting',
    'e': 'CurrentArmor',
    'f': 'CurrentEvasion',
    'g': 'CurrentAccuracy',
    'h': 'CurrentLethality',
    'i': 'CurrentCorrosion',
    'j': 'CurrentResistance',
    'k': 'CurrentInitiative',
    'l': 'CurrentCounterattack',
    'm': 'CurrentBlock',
    'n': 'CurrentArmorPenetration',
    'o': 'CurrentParticleShield',
}

# 机器人类型定义
MELEE_ROBOT_IDS = [1, 2, 3, 19, 20, 21, 22, 23, 24, 28, 29, 30, 37, 38, 39, 46, 47, 48, 49, 57, 60, 61, 62, 63, 70, 71, 72, 81]  # 格斗
ALL_ROUND_ROBOT_IDS = [7, 8, 9, 13, 14, 15, 16, 17, 18, 34, 35, 36, 43, 44, 45, 53, 54, 55, 58, 67, 68, 69, 73, 77, 78, 79]  # 全能
SHOOTING_ROBOT_IDS = [4, 5, 6, 10, 11, 12, 25, 26, 27, 31, 32, 33, 40, 41, 42, 50, 51, 52, 56, 59, 64, 65, 66, 74, 75, 76, 80]  # 射击


class RobotUpgradeManager:
    """机甲升级管理器"""
    
    def __init__(self, classes_json_path: str = None):
        """
        初始化升级管理器
        :param classes_json_path: Classes.json文件路径，如果为None则使用默认路径
        """
        if classes_json_path is None:
            # 尝试多个可能的路径
            base_dir = os.path.dirname(os.path.abspath(__file__))  # server/handlers
            parent_dir = os.path.dirname(base_dir)  # server
            
            possible_paths = [
                os.path.join(parent_dir, 'data', 'Classes.json'),  # server/data/Classes.json（新位置，优先）
                os.path.join(parent_dir, 'Classes.json'),  # server/Classes.json（旧位置，兼容）
                os.path.join(base_dir, 'Classes.json'),    # server/handlers/Classes.json（备用）
            ]
            
            classes_json_path = None
            for path in possible_paths:
                if os.path.exists(path):
                    classes_json_path = path
                    break
            
            # 如果都没找到，使用第一个作为默认（会报错但至少知道路径）
            if not classes_json_path:
                classes_json_path = possible_paths[0]
        
        self.classes_json_path = classes_json_path
        self.classes_data = None
        self.formula_cache = {}  # 缓存解析后的公式
        
        # 加载Classes.json
        self._load_classes_data()
        
        # 加载ClassCoefficient.json
        self.coefficient_data = None
        self._load_coefficient_data()
    
    def _load_classes_data(self):
        """加载Classes.json数据"""
        try:
            with open(self.classes_json_path, 'r', encoding='utf-8') as f:
                self.classes_data = json.load(f)
            print(f'✅ 成功加载Classes.json，共 {len(self.classes_data)} 个职业')
        except Exception as e:
            print(f'❌ 加载Classes.json失败: {e}')
            self.classes_data = []
    
    def _load_coefficient_data(self):
        """加载ClassCoefficient.json数据"""
        try:
            base_dir = os.path.dirname(os.path.abspath(__file__))  # server/handlers
            parent_dir = os.path.dirname(base_dir)  # server
            
            coefficient_path = os.path.join(parent_dir, 'data', 'ClassCoefficient.json')
            if os.path.exists(coefficient_path):
                with open(coefficient_path, 'r', encoding='utf-8') as f:
                    self.coefficient_data = json.load(f)
                print(f'✅ 成功加载ClassCoefficient.json，共 {len(self.coefficient_data)} 个机甲系数')
            else:
                print(f'⚠️ ClassCoefficient.json文件不存在: {coefficient_path}，将使用默认系数')
                self.coefficient_data = None
        except Exception as e:
            print(f'❌ 加载ClassCoefficient.json失败: {e}，将使用默认系数')
            self.coefficient_data = None
    
    def _get_coefficient_for_robot_id(self, robot_id: int) -> Dict[str, float]:
        """
        根据机甲ID获取系数配置
        :param robot_id: 机甲ID（整数）
        :return: 系数字典，键为属性字母（a-o），值为系数（0-1）
        """
        if not self.coefficient_data or robot_id is None or robot_id < 1:
            return {}
        
        # 默认系数（所有属性为1.0）
        default_coefficients = {
            'a': 1.0, 'b': 1.0, 'c': 1.0, 'd': 1.0, 'e': 1.0,
            'f': 1.0, 'g': 1.0, 'h': 1.0, 'i': 1.0, 'j': 1.0,
            'k': 1.0, 'l': 1.0, 'm': 1.0, 'n': 1.0, 'o': 1.0
        }
        
        # 尝试从JSON中获取
        if robot_id < len(self.coefficient_data):
            coeff_info = self.coefficient_data[robot_id]
            if coeff_info and isinstance(coeff_info, dict):
                # 提取系数
                coefficients = {}
                for attr_letter in ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o']:
                    coefficients[attr_letter] = coeff_info.get(attr_letter, default_coefficients[attr_letter])
                return coefficients
        
        return default_coefficients
    
    def _parse_formula(self, note: str) -> Dict[str, str]:
        """
        解析属性计算公式
        :param note: 公式字符串，例如 "a = level * (506/2) + 300 ,b = level * 174 + 150"
        :return: 字典，键为属性字母（a-p），值为公式字符串
        """
        if not note:
            return {}
        
        formulas = {}
        # 分割公式（按逗号分割）
        parts = note.split(',')
        
        for part in parts:
            part = part.strip()
            if not part:
                continue
            
            # 匹配 "a = ..." 格式
            match = re.match(r'([a-p])\s*=\s*(.+)', part)
            if match:
                attr_letter = match.group(1)
                formula = match.group(2).strip()
                formulas[attr_letter] = formula
        
        return formulas
    
    def _get_formula_for_class(self, class_id: int) -> Dict[str, str]:
        """
        获取指定职业的公式
        :param class_id: 职业ID（1-99）
        :return: 公式字典
        """
        if not self.classes_data or class_id < 1 or class_id >= len(self.classes_data):
            return {}
        
        class_info = self.classes_data[class_id]
        if not class_info:
            return {}
        
        note = class_info.get('note', '')
        if not note:
            return {}
        
        # 检查缓存
        cache_key = f"class_{class_id}"
        if cache_key in self.formula_cache:
            return self.formula_cache[cache_key]
        
        # 解析公式
        formulas = self._parse_formula(note)
        self.formula_cache[cache_key] = formulas
        
        return formulas
    
    def _get_formula_for_robot_id(self, robot_id) -> Dict[str, str]:
        """
        根据机甲ID（RobotID）获取对应的公式
        :param robot_id: 机甲ID（RobotID，可能是字符串或整数）
        :return: 公式字典
        """
        if robot_id is None or not self.classes_data:
            return {}
        
        # 统一转换为整数（如果可能）
        robot_id_int = None
        try:
            if isinstance(robot_id, int):
                robot_id_int = robot_id
            elif isinstance(robot_id, str):
                if robot_id.isdigit():
                    robot_id_int = int(robot_id)
        except (ValueError, TypeError, AttributeError):
            pass
        
        # 方法1: 如果robot_id是整数，直接作为Classes.json的索引
        if robot_id_int and robot_id_int > 0 and robot_id_int < len(self.classes_data):
            return self._get_formula_for_class(robot_id_int)
        
        # 方法2: 在Classes.json中查找id字段匹配的条目
        for idx, class_info in enumerate(self.classes_data):
            if not class_info:
                continue
            # 尝试整数匹配
            if robot_id_int and class_info.get('id') == robot_id_int:
                return self._get_formula_for_class(idx)
            # 也尝试字符串匹配
            if str(class_info.get('id', '')) == str(robot_id):
                return self._get_formula_for_class(idx)
        
        return {}
    
    def _calculate_attribute_value(self, formula: str, level: int, growth: int = 50, comprehension: int = 50, star_level: int = 1) -> float:
        """
        计算属性值
        :param formula: 公式字符串，例如 "level * (506/2) + 300"
        :param level: 当前等级
        :param growth: 成长值（用于某些公式）
        :param comprehension: 悟性值（用于某些公式）
        :param star_level: 星级（用于某些公式）
        :return: 计算后的属性值
        """
        try:
            # 替换公式中的变量（注意：要按顺序替换，避免部分替换）
            # 先替换复杂的表达式，再替换简单的
            formula = formula.replace('level', str(level))
            formula = formula.replace('growth', str(growth))
            formula = formula.replace('comprehension', str(comprehension))
            formula = formula.replace('star_level', str(star_level))
            
            # 验证公式只包含安全的数学表达式字符
            # 允许：数字、运算符、括号、小数点、空格
            if not re.match(r'^[0-9+\-*/().\s]+$', formula):
                print(f'⚠️ 公式包含不安全字符: {formula}')
                return 0.0
            
            # 计算表达式（使用eval，因为已经验证过安全性）
            result = eval(formula)
            return float(result)
        except Exception as e:
            print(f'⚠️ 计算属性值失败: formula={formula}, error={e}')
            return 0.0
    
    def get_exp_required_for_level(self, level: int) -> int:
        """
        获取指定等级升级需要的经验
        :param level: 等级（1-60）
        :return: 该等级需要的经验
        """
        if level < 1:
            return 0
        if level > MAX_ROBOT_LEVEL:
            return ROBOT_LEVEL_TOTAL_EXP[-1]
        return ROBOT_LEVEL_TOTAL_EXP[level - 1]
    
    def get_total_exp_for_level(self, level: int) -> int:
        """
        获取指定等级的累计总经验（通过累加前面所有等级的经验来计算）
        :param level: 等级（1-60）
        :return: 累计总经验
        """
        if level < 1:
            return 0
        if level > MAX_ROBOT_LEVEL:
            # 如果超过最大等级，返回所有等级的经验总和
            return sum(ROBOT_LEVEL_TOTAL_EXP)
        
        # 累加从1级到指定等级的所有经验
        total = 0
        for lvl in range(1, level + 1):
            total += ROBOT_LEVEL_TOTAL_EXP[lvl - 1]
        return total
    
    def calculate_level_from_exp(self, total_exp: int) -> int:
        """
        根据累计总经验计算等级（通过累加每级经验来判断总经验对应的等级）
        :param total_exp: 累计总经验
        :return: 等级（1-60）
        """
        if total_exp <= 0:
            return 1
        
        # 累加每级经验，判断总经验对应的等级
        accumulated_exp = 0
        result = 1
        
        for lvl in range(1, MAX_ROBOT_LEVEL + 1):
            exp_required = ROBOT_LEVEL_TOTAL_EXP[lvl - 1]  # 每级需要的经验
            accumulated_exp += exp_required
            
            if total_exp >= accumulated_exp:
                result = lvl
            else:
                break
        
        return result
    
    def check_star_growth(self, robot_pet: Dict) -> bool:
        """
        检查并处理升星逻辑
        参考源代码：Math.random() * 240 < this._growth
        规则：100成长值最幸运的情况下能到35星（不是硬上限，而是概率上限）
        :param robot_pet: 机甲宠物数据字典
        :return: 是否升星成功
        """
        growth = robot_pet.get('Growth', 50)
        
        # 使用源代码的公式：Math.random() * 240 < growth
        # 升星概率 = growth / 240
        # 100成长值 = 100/240 = 41.67%概率
        if random.random() * 300 < growth:
            star_level = robot_pet.get('StarLevel', 1)
            robot_pet['StarLevel'] = star_level + 1
            print(f'[升星] 机甲 {robot_pet.get("RobotName", "未知")}: {star_level}星 -> {star_level + 1}星 (成长值:{growth}, 概率:{growth/240*100:.2f}%)')
            return True
        return False
    
    def add_star_bonus(self, robot_pet: Dict, updated_attrs: Dict) -> Dict:
        """
        每升一星增加角色的基础属性
        参考：rate = 0.02 - Math.random() * 0.01  (每升一星增加0.01到0.02之间的随机百分比)
        :param robot_pet: 机甲宠物数据字典
        :param updated_attrs: 当前更新的属性字典
        :return: 更新后的属性字典
        """
        star_level = robot_pet.get('StarLevel', 1)
        if star_level <= 1:
            return updated_attrs
        
        # 计算升星次数（从1星开始，所以升星次数 = star_level - 1）
        star_up_count = star_level - 1
        
        # 获取或生成每次升星的随机加成率
        # 如果已经存储了升星加成率列表，使用存储的值（保证一致性）
        # 否则为每次升星生成随机值并存储
        star_rates_key = '_star_bonus_rates'
        if star_rates_key not in robot_pet:
            # 首次计算，为每次升星生成随机加成率
            # rate = 0.02 - random() * 0.01，范围是 (0.01, 0.02]
            robot_pet[star_rates_key] = []
            for _ in range(star_up_count):
                rate = 0.005 - random.random() * 0.003
                robot_pet[star_rates_key].append(rate)
        else:
            # 如果已有存储的加成率，但升星次数增加了，为新升星生成随机值
            existing_rates = robot_pet[star_rates_key]
            while len(existing_rates) < star_up_count:
                rate = 0.02 - random.random() * 0.01
                existing_rates.append(rate)
        
        # 获取基础属性（从robot_pet或updated_attrs中获取）
        base_attrs = {}
        attr_fields = ['HP', 'MaxHP', 'MP', 'MaxMP', 'Melee', 'Accuracy', 'Armor', 
                      'Corrosion', 'Initiative', 'Block', 'ParticleShield', 
                      'ArmorPenetration', 'Shooting', 'Evasion', 'Lethality', 
                      'Resistance', 'Counterattack']
        
        for field in attr_fields:
            # 优先使用updated_attrs中的值，如果没有则使用robot_pet中的值
            base_value = updated_attrs.get(field) or robot_pet.get(field, 0)
            if base_value > 0:
                base_attrs[field] = base_value
        
        # 累计所有升星的加成（每次升星使用对应的随机率）
        star_rates = robot_pet[star_rates_key]
        total_bonus = {}
        
        for field, base_value in base_attrs.items():
            total_bonus_value = 0
            # 对每次升星应用对应的随机率
            for rate in star_rates:
                bonus = int(base_value * rate)
                total_bonus_value += bonus
            
            if total_bonus_value > 0:
                updated_attrs[field] = updated_attrs.get(field, base_value) + total_bonus_value
        
        return updated_attrs
    
    def apply_unique_growth(self, robot_pet: Dict, updated_attrs: Dict) -> Dict:
        """
        应用独特的成长值到属性
        :param robot_pet: 机甲宠物数据字典
        :param updated_attrs: 当前更新的属性字典
        :return: 更新后的属性字典
        """
        unique_growth = robot_pet.get('UniqueGrowthValue', 0)
        if unique_growth <= 0:
            return updated_attrs
        
        level = robot_pet.get('Level', 1)
        
        # 独特成长值按等级比例应用（等级越高，加成越大）
        # 公式：加成 = unique_growth * level / 10
        growth_bonus = unique_growth * level / 10
        
        # 应用到主要属性
        attr_fields = ['HP', 'MaxHP', 'MP', 'MaxMP', 'Melee', 'Accuracy', 'Armor', 
                      'Shooting', 'Evasion']
        
        for field in attr_fields:
            base_value = updated_attrs.get(field) or robot_pet.get(field, 0)
            if base_value > 0:
                bonus = int(base_value * growth_bonus / 100)  # 转换为百分比加成
                if bonus > 0:
                    updated_attrs[field] = updated_attrs.get(field, base_value) + bonus
        
        return updated_attrs
    
    def calculate_attributes(self, robot_pet: Dict, class_id: int = None, robot_id: str = None) -> Dict:
        """
        根据等级计算机甲属性
        :param robot_pet: 机甲宠物数据字典
        :param class_id: 职业ID，如果为None则从robot_pet中获取
        :param robot_id: 机甲ID（RobotID），如果提供则优先使用此ID查找公式
        :return: 更新后的属性字典
        """
        # 获取等级和基础属性
        level = robot_pet.get('Level', 1)
        growth = robot_pet.get('Growth', 50)
        comprehension = robot_pet.get('Comprehension', 50)
        star_level = robot_pet.get('StarLevel', 1)
        
        # 优先使用robot_id（机甲ID）查找公式
        if robot_id is None:
            robot_id = robot_pet.get('RobotID', '')
        
        # 如果提供了robot_id，优先根据RobotID查找对应的公式
        formulas = {}
        if robot_id:
            formulas = self._get_formula_for_robot_id(robot_id)
            if formulas:
                print(f'根据RobotID {robot_id} 找到公式')
        
        # 如果根据RobotID没找到公式，回退到使用Class ID
        if not formulas:
            if class_id is None:
                class_id = robot_pet.get('Class', 1)
            formulas = self._get_formula_for_class(class_id)
            if formulas:
                print(f'根据Class ID {class_id} 找到公式')
        
        # 计算所有属性
        updated_attrs = {}
        
        for attr_letter, formula in formulas.items():
            # 计算属性值
            value = self._calculate_attribute_value(formula, level, growth, comprehension, star_level)
            
            # 获取对应的数据库字段名
            db_field = ATTRIBUTE_MAPPING.get(attr_letter)
            if db_field:
                # 四舍五入到整数
                rounded_value = int(round(value))
                updated_attrs[db_field] = rounded_value
                
                # 特殊处理：HP和MP需要同时更新Max和Current字段
                if attr_letter == 'a':  # HP
                    updated_attrs['MaxHP'] = rounded_value
                    # CurrentHP 保持当前值，如果不存在则使用MaxHP
                    if 'CurrentHP' not in robot_pet or robot_pet.get('CurrentHP') is None:
                        updated_attrs['CurrentHP'] = rounded_value
                elif attr_letter == 'b':  # MP
                    updated_attrs['MaxMP'] = rounded_value
                    # CurrentMP 保持当前值，如果不存在则使用MaxMP
                    if 'CurrentMP' not in robot_pet or robot_pet.get('CurrentMP') is None:
                        updated_attrs['CurrentMP'] = rounded_value
                
                # 如果是战斗属性，同时更新Current前缀的字段
                current_field = CURRENT_ATTRIBUTE_MAPPING.get(attr_letter)
                if current_field:
                    updated_attrs[current_field] = rounded_value
        
        # 根据ClassCoefficient.json中的系数调整所有属性
        # 尝试将 robot_id 转换为整数
        robot_id_int = None
        try:
            if isinstance(robot_id, int):
                robot_id_int = robot_id
            elif isinstance(robot_id, str):
                if robot_id.isdigit():
                    robot_id_int = int(robot_id)
        except (ValueError, TypeError, AttributeError):
            pass
        
        if robot_id_int is not None:
            # 从JSON获取系数配置
            coefficients = self._get_coefficient_for_robot_id(robot_id_int)
            
            if coefficients:
                # 应用系数到所有属性
                for attr_letter, db_field in ATTRIBUTE_MAPPING.items():
                    if db_field in updated_attrs:
                        coeff = coefficients.get(attr_letter, 1.0)
                        original_value = updated_attrs[db_field]
                        
                        # 应用系数（如果系数为0，直接设为0；否则乘以系数）
                        if coeff == 0:
                            new_value = 0
                        else:
                            new_value = int(round(original_value * coeff))
                        
                        updated_attrs[db_field] = new_value
                        
                        # 同时更新Current前缀的字段（除了HP和MP，它们已经在上面处理过）
                        if attr_letter not in ['a', 'b']:  # HP和MP已经在上面的特殊处理中处理过
                            current_field = CURRENT_ATTRIBUTE_MAPPING.get(attr_letter)
                            if current_field:
                                updated_attrs[current_field] = new_value
                        
                        # 特殊处理HP和MP的Max字段（需要重新应用系数）
                        if attr_letter == 'a':  # HP
                            updated_attrs['MaxHP'] = new_value
                        elif attr_letter == 'b':  # MP
                            updated_attrs['MaxMP'] = new_value
        
        return updated_attrs
    
    def add_exp_to_robot(self, robot_pet: Dict, exp_amount: int) -> Tuple[int, int, int, Dict]:
        """
        给机甲增加经验并计算升级
        :param robot_pet: 机甲宠物数据字典
        :param exp_amount: 要增加的经验值
        :return: (新等级, 新总经验, 升级次数, 更新后的属性字典)
        """
        current_exp = robot_pet.get('EXP', 0)
        current_level = robot_pet.get('Level', 1)
        
        # 如果已经满级，不增加经验
        if current_level >= MAX_ROBOT_LEVEL:
            return current_level, current_exp, 0, {}
        
        # 增加经验
        new_exp = current_exp + exp_amount
        
        # 根据新经验计算等级（无论是否升级都重新计算，确保等级准确）
        new_level = self.calculate_level_from_exp(new_exp)
        level_up_count = new_level - current_level
        
        # 调试信息
        if level_up_count > 0:
            print(f'[升级] 机甲 {robot_pet.get("RobotName", "未知")}: 等级 {current_level} -> {new_level}, 经验 {current_exp} -> {new_exp}')
        elif new_level != current_level:
            # 如果计算出的等级和当前等级不一致，说明数据库中的等级可能不准确，需要更新
            print(f'[等级修正] 机甲 {robot_pet.get("RobotName", "未知")}: 数据库等级 {current_level}, 计算等级 {new_level}, 经验 {new_exp}')
            level_up_count = new_level - current_level  # 重新计算升级次数
        
        # 如果等级有变化（升级或修正），重新计算属性
        updated_attrs = {}
        star_up_count = 0
        
        if level_up_count != 0:
            # 关键修复：对每个等级都检查升星（如果一次升级跨越多个等级）
            # 例如：从1级升到10级，应该对2级、3级、4级...10级都检查一次升星
            current_check_level = current_level
            for _ in range(level_up_count):
                current_check_level += 1
                # 临时设置等级以便检查升星
                robot_pet['Level'] = current_check_level
                
                # 检查升星逻辑（每个等级都检查）
                if self.check_star_growth(robot_pet):
                    star_up_count += 1
                    # 升星时生成并存储随机加成率（0.01 到 0.02 之间）
                    # rate = 0.02 - random() * 0.01，范围是 (0.01, 0.02]
                    star_rates_key = '_star_bonus_rates'
                    if star_rates_key not in robot_pet:
                        robot_pet[star_rates_key] = []
                    rate = 0.02 - random.random() * 0.01
                    robot_pet[star_rates_key].append(rate)
                    print(f'[升星加成] 机甲 {robot_pet.get("RobotName", "未知")}: 等级 {current_check_level} 升星成功，生成随机加成率 {rate:.4f} ({rate*100:.2f}%)')
            
            # 更新到最终等级和经验
            robot_pet['Level'] = new_level
            robot_pet['EXP'] = new_exp
            
            # 计算新属性（传递RobotID以便根据机甲ID查找对应的公式）
            robot_id = robot_pet.get('RobotID', '')
            updated_attrs = self.calculate_attributes(robot_pet, robot_id=robot_id)
            
            # 应用升星加成（累计所有升星的加成）
            updated_attrs = self.add_star_bonus(robot_pet, updated_attrs)
            
            # 应用独特成长值
            updated_attrs = self.apply_unique_growth(robot_pet, updated_attrs)
        
        return new_level, new_exp, level_up_count, updated_attrs
    
    def add_exp_to_robot_atomic(self, robotpet_col, pet_object_id, user_id, exp_amount: int) -> Tuple[int, int, int, Dict]:
        """
        原子性地给机甲增加经验并计算升级（使用MongoDB原子操作避免并发问题）
        这个方法使用 $inc 操作符原子性地增加经验，避免了并发情况下的竞态条件
        
        :param robotpet_col: MongoDB集合对象
        :param pet_object_id: 机甲ObjectId
        :param user_id: 用户ID（用于安全验证）
        :param exp_amount: 要增加的经验值
        :return: (新等级, 新总经验, 升级次数, 更新后的属性字典)
        """
        from bson import ObjectId
        
        # 关键修复：先读取当前数据，计算预期的新等级，然后使用原子操作一次性更新经验和等级
        # 这样可以避免在高频点击时，多个请求同时增加经验但等级更新不同步的问题
        
        # 第一步：原子性地增加经验（使用 $inc 操作符，MongoDB保证原子性）
        result = robotpet_col.find_one_and_update(
            {
                '_id': pet_object_id,
                'user_id': user_id,
                'Level': {'$lt': MAX_ROBOT_LEVEL}  # 只处理未满级的机甲
            },
            {
                '$inc': {'EXP': exp_amount}  # 原子性地增加经验
            },
            return_document=True  # 返回更新后的文档
        )
        
        if not result:
            # 如果更新失败（机甲不存在、不属于用户或已满级）
            return None, None, 0, {}
        
        # 获取更新后的经验值
        new_exp = result.get('EXP', 0)
        old_level = result.get('Level', 1)
        
        # 根据新经验计算等级（无论什么情况都重新计算，确保准确）
        new_level = self.calculate_level_from_exp(new_exp)
        level_up_count = new_level - old_level
        
        # 调试信息
        if level_up_count > 0:
            print(f'[原子升级] 机甲 {result.get("RobotName", "未知")}: 等级 {old_level} -> {new_level}, 经验 +{exp_amount}, 新经验 {new_exp}')
        elif new_level != old_level:
            print(f'[等级修正-原子] 机甲 {result.get("RobotName", "未知")}: 数据库等级 {old_level}, 计算等级 {new_level}, 经验 {new_exp}')
            level_up_count = new_level - old_level
        
        # 关键修复：只要新等级和旧等级不一致，就必须更新等级和属性
        # 使用原子操作确保等级更新，避免并发问题
        updated_attrs = {}
        star_up_count = 0
        
        if new_level != old_level:
            # 关键修复：对每个等级都检查升星（如果一次升级跨越多个等级）
            # 例如：从1级升到10级，应该对2级、3级、4级...10级都检查一次升星
            current_check_level = old_level
            for _ in range(level_up_count):
                current_check_level += 1
                # 临时设置等级以便检查升星
                result['Level'] = current_check_level
                
                # 检查升星逻辑（每个等级都检查）
                if self.check_star_growth(result):
                    star_up_count += 1
                    # 升星时生成并存储随机加成率（0.01 到 0.02 之间）
                    # rate = 0.02 - random() * 0.01，范围是 (0.01, 0.02]
                    star_rates_key = '_star_bonus_rates'
                    if star_rates_key not in result:
                        result[star_rates_key] = []
                    rate = 0.02 - random.random() * 0.01
                    result[star_rates_key].append(rate)
                    print(f'[升星加成-原子] 机甲 {result.get("RobotName", "未知")}: 等级 {current_check_level} 升星成功，生成随机加成率 {rate:.4f} ({rate*100:.2f}%)')
            
            # 更新到最终等级和经验
            result['Level'] = new_level
            result['EXP'] = new_exp
            
            # 计算新属性
            robot_id = result.get('RobotID', '')
            updated_attrs = self.calculate_attributes(result, robot_id=robot_id)
            
            # 应用升星加成（累计所有升星的加成）
            updated_attrs = self.add_star_bonus(result, updated_attrs)
            
            # 应用独特成长值
            updated_attrs = self.apply_unique_growth(result, updated_attrs)
            
            # 准备更新数据 - 确保等级和经验都更新（虽然经验已经通过$inc更新了，但这里确保同步）
            update_data = {
                'Level': new_level,
                'EXP': new_exp,  # 确保经验值也同步更新（虽然已经通过$inc更新了，但显式设置确保一致性）
                'StarLevel': result.get('StarLevel', 1)  # 更新星级
            }
            # 保存升星加成率列表（如果存在）
            if '_star_bonus_rates' in result:
                update_data['_star_bonus_rates'] = result['_star_bonus_rates']
            update_data.update(updated_attrs)
            
            # 关键修复：使用原子操作 find_one_and_update 确保等级和经验同步更新
            # 这样可以避免在高频点击时，多个请求同时更新导致的数据不一致
            update_result = robotpet_col.find_one_and_update(
                {
                    '_id': pet_object_id,
                    'user_id': user_id  # 双重验证确保安全
                },
                {
                    '$set': update_data
                },
                return_document=True
            )
            
            # 验证更新是否成功
            if not update_result:
                print(f'⚠️ [原子升级] 警告：机甲 {result.get("RobotName", "未知")} 等级更新失败，但经验已增加')
            else:
                # 验证更新后的等级是否正确
                updated_level = update_result.get('Level', 0)
                if updated_level != new_level:
                    print(f'⚠️ [原子升级] 警告：机甲 {result.get("RobotName", "未知")} 等级更新不一致，预期 {new_level}，实际 {updated_level}')
        
        return new_level, new_exp, level_up_count, updated_attrs


# 全局单例
_upgrade_manager = None

def get_upgrade_manager() -> RobotUpgradeManager:
    """获取升级管理器单例"""
    global _upgrade_manager
    if _upgrade_manager is None:
        _upgrade_manager = RobotUpgradeManager()
    return _upgrade_manager

