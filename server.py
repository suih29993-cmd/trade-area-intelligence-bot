#!/usr/bin/env python3
"""Local-only demo server for District Health Studio.

The server has two jobs:
1. Serve a small allow-listed set of static files from this project directory.
2. Expose a read-only dataset API and an optional, explicitly enabled AI proxy.

It never logs request bodies, query strings, headers, or credentials. It binds
to 127.0.0.1 and does not enable CORS. The live AI adapter is disabled by
default and only reads its key from server-side environment variables.
"""
from __future__ import annotations

import argparse
import ipaddress
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "demo_districts.json"
RUNTIME_DIR = ROOT / "runtime"
LOG_FILE = RUNTIME_DIR / "server.log"

DEFAULT_PORT = 8137
MAX_BODY_BYTES = 16_384
MAX_MESSAGE_CHARS = 500
MAX_PROVIDER_RESPONSE_BYTES = 1_000_000
PROVIDER_TIMEOUT_SECONDS = 30

ALLOWED_SUFFIXES = {
    ".html", ".css", ".js", ".json", ".svg", ".png", ".ico", ".md", ".txt"
}
BLOCKED_DIRS = {"tests", "tools", "scripts", "runtime", "node_modules", "__pycache__"}
BLOCKED_NAMES = {".env", "server.py", ".gitignore", ".git"}
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}
SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; img-src 'self' data:; style-src 'self'; "
        "script-src 'self'; connect-src 'self'; font-src 'self'; "
        "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cross-Origin-Resource-Policy": "same-origin",
}


class LiveProviderError(Exception):
    """A deliberately generic provider error that is safe to log."""


class LiveAIAdapter:
    """Optional OpenAI-compatible adapter, disabled unless explicitly enabled."""

    def __init__(self) -> None:
        self.enabled = os.environ.get("ENABLE_LIVE_AI", "0") == "1"
        self.base_url = os.environ.get("LIVE_AI_BASE_URL", "").strip().rstrip("/")
        self.provider_credential = os.environ.get("LIVE_AI_API_KEY", "").strip()
        self.model = os.environ.get("LIVE_AI_MODEL", "").strip()

    def configured(self) -> bool:
        return self.enabled and bool(self.base_url and self.provider_credential and self.model)

    def _check_base_url(self) -> None:
        parsed = urllib.parse.urlsplit(self.base_url)
        if parsed.scheme != "https" or not parsed.hostname:
            raise LiveProviderError("invalid_base_url")
        if parsed.username or parsed.password:
            raise LiveProviderError("invalid_base_url")
        host = parsed.hostname.lower()
        if host == "localhost" or host.endswith(".local"):
            raise LiveProviderError("invalid_base_url")
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
        if address is not None and (address.is_private or address.is_loopback or address.is_link_local):
            raise LiveProviderError("invalid_base_url")

    def complete(self, messages: list[dict[str, str]]) -> str:
        if not self.configured():
            raise LiveProviderError("live_disabled")
        self._check_base_url()
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 700,
            "stream": False,
        }
        request = urllib.request.Request(
            self.base_url + "/chat/completions",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + self.provider_credential,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=PROVIDER_TIMEOUT_SECONDS) as response:
                raw = response.read(MAX_PROVIDER_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as exc:
            raise LiveProviderError("provider_http_" + str(exc.code)) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise LiveProviderError("provider_network_error") from None
        if len(raw) > MAX_PROVIDER_RESPONSE_BYTES:
            raise LiveProviderError("provider_response_too_large")
        try:
            data = json.loads(raw.decode("utf-8", "replace"))
            content = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            raise LiveProviderError("provider_invalid_response") from None
        text = str(content or "").strip()
        if not text or len(text) > 8000:
            raise LiveProviderError("provider_invalid_response")
        return text


def load_dataset(path: Path = DATA_FILE) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("dataClass") != "synthetic":
        raise ValueError("dataset must be marked as synthetic")
    if not isinstance(data.get("districts"), list) or not data["districts"]:
        raise ValueError("dataset has no districts")
    if not isinstance(data.get("channels"), list) or not data["channels"]:
        raise ValueError("dataset has no channels")
    return data


def _distance_km(store: dict) -> float:
    return (float(store.get("x", 0)) ** 2 + float(store.get("y", 0)) ** 2) ** 0.5


def _average(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


def build_synthetic_context(dataset: dict, district_id: str) -> dict:
    district = next((item for item in dataset["districts"] if item.get("id") == district_id), None)
    if district is None:
        raise KeyError("district_not_found")
    channels = dataset["channels"]
    stores = district.get("stores", [])
    focus = [store for store in stores if store.get("role") == "focus"]
    competitors = [store for store in stores if store.get("role") == "competitor"]

    def channel_values(group: list[dict], field: str) -> list[float]:
        values = []
        for store in group:
            for channel in channels:
                info = (store.get("channels") or {}).get(channel) or {}
                value = info.get(field)
                if isinstance(value, (int, float)):
                    values.append(float(value))
        return values

    def promo_coverage(group: list[dict]) -> int:
        if not group:
            return 0
        active = 0
        for store in group:
            infos = [(store.get("channels") or {}).get(channel) or {} for channel in channels]
            if any(float(info.get("promotionPct", 0)) > 0 for info in infos):
                active += 1
        return round(active / len(group) * 100)

    brand_counts = Counter(store.get("brand", "Unknown") for store in competitors)
    focus_orders = sum(int(store.get("monthlyOrders", 0)) for store in focus)
    competitor_orders = sum(int(store.get("monthlyOrders", 0)) for store in competitors)
    total_orders = focus_orders + competitor_orders
    return {
        "dataClass": "synthetic",
        "district": district.get("name"),
        "description": district.get("description"),
        "coverageRadiusKm": district.get("coverageRadiusKm"),
        "focus": {
            "stores": len(focus),
            "coreStores": sum(1 for store in focus if _distance_km(store) <= 1),
            "monthlyOrders": focus_orders,
            "avgDeliveryFee": _average(channel_values(focus, "deliveryFee")),
            "promotionCoveragePct": promo_coverage(focus),
            "avgPromotionPct": _average(channel_values(focus, "promotionPct")),
        },
        "competitors": {
            "stores": len(competitors),
            "brands": dict(brand_counts.most_common()),
            "monthlyOrders": competitor_orders,
            "avgDeliveryFee": _average(channel_values(competitors, "deliveryFee")),
            "promotionCoveragePct": promo_coverage(competitors),
            "avgPromotionPct": _average(channel_values(competitors, "promotionPct")),
        },
        "market": {
            "totalOrders": total_orders,
            "focusSharePct": round(focus_orders / total_orders * 100) if total_orders else 0,
        },
    }


class DemoHandler(BaseHTTPRequestHandler):
    server_version = "DistrictHealthStudio/1.0"
    sys_version = ""
    protocol_version = "HTTP/1.1"
    dataset: dict = {}
    adapter: LiveAIAdapter | None = None

    def end_headers(self) -> None:
        for name, value in SECURITY_HEADERS.items():
            self.send_header(name, value)
        super().end_headers()

    def log_request(self, code: int | str = "-", size: int | str = "-") -> None:
        path = urllib.parse.urlsplit(self.path).path
        clean_path = re.sub(r"[^\x20-\x7e]", "?", path)[:200]
        line = "%s %s %s %s %s\n" % (
            time.strftime("%Y-%m-%d %H:%M:%S"),
            self.client_address[0],
            self.command,
            clean_path,
            code,
        )
        try:
            RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
            with LOG_FILE.open("a", encoding="utf-8") as handle:
                handle.write(line)
        except OSError:
            pass

    def log_error(self, format: str, *args: object) -> None:
        # BaseHTTPRequestHandler may include the request path in errors. Keep it
        # sanitized and never include the query string or headers.
        message = format % args
        self.log_request("error", len(message))

    def _send_body(self, status: int, body: bytes, content_type: str, *, head: bool = False) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send_body(status, body, "application/json; charset=utf-8")

    def send_text(self, status: int, text: str) -> None:
        self._send_body(status, text.encode("utf-8"), "text/plain; charset=utf-8")

    def _serve_static(self, path: str, *, head: bool) -> None:
        if "\x00" in path:
            self.send_text(400, "Bad request")
            return
        relative = path.lstrip("/")
        if relative in {"", "index.html"}:
            relative = "index.html"
        parts = Path(relative).parts
        if not parts or any(part.startswith(".") or part in BLOCKED_DIRS or part in BLOCKED_NAMES for part in parts):
            self.send_text(404, "Not found")
            return
        candidate = (ROOT / relative).resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            self.send_text(404, "Not found")
            return
        if not candidate.is_file() or candidate.suffix.lower() not in ALLOWED_SUFFIXES:
            self.send_text(404, "Not found")
            return
        try:
            body = candidate.read_bytes()
        except OSError:
            self.send_text(404, "Not found")
            return
        content_type = CONTENT_TYPES.get(candidate.suffix.lower(), "application/octet-stream")
        self._send_body(200, body, content_type, head=head)

    def _handle_get(self, *, head: bool) -> None:
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if path == "/api/health":
            if head:
                self.send_text(405, "Method not allowed")
                return
            adapter = self.adapter or LiveAIAdapter()
            self.send_json(200, {
                "ok": True,
                "mode": "demo",
                "liveAIEnabled": adapter.configured(),
                "version": "1.0.0",
            })
            return
        if path == "/api/config":
            if head:
                self.send_text(405, "Method not allowed")
                return
            adapter = self.adapter or LiveAIAdapter()
            self.send_json(200, {"liveAIEnabled": adapter.configured()})
            return
        if path == "/api/districts":
            if head:
                self.send_text(405, "Method not allowed")
                return
            self.send_json(200, self.dataset)
            return
        if path.startswith("/api/"):
            if head:
                self.send_text(404, "Not found")
            else:
                self.send_json(404, {"ok": False, "error": "not_found"})
            return
        self._serve_static(path, head=head)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        self._handle_get(head=False)

    def do_HEAD(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        self._handle_get(head=True)

    def do_OPTIONS(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        self.send_text(405, "Method not allowed")

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if path != "/api/chat":
            self.send_json(404, {"ok": False, "error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            self.send_json(400, {"ok": False, "error": "invalid_content_length"})
            return
        if length <= 0:
            self.send_json(400, {"ok": False, "error": "empty_body"})
            return
        if length > MAX_BODY_BYTES:
            self.send_json(413, {"ok": False, "error": "body_too_large"})
            return
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8", "replace"))
        except (ValueError, UnicodeDecodeError):
            self.send_json(400, {"ok": False, "error": "invalid_json"})
            return
        if not isinstance(payload, dict):
            self.send_json(400, {"ok": False, "error": "invalid_payload"})
            return
        message = payload.get("message")
        district_id = payload.get("districtId")
        if not isinstance(message, str) or not message.strip() or len(message.strip()) > MAX_MESSAGE_CHARS:
            self.send_json(400, {"ok": False, "error": "invalid_message"})
            return
        if not isinstance(district_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,39}", district_id):
            self.send_json(400, {"ok": False, "error": "invalid_district"})
            return

        adapter = self.adapter or LiveAIAdapter()
        if not adapter.configured():
            self.send_json(409, {
                "ok": False,
                "error": "live_disabled",
                "message": "Live AI is disabled. The browser uses the local rule engine.",
            })
            return
        try:
            context = build_synthetic_context(self.dataset, district_id)
        except KeyError:
            self.send_json(404, {"ok": False, "error": "district_not_found"})
            return

        system_prompt = (
            "You are a retail analytics assistant for a portfolio demonstration. "
            "All data is synthetic and fictional. Never claim it is real business data. "
            "Do not invent metrics that are not present in the JSON. "
            "Answer in English with four short sections: Summary, Evidence, Risks, Recommendations. "
            "Use only the provided synthetic context and the user's question."
        )
        user_prompt = "Synthetic data context:\n" + json.dumps(context, ensure_ascii=False) + "\n\nUser question: " + message.strip()
        try:
            reply = adapter.complete([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ])
        except LiveProviderError as exc:
            # The exception text is a fixed internal code, never a provider body
            # or a credential. It is safe to log.
            try:
                RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
                with LOG_FILE.open("a", encoding="utf-8") as handle:
                    handle.write("%s provider_error %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), exc))
            except OSError:
                pass
            self.send_json(502, {"ok": False, "error": "live_provider_failed"})
            return
        self.send_json(200, {"ok": True, "mode": "live", "reply": reply})


def create_server(
    dataset: dict,
    adapter: LiveAIAdapter | None = None,
    host: str = "127.0.0.1",
    port: int = 0,
) -> ThreadingHTTPServer:
    class LocalServer(ThreadingHTTPServer):
        # On Windows SO_REUSEADDR can allow multiple listeners on the same port
        # and produce unpredictable responses. Fail fast instead.
        allow_reuse_address = False
        daemon_threads = True

    class Handler(DemoHandler):
        pass

    Handler.dataset = dataset
    Handler.adapter = adapter or LiveAIAdapter()
    return LocalServer((host, port), Handler)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the local District Health Studio demo")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", DEFAULT_PORT)))
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args(argv)
    if args.host not in {"127.0.0.1", "localhost"}:
        print("Refusing to bind to a non-local address.", file=sys.stderr)
        return 2
    try:
        dataset = load_dataset()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print("Cannot load synthetic dataset: %s" % exc, file=sys.stderr)
        return 1
    try:
        server = create_server(dataset, host=args.host, port=args.port)
    except OSError as exc:
        print("Cannot start server: %s" % exc, file=sys.stderr)
        return 1
    host, port = server.server_address[:2]
    print("District Health Studio demo: http://%s:%s/index.html" % (host, port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
