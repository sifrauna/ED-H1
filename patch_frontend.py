"""Adds the Room / Play / Media screens to the existing ED-H1 interface (three small edits to App.jsx).

Run from D:\\ED-H1:   py patch_frontend.py
Makes frontend\\src\\App.jsx.bak5 first. Stops without changing anything if the file does not match.
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "frontend" / "src" / "App.jsx"
EDH = ROOT / "frontend" / "src" / "edh"
for name in ("EdhOverlay.jsx", "RoomScreen.jsx", "GamesScreen.jsx", "MediaScreen.jsx", "ui.jsx", "api.js",
             "voice.js", "activity.js", "MiniAvatar.jsx"):
    if not (EDH / name).exists():
        sys.exit(f"STOP: frontend\\src\\edh\\{name} is missing. Copy the whole 'edh' folder first.")

raw = APP.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
text = raw.replace("\r\n", "\n")
if "EdhOverlay" in text:
    print("App.jsx already patched, skipping")
    sys.exit(0)

edits = [
    # 1) imports
    ("} from 'lucide-react';\n",
     "} from 'lucide-react';\n"
     "import { Users as EdhUsers, Gamepad2 as EdhGamepad, Film as EdhFilm } from 'lucide-react';\n"
     "import EdhOverlay from './edh/EdhOverlay.jsx';\n"),
    # 2) three more pill buttons (on phones idle buttons show only their icon so the pill still fits)
    ("            { id: 'music', label: 'Music', icon: Music }\n          ].map((item) => {",
     "            { id: 'music', label: 'Music', icon: Music },\n"
     "            { id: 'room', label: 'Room', icon: EdhUsers, compact: true },\n"
     "            { id: 'games', label: 'Play', icon: EdhGamepad, compact: true },\n"
     "            { id: 'media', label: 'Media', icon: EdhFilm, compact: true }\n          ].map((item) => {"),
    ("                <Icon className=\"w-3.5 h-3.5\" />\n                <span>{item.label}</span>",
     "                <Icon className=\"w-3.5 h-3.5\" />\n                <span className={active ? '' : 'hidden sm:inline'}>{item.label}</span>"),
    # 3) the overlay itself, just before the navigation pill
    ("      <div\n        onClick={(e) => e.stopPropagation()}\n        className={`fixed bottom-5 z-30 transition-all duration-700 ${",
     "      <EdhOverlay mode={mode} isLight={isLight} speechLang={currentLangObj.voiceCode} />\n\n"
     "      <div\n        onClick={(e) => e.stopPropagation()}\n        className={`fixed bottom-5 z-30 max-w-[calc(100vw-12px)] transition-all duration-700 ${"),
    ("        <div className={`flex items-center gap-1 p-1.5 rounded-full backdrop-blur-2xl border ${pillSurface}`}>\n",
     "        <div className={`flex items-center gap-1 p-1.5 rounded-full backdrop-blur-2xl border max-w-full overflow-x-auto [scrollbar-width:none] ${pillSurface}`}>\n"),
]
for old, new in edits:
    if text.count(old) != 1:
        sys.exit(f"STOP: expected text found {text.count(old)} times (need 1): {old.strip()[:60]!r}. Nothing was changed.")
shutil.copy2(APP, APP.with_suffix(".jsx.bak5"))
for old, new in edits:
    text = text.replace(old, new)
if crlf:
    text = text.replace("\n", "\r\n")
APP.write_bytes(text.encode("utf-8"))
print("App.jsx patched: new Room, Play and Media buttons added to the navigation pill.")
