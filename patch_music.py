"""Applies the ED-H1 music wiring. Run from D:\\ED-H1:

    py patch_music.py

Makes backups (main.py.bak, App.jsx.bak) first. Refuses to change a file
if any expected anchor is missing or appears more than once. Safe to re-run:
files that are already patched are skipped.
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "backend" / "main.py"
APP = ROOT / "frontend" / "src" / "App.jsx"
MUSIC = ROOT / "backend" / "music.py"


def read(path):
    raw = path.read_bytes().decode("utf-8")
    crlf = "\r\n" in raw
    return raw.replace("\r\n", "\n"), crlf


def write(path, text, crlf):
    if crlf:
        text = text.replace("\n", "\r\n")
    path.write_bytes(text.encode("utf-8"))


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        sys.exit(f"STOP: anchor for '{label}' found {count} times (expected 1). Nothing was changed in this file.")
    return text.replace(old, new)


# ---------- backend/main.py ----------
if not MUSIC.exists():
    sys.exit(f"STOP: {MUSIC} is missing. Copy music.py into the backend folder first.")

text, crlf = read(MAIN)
if "include_router(music_router)" in text:
    print("main.py already patched, skipping")
else:
    shutil.copy2(MAIN, MAIN.with_suffix(".py.bak"))
    text = replace_once(
        text,
        "from pydantic import BaseModel\n",
        "from pydantic import BaseModel\nfrom music import router as music_router\n",
        "main.py import",
    )
    text = replace_once(
        text,
        "SYSTEM_PROMPT = ",
        "app.include_router(music_router)\n\nSYSTEM_PROMPT = ",
        "main.py include_router",
    )
    write(MAIN, text, crlf)
    print("main.py patched")

# ---------- frontend/src/App.jsx ----------
text, crlf = read(APP)
if "audioRef" in text:
    print("App.jsx already patched, skipping")
else:
    shutil.copy2(APP, APP.with_suffix(".jsx.bak"))

    # 1) state + refs
    text = replace_once(
        text,
        "  const [isPlaying, setIsPlaying] = useState(false);\n",
        "  const [isPlaying, setIsPlaying] = useState(false);\n"
        "  const audioRef = useRef(null);\n"
        "  const loadedKeyRef = useRef('');\n"
        "  const [musicStatus, setMusicStatus] = useState('');\n",
        "state",
    )

    # 2) effect that talks to the backend and drives the <audio> element
    effect = """  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    if (!isPlaying) {
      audio.pause();
      return undefined;
    }

    const query =
      activeStream.id === 'custom'
        ? activeStream.title
        : `${activeStream.title} ${activeStream.channel}`;

    if (loadedKeyRef.current === query && audio.src) {
      audio.play().catch(() => {});
      return undefined;
    }

    let cancelled = false;
    setMusicStatus('Finding audio...');

    fetch(`${EDH1_BACKEND_URL}/api/music/resolve?q=${encodeURIComponent(query)}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return null;
        loadedKeyRef.current = query;
        audio.src = `${EDH1_BACKEND_URL}${data.stream_path}`;
        setMusicStatus(`Now playing: ${data.title}`);
        return audio.play();
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return;
        setMusicStatus(`Music error: ${err.message}`);
        setIsPlaying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPlaying, activeStream]);

"""
    text = replace_once(
        text,
        "  const handleMusicSearch = (e) => {\n",
        effect + "  const handleMusicSearch = (e) => {\n",
        "effect",
    )

    # 3) always-mounted audio element (so music survives switching modes)
    text = replace_once(
        text,
        "      {mode === 'music' && (\n        <div\n          onClick={(e) => e.stopPropagation()}\n",
        "      <audio\n"
        "        ref={audioRef}\n"
        "        onEnded={() => setIsPlaying(false)}\n"
        "        onError={() => {\n"
        "          if (audioRef.current && audioRef.current.src) {\n"
        "            setMusicStatus('Playback error: the audio could not be loaded.');\n"
        "            setIsPlaying(false);\n"
        "          }\n"
        "        }}\n"
        "      />\n\n"
        "      {mode === 'music' && (\n        <div\n          onClick={(e) => e.stopPropagation()}\n",
        "audio element",
    )

    # 4) status line under the track title
    text = replace_once(
        text,
        "                {activeStream.channel} &bull; {activeStream.category}\n              </div>\n",
        "                {activeStream.channel} &bull; {activeStream.category}\n              </div>\n"
        "              {musicStatus && (\n"
        "                <div className=\"text-[11px] opacity-60 truncate\">{musicStatus}</div>\n"
        "              )}\n",
        "status line",
    )

    write(APP, text, crlf)
    print("App.jsx patched")

print("Done. Restart uvicorn if --reload did not pick up the change.")
