#!/usr/bin/env python3
"""Fail closed when a public portfolio copy contains unsafe material.

The check is intentionally conservative: it scans text sources for credential
patterns, personal paths, external network references and missing safety docs.
It never prints the matched value, only the file, line and finding category.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKER = Path(__file__).resolve()

SKIP_DIRS = {".git", "runtime", "node_modules", "__pycache__", ".venv", "venv", "private", "exports"}
TEXT_SUFFIXES = {
    ".bat", ".css", ".example", ".html", ".js", ".json", ".md", ".ps1",
    ".py", ".svg", ".txt", ".yml", ".yaml",
}
ALLOWED_URL_HOSTS = {"127.0.0.1", "www.w3.org"}
REQUIRED_FILES = {
    ".env.example",
    ".gitignore",
    "README.md",
    "SECURITY.md",
    "SECURITY_AUDIT.md",
    "TEST_REPORT.md",
    "data/demo_districts.json",
    "docs/DATA_CARD.md",
    "index.html",
    "server.py",
}

SECRET_PATTERNS = [
    ("provider-key", re.compile(r"sk-[A-Za-z0-9_-]{20,}")),
    ("google-api-key", re.compile(r"AIza[0-9A-Za-z_-]{30,}")),
    ("bearer-token", re.compile(r"(?i)authorization\s*:\s*bearer\s+[A-Za-z0-9._-]{12,}")),
    ("assigned-secret", re.compile(r"(?i)(api[_-]?key|secret|token)\s*[=:]\s*[\"']?[A-Za-z0-9_-]{20,}")),
    ("amap-jscode", re.compile(r"(?i)securityJsCode\s*[=:]\s*[\"']?[A-Za-z0-9_-]{12,}")),
]
PRIVATE_STATE_MARKERS = [
    "ht_ds_key",
    "ht_bocha_key",
    "ht_amap_key",
    "ht_amap_web_key",
    "ht_amap_jscode",
    "keyDeepseek",
    "keyBocha",
    "keyAmap",
]
PERSONAL_PATH_PATTERNS = [
    re.compile(r"[A-Za-z]:\\Users\\"),
    re.compile(r"/Users/[^/\s]+/"),
    re.compile(r"/home/[^/\s]+/"),
]
URL_PATTERN = re.compile(r"https?://(?![%{<])[^\s<>\"')]+")
CJK_PATTERN = re.compile(r"[\u4e00-\u9fff]")


def iter_text_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in relative.parts):
            continue
        if path.suffix.lower() in TEXT_SUFFIXES or path.name == ".env.example":
            files.append(path)
    return sorted(files)


def add(errors: list[str], path: Path, line: int, category: str) -> None:
    errors.append("%s:%s: %s" % (path.relative_to(ROOT).as_posix(), line, category))


def main() -> int:
    errors: list[str] = []
    for relative in sorted(REQUIRED_FILES):
        if not (ROOT / relative).is_file():
            errors.append("missing required file: " + relative)

    if (ROOT / ".git").exists():
        errors.append("git history directory is present; do not ship it")
    if (ROOT / "runtime").exists():
        errors.append("runtime directory is present; remove logs and pid files")
    if (ROOT / ".env").exists():
        errors.append("local .env file is present; do not ship it")

    for path in iter_text_files():
        text = path.read_text(encoding="utf-8", errors="replace")
        for line_number, line in enumerate(text.splitlines(), 1):
            if CJK_PATTERN.search(line):
                add(errors, path, line_number, "non-English CJK text")
            if path != CHECKER:
                for category, pattern in SECRET_PATTERNS:
                    if pattern.search(line):
                        add(errors, path, line_number, category)
                for marker in PRIVATE_STATE_MARKERS:
                    if marker in line:
                        add(errors, path, line_number, "legacy private-state marker")
                for pattern in PERSONAL_PATH_PATTERNS:
                    if pattern.search(line):
                        add(errors, path, line_number, "personal filesystem path")
            for match in URL_PATTERN.finditer(line):
                parsed = urllib.parse.urlsplit(match.group(0))
                if parsed.hostname not in ALLOWED_URL_HOSTS:
                    add(errors, path, line_number, "external URL host: " + str(parsed.hostname))

    env_file = ROOT / ".env.example"
    if env_file.is_file():
        for line_number, line in enumerate(env_file.read_text(encoding="utf-8").splitlines(), 1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            name, value = stripped.split("=", 1)
            value = value.strip()
            if name.strip() in {"ENABLE_LIVE_AI", "PORT"}:
                continue
            if value:
                add(errors, env_file, line_number, "non-empty provider configuration placeholder")

    data_path = ROOT / "data" / "demo_districts.json"
    if data_path.is_file():
        dataset = json.loads(data_path.read_text(encoding="utf-8"))
        districts = dataset.get("districts") or []
        stores = [store for district in districts for store in district.get("stores", [])]
        if dataset.get("dataClass") != "synthetic":
            errors.append("dataset is not marked synthetic")
        if len(districts) != 4:
            errors.append("expected 4 synthetic districts, found %s" % len(districts))
        if len(stores) != 42:
            errors.append("expected 42 synthetic stores, found %s" % len(stores))
        for store in stores:
            if store.get("source") != "synthetic":
                errors.append("store is missing synthetic source marker: " + str(store.get("id")))
            if "lat" in store or "lng" in store:
                errors.append("store contains real-world coordinates: " + str(store.get("id")))
            for axis in ("x", "y"):
                try:
                    value = float(store.get(axis))
                except (TypeError, ValueError):
                    errors.append("store has invalid %s: %s" % (axis, store.get("id")))
                    continue
                if abs(value) > 3.1:
                    errors.append("store is outside synthetic map bounds: " + str(store.get("id")))

    if errors:
        print("PUBLIC SAFETY CHECK: FAIL")
        for item in errors:
            print(" - " + item)
        return 1

    print("PUBLIC SAFETY CHECK: PASS")
    print("Checked files: %s" % len(iter_text_files()))
    print("No credential patterns, personal paths, external URL hosts, CJK text or runtime state found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
