# -*- coding: utf-8 -*-
"""初始机甲三选一"""
import asyncio
import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from bson import ObjectId

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestChooseStarterMech(unittest.TestCase):
    def test_starter_options_whitelist(self):
        from handlers.robot_handler import STARTER_MECH_GRANT_LEVEL, STARTER_MECH_OPTIONS

        self.assertEqual(STARTER_MECH_GRANT_LEVEL, 15)
        self.assertEqual(set(STARTER_MECH_OPTIONS.keys()), {0, 3, 6})
        self.assertEqual(STARTER_MECH_OPTIONS[0], '铁壁')
        self.assertEqual(STARTER_MECH_OPTIONS[3], '鹰眼')
        self.assertEqual(STARTER_MECH_OPTIONS[6], '钢板')

    def test_build_level_upgrade_patch_sets_level_15(self):
        from handlers.robot_handler import _build_level_upgrade_patch

        pet = {
            'RobotID': 3,
            'Level': 1,
            'StarLevel': 1,
            'Growth': 80,
            'Comprehension': 80,
            'RobotPet_backup': {
                'RobotID': 3,
                'Level': 1,
                'HP': 1000,
                'MaxHP': 1000,
                'MP': 300,
                'MaxMP': 300,
                'Melee': 50,
                'Shooting': 40,
                'Armor': 30,
            },
        }
        patch = _build_level_upgrade_patch(pet, 15)
        self.assertEqual(patch['Level'], 15)
        self.assertGreater(patch.get('EXP', 0), 0)
        self.assertEqual(patch.get('CurrentHP'), patch.get('MaxHP'))

    def test_reject_when_character_already_has_pets(self):
        async def run():
            from handlers import robot_handler as rh

            sent = []

            async def fake_send_error(websocket, route, message, code=400, request_data=None, **kwargs):
                sent.append({'route': route, 'message': message, 'code': code})

            user = {'_id': 'uid1', 'account': 'test'}
            with patch.object(rh, '_create_robot_pet', lambda *a, **k: {'_id': 'pet1'}), patch.object(
                rh.utils, 'get_user_by_id_or_token', return_value=user
            ), patch.object(
                rh.utils,
                'async_mongo_operation',
                new=unittest.mock.AsyncMock(side_effect=[None, 2]),
            ), patch.object(rh.utils, 'send_error_response', new=fake_send_error):
                await rh.handle_choose_starter_mech(
                    MagicMock(),
                    {'robot_id': 3, 'character_id': 'cid1'},
                    'cid1',
                )
            self.assertTrue(sent)
            self.assertEqual(sent[0]['code'], 409)

        asyncio.run(run())


    def test_reject_when_starter_mech_already_chosen(self):
        async def run():
            from handlers import robot_handler as rh

            sent = []

            async def fake_send_error(websocket, route, message, code=400, request_data=None, **kwargs):
                sent.append({'route': route, 'message': message, 'code': code})

            user = {'_id': 'uid1', 'account': 'test'}
            with patch.object(rh, '_create_robot_pet', lambda *a, **k: {'_id': 'pet1'}), patch.object(
                rh.utils, 'get_user_by_id_or_token', return_value=user
            ), patch.object(
                rh.utils,
                'async_mongo_operation',
                new=unittest.mock.AsyncMock(side_effect=[{'starter_mech_chosen': True}, 0]),
            ), patch.object(rh.utils, 'send_error_response', new=fake_send_error):
                await rh.handle_choose_starter_mech(
                    MagicMock(),
                    {'robot_id': 3, 'character_id': 'cid1'},
                    'cid1',
                )
            self.assertTrue(sent)
            self.assertEqual(sent[0]['code'], 409)
            self.assertIn('无法更改', sent[0]['message'])

        asyncio.run(run())

    def test_reject_release_last_robot(self):
        async def run():
            from handlers import robot_handler as rh

            sent = []

            async def fake_send_error(websocket, route, message, code=400, request_data=None, **kwargs):
                sent.append({'route': route, 'message': message, 'code': code})

            user = {'_id': 'uid1', 'account': 'test'}
            pet = {'_id': ObjectId('674f1f77bcf86cd799439011'), 'RobotName': '铁壁'}
            with patch.object(rh.utils, 'get_user_by_id_or_token', return_value=user), patch.object(
                rh.utils,
                'async_mongo_operation',
                new=unittest.mock.AsyncMock(side_effect=[
                    pet,
                    1,
                ]),
            ), patch.object(rh.utils, 'send_error_response', new=fake_send_error):
                await rh.handle_robot_release_pet(
                    MagicMock(),
                    {'pet_id': '674f1f77bcf86cd799439011', 'character_id': 'cid1'},
                    'cid1',
                )
            self.assertTrue(sent)
            self.assertEqual(sent[0]['code'], 409)
            self.assertIn('至少保留', sent[0]['message'])

        asyncio.run(run())

    def test_find_robot_base_fallback_by_name(self):
        from handlers import robot_handler as rh

        fake_doc = {'_id': 'base1', 'RobotID': 1, 'RobotName': '铁臂|初'}
        with patch.object(
            rh.utils,
            'safe_mongo_operation',
            side_effect=[None] * 7 + [fake_doc],
        ):
            doc = rh._find_robot_base_by_robot_id(0)
        self.assertEqual(doc, fake_doc)

    def test_starter_name_aliases_include_tiebi(self):
        from handlers.robot_handler import STARTER_MECH_NAME_ALIASES

        self.assertIn('铁臂', STARTER_MECH_NAME_ALIASES[0])
        self.assertIn('铁壁', STARTER_MECH_NAME_ALIASES[0])


if __name__ == '__main__':
    unittest.main()
