"""Registers the games / files / room API in backend\\main.py (two added lines).

Run from D:\\ED-H1 AFTER patch_characters.py:   py patch_extras.py
Makes backend\\main.py.bak4 first. Safe to run twice.
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "backend" / "main.py"
for needed in ("extras.py", "games_core.py", "files_core.py", "characters.py", "agents_core.py"):
    if not (ROOT / "backend" / needed).exists():
        sys.exit(f"STOP: backend\\{needed} is missing. Copy it into D:\\ED-H1\\backend first.")
raw = MAIN.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
text = raw.replace("\r\n", "\n")
if "extras_router" in text:
    print("main.py already patched, skipping")
    sys.exit(0)
pairs = [
    ("from characters import router as characters_router\n",
     "from characters import router as characters_router\nfrom extras import router as extras_router\n"),
    ("app.include_router(characters_router)\n",
     "app.include_router(characters_router)\napp.include_router(extras_router)\n"),
]
for old, new in pairs:
    if text.count(old) != 1:
        sys.exit("STOP: run patch_characters.py first (its lines are missing). Nothing was changed.")
shutil.copy2(MAIN, MAIN.with_suffix(".py.bak4"))
for old, new in pairs:
    text = text.replace(old, new)
if crlf:
    text = text.replace("\n", "\r\n")
MAIN.write_bytes(text.encode("utf-8"))
print("main.py patched. New routes: /api/games/*, /api/files/*, /api/room")
