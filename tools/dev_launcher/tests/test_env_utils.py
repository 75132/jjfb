"""env_utils 单元测试。"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.dev_launcher.env_utils import (
    juben_env_status,
    merge_dotenv_into,
    parse_dotenv,
    subprocess_env_for_service,
)


class TestParseDotenv(unittest.TestCase):
    def test_basic_and_comments(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ".env"
            path.write_text(
                "# comment\nPORT=8787\nDEEPSEEK_API_KEY=sk-test\nQUOTED=\"hello\"\n",
                encoding="utf-8",
            )
            parsed = parse_dotenv(path)
        self.assertEqual(parsed["PORT"], "8787")
        self.assertEqual(parsed["DEEPSEEK_API_KEY"], "sk-test")
        self.assertEqual(parsed["QUOTED"], "hello")

    def test_missing_file(self) -> None:
        self.assertEqual(parse_dotenv(Path("/nonexistent/.env")), {})


class TestMergeDotenv(unittest.TestCase):
    def test_does_not_override_existing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ".env"
            path.write_text("PORT=9999\nDATA_DIR=./data\n", encoding="utf-8")
            merged = merge_dotenv_into({"PORT": "8787"}, path)
        self.assertEqual(merged["PORT"], "8787")
        self.assertEqual(merged["DATA_DIR"], "./data")


class TestSubprocessEnvForService(unittest.TestCase):
    def test_juben_loads_dotenv(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            juben = Path(tmp)
            (juben / ".env").write_text("DEEPSEEK_API_KEY=from-file\n", encoding="utf-8")
            prev = os.environ.pop("DEEPSEEK_API_KEY", None)
            try:
                env = subprocess_env_for_service("juben", juben)
            finally:
                if prev is not None:
                    os.environ["DEEPSEEK_API_KEY"] = prev
        self.assertEqual(env.get("DEEPSEEK_API_KEY"), "from-file")

    def test_ws_server_unchanged(self) -> None:
        env = subprocess_env_for_service("ws_server", ROOT / "server")
        self.assertIn("PYTHONIOENCODING", env)


class TestJubenEnvStatus(unittest.TestCase):
    def test_detects_deepseek_from_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            juben = Path(tmp)
            (juben / ".env").write_text("DEEPSEEK_API_KEY=abc\n", encoding="utf-8")
            status = juben_env_status(juben)
        self.assertTrue(status.has_deepseek_key)
        self.assertEqual(status.var_count, 1)


if __name__ == "__main__":
    unittest.main()
