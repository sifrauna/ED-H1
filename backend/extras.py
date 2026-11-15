"""ED-H1 extras API: games, file reading, room settings. Registered next to characters.py."""
import asyncio
import json
import os
import random
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import agents_core as core
import files_core as fc
import games_core as gc
import characters as chars          # reuses the ONE shared, queued Ollama connection

BASE = Path(__file__).resolve().parent
DB = str(BASE / "edh1_memory.db")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
core.init_db(DB)
_c = core._conn(DB)
_c.executescript(fc.SCHEMA)
_c.commit()
_c.close()

router = APIRouter(prefix="/api", tags=["games-files-room"])
_dict = {"obj": None}


def dictionary():
    if _dict["obj"] is None:
        _dict["obj"] = gc.Dictionary.from_file(BASE / "data" / "words.txt")
    return _dict["obj"]


def _err(exc, code=400):
    return HTTPException(code, str(exc))


# ------------------------------------------------------------------ models
class TttIn(BaseModel):
    board: list[str]
    move: int
    level: int = 2


class LevelIn(BaseModel):
    level: int = 2


class GridIn(BaseModel):
    grid: list[int]


class ScrabbleNew(BaseModel):
    ai_name: str = "ED-H1"


class PlaceIn(BaseModel):
    placements: list[dict]


class ExchangeIn(BaseModel):
    letters: list[str]


class AiIn(BaseModel):
    level: int = 2


class FileIn(BaseModel):
    name: str
    data_base64: str


class AccessIn(BaseModel):
    character_ids: list[int] = []


class AskIn(BaseModel):
    character_id: int
    question: str = ""
    mode: str = "ask"            # "ask" or "summarize"


class RoomIn(BaseModel):
    environment: Optional[str] = None
    show_names: Optional[bool] = None
    voice_replies: Optional[bool] = None


# ------------------------------------------------------------------ games
@router.post("/games/tictactoe/move")
async def ttt_move(body: TttIn):
    try:
        return gc.ttt_play(body.board, body.move, body.level)
    except gc.GameError as exc:
        raise _err(exc)


@router.post("/games/sudoku/new")
async def sudoku_new(body: LevelIn):
    return await asyncio.to_thread(gc.sudoku_new, body.level)


@router.post("/games/sudoku/check")
async def sudoku_check(body: GridIn):
    try:
        return gc.sudoku_check(body.grid)
    except gc.GameError as exc:
        raise _err(exc)


@router.post("/games/sudoku/hint")
async def sudoku_hint(body: GridIn):
    try:
        return await asyncio.to_thread(gc.sudoku_hint, body.grid)
    except gc.GameError as exc:
        raise _err(exc)


def _load(gid):
    r = core.row(DB, "SELECT * FROM saved_games WHERE id=? AND kind='scrabble'", (gid,))
    if not r:
        raise HTTPException(404, "Game not found")
    return json.loads(r["state"])


def _save(gid, st):
    core.run(DB, "UPDATE saved_games SET state=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", (json.dumps(st), gid))


def _view(gid, st):
    out = gc.public_state(st)
    out["id"] = gid
    out["dictionary_loaded"] = dictionary().loaded
    return out


@router.get("/games/scrabble/dictionary")
async def scrabble_dictionary():
    d = dictionary()
    return {"loaded": d.loaded, "words": len(d.words)}


@router.post("/games/scrabble/new")
async def scrabble_new(body: ScrabbleNew):
    st = gc.scrabble_new(body.ai_name[:40] or "ED-H1")
    gid = core.run(DB, "INSERT INTO saved_games(kind, state) VALUES('scrabble', ?)", (json.dumps(st),))
    return _view(gid, st)


@router.get("/games/scrabble/latest")
async def scrabble_latest():
    r = core.row(DB, "SELECT id FROM saved_games WHERE kind='scrabble' ORDER BY updated_at DESC, id DESC LIMIT 1")
    if not r:
        return {"game": None}
    return {"game": _view(r["id"], _load(r["id"]))}


@router.get("/games/scrabble/{gid}")
async def scrabble_get(gid: int):
    return _view(gid, _load(gid))


@router.post("/games/scrabble/{gid}/check")
async def scrabble_check(gid: int, body: PlaceIn):
    return gc.scrabble_check(_load(gid), "human", body.placements, dictionary())


@router.post("/games/scrabble/{gid}/play")
async def scrabble_play(gid: int, body: PlaceIn):
    st = _load(gid)
    try:
        res = gc.scrabble_play(st, "human", body.placements, dictionary())
    except gc.GameError as exc:
        raise _err(exc)
    _save(gid, st)
    return {"result": res, "game": _view(gid, st)}


@router.post("/games/scrabble/{gid}/pass")
async def scrabble_pass(gid: int):
    st = _load(gid)
    try:
        gc.scrabble_pass(st, "human")
    except gc.GameError as exc:
        raise _err(exc)
    _save(gid, st)
    return _view(gid, st)


@router.post("/games/scrabble/{gid}/exchange")
async def scrabble_exchange(gid: int, body: ExchangeIn):
    st = _load(gid)
    try:
        gc.scrabble_exchange(st, "human", body.letters)
    except gc.GameError as exc:
        raise _err(exc)
    _save(gid, st)
    return _view(gid, st)


@router.post("/games/scrabble/{gid}/ai")
async def scrabble_ai(gid: int, body: AiIn):
    st = _load(gid)
    try:
        move = await asyncio.to_thread(gc.scrabble_ai_move, st, dictionary(), body.level)
    except gc.GameError as exc:
        raise _err(exc)
    _save(gid, st)
    return {"move": move, "game": _view(gid, st)}


# ------------------------------------------------------------------ files
@router.get("/files")
async def list_files():
    files = core.rows(DB, "SELECT id, name, ext, kind, size, created_at FROM files ORDER BY id DESC")
    for f in files:
        f["character_ids"] = [r["character_id"] for r in core.rows(
            DB, "SELECT character_id FROM file_access WHERE file_id=?", (f["id"],))]
    return {"files": files}


@router.post("/files")
async def upload_file(body: FileIn):
    try:
        meta = fc.add_file(lambda s, a=(): core.run(DB, s, a), lambda s, a=(): core.row(DB, s, a),
                           body.name, body.data_base64)
    except fc.FileError as exc:
        raise _err(exc)
    meta["character_ids"] = []          # nobody can read a new file until the user allows it
    return meta


@router.delete("/files/{fid}")
async def delete_file(fid: int):
    core.run(DB, "DELETE FROM files WHERE id=?", (fid,))
    return {"status": "deleted"}


@router.put("/files/{fid}/access")
async def set_access(fid: int, body: AccessIn):
    if not core.row(DB, "SELECT id FROM files WHERE id=?", (fid,)):
        raise HTTPException(404, "File not found")
    core.run(DB, "DELETE FROM file_access WHERE file_id=?", (fid,))
    for cid in dict.fromkeys(body.character_ids):
        if core.row(DB, "SELECT id FROM characters WHERE id=?", (cid,)):
            core.run(DB, "INSERT OR IGNORE INTO file_access(file_id, character_id) VALUES(?,?)", (fid, cid))
    return {"character_ids": [r["character_id"] for r in core.rows(
        DB, "SELECT character_id FROM file_access WHERE file_id=?", (fid,))]}


async def _vision(file_row, question):
    model = os.getenv("EDH1_VISION_MODEL", "llava")
    import base64
    img = base64.b64encode(file_row["data"]).decode()
    try:
        async with httpx.AsyncClient(timeout=240) as client:
            resp = await client.post(f"{OLLAMA_URL}/api/chat", json={
                "model": model, "stream": False,
                "messages": [{"role": "user", "content": question or "Describe this image.", "images": [img]}]})
            if resp.status_code == 404:
                raise HTTPException(400, f"Image understanding needs a vision model. Install one with: ollama pull {model}")
            resp.raise_for_status()
            return resp.json()["message"]["content"]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"AI engine error: {exc}")


@router.post("/files/{fid}/ask")
async def ask_file(fid: int, body: AskIn):
    f = core.row(DB, "SELECT * FROM files WHERE id=?", (fid,))
    if not f:
        raise HTTPException(404, "File not found")
    try:
        c = core.get_character(DB, body.character_id)
    except core.AgentError as exc:
        raise HTTPException(404, str(exc))
    if not core.row(DB, "SELECT 1 FROM file_access WHERE file_id=? AND character_id=?", (fid, c["id"])):
        raise HTTPException(403, f"{c['name']} is not allowed to read this file. Allow it first.")
    question = (body.question or "").strip()
    if f["kind"] == "image":
        return {"reply": await _vision(f, question), "character": c["name"], "source": f["name"]}
    if body.mode == "summarize" or not question:
        excerpt = fc.overview_excerpt(f["text"])
        task = "Summarize this document clearly for the user."
    else:
        excerpt = "\n---\n".join(fc.relevant_excerpts(f["text"], question))
        task = f"Answer the user's question using only the document excerpts: {question}"
    system = (core.persona_prompt(c) + "\n\nThe user shared a document called '" + f["name"] + "'. "
              "Use only the excerpts below. If the answer is not there, say so. Do not invent content.\n\n"
              "Document excerpts:\n" + excerpt)
    reply = await chars.llm([{"role": "system", "content": system}, {"role": "user", "content": task}], 500)
    return {"reply": (reply or "").strip(), "character": c["name"], "source": f["name"]}


# ------------------------------------------------------------------ room
@router.get("/room")
async def get_room():
    return {"environment": core.get_kv(DB, "environment", "living_room"),
            "show_names": core.get_kv(DB, "show_names", True),
            "voice_replies": core.get_kv(DB, "voice_replies", True)}


@router.put("/room")
async def put_room(body: RoomIn):
    for key, val in body.model_dump(exclude_unset=True).items():
        if val is None:
            continue
        if key == "environment" and (not isinstance(val, str) or len(val) > 40):
            raise HTTPException(400, "Invalid environment")
        core.set_kv(DB, key, val)
    return await get_room()
