"""ED-H1 music routes (Option A: audio plays in the browser).

GET /api/music/resolve?q=...      -> finds a track with yt-dlp, returns a stream path
GET /api/music/stream/{token}     -> proxies the audio to the browser (supports Range)
"""
import asyncio
import os
import shutil
import subprocess
import sys
import time
import uuid

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/music", tags=["music"])

# Uses yt-dlp from PATH (yours is in Python313\Scripts). Override with YTDLP_PATH if needed.
YTDLP_BIN = os.getenv("YTDLP_PATH") or shutil.which("yt-dlp")

# token -> {"url": direct audio url, "t": created time}
_cache: dict = {}
_CACHE_SECONDS = 4 * 60 * 60  # direct URLs expire after a few hours


def _ytdlp_cmd():
    if YTDLP_BIN:
        return [YTDLP_BIN]
    return [sys.executable, "-m", "yt_dlp"]


def _resolve_blocking(query: str) -> dict:
    cmd = _ytdlp_cmd() + [
        "--no-playlist",
        "--no-warnings",
        "-f", "bestaudio[ext=m4a]/bestaudio",
        "--print", "title",
        "--print", "channel",
        "--print", "duration",
        "--print", "url",
        f"ytsearch1:{query}",
    ]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=90,
        )
    except FileNotFoundError:
        raise RuntimeError("yt-dlp was not found. Set YTDLP_PATH or add it to PATH.")
    except subprocess.TimeoutExpired:
        raise RuntimeError("yt-dlp timed out while searching.")

    lines = [ln.strip() for ln in result.stdout.splitlines() if ln.strip()]
    if result.returncode != 0 or len(lines) < 4:
        detail = (result.stderr or "no output").strip().splitlines()[-1:]  # last error line
        raise RuntimeError(f"yt-dlp could not find playable audio: {' '.join(detail)}")

    title, channel, duration, url = lines[0], lines[1], lines[2], lines[-1]
    if ".m3u8" in url or "manifest" in url:
        raise RuntimeError(
            "That result is a live stream, which the browser player cannot play. "
            "Try searching for a specific track instead."
        )
    return {"title": title, "channel": channel, "duration": duration, "url": url}


@router.get("/resolve")
async def resolve(q: str):
    q = q.strip()
    if not q:
        raise HTTPException(400, "Search text is required")
    if len(q) > 200:
        raise HTTPException(413, "Search text is too long")

    # drop expired entries
    now = time.time()
    for key in [k for k, v in _cache.items() if now - v["t"] > _CACHE_SECONDS]:
        _cache.pop(key, None)

    try:
        info = await asyncio.to_thread(_resolve_blocking, q)
    except RuntimeError as exc:
        raise HTTPException(502, str(exc))

    token = uuid.uuid4().hex
    _cache[token] = {"url": info["url"], "t": now}
    return {
        "title": info["title"],
        "channel": info["channel"],
        "duration": info["duration"],
        "stream_path": f"/api/music/stream/{token}",
    }


@router.get("/stream/{token}")
async def stream(token: str, request: Request):
    item = _cache.get(token)
    if not item or time.time() - item["t"] > _CACHE_SECONDS:
        raise HTTPException(404, "Stream expired. Press Play again.")

    headers = {"User-Agent": "Mozilla/5.0"}
    if request.headers.get("range"):
        headers["Range"] = request.headers["range"]

    client = httpx.AsyncClient(timeout=None, follow_redirects=True)
    try:
        upstream = await client.send(
            client.build_request("GET", item["url"], headers=headers), stream=True
        )
    except Exception as exc:
        await client.aclose()
        raise HTTPException(502, f"Could not open audio stream: {exc}")

    if upstream.status_code >= 400:
        code = upstream.status_code
        await upstream.aclose()
        await client.aclose()
        raise HTTPException(502, f"Audio source returned HTTP {code}")

    out = {
        k: upstream.headers[k]
        for k in ("content-length", "content-range", "accept-ranges")
        if k in upstream.headers
    }
    out.setdefault("accept-ranges", "bytes")
    media_type = upstream.headers.get("content-type", "audio/mp4")

    async def body():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        body(), status_code=upstream.status_code, headers=out, media_type=media_type
    )
