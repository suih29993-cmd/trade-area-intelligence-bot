from __future__ import annotations

import json
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402


class DisabledAdapter(server.LiveAIAdapter):
    def configured(self) -> bool:
        return False


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        dataset = server.load_dataset()
        cls.server = server.create_server(dataset, adapter=DisabledAdapter(), port=0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        host, port = cls.server.server_address[:2]
        cls.base = f"http://{host}:{port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def request(self, path: str, method: str = "GET", body: bytes | None = None, headers: dict | None = None):
        request = urllib.request.Request(self.base + path, data=body, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status, dict(response.headers), response.read()
        except urllib.error.HTTPError as exc:
            return exc.code, dict(exc.headers), exc.read()

    def test_health(self) -> None:
        status, headers, body = self.request("/api/health")
        self.assertEqual(status, 200)
        data = json.loads(body)
        self.assertTrue(data["ok"])
        self.assertEqual(data["mode"], "demo")
        self.assertFalse(data["liveAIEnabled"])
        self.assertIn("default-src 'self'", headers["Content-Security-Policy"])

    def test_config_never_contains_keys(self) -> None:
        status, _, body = self.request("/api/config")
        self.assertEqual(status, 200)
        data = json.loads(body)
        self.assertEqual(set(data), {"liveAIEnabled"})

    def test_districts_are_synthetic(self) -> None:
        status, _, body = self.request("/api/districts")
        self.assertEqual(status, 200)
        data = json.loads(body)
        self.assertEqual(data["dataClass"], "synthetic")
        self.assertEqual(len(data["districts"]), 4)

    def test_live_chat_is_disabled_by_default(self) -> None:
        body = json.dumps({"message": "竞争激烈吗？", "districtId": "harbor-central"}).encode()
        status, _, response = self.request(
            "/api/chat", method="POST", body=body, headers={"Content-Type": "application/json"}
        )
        self.assertEqual(status, 409)
        self.assertEqual(json.loads(response)["error"], "live_disabled")

    def test_body_limit(self) -> None:
        body = b"{" + b" " * server.MAX_BODY_BYTES + b"}"
        status, _, _ = self.request(
            "/api/chat", method="POST", body=body, headers={"Content-Type": "application/json"}
        )
        self.assertEqual(status, 413)

    def test_private_files_are_not_served(self) -> None:
        for path in ("/server.py", "/.env", "/runtime/server.log", "/%2e%2e/server.py", "/tools/generate_demo_data.py"):
            status, _, _ = self.request(path)
            self.assertEqual(status, 404, path)

    def test_static_index_and_dataset(self) -> None:
        for path in ("/", "/index.html", "/data/demo_districts.json", "/assets/favicon.svg"):
            status, _, body = self.request(path)
            self.assertEqual(status, 200, path)
            self.assertTrue(body)

    def test_options_is_not_cors_enabled(self) -> None:
        status, headers, _ = self.request("/api/health", method="OPTIONS")
        self.assertEqual(status, 405)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_request_log_redacts_query_and_headers(self) -> None:
        marker = "public-safety-test-value"
        status, _, _ = self.request(
            "/api/health?key=" + marker,
            headers={"Authorization": "Bearer " + marker},
        )
        self.assertEqual(status, 200)
        time.sleep(0.1)
        log_text = server.LOG_FILE.read_text(encoding="utf-8") if server.LOG_FILE.exists() else ""
        self.assertNotIn(marker, log_text)
        self.assertIn("/api/health", log_text)

    def test_legacy_get_chat_with_credentials_is_not_supported(self) -> None:
        status, _, body = self.request("/api/chat?message=hello&key=test-value")
        self.assertEqual(status, 404)
        self.assertEqual(json.loads(body)["error"], "not_found")

    def test_unknown_api_is_json_404(self) -> None:
        status, _, body = self.request("/api/unknown")
        self.assertEqual(status, 404)
        self.assertEqual(json.loads(body)["error"], "not_found")


if __name__ == "__main__":
    unittest.main()
