"""Makes the backend serve the built web interface, so ED-H1 runs as ONE program.

Run from D:\\ED-H1:   py patch_serve_frontend.py
Makes backend\\main.py.bak2 first. Safe to run twice.
"""
import shutil
import sys
from pathlib import Path

MAIN = Path(__file__).resolve().parent / "backend" / "main.py"
raw = MAIN.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
text = raw.replace("\r\n", "\n")

if "FRONTEND_DIST" in text:
    print("main.py already serves the frontend, skipping")
    sys.exit(0)

shutil.copy2(MAIN, MAIN.with_suffix(".py.bak2"))

block = '''

# --- serve the built web interface (added by patch_serve_frontend.py) ---
# Must stay at the END of the file so the /api routes above take priority.
import mimetypes
from fastapi.staticfiles import StaticFiles

mimetypes.add_type("application/javascript", ".js")  # Windows sometimes maps .js wrongly
mimetypes.add_type("text/css", ".css")

FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
'''

text = text.rstrip("\n") + "\n" + block
if crlf:
    text = text.replace("\n", "\r\n")
MAIN.write_bytes(text.encode("utf-8"))
print("main.py patched. The backend will now serve frontend\\dist at http://127.0.0.1:8000")
