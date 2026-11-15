"""ED-H1 multi-character API (characters, memory, groups, relationships, autonomy, rewards).

Added alongside the existing routes. Nothing in /api/chat, /api/memories or /api/music changes.
All characters share ONE Ollama model through ONE queue (EDH1_MAX_PARALLEL, default 1).
"""
import asyncio
import os
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

import agents_core as core

DB = str(Path(__file__).resolve().parent / "edh1_memory.db")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")

core.init_db(DB)
router = APIRouter(prefix="/api", tags=["characters"])

_sem = asyncio.Semaphore(max(1, int(os.getenv("EDH1_MAX_PARALLEL", "1"))))
_stats = {"waiting": 0, "running": 0, "completed": 0, "errors": 0}
_running_groups = {}   # group id -> cancel Event


# ----------------------------------------------------------- shared inference
async def llm(messages, max_tokens=300):
    """The single doorway to Ollama. Requests queue here, so many characters never mean many models."""
    _stats["waiting"] += 1
    acquired = False
    try:
        async with _sem:
            acquired = True
            _stats["waiting"] -= 1
            _stats["running"] += 1
            try:
                async with httpx.AsyncClient(timeout=180) as client:
                    resp = await client.post(
                        f"{OLLAMA_URL}/api/chat",
                        json={"model": os.getenv("OLLAMA_MODEL", "llama3.1:8b"), "messages": messages,
                              "stream": False, "options": {"num_predict": max_tokens, "num_ctx": 4096}})
                    resp.raise_for_status()
                    _stats["completed"] += 1
                    return resp.json()["message"]["content"]
            finally:
                _stats["running"] -= 1
    except Exception as exc:
        _stats["errors"] += 1
        raise HTTPException(502, f"AI engine error: {exc}")
    finally:
        if not acquired:
            _stats["waiting"] -= 1


def _http(exc):
    text = str(exc)
    if "not found" in text.lower():
        return HTTPException(404, text)
    return HTTPException(400, text)


def call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except core.AgentError as exc:
        raise _http(exc)


async def acall(coro):
    try:
        return await coro
    except core.AgentError as exc:
        raise _http(exc)


# --------------------------------------------------------------------- models
class CharacterIn(BaseModel):
    name: str
    role: str = ""
    personality: str
    style: str = ""
    interests: str = ""
    extra_instructions: str = ""
    voice: Optional[dict] = None
    appearance: Optional[dict] = None
    can_initiate: bool = False
    enabled: bool = True


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    personality: Optional[str] = None
    style: Optional[str] = None
    interests: Optional[str] = None
    extra_instructions: Optional[str] = None
    voice: Optional[dict] = None
    appearance: Optional[dict] = None
    can_initiate: Optional[bool] = None
    enabled: Optional[bool] = None


class MessageIn(BaseModel):
    message: str


class MemoryIn(BaseModel):
    content: str
    importance: int = 3


class GroupIn(BaseModel):
    name: str
    character_ids: list[int] = []


class MemberIn(BaseModel):
    character_id: int


class GroupTalkIn(BaseModel):
    message: Optional[str] = None
    topic: Optional[str] = None
    max_turns: Optional[int] = None
    reflect: bool = True


class SettingsIn(BaseModel):
    autonomy_enabled: Optional[bool] = None
    initiatives_per_day: Optional[int] = None
    initiative_cooldown_minutes: Optional[int] = None
    quiet_hours: Optional[str] = None
    max_turns_per_run: Optional[int] = None
    run_time_budget_seconds: Optional[int] = None
    history_window: Optional[int] = None


class ResultIn(BaseModel):
    skill: str = "general"
    won: bool
    score: int = 0


# ----------------------------------------------------------------- characters
@router.get("/characters")
async def list_characters():
    return {"characters": core.list_characters(DB)}


@router.post("/characters")
async def create_character(body: CharacterIn):
    return call(core.create_character, DB, body.model_dump())


@router.post("/characters/seed-examples")
async def seed_examples():
    """Adds Otto (logical), Milo (playful) and Luna (creative) if they do not exist yet."""
    return {"created": core.seed_examples(DB)}


@router.get("/characters/{cid}")
async def get_character(cid: int):
    return call(core.get_character, DB, cid)


@router.put("/characters/{cid}")
async def update_character(cid: int, body: CharacterUpdate):
    return call(core.update_character, DB, cid, body.model_dump(exclude_unset=True))


@router.delete("/characters/{cid}")
async def delete_character(cid: int):
    call(core.delete_character, DB, cid)
    return {"status": "deleted"}


async def _compact(cid):
    try:
        await core.compact_history(DB, cid, llm)
    except Exception:
        pass   # summarising is optional; never break the chat


@router.post("/characters/{cid}/chat")
async def character_chat(cid: int, body: MessageIn, background: BackgroundTasks):
    reply, remembered = await acall(core.character_chat(DB, cid, body.message, llm))
    background.add_task(_compact, cid)
    return {"reply": reply, "character": core.get_character(DB, cid)["name"], "remembered": remembered}


@router.get("/characters/{cid}/messages")
async def character_messages(cid: int, limit: int = 100):
    call(core.get_character, DB, cid)
    found = core.rows(DB, "SELECT role, content, created_at FROM character_messages "
                          "WHERE character_id=? ORDER BY id DESC LIMIT ?", (cid, max(1, min(limit, 500))))
    return {"messages": list(reversed(found))}


@router.delete("/characters/{cid}/messages")
async def clear_character_messages(cid: int):
    call(core.get_character, DB, cid)
    core.run(DB, "DELETE FROM character_messages WHERE character_id=?", (cid,))
    return {"status": "cleared"}


# --------------------------------------------------------------------- memory
@router.get("/characters/{cid}/memories")
async def character_memories(cid: int):
    call(core.get_character, DB, cid)
    return {"memories": core.rows(DB, "SELECT id, content, importance, source, created_at "
                                      "FROM character_memories WHERE character_id=? ORDER BY id DESC", (cid,))}


@router.post("/characters/{cid}/memories")
async def add_character_memory(cid: int, body: MemoryIn):
    call(core.get_character, DB, cid)
    res = core.add_character_memory(DB, cid, body.content, body.importance, "user_added")
    if not res:
        raise HTTPException(400, "Memory text is too short")
    return res


@router.delete("/characters/{cid}/memories/{mid}")
async def delete_character_memory(cid: int, mid: int):
    call(core.get_character, DB, cid)
    core.run(DB, "DELETE FROM character_memories WHERE id=? AND character_id=?", (mid, cid))
    return {"status": "deleted"}


@router.delete("/characters/{cid}/memories")
async def clear_character_memories(cid: int):
    call(core.get_character, DB, cid)
    core.run(DB, "DELETE FROM character_memories WHERE character_id=?", (cid,))
    return {"status": "cleared"}


@router.get("/shared-memories")
async def shared_memories():
    return {"memories": core.rows(DB, "SELECT id, content, participants, created_at FROM shared_memories "
                                      "ORDER BY id DESC")}


@router.delete("/shared-memories/{mid}")
async def delete_shared_memory(mid: int):
    core.run(DB, "DELETE FROM shared_memories WHERE id=?", (mid,))
    return {"status": "deleted"}


@router.get("/relationships")
async def relationships():
    return {"relationships": core.list_relationships(DB)}


# --------------------------------------------------------------------- groups
@router.get("/groups")
async def list_groups():
    return {"groups": core.list_groups(DB)}


@router.post("/groups")
async def create_group(body: GroupIn):
    return call(core.create_group, DB, body.name, body.character_ids)


@router.get("/groups/{gid}")
async def get_group(gid: int):
    return call(core.get_group, DB, gid)


@router.delete("/groups/{gid}")
async def delete_group(gid: int):
    call(core.delete_group, DB, gid)
    return {"status": "deleted"}


@router.post("/groups/{gid}/members")
async def add_member(gid: int, body: MemberIn):
    return call(core.add_group_member, DB, gid, body.character_id)


@router.delete("/groups/{gid}/members/{cid}")
async def remove_member(gid: int, cid: int):
    return call(core.remove_group_member, DB, gid, cid)


@router.get("/groups/{gid}/messages")
async def get_group_messages(gid: int, limit: int = 100):
    return {"messages": call(core.group_messages, DB, gid, max(1, min(limit, 500)))}


async def _reflect(gid):
    try:
        await core.reflect_on_group(DB, gid, llm)
    except Exception:
        pass   # learning from the chat is optional; never break the chat


async def _group_run(gid, body, background):
    call(core.get_group, DB, gid)
    if gid in _running_groups:
        raise HTTPException(409, "This group is already talking. Wait for it or cancel it.")
    cancel = asyncio.Event()
    _running_groups[gid] = cancel
    try:
        result = await acall(core.run_group_turns(
            DB, gid, llm, max_turns=body.max_turns, cancel=cancel,
            user_message=body.message, topic=body.topic))
    finally:
        _running_groups.pop(gid, None)
    if body.reflect and sum(1 for m in result["messages"] if m["speaker_kind"] == "character") >= 2:
        background.add_task(_reflect, gid)
    return result


@router.post("/groups/{gid}/message")
async def group_message(gid: int, body: GroupTalkIn, background: BackgroundTasks):
    """The user says something; the characters answer in turn (limited by max_turns)."""
    if not (body.message or "").strip():
        raise HTTPException(400, "Message is empty")
    return await _group_run(gid, body, background)


@router.post("/groups/{gid}/discuss")
async def group_discuss(gid: int, body: GroupTalkIn, background: BackgroundTasks):
    """Characters talk to each other (optionally about a topic) without the user typing each line."""
    return await _group_run(gid, body, background)


@router.post("/groups/{gid}/cancel")
async def group_cancel(gid: int):
    event = _running_groups.get(gid)
    if event:
        event.set()
    return {"cancelled": bool(event)}


# ------------------------------------------------------- settings and autonomy
@router.get("/agents/settings")
async def get_agent_settings():
    return core.get_settings(DB)


@router.put("/agents/settings")
async def put_agent_settings(body: SettingsIn):
    return call(core.set_settings, DB, body.model_dump(exclude_unset=True))


@router.get("/agents/status")
async def agent_status():
    return {"model": os.getenv("OLLAMA_MODEL", "llama3.1:8b"), "queue": dict(_stats),
            "max_parallel": int(os.getenv("EDH1_MAX_PARALLEL", "1")),
            "groups_talking": list(_running_groups),
            "characters": len(core.list_characters(DB))}


@router.get("/autonomy/suggest")
async def autonomy_suggest():
    """Pull model: the app asks now and then. A character may speak up only if every limit allows it."""
    cand = core.autonomy_candidate(DB)
    if not cand["allowed"]:
        return {"suggestion": None, "reason": cand["reason"]}
    character = cand["character"]
    text = await acall(core.make_initiative(DB, character, llm))
    if not text:
        return {"suggestion": None, "reason": "no message produced"}
    core.log_autonomy(DB, character["id"], text)
    return {"suggestion": {"character_id": character["id"], "character": character["name"],
                           "message": text, "autonomous": True}}


# -------------------------------------------------------- progress and rewards
@router.get("/rewards")
async def rewards():
    return core.get_rewards(DB)


@router.post("/progress/{game}")
async def progress(game: str, body: ResultIn):
    return call(core.record_result, DB, game, body.skill, body.won, body.score)
