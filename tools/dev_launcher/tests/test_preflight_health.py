"""dev_launcher 单元测试。"""
from __future__ import annotations

import shutil
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.dev_launcher.preflight import check_service_preflight
from tools.dev_launcher.process_utils import (
    check_health,
    decode_subprocess_bytes,
    format_port_busy,
    parse_port_spec,
    probe_http,
    service_health_ready,
)
from tools.dev_launcher.services import HealthCheck, SERVICES


class TestParsePortSpec(unittest.TestCase):
    def test_range_and_list(self) -> None:
        self.assertEqual(parse_port_spec("5173,8080-8082"), [5173, 8080, 8081, 8082])


class TestFormatPortBusy(unittest.TestCase):
    def test_format(self) -> None:
        self.assertEqual(format_port_busy({5173: [1234, 5678], 8787: [9999]}), "5173=PID1234,5678, 8787=PID9999")


class TestProbeHttp(unittest.TestCase):
    @patch("tools.dev_launcher.process_utils.urllib.request.urlopen")
    def test_ok_response(self, mock_urlopen) -> None:
        mock_urlopen.return_value.__enter__.return_value.status = 200
        ok, code = probe_http("http://127.0.0.1:8787/api/health")
        self.assertTrue(ok)
        self.assertEqual(code, 200)

    @patch("tools.dev_launcher.process_utils.urllib.request.urlopen")
    def test_http_error_still_counts_as_response(self, mock_urlopen) -> None:
        import urllib.error

        mock_urlopen.side_effect = urllib.error.HTTPError("url", 404, "n/a", {}, None)
        ok, code = probe_http("http://127.0.0.1:5173/")
        self.assertTrue(ok)
        self.assertEqual(code, 404)


class TestCheckHealth(unittest.TestCase):
    @patch("tools.dev_launcher.process_utils.probe_http", return_value=(True, 200))
    def test_require_ok_pass(self, _mock) -> None:
        self.assertTrue(check_health(HealthCheck("http://x", require_ok=True)))

    @patch("tools.dev_launcher.process_utils.probe_http", return_value=(True, 404))
    def test_require_ok_fail(self, _mock) -> None:
        self.assertFalse(check_health(HealthCheck("http://x", require_ok=True)))

    @patch("tools.dev_launcher.process_utils.probe_http", return_value=(True, 404))
    def test_any_response_pass(self, _mock) -> None:
        self.assertTrue(check_health(HealthCheck("http://x", require_ok=False)))


class TestPreflight(unittest.TestCase):
    def test_juben_missing_node_modules(self) -> None:
        svc = next(s for s in SERVICES if s.id == "juben")
        with patch.object(shutil, "which", return_value="/bin/npm"):
            with patch.object(Path, "is_dir", return_value=False):
                result = check_service_preflight(svc)
        self.assertFalse(result.ok)
        self.assertIn("npm install", result.message)

    def test_ws_server_missing_script(self) -> None:
        svc = next(s for s in SERVICES if s.id == "ws_server")
        with patch.object(Path, "is_file", return_value=False):
            result = check_service_preflight(svc)
        self.assertFalse(result.ok)


class TestServiceHealthReady(unittest.TestCase):
    @patch("tools.dev_launcher.process_utils.ports_ready", return_value=True)
    @patch("tools.dev_launcher.process_utils.probe_http", return_value=(True, 200))
    def test_all_checks_pass(self, _probe, _ports) -> None:
        svc = next(s for s in SERVICES if s.id == "juben")
        ok, reason = service_health_ready(svc)
        self.assertTrue(ok)
        self.assertEqual(reason, "")


class TestDecodeSubprocessBytes(unittest.TestCase):
    def test_utf8(self) -> None:
        self.assertEqual(decode_subprocess_bytes("hello\n".encode()), "hello\n")

    def test_gbk_fallback(self) -> None:
        raw = "启动成功".encode("gbk")
        self.assertIn("启动", decode_subprocess_bytes(raw))


if __name__ == "__main__":
    unittest.main()
