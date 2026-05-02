"""
物品效果系统
处理物品使用后的各种效果：经验、HP、MP、获得物品、获得机甲等
"""
import json
import os
import random
from typing import Dict, Optional, List
from . import utils

# 全局效果管理器实例
_effect_manager = None

def get_effect_manager():
    """获取效果管理器单例"""
    global _effect_manager
    if _effect_manager is None:
        _effect_manager = ItemEffectManager()
    return _effect_manager

def load_items_json():
    """加载 Items.json"""
    base_dir = os.path.dirname(os.path.dirname(__file__))  # server
    possible_paths = [
        os.path.join(base_dir, 'data', 'Items.json'),
        os.path.join(os.path.dirname(__file__), 'json', 'Items.json'),
        os.path.join(base_dir, 'assets', 'resources', 'json', 'Items.json'),
        'assets/resources/json/Items.json',
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
    return []

def load_equipment_json():
    """加载所有装备JSON文件（Weapon, Gun, Wing, Dun, Armor）"""
    base_dir = os.path.dirname(os.path.dirname(__file__))  # server
    data_dir = os.path.join(base_dir, 'data')
    
    equipment_files = ['Weapon.json', 'Gun.json', 'Wing.json', 'Dun.json', 'Armor.json']
    all_equipment = []
    
    for filename in equipment_files:
        filepath = os.path.join(data_dir, filename)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    equipment = json.load(f)
                    all_equipment.extend(equipment)
            except Exception as e:
                print(f'⚠️ [ItemEffect] 加载 {filename} 失败: {e}')
    
    return all_equipment

def load_all_items_json():
    """加载所有物品和装备数据"""
    items = load_items_json()
    equipment = load_equipment_json()
    return items + equipment


class ItemEffectManager:
    """物品效果管理器"""
    
    def __init__(self):
        self.handlers = {}
        self._register_handlers()
    
    def _register_handlers(self):
        """注册所有效果处理器"""
        self.handlers['EXP'] = self._handle_exp
        self.handlers['HP'] = self._handle_hp
        self.handlers['MP'] = self._handle_mp
        self.handlers['PET_EXP'] = self._handle_pet_exp
        self.handlers['PET_HP'] = self._handle_pet_hp
        self.handlers['PET_MP'] = self._handle_pet_mp
        self.handlers['ADD_ITEM'] = self._handle_add_item
        self.handlers['ADD_RANDOM_ITEM'] = self._handle_add_random_item
        self.handlers['ADD_ROBOT'] = self._handle_add_robot
        self.handlers['ADD_RANDOM_ROBOT'] = self._handle_add_random_robot
        self.handlers['PET_RESET'] = self._handle_pet_reset  # 还原晶体
        self.handlers['PET_REBORN'] = self._handle_pet_reborn  # 重生晶体
        self.handlers['PET_EVOLVE'] = self._handle_pet_evolve  # 进化水晶
        self.handlers['PET_DISASSEMBLE_PARTS'] = self._handle_pet_disassemble_parts  # 机甲分解晶体
        self.handlers['PET_DISASSEMBLE_EXP'] = self._handle_pet_disassemble_exp  # 经验分解晶体
        # 注意：EQUIP_ATTRIBUTES 效果通过 apply_equipment_attributes 方法直接调用，不通过 effect_str

    def _convert_aniid_for_form(self, ani_id: str, target_form: int) -> str:
        """
        根据形态替换 AniID 中的 L1/L2/L3 标识，资源命名规则为 {AniID}-0。
        如果无法解析则返回原值。
        """
        if not ani_id or target_form not in (1, 2, 3):
            return ani_id
        replacements = ['L1', 'L2', 'L3']
        new_tag = f'L{target_form}'
        for tag in replacements:
            if tag in ani_id:
                return ani_id.replace(tag, new_tag)
        return ani_id
    
    async def apply(self, effect_str: str, user_id, character_id, 
                   target_type: str, pet_id: Optional[str] = None, 
                   item_id: Optional[int] = None, item_data: Optional[Dict] = None) -> Dict:
        """
        应用物品效果
        
        Args:
            effect_str: 效果字符串，如 "EXP:50000" 或 "HP:1000|MP:500"
            user_id: 用户ID
            character_id: 角色ID
            target_type: 目标类型 ('Player' 或 'Pet')
            pet_id: 机甲ID（如果目标类型是 Pet）
            item_id: 物品ID（用于日志）
            item_data: 物品配置数据（可选，用于智能转换）
        
        Returns:
            {
                'success': bool,
                'message': str,
                'data': dict,
                'results': list  # 多个效果的详细结果
            }
        """
        if not effect_str or not effect_str.strip():
            return {'success': True, 'message': '无效果', 'results': []}
        
        # 支持多个效果用 | 分隔
        effects = [e.strip() for e in effect_str.split('|')]
        results = []
        
        for effect in effects:
            # 支持无参数效果（如 PET_RESET、PET_REBORN、ADD_RANDOM_ROBOT）
            if ':' in effect:
                parts = effect.split(':', 1)
                effect_type = parts[0].strip().upper()
                params_str = parts[1].strip() if len(parts) > 1 else ''
            else:
                effect_type = effect.strip().upper()
                params_str = ''
            
            # 智能转换：如果 UsageTarget 是 Pet 但效果是 EXP/HP/MP，自动转换为 PET_EXP/PET_HP/PET_MP
            if item_data and item_data.get('UsageTarget') == 'Pet':
                if effect_type == 'EXP':
                    effect_type = 'PET_EXP'
                    print(f'🔄 [ItemEffect] 自动转换: EXP -> PET_EXP (物品 UsageTarget 是 Pet)')
                elif effect_type == 'HP' and target_type == 'Pet':
                    effect_type = 'PET_HP'
                    print(f'🔄 [ItemEffect] 自动转换: HP -> PET_HP (物品 UsageTarget 是 Pet)')
                elif effect_type == 'MP' and target_type == 'Pet':
                    effect_type = 'PET_MP'
                    print(f'🔄 [ItemEffect] 自动转换: MP -> PET_MP (物品 UsageTarget 是 Pet)')
            
            handler = self.handlers.get(effect_type)
            if not handler:
                results.append({
                    'success': False,
                    'error': f'未知效果类型: {effect_type}',
                    'effect_type': effect_type
                })
                continue
            
            try:
                result = await handler(params_str, user_id, character_id, 
                                      target_type, pet_id, item_id)
                result['effect_type'] = effect_type
                results.append(result)
            except Exception as e:
                import traceback
                print(f'❌ [ItemEffect] 应用效果失败: {e}')
                print(traceback.format_exc())
                results.append({
                    'success': False,
                    'error': str(e),
                    'effect_type': effect_type
                })
        
        # 检查是否有失败的效果
        failed = [r for r in results if not r.get('success')]
        if failed:
            return {
                'success': False,
                'error': failed[0].get('error', '效果应用失败'),
                'results': results
            }
        
        return {
            'success': True,
            'message': f'成功应用 {len(results)} 个效果',
            'results': results
        }
    
    # ========== 基础效果处理器 ==========
    
    async def _handle_exp(self, params: str, user_id, character_id, 
                         target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """处理玩家经验"""
        if target_type != 'Player':
            return {'success': False, 'error': '经验效果只能对玩家使用'}
        
        try:
            exp_amount = int(params)
        except ValueError:
            return {'success': False, 'error': f'无效的经验值: {params}'}
        
        if exp_amount <= 0:
            return {'success': False, 'error': '经验值必须大于0'}
        
        player = utils.players_col.find_one({
            'user_id': user_id,
            'character_id': character_id
        })
        if not player:
            return {'success': False, 'error': '角色不存在'}
        
        # 使用现有的经验计算函数
        from ws_server import add_exp_to_player
        new_level, new_exp, level_up_count = add_exp_to_player(player, exp_amount)
        
        utils.players_col.update_one(
            {'user_id': user_id, 'character_id': character_id},
            {'$set': {'level': new_level, 'exp': new_exp}}
        )
        
        return {
            'success': True,
            'message': f'获得 {exp_amount} 经验',
            'data': {
                'old_level': player.get('level', 1),
                'new_level': new_level,
                'old_exp': player.get('exp', 0),
                'new_exp': new_exp,
                'exp_gained': exp_amount,
                'level_up_count': level_up_count
            }
        }
    
    async def _handle_hp(self, params: str, user_id, character_id,
                        target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """处理HP恢复"""
        # 解析参数（支持数值或百分比）
        if params.endswith('%'):
            try:
                percent = float(params[:-1])
                is_percent = True
            except ValueError:
                return {'success': False, 'error': f'无效的百分比值: {params}'}
        else:
            try:
                amount = int(params)
                is_percent = False
            except ValueError:
                return {'success': False, 'error': f'无效的HP值: {params}'}
        
        if target_type == 'Player':
            player = utils.players_col.find_one({
                'user_id': user_id,
                'character_id': character_id
            })
            if not player:
                return {'success': False, 'error': '角色不存在'}
            
            max_hp = player.get('MaxHP', 1000)
            current_hp = player.get('CurrentHP', max_hp)
            
            if is_percent:
                restore = int(max_hp * percent / 100)
            else:
                restore = amount
            
            new_hp = min(current_hp + restore, max_hp)
            actual_restore = new_hp - current_hp
            
            utils.players_col.update_one(
                {'user_id': user_id, 'character_id': character_id},
                {'$set': {'CurrentHP': new_hp}}
            )
            
            return {
                'success': True,
                'message': f'恢复 {actual_restore} HP',
                'data': {
                    'old_hp': current_hp,
                    'new_hp': new_hp,
                    'max_hp': max_hp,
                    'restore_amount': actual_restore
                }
            }
        
        elif target_type == 'Pet':
            if not pet_id:
                return {'success': False, 'error': '需要指定机甲ID'}
            from bson import ObjectId
            try:
                pet_object_id = ObjectId(pet_id)
            except Exception:
                return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
            
            pet = utils.robotpet_col.find_one({
                '_id': pet_object_id,
                'user_id': user_id,
                'character_id': character_id
            })
            if not pet:
                return {'success': False, 'error': '机甲不存在'}
            
            max_hp = pet.get('MaxHP', 1000)
            current_hp = pet.get('CurrentHP', max_hp)
            
            if is_percent:
                restore = int(max_hp * percent / 100)
            else:
                restore = amount
            
            new_hp = min(current_hp + restore, max_hp)
            actual_restore = new_hp - current_hp
            
            utils.robotpet_col.update_one(
                {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
                {'$set': {'CurrentHP': new_hp}}
            )
            
            return {
                'success': True,
                'message': f'机甲恢复 {actual_restore} HP',
                'data': {
                    'old_hp': current_hp,
                    'new_hp': new_hp,
                    'max_hp': max_hp,
                    'restore_amount': actual_restore
                }
            }
        
        return {'success': False, 'error': '无效的目标类型'}
    
    async def _handle_mp(self, params: str, user_id, character_id,
                        target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """处理MP恢复（与HP类似）"""
        # 解析参数
        if params.endswith('%'):
            try:
                percent = float(params[:-1])
                is_percent = True
            except ValueError:
                return {'success': False, 'error': f'无效的百分比值: {params}'}
        else:
            try:
                amount = int(params)
                is_percent = False
            except ValueError:
                return {'success': False, 'error': f'无效的MP值: {params}'}
        
        if target_type == 'Player':
            player = utils.players_col.find_one({
                'user_id': user_id,
                'character_id': character_id
            })
            if not player:
                return {'success': False, 'error': '角色不存在'}
            
            max_mp = player.get('MaxMP', 500)
            current_mp = player.get('CurrentMP', max_mp)
            
            if is_percent:
                restore = int(max_mp * percent / 100)
            else:
                restore = amount
            
            new_mp = min(current_mp + restore, max_mp)
            actual_restore = new_mp - current_mp
            
            utils.players_col.update_one(
                {'user_id': user_id, 'character_id': character_id},
                {'$set': {'CurrentMP': new_mp}}
            )
            
            return {
                'success': True,
                'message': f'恢复 {actual_restore} MP',
                'data': {
                    'old_mp': current_mp,
                    'new_mp': new_mp,
                    'max_mp': max_mp,
                    'restore_amount': actual_restore
                }
            }
        
        elif target_type == 'Pet':
            if not pet_id:
                return {'success': False, 'error': '需要指定机甲ID'}
            from bson import ObjectId
            try:
                pet_object_id = ObjectId(pet_id)
            except Exception:
                return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
            
            pet = utils.robotpet_col.find_one({
                '_id': pet_object_id,
                'user_id': user_id,
                'character_id': character_id
            })
            if not pet:
                return {'success': False, 'error': '机甲不存在'}
            
            max_mp = pet.get('MaxMP', 300)
            current_mp = pet.get('CurrentMP', max_mp)
            
            if is_percent:
                restore = int(max_mp * percent / 100)
            else:
                restore = amount
            
            new_mp = min(current_mp + restore, max_mp)
            actual_restore = new_mp - current_mp
            
            utils.robotpet_col.update_one(
                {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
                {'$set': {'CurrentMP': new_mp}}
            )
            
            return {
                'success': True,
                'message': f'机甲恢复 {actual_restore} MP',
                'data': {
                    'old_mp': current_mp,
                    'new_mp': new_mp,
                    'max_mp': max_mp,
                    'restore_amount': actual_restore
                }
            }
        
        return {'success': False, 'error': '无效的目标类型'}
    
    async def _handle_pet_exp(self, params: str, user_id, character_id,
                             target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """处理机甲经验"""
        if target_type != 'Pet' or not pet_id:
            return {'success': False, 'error': '机甲经验效果需要指定机甲'}
        
        try:
            exp_amount = int(params)
        except ValueError:
            return {'success': False, 'error': f'无效的经验值: {params}'}
        
        if exp_amount <= 0:
            return {'success': False, 'error': '经验值必须大于0'}
        
        from .robot_upgrade import RobotUpgradeManager
        from bson import ObjectId
        
        upgrade_manager = RobotUpgradeManager()
        
        # add_exp_to_robot_atomic 返回 tuple: (新等级, 新总经验, 升级次数, 更新后的属性字典)
        try:
            pet_object_id = ObjectId(pet_id)
        except Exception:
            return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
        
        new_level, new_exp, level_up_count, updated_attrs = upgrade_manager.add_exp_to_robot_atomic(
            utils.robotpet_col, pet_object_id, user_id, exp_amount
        )
        
        # 检查是否成功（如果返回 None 表示失败）
        if new_level is None or new_exp is None:
            return {
                'success': False,
                'error': '机甲不存在、不属于用户或已满级'
            }
        
        # 更新数据库中的属性
        if updated_attrs:
            update_data = {
                'Level': new_level,
                'EXP': new_exp,
                **updated_attrs
            }
            utils.robotpet_col.update_one(
                {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
                {'$set': update_data}
            )
        
        return {
            'success': True,
            'message': f'机甲获得 {exp_amount} 经验' + (f'，升级 {level_up_count} 级' if level_up_count > 0 else ''),
            'data': {
                'new_level': new_level,
                'new_exp': new_exp,
                'level_up_count': level_up_count,
                'updated_attrs': updated_attrs
            }
        }
    
    async def _handle_pet_hp(self, params: str, user_id, character_id,
                            target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """处理机甲HP（复用_handle_hp逻辑）"""
        return await self._handle_hp(params, user_id, character_id, target_type, pet_id, item_id)
    
    async def _handle_pet_mp(self, params: str, user_id, character_id,
                             target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """处理机甲MP"""
        return await self._handle_mp(params, user_id, character_id, target_type, pet_id, item_id)
    
    # ========== 奖励效果处理器 ==========
    
    async def _handle_add_item(self, params: str, user_id, character_id,
                              target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """添加物品到背包"""
        parts = params.split(':')
        if len(parts) < 2:
            return {'success': False, 'error': '参数格式错误：ADD_ITEM:物品ID:数量'}
        
        try:
            target_item_id = int(parts[0])
            quantity = int(parts[1])
        except ValueError:
            return {'success': False, 'error': '物品ID或数量格式错误'}
        
        if quantity <= 0:
            return {'success': False, 'error': '数量必须大于0'}
        
        # 获取背包
        from .bag_handler import merge_inventory_items, split_inventory_items
        doc = utils.inventory_col.find_one({
            'user_id': user_id,
            'character_id': character_id
        })
        items = merge_inventory_items(doc) if doc else []
        
        # 使用现有的堆叠逻辑
        from .bag_handler import _normalize_and_stack_items, _item_config, load_valid_item_ids
        
        # 确保配置已加载
        if _item_config is None:
            load_valid_item_ids()
        
        # 查找是否已有该物品
        found = False
        for item in items:
            if item.get('item_id') == target_item_id:
                # 检查是否可以堆叠
                config = _item_config.get(target_item_id, {})
                can_stack = config.get('CanStack', True)
                stack_limit = config.get('StackLimit', 99)
                
                if can_stack:
                    # 可以堆叠
                    current_qty = item.get('quantity', 0)
                    # 计算可以添加的数量
                    can_add = min(quantity, stack_limit - current_qty)
                    if can_add > 0:
                        item['quantity'] = current_qty + can_add
                        quantity -= can_add
                        found = True
                        if quantity <= 0:
                            break
                else:
                    # 不可堆叠，跳过
                    continue
        
        # 根据物品的itypeId自动分配分类
        # 分类映射：1=Items, 2=Weapon+Gun(武器), 3=Wing+Dun+Armor(护甲)
        def get_category_by_item_id(item_id):
            from .bag_handler import load_all_item_ids_data
            all_items_data = load_all_item_ids_data()
            for item in all_items_data:
                if item.get('id') == item_id:
                    itype_id = item.get('itypeId', 1)
                    if itype_id == 1:
                        return 1  # Items
                    elif itype_id in [2, 3]:  # Weapon, Gun
                        return 2  # 武器
                    elif itype_id in [4, 5, 6]:  # Wing, Dun, Armor
                        return 3  # 护甲
            return 1  # 默认分类为Items
        
        # 如果还有剩余，添加新格子
        while quantity > 0:
            config = _item_config.get(target_item_id, {})
            stack_limit = config.get('StackLimit', 99)
            add_qty = min(quantity, stack_limit)
            
            category = get_category_by_item_id(target_item_id)
            items.append({
                'item_id': target_item_id,
                'quantity': add_qty,
                'category': category
            })
            quantity -= add_qty
        
        # 规范化堆叠
        items = _normalize_and_stack_items(items)
        
        # 按分类拆分到三个字段
        inventory_data = split_inventory_items(items)
        inventory_data['user_id'] = user_id
        inventory_data['character_id'] = character_id
        
        # 更新数据库
        utils.inventory_col.replace_one(
            {'user_id': user_id, 'character_id': character_id},
            inventory_data,
            upsert=True
        )
        
        return {
            'success': True,
            'message': f'获得物品 {target_item_id} x{int(parts[1])}',
            'data': {
                'item_id': target_item_id,
                'quantity': int(parts[1])
            }
        }
    
    async def _handle_add_random_item(self, params: str, user_id, character_id,
                                     target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """添加随机物品"""
        parts = params.split(':')
        if len(parts) < 2:
            return {'success': False, 'error': '参数格式错误：ADD_RANDOM_ITEM:物品ID1,物品ID2,...:数量'}
        
        try:
            item_ids_str = parts[0]
            quantity = int(parts[1])
        except ValueError:
            return {'success': False, 'error': '数量格式错误'}
        
        # 解析物品ID列表
        item_ids = []
        for item_id_str in item_ids_str.split(','):
            try:
                item_ids.append(int(item_id_str.strip()))
            except ValueError:
                continue
        
        if not item_ids:
            return {'success': False, 'error': '没有有效的物品ID'}
        
        # 随机选择一个物品ID
        selected_item_id = random.choice(item_ids)
        
        # 调用添加物品处理器
        return await self._handle_add_item(f'{selected_item_id}:{quantity}', 
                                          user_id, character_id, target_type, pet_id, item_id)
    
    async def _handle_add_robot(self, params: str, user_id, character_id,
                                target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """添加指定机甲"""
        if not params or not params.strip():
            return {'success': False, 'error': '需要指定机甲ID'}
        
        # 这里需要根据机甲ID查找RobotBase
        # 暂时返回错误，因为需要知道如何根据ID查找机甲
        return {'success': False, 'error': '添加指定机甲功能待实现（需要机甲ID映射）'}
    
    async def _handle_add_random_robot(self, params: str, user_id, character_id,
                                      target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """添加随机机甲"""
        # 从 RobotBase 随机选择
        sample = utils.safe_mongo_operation(
            lambda: list(utils.robotbase_col.aggregate([{'$sample': {'size': 1}}]))
        )
        
        if not sample:
            return {'success': False, 'error': 'RobotBase集合为空，无法创建机甲'}
        
        base_robot = sample[0]
        from ws_server import create_robot_pet
        robot_pet = create_robot_pet(user_id, character_id, base_robot)
        
        # 更新机甲数量
        robot_count = utils.compute_robot_count(user_id, character_id)
        utils.players_col.update_one(
            {'user_id': user_id, 'character_id': character_id},
            {'$set': {'robotcount': robot_count}}
        )
        
        return {
            'success': True,
            'message': f'获得机甲: {base_robot.get("RobotName", "")}',
            'data': {
                'pet_id': str(robot_pet.get('_id')),
                'robot_name': base_robot.get('RobotName', ''),
                'robot_id': base_robot.get('RobotID', ''),
                'growth': robot_pet.get('Growth', 50),
                'comprehension': robot_pet.get('Comprehension', 50),
                'level': robot_pet.get('Level', 1)
            }
        }
    
    async def _handle_pet_reset(self, params: str, user_id, character_id,
                                target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """处理还原晶体效果 - 将机甲还原为1级，使用RobotPet_backup备份"""
        if target_type != 'Pet' or not pet_id:
            return {'success': False, 'error': '还原晶体需要指定机甲'}
        
        from bson import ObjectId
        
        try:
            pet_object_id = ObjectId(pet_id)
        except Exception:
            return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
        
        # 获取机甲数据
        pet = utils.robotpet_col.find_one({
            '_id': pet_object_id,
            'user_id': user_id,
            'character_id': character_id
        })
        
        if not pet:
            return {'success': False, 'error': '机甲不存在'}

        # 检查是否有备份
        backup = pet.get('RobotPet_backup')
        if not backup:
            return {'success': False, 'error': '机甲没有备份数据，无法还原'}

        from . import bag_handler
        from .equipment_handler import strip_all_equipment_to_bag
        strip_res = await strip_all_equipment_to_bag(
            user_id, character_id, pet_id, bag_handler._add_item_to_inventory
        )
        if not strip_res.get('success'):
            return {'success': False, 'error': strip_res.get('error', '卸下装备失败')}
        
        # 从备份恢复所有属性
        update_data = {
            'Level': 1,
            'EXP': 0,
            'CurrentEXP': 0,
            'StarLevel': backup.get('StarLevel', 1),
            'Form': 1,
            'AniID': self._convert_aniid_for_form(backup.get('AniID', ''), 1)
        }
        
        # 恢复所有备份的属性
        backup_fields = [
            'HP', 'MaxHP', 'CurrentHP', 'MP', 'MaxMP', 'CurrentMP',
            'Melee', 'Shooting', 'Armor', 'Evasion', 'Accuracy',
            'Lethality', 'Corrosion', 'Resistance', 'Initiative',
            'Counterattack', 'Block', 'ArmorPenetration', 'ParticleShield',
            'CurrentMelee', 'CurrentShooting', 'CurrentArmor', 'CurrentEvasion',
            'CurrentAccuracy', 'CurrentLethality', 'CurrentCorrosion', 'CurrentResistance',
            'CurrentInitiative', 'CurrentCounterattack', 'CurrentBlock',
            'CurrentArmorPenetration', 'CurrentParticleShield',
            'Growth', 'Comprehension'
        ]
        
        for field in backup_fields:
            if field in backup:
                update_data[field] = backup[field]
        
        # 清除升星加成率和独特成长值（还原晶体会删除这些）
        update_data['_star_bonus_rates'] = []
        update_data['UniqueGrowthValue'] = backup.get('UniqueGrowthValue', 0)
        
        # 更新数据库
        utils.robotpet_col.update_one(
            {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
            {'$set': update_data}
        )
        
        return {
            'success': True,
            'message': f'机甲 {pet.get("RobotName", "")} 已还原为1级',
            'data': {
                'pet_id': pet_id,
                'robot_name': pet.get('RobotName', ''),
                'old_level': pet.get('Level', 1),
                'new_level': 1
            }
        }
    
    async def _handle_pet_evolve(self, params: str, user_id, character_id,
                                 target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """处理进化水晶效果 - Form 进阶并叠加属性"""
        if target_type != 'Pet' or not pet_id:
            return {'success': False, 'error': '进化需要指定机甲'}
        
        from bson import ObjectId
        from .robot_upgrade import RobotUpgradeManager
        
        try:
            target_form = int(params) if params else 0
        except ValueError:
            return {'success': False, 'error': f'无效的进化形态: {params}'}
        
        if target_form not in (2, 3):
            return {'success': False, 'error': '进化形态只支持 2 或 3'}
        
        try:
            pet_object_id = ObjectId(pet_id)
        except Exception:
            return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
        
        pet = utils.robotpet_col.find_one({
            '_id': pet_object_id,
            'user_id': user_id,
            'character_id': character_id
        })
        
        if not pet:
            return {'success': False, 'error': '机甲不存在'}
        
        robot_id = pet.get('RobotID')
        blocked_ids = {'80', '81', '73', '60', '59', '58', '57', '56', '46'}
        if str(robot_id) in blocked_ids:
            return {'success': False, 'error': '该机甲禁止进化'}
        
        current_form = int(pet.get('Form', 1) or 1)
        if current_form >= 3:
            return {'success': False, 'error': '已达最高形态'}
        if target_form != current_form + 1:
            return {'success': False, 'error': f'当前形态为 L{current_form}，只能进化到 L{current_form + 1}'}
        
        # 等级校验
        req_level = 25 if target_form == 2 else 45
        level = int(pet.get('Level', 1) or 1)
        if level < req_level:
            return {'success': False, 'error': f'等级不足，需达到 {req_level} 级'}
        
        # 计算目标等级基础属性
        upgrade_manager = RobotUpgradeManager()
        calc_source = pet.get('RobotPet_backup') or pet
        calc_pet = dict(calc_source)
        calc_pet['Level'] = req_level
        target_attrs = upgrade_manager.calculate_attributes(calc_pet, robot_id=calc_pet.get('RobotID', ''))
        target_attrs = upgrade_manager.add_star_bonus(calc_pet, target_attrs)
        target_attrs = upgrade_manager.apply_unique_growth(calc_pet, target_attrs)
        
        coeff = 0.2 if target_form == 2 else 0.3
        update_data = {}
        for attr, base_val in target_attrs.items():
            try:
                delta = int(round(base_val * coeff))
            except Exception:
                continue
            current_val = pet.get(attr, 0)
            try:
                current_val = int(current_val)
            except Exception:
                current_val = 0
            update_data[attr] = current_val + delta
        
        # 同步 HP/MP 当前值不超过最大值
        if 'MaxHP' in update_data:
            update_data['CurrentHP'] = min(update_data.get('CurrentHP', pet.get('CurrentHP', update_data['MaxHP'])), update_data['MaxHP'])
        if 'MaxMP' in update_data:
            update_data['CurrentMP'] = min(update_data.get('CurrentMP', pet.get('CurrentMP', update_data['MaxMP'])), update_data['MaxMP'])
        
        new_aniid = self._convert_aniid_for_form(pet.get('AniID', ''), target_form)
        update_data.update({
            'Form': target_form,
            'AniID': new_aniid,
        })
        
        utils.robotpet_col.update_one(
            {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
            {'$set': update_data}
        )

        try:
            from . import bag_handler
            from .equipment_handler import strip_invalid_equipment_for_pet
            await strip_invalid_equipment_for_pet(
                user_id, character_id, pet_id, bag_handler._add_item_to_inventory
            )
        except Exception as _ev_err:
            print(f'⚠️ [ItemEffect] PET_EVOLVE 后自动卸下违规装备失败: {_ev_err}')
        
        return {
            'success': True,
            'message': f'机甲进化至 L{target_form}',
            'data': {
                'pet_id': pet_id,
                'new_form': target_form,
                'ani_id': new_aniid,
                'updated_attrs': update_data
            }
        }
    
    async def _handle_pet_reborn(self, params: str, user_id, character_id,
                                 target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """处理重生晶体效果 - 将机甲还原为1级，随机刷新成长、悟性和基础属性"""
        if target_type != 'Pet' or not pet_id:
            return {'success': False, 'error': '重生晶体需要指定机甲'}
        
        from bson import ObjectId
        import random
        import datetime
        
        try:
            pet_object_id = ObjectId(pet_id)
        except Exception:
            return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
        
        # 获取机甲数据
        pet = utils.robotpet_col.find_one({
            '_id': pet_object_id,
            'user_id': user_id,
            'character_id': character_id
        })
        
        if not pet:
            return {'success': False, 'error': '机甲不存在'}

        from . import bag_handler
        from .equipment_handler import strip_all_equipment_to_bag
        strip_res = await strip_all_equipment_to_bag(
            user_id, character_id, pet_id, bag_handler._add_item_to_inventory
        )
        if not strip_res.get('success'):
            return {'success': False, 'error': strip_res.get('error', '卸下装备失败')}
        
        # 获取 robot_base_id
        robot_base_id = pet.get('robot_base_id')
        if not robot_base_id:
            return {'success': False, 'error': '机甲缺少基础数据ID，无法重生'}
        
        # 从 RobotBase 获取基础数据
        base_robot = utils.robotbase_col.find_one({'_id': ObjectId(robot_base_id)})
        if not base_robot:
            return {'success': False, 'error': '找不到机甲基础数据'}
        
        # 重新随机生成成长值和悟性值（与创建时相同的逻辑）
        unique_growth_value = random.uniform(5, 15)
        use_special_values = random.random() < 0.05
        
        if use_special_values:
            special_case = random.random()
            if special_case < 0.35:
                growth = 100
                comprehension = 100
            elif special_case < 0.65:
                growth = 80
                comprehension = 100
            elif special_case < 0.75:
                growth = 60
                comprehension = 80
            else:
                growth = 100
                comprehension = 80
        else:
            growth = random.randint(50, 100)
            comprehension = random.randint(50, 100)
        
        # 重新生成基础属性（从 RobotBase 复制）
        update_data = {}
        
        # 复制基础属性
        base_fields = [
            'HP', 'MaxHP', 'MP', 'MaxMP',
            'Melee', 'Shooting', 'Armor', 'Evasion', 'Accuracy',
            'Lethality', 'Corrosion', 'Resistance', 'Initiative',
            'Counterattack', 'Block', 'ArmorPenetration', 'ParticleShield',
            'RobotID', 'RobotName', 'Class', 'Form', 'AniID'
        ]
        
        for field in base_fields:
            if field in base_robot:
                update_data[field] = base_robot[field]
        
        # 属性随机化（±5%）
        random_factor = random.uniform(0.95, 1.05)
        randomize_attrs = [
            'HP', 'MaxHP', 'MP', 'MaxMP',
            'Melee', 'Shooting', 'Armor', 'Evasion', 'Accuracy',
            'Lethality', 'Corrosion', 'Resistance', 'Initiative',
            'Counterattack', 'Block', 'ArmorPenetration', 'ParticleShield'
        ]
        
        for attr in randomize_attrs:
            if attr in update_data and isinstance(update_data[attr], (int, float)) and update_data[attr] > 0:
                original_value = update_data[attr]
                randomized_value = int(original_value * random_factor)
                update_data[attr] = max(1, randomized_value)
        
        # 设置 Current 前缀字段
        current_field_mappings = {
            'CurrentMelee': 'Melee',
            'CurrentArmor': 'Armor',
            'CurrentAccuracy': 'Accuracy',
            'CurrentCorrosion': 'Corrosion',
            'CurrentInitiative': 'Initiative',
            'CurrentBlock': 'Block',
            'CurrentParticleShield': 'ParticleShield',
            'CurrentArmorPenetration': 'ArmorPenetration',
            'CurrentShooting': 'Shooting',
            'CurrentEvasion': 'Evasion',
            'CurrentLethality': 'Lethality',
            'CurrentResistance': 'Resistance',
            'CurrentCounterattack': 'Counterattack'
        }
        
        for current_key, base_key in current_field_mappings.items():
            update_data[current_key] = update_data.get(base_key, 0)
        
        # 设置 CurrentHP 和 CurrentMP
        update_data['CurrentHP'] = update_data.get('MaxHP', update_data.get('HP', 1000))
        update_data['CurrentMP'] = update_data.get('MaxMP', update_data.get('MP', 300))
        
        # 重置等级和经验
        update_data.update({
            'Level': 1,
            'EXP': 0,
            'CurrentEXP': 0,
            'StarLevel': 1,
            'Growth': growth,
            'Comprehension': comprehension,
            'UniqueGrowthValue': unique_growth_value,
            '_star_bonus_rates': [],  # 清除升星加成
            'Form': 1,
            'AniID': self._convert_aniid_for_form(update_data.get('AniID', ''), 1),
        })
        
        # 重新创建备份
        robot_pet_backup = {}
        backup_fields = [
            'HP', 'MaxHP', 'CurrentHP', 'MP', 'MaxMP', 'CurrentMP',
            'Melee', 'Shooting', 'Armor', 'Evasion', 'Accuracy',
            'Lethality', 'Corrosion', 'Resistance', 'Initiative',
            'Counterattack', 'Block', 'ArmorPenetration', 'ParticleShield',
            'CurrentMelee', 'CurrentShooting', 'CurrentArmor', 'CurrentEvasion',
            'CurrentAccuracy', 'CurrentLethality', 'CurrentCorrosion', 'CurrentResistance',
            'CurrentInitiative', 'CurrentCounterattack', 'CurrentBlock',
            'CurrentArmorPenetration', 'CurrentParticleShield',
            'Growth', 'Comprehension', 'StarLevel', 'Level', 'EXP',
            'RobotID', 'RobotName', 'Class', 'Form', 'AniID'
        ]
        
        for field in backup_fields:
            if field in update_data:
                robot_pet_backup[field] = update_data[field]
        
        update_data['RobotPet_backup'] = robot_pet_backup
        
        # 更新数据库
        utils.robotpet_col.update_one(
            {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
            {'$set': update_data}
        )
        
        return {
            'success': True,
            'message': f'机甲 {pet.get("RobotName", "")} 已重生，成长: {growth}, 悟性: {comprehension}',
            'data': {
                'pet_id': pet_id,
                'robot_name': pet.get('RobotName', ''),
                'old_level': pet.get('Level', 1),
                'new_level': 1,
                'growth': growth,
                'comprehension': comprehension
            }
        }

    async def _handle_pet_disassemble_parts(self, params: str, user_id, character_id,
                                              target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """机甲分解晶体：先卸装备入包，再给零件，再删除机甲。"""
        if target_type != 'Pet' or not pet_id:
            return {'success': False, 'error': '分解晶体需要对机甲使用'}
        from bson import ObjectId
        try:
            pet_object_id = ObjectId(pet_id)
        except Exception:
            return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
        pet = utils.robotpet_col.find_one({
            '_id': pet_object_id,
            'user_id': user_id,
            'character_id': character_id,
        })
        if not pet:
            return {'success': False, 'error': '机甲不存在'}
        from . import bag_handler
        from .equipment_handler import strip_all_equipment_to_bag
        strip_res = await strip_all_equipment_to_bag(
            user_id, character_id, pet_id, bag_handler._add_item_to_inventory
        )
        if not strip_res.get('success'):
            return {'success': False, 'error': strip_res.get('error', '卸下装备失败')}
        level = int(pet.get('Level', 1) or 1)
        star = int(pet.get('StarLevel', 1) or 1)
        n26 = max(2, min(99, level * 2 + star * 3))
        n27 = max(0, min(99, (level // 10) * 2 + (star // 2)))
        await bag_handler._add_item_to_inventory(user_id, character_id, 26, n26)
        if n27 > 0:
            await bag_handler._add_item_to_inventory(user_id, character_id, 27, n27)
        from .robot_handler import remove_robot_pet_from_account, broadcast_robot_pets_after_change
        rm = await remove_robot_pet_from_account(user_id, character_id, pet_id)
        if not rm.get('success'):
            return {'success': False, 'error': '分解后移除机甲失败'}
        await broadcast_robot_pets_after_change(
            user_id, character_id, rm.get('battle_team') or [], bool(rm.get('team_changed'))
        )
        return {
            'success': True,
            'message': f'机甲 {pet.get("RobotName", "")} 已分解为零件',
            'data': {'pet_id': pet_id, 'parts_normal': n26, 'parts_high': n27},
        }

    async def _handle_pet_disassemble_exp(self, params: str, user_id, character_id,
                                          target_type: str, pet_id: Optional[str], item_id: Optional[int]) -> Dict:
        """经验分解晶体：先卸装备入包，再按总经验约 70% 发放经验类道具，再删除机甲。"""
        if target_type != 'Pet' or not pet_id:
            return {'success': False, 'error': '分解晶体需要对机甲使用'}
        from bson import ObjectId
        try:
            pet_object_id = ObjectId(pet_id)
        except Exception:
            return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
        pet = utils.robotpet_col.find_one({
            '_id': pet_object_id,
            'user_id': user_id,
            'character_id': character_id,
        })
        if not pet:
            return {'success': False, 'error': '机甲不存在'}
        from . import bag_handler
        from .equipment_handler import strip_all_equipment_to_bag
        strip_res = await strip_all_equipment_to_bag(
            user_id, character_id, pet_id, bag_handler._add_item_to_inventory
        )
        if not strip_res.get('success'):
            return {'success': False, 'error': strip_res.get('error', '卸下装备失败')}
        total_exp = int(pet.get('EXP', 0) or 0)
        grant_val = max(0, int(total_exp * 0.7))
        TIERS = [
            (161, 10_000_000),
            (135, 5_000_000),
            (187, 2_000_000),
            (200, 1_000_000),
            (122, 500_000),
            (174, 100_000),
            (109, 50_000),
        ]
        remaining = grant_val
        granted = []
        for iid, unit in TIERS:
            if remaining <= 0:
                break
            if remaining >= unit:
                q = min(99, remaining // unit)
                if q > 0:
                    await bag_handler._add_item_to_inventory(user_id, character_id, iid, q)
                    granted.append({'item_id': iid, 'qty': q})
                    remaining -= q * unit
        if grant_val <= 0:
            await bag_handler._add_item_to_inventory(user_id, character_id, 109, 1)
            granted.append({'item_id': 109, 'qty': 1})
        elif remaining > 0:
            await bag_handler._add_item_to_inventory(user_id, character_id, 174, 1)
            granted.append({'item_id': 174, 'qty': 1})
        from .robot_handler import remove_robot_pet_from_account, broadcast_robot_pets_after_change
        rm = await remove_robot_pet_from_account(user_id, character_id, pet_id)
        if not rm.get('success'):
            return {'success': False, 'error': '分解后移除机甲失败'}
        await broadcast_robot_pets_after_change(
            user_id, character_id, rm.get('battle_team') or [], bool(rm.get('team_changed'))
        )
        return {
            'success': True,
            'message': f'机甲 {pet.get("RobotName", "")} 已分解为经验道具',
            'data': {'pet_id': pet_id, 'grant_exp_value': grant_val, 'granted_items': granted},
        }
    
    async def apply_equipment_attributes(self, item_data: Dict, user_id, character_id,
                                        pet_id: str, item_id: Optional[int] = None) -> Dict:
        """
        应用装备属性加成到机甲
        
        Args:
            item_data: 装备配置数据（包含所有属性字段）
            user_id: 用户ID
            character_id: 角色ID
            pet_id: 机甲ID
            item_id: 物品ID（用于日志）
        
        Returns:
            {
                'success': bool,
                'message': str,
                'data': dict
            }
        """
        if not pet_id:
            return {'success': False, 'error': '需要指定机甲ID'}
        
        from bson import ObjectId
        
        try:
            pet_object_id = ObjectId(pet_id)
        except Exception:
            return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
        
        # 获取机甲数据
        pet = utils.robotpet_col.find_one({
            '_id': pet_object_id,
            'user_id': user_id,
            'character_id': character_id
        })
        
        if not pet:
            return {'success': False, 'error': '机甲不存在'}
        
        # 检查等级要求
        required_level = item_data.get('requiredLevel', 0)
        if required_level > 0:
            pet_level = int(pet.get('Level', 1) or 1)
            if pet_level < required_level:
                return {
                    'success': False,
                    'error': f'机甲等级不足，需要等级 {required_level}，当前等级 {pet_level}'
                }
        
        # 提取装备属性加成
        attribute_updates = {}
        attribute_mapping = {
            'hp': 'HP',
            'mp': 'MP',
            'melee': 'Melee',
            'shoot': 'Shooting',
            'armor': 'Armor',
            'evasion': 'Evasion',
            'accuracy': 'Accuracy',
            'lethality': 'Lethality',
            'corrosion': 'Corrosion',
            'resistance': 'Resistance',
            'initiative': 'Initiative',
            'counterattack': 'Counterattack',
            'block': 'Block',
            'armorPenetration': 'ArmorPenetration',
            'particleShield': 'ParticleShield',
            'energyRecovery': 'EnergyRecovery',
            'lifeRecovery': 'LifeRecovery',
            'attackTimes': 'AttackTimes'
        }
        
        # 收集所有非零属性加成
        applied_attrs = {}
        for json_key, db_key in attribute_mapping.items():
            value = item_data.get(json_key, 0)
            if value and int(value) > 0:
                # 获取当前值
                current_value = int(pet.get(db_key, 0) or 0)
                new_value = current_value + int(value)
                attribute_updates[db_key] = new_value
                applied_attrs[db_key] = int(value)
                
                # 同时更新Current前缀的字段（除了HP和MP）
                if json_key not in ['hp', 'mp']:
                    current_field = f'Current{db_key}'
                    current_current_value = int(pet.get(current_field, 0) or 0)
                    attribute_updates[current_field] = current_current_value + int(value)
        
        # 特殊处理HP和MP
        if 'HP' in attribute_updates:
            max_hp = attribute_updates['HP']
            current_hp = int(pet.get('CurrentHP', max_hp) or max_hp)
            # 确保CurrentHP不超过MaxHP
            attribute_updates['CurrentHP'] = min(current_hp, max_hp)
            attribute_updates['MaxHP'] = max_hp
        
        if 'MP' in attribute_updates:
            max_mp = attribute_updates['MP']
            current_mp = int(pet.get('CurrentMP', max_mp) or max_mp)
            # 确保CurrentMP不超过MaxMP
            attribute_updates['CurrentMP'] = min(current_mp, max_mp)
            attribute_updates['MaxMP'] = max_mp
        
        if not attribute_updates:
            return {'success': True, 'message': '装备无属性加成', 'data': {}}
        
        # 更新数据库
        utils.robotpet_col.update_one(
            {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
            {'$set': attribute_updates}
        )
        
        # 生成属性加成描述
        attr_descriptions = []
        for db_key, added_value in applied_attrs.items():
            attr_name_map = {
                'HP': '生命值', 'MP': '能量值', 'Melee': '格斗', 'Shooting': '射击',
                'Armor': '护甲', 'Evasion': '闪避', 'Accuracy': '命中', 'Lethality': '致命',
                'Corrosion': '腐蚀', 'Resistance': '抗性', 'Initiative': '先攻',
                'Counterattack': '反击', 'Block': '格挡', 'ArmorPenetration': '穿透',
                'ParticleShield': '粒子护盾', 'EnergyRecovery': '能量恢复',
                'LifeRecovery': '生命恢复', 'AttackTimes': '攻击次数'
            }
            attr_name = attr_name_map.get(db_key, db_key)
            attr_descriptions.append(f'{attr_name}+{added_value}')
        
        message = f'装备属性加成成功: {", ".join(attr_descriptions)}'
        
        return {
            'success': True,
            'message': message,
            'data': {
                'pet_id': pet_id,
                'robot_name': pet.get('RobotName', ''),
                'applied_attributes': applied_attrs,
                'updated_attributes': attribute_updates
            }
        }

