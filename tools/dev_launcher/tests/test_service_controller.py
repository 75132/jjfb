"""ServiceController 单元测试。"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.dev_launcher.config import migrate_config
from tools.dev_launcher.service_controller import ServiceController


class TestConfigMigrate(unittest.TestCase):
    def test_removes_broken_paned_sash(self) -> None:
        cfg = migrate_config({"paned_sash": 0, "theme": "dark"})
        self.assertNotIn("paned_sash", cfg)
        self.assertEqual(cfg["theme"], "dark")


class TestServiceController(unittest.TestCase):
    def test_parse_cleanup_ports(self) -> None:
        ctrl = ServiceController()
        ctrl.set_port_spec("5173,8787")
        ports = ctrl.parse_cleanup_ports()
        self.assertIn(5173, ports)
        self.assertIn(8787, ports)

    @patch("tools.dev_launcher.service_controller.pids_listening_on_ports", return_value={})
    def test_scan_ports_empty(self, _mock) -> None:
        ctrl = ServiceController()
        self.assertEqual(ctrl.scan_ports([5173]), {})


if __name__ == "__main__":
    unittest.main()
