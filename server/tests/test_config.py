# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import ConfigError, load_config, redact_mongo_url


class TestLoadConfig(unittest.TestCase):
    def test_development_defaults_local_mongo(self):
        cfg = load_config(
            {
                "ENVIRONMENT": "development",
            }
        )
        self.assertEqual(cfg.environment, "development")
        self.assertEqual(cfg.mongo_url, "mongodb://127.0.0.1:27017/")
        self.assertTrue(cfg.encryption_key_ephemeral)
        self.assertTrue(len(cfg.encryption_key) >= 16)
        self.assertEqual(cfg.ws_port, 8001)
        self.assertEqual(cfg.admin_port, 8080)

    def test_development_respects_explicit_values(self):
        cfg = load_config(
            {
                "ENVIRONMENT": "dev",
                "WS_HOST": "127.0.0.1",
                "WS_PORT": "9001",
                "ADMIN_HOST": "127.0.0.1",
                "ADMIN_PORT": "8090",
                "MONGO_URL": "mongodb://127.0.0.1:27018/jjfb",
                "ENCRYPTION_KEY": "fixed-dev-key-not-random",
            }
        )
        self.assertEqual(cfg.ws_host, "127.0.0.1")
        self.assertEqual(cfg.ws_port, 9001)
        self.assertEqual(cfg.admin_port, 8090)
        self.assertEqual(cfg.mongo_url, "mongodb://127.0.0.1:27018/jjfb")
        self.assertFalse(cfg.encryption_key_ephemeral)
        self.assertEqual(cfg.encryption_key, "fixed-dev-key-not-random")

    def test_production_requires_mongo_and_key(self):
        with self.assertRaises(ConfigError) as ctx:
            load_config({"ENVIRONMENT": "production"})
        msg = str(ctx.exception)
        self.assertIn("MONGO_URL", msg)
        self.assertIn("ENCRYPTION_KEY", msg)

    def test_production_rejects_missing_encryption_key_only(self):
        with self.assertRaises(ConfigError) as ctx:
            load_config(
                {
                    "ENVIRONMENT": "production",
                    "MONGO_URL": "mongodb://127.0.0.1:27017/",
                }
            )
        self.assertIn("ENCRYPTION_KEY", str(ctx.exception))

    def test_production_accepts_required_fields(self):
        cfg = load_config(
            {
                "ENVIRONMENT": "production",
                "MONGO_URL": "mongodb://u:p@db.example:27017/",
                "ENCRYPTION_KEY": "prod-fixed-key",
            }
        )
        self.assertEqual(cfg.environment, "production")
        self.assertFalse(cfg.encryption_key_ephemeral)
        self.assertEqual(cfg.encryption_key, "prod-fixed-key")

    def test_invalid_port(self):
        with self.assertRaises(ConfigError):
            load_config({"ENVIRONMENT": "development", "WS_PORT": "not-a-port"})

    def test_redact_mongo_url(self):
        redacted = redact_mongo_url("mongodb://user:secret@8.1.2.3:27017/?authSource=admin")
        self.assertNotIn("secret", redacted)
        self.assertNotIn("user", redacted)
        self.assertIn("***:***@", redacted)
        self.assertIn("8.1.2.3:27017", redacted)


if __name__ == "__main__":
    unittest.main()
