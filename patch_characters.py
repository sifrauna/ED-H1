"""Registers the multi-character API in backend\\main.py (two added lines).

Run from D:\\ED-H1:   py patch_characters.py
Makes backend\\main.py.bak3 first. Safe to run twice.
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "backend" / "main.py"
for needed in ("agents_core.py", "characters.py"):
    if not (ROOT / "backend" / needed).exists():
        sys.exit(f"STOP: backend\\{needed} is missing. Copy it into D:\\ED-H1\\backend first.")

raw = MAIN.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
text = raw.replace("\r\n", "\n")
if "characters_router" in text:
    print("main.py already patched, skipping")
    sys.exit(0)

pairs = [
    ("from music import router as music_router\n",
     "from music import router as music_router\nfrom characters import router as characters_router\n"),
    ("app.include_router(music_router)\n",
     "app.include_router(music_router)\napp.include_router(characters_router)\n"),
]
for old, new in pairs:
    if text.count(old) != 1:
        sys.exit(f"STOP: expected line not found exactly once: {old.strip()}. Nothing was changed.")
shutil.copy2(MAIN, MAIN.with_suffix(".py.bak3"))
for old, new in pairs:
    text = text.replace(old, new)
if crlf:
    text = text.replace("\n", "\r\n")
MAIN.write_bytes(text.encode("utf-8"))
print("main.py patched. Open http://127.0.0.1:8000/docs to see the new /api/characters, /api/groups ... routes.")
