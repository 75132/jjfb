# -*- coding: utf-8 -*-
import os
import socket
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from port_utils import check_port_available, is_port_in_use


class TestPortUtils(unittest.TestCase):
    def test_free_port_available(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(("127.0.0.1", 0))
        host, port = sock.getsockname()
        sock.close()
        # 端口已释放后应可用
        self.assertIsNone(check_port_available("127.0.0.1", port))

    def test_occupied_port_reports_and_does_not_kill(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("127.0.0.1", 0))
        sock.listen(1)
        host, port = sock.getsockname()
        try:
            self.assertTrue(is_port_in_use("127.0.0.1", port))
            occupant = check_port_available("127.0.0.1", port)
            self.assertIsNotNone(occupant)
            self.assertEqual(occupant.port, port)
            # 占用套接字仍应可 accept，证明未被强制结束
            self.assertTrue(sock.fileno() >= 0)
        finally:
            sock.close()


if __name__ == "__main__":
    unittest.main()
