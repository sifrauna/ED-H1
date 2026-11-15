"""ED-H1 multi-character engine.

Pure Python + sqlite3 (no web framework), so it can be tested without a server.
The LLM is injected as `llm(messages, max_tokens) -> str`, so every character
shares ONE model through ONE queue; characters differ only by their context.
"""
import difflib
import json
import re
import sqlite3
import time
from datetime import datetime

HARD_MAX_TURNS = 8

DEFAULT_SETTINGS = {
    "autonomy_enabled": "0",             # off until the user turns it on
    "initiatives_per_day": "3",
    "initiative_cooldown_minutes": "60",
    "quiet_hours": "22:00-07:00",
    "max_turns_per_run": "4",
    "run_time_budget_seconds": "300",
    "history_window": "12",
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT '',
    personality TEXT NOT NULL,
    style TEXT DEFAULT '',
    interests TEXT DEFAULT '',
    extra_instructions TEXT DEFAULT '',
    voice_json TEXT DEFAULT '{}',
    can_initiate INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS character_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS character_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 3,
    source TEXT DEFAULT 'chat',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP
);
CREATE TABLE IF NOT EXISTS shared_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    participants TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS relationships (
    from_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    to_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    familiarity REAL DEFAULT 0,
    trust REAL DEFAULT 0,
    rapport REAL DEFAULT 0,
    rivalry REAL DEFAULT 0,
    interactions INTEGER DEFAULT 0,
    history TEXT DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (from_id, to_id)
);
CREATE TABLE IF NOT EXISTS groups_ (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, character_id)
);
CREATE TABLE IF NOT EXISTS group_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
    speaker_kind TEXT NOT NULL,
    speaker_id INTEGER,
    speaker_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS agent_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS autonomy_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS game_progress (
    game TEXT NOT NULL,
    skill TEXT NOT NULL DEFAULT 'general',
    level INTEGER NOT NULL DEFAULT 1,
    played INTEGER NOT NULL DEFAULT 0,
    won INTEGER NOT NULL DEFAULT 0,
    best_score INTEGER NOT NULL DEFAULT 0,
    win_streak INTEGER NOT NULL DEFAULT 0,
    lose_streak INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (game, skill)
);
CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


# ------------------------------------------------------------------ database
class AgentError(Exception):
    """Problem caused by the request (bad input, missing item, busy)."""


def _conn(db):
    c = sqlite3.connect(db, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return c


def run(db, sql, args=()):
    c = _conn(db)
    try:
        cur = c.execute(sql, args)
        c.commit()
        return cur.lastrowid
    finally:
        c.close()


def rows(db, sql, args=()):
    c = _conn(db)
    try:
        return [dict(r) for r in c.execute(sql, args).fetchall()]
    finally:
        c.close()


def row(db, sql, args=()):
    found = rows(db, sql, args)
    return found[0] if found else None


def init_db(db):
    c = _conn(db)
    try:
        c.executescript(SCHEMA)
        cols = {r["name"] for r in c.execute("PRAGMA table_info(characters)").fetchall()}
        if "appearance_json" not in cols:       # upgrade older databases in place
            c.execute("ALTER TABLE characters ADD COLUMN appearance_json TEXT DEFAULT '{}'")
        c.commit()
    finally:
        c.close()


def get_kv(db, key, default=None):
    r = row(db, "SELECT value FROM agent_settings WHERE key=?", ("kv:" + key,))
    if not r:
        return default
    try:
        return json.loads(r["value"])
    except ValueError:
        return default


def set_kv(db, key, value):
    text = json.dumps(value)
    if len(text) > 4000:
        raise AgentError("Value is too large")
    run(db, "INSERT INTO agent_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        ("kv:" + key, text))


# ------------------------------------------------------------------ settings
def get_settings(db):
    out = dict(DEFAULT_SETTINGS)
    for r in rows(db, "SELECT key, value FROM agent_settings"):
        if r["key"] in out:
            out[r["key"]] = r["value"]
    return {
        "autonomy_enabled": out["autonomy_enabled"] == "1",
        "initiatives_per_day": int(out["initiatives_per_day"]),
        "initiative_cooldown_minutes": int(out["initiative_cooldown_minutes"]),
        "quiet_hours": out["quiet_hours"],
        "max_turns_per_run": int(out["max_turns_per_run"]),
        "run_time_budget_seconds": int(out["run_time_budget_seconds"]),
        "history_window": int(out["history_window"]),
    }


_INT_LIMITS = {
    "initiatives_per_day": (0, 20),
    "initiative_cooldown_minutes": (5, 1440),
    "max_turns_per_run": (1, HARD_MAX_TURNS),
    "run_time_budget_seconds": (30, 1800),
    "history_window": (4, 40),
}


def set_settings(db, changes):
    for key, val in changes.items():
        if val is None:
            continue
        if key == "autonomy_enabled":
            store = "1" if val else "0"
        elif key == "quiet_hours":
            if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d", str(val)):
                raise AgentError("quiet_hours must look like 22:00-07:00")
            store = str(val)
        elif key in _INT_LIMITS:
            lo, hi = _INT_LIMITS[key]
            try:
                n = int(val)
            except (TypeError, ValueError):
                raise AgentError(f"{key} must be a number")
            if not lo <= n <= hi:
                raise AgentError(f"{key} must be between {lo} and {hi}")
            store = str(n)
        else:
            raise AgentError(f"Unknown setting: {key}")
        run(db, "INSERT INTO agent_settings(key,value) VALUES(?,?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, store))
    return get_settings(db)


# ---------------------------------------------------------------- characters
def _clean_char(data, partial=False):
    out = {}
    limits = {"name": 40, "role": 120, "personality": 2000, "style": 600,
              "interests": 600, "extra_instructions": 1500}
    for field, cap in limits.items():
        if field in data and data[field] is not None:
            val = str(data[field]).strip()
            if len(val) > cap:
                raise AgentError(f"{field} is too long (max {cap} characters)")
            out[field] = val
    if not partial:
        if not out.get("name"):
            raise AgentError("name is required")
        if not out.get("personality"):
            raise AgentError("personality is required")
    elif "name" in out and not out["name"]:
        raise AgentError("name cannot be empty")
    if "personality" in out and not out["personality"]:
        raise AgentError("personality cannot be empty")
    for flag in ("can_initiate", "enabled"):
        if flag in data and data[flag] is not None:
            out[flag] = 1 if data[flag] else 0
    if "appearance" in data and data["appearance"] is not None:
        if not isinstance(data["appearance"], dict):
            raise AgentError("appearance must be an object")
        text = json.dumps(data["appearance"])
        if len(text) > 2000:
            raise AgentError("appearance is too large")
        out["appearance_json"] = text
    if "voice" in data and data["voice"] is not None:
        if not isinstance(data["voice"], dict):
            raise AgentError("voice must be an object")
        out["voice_json"] = json.dumps(data["voice"])[:500]
    return out


def _char_out(r):
    if r is None:
        return None
    r = dict(r)
    try:
        r["voice"] = json.loads(r.pop("voice_json") or "{}")
    except ValueError:
        r["voice"] = {}
    try:
        r["appearance"] = json.loads(r.pop("appearance_json", None) or "{}")
    except ValueError:
        r["appearance"] = {}
    r["can_initiate"] = bool(r["can_initiate"])
    r["enabled"] = bool(r["enabled"])
    return r


def get_character(db, cid):
    c = _char_out(row(db, "SELECT * FROM characters WHERE id=?", (cid,)))
    if not c:
        raise AgentError("Character not found")
    return c


def list_characters(db):
    return [_char_out(r) for r in rows(db, "SELECT * FROM characters ORDER BY id")]


def create_character(db, data):
    clean = _clean_char(data)
    if row(db, "SELECT id FROM characters WHERE lower(name)=lower(?)", (clean["name"],)):
        raise AgentError("A character with that name already exists")
    cols = ", ".join(clean)
    marks = ", ".join("?" for _ in clean)
    cid = run(db, f"INSERT INTO characters ({cols}) VALUES ({marks})", tuple(clean.values()))
    return get_character(db, cid)


def update_character(db, cid, data):
    get_character(db, cid)
    clean = _clean_char(data, partial=True)
    if "name" in clean and row(db, "SELECT id FROM characters WHERE lower(name)=lower(?) AND id<>?",
                               (clean["name"], cid)):
        raise AgentError("A character with that name already exists")
    if clean:
        sets = ", ".join(f"{k}=?" for k in clean)
        run(db, f"UPDATE characters SET {sets} WHERE id=?", (*clean.values(), cid))
    return get_character(db, cid)


def delete_character(db, cid):
    get_character(db, cid)
    run(db, "DELETE FROM characters WHERE id=?", (cid,))


EXAMPLE_CHARACTERS = [
    {"name": "Otto", "role": "logical thinker",
     "personality": "Analytical, rational and calm. Prefers facts, structure and step-by-step problem solving.",
     "style": "Precise and structured. Short, clear sentences.", "interests": "puzzles, science, planning"},
    {"name": "Milo", "role": "playful companion",
     "personality": "Humorous, friendly and a little sarcastic. Loves games and keeping things fun.",
     "style": "Casual and witty. Uses light teasing, never mean.", "interests": "games, jokes, music"},
    {"name": "Luna", "role": "creative thinker",
     "personality": "Imaginative, curious and artistic. Enjoys brainstorming and exploring what-ifs.",
     "style": "Warm and vivid. Likes metaphors and questions.", "interests": "art, stories, ideas"},
]


def seed_examples(db):
    made = []
    for ex in EXAMPLE_CHARACTERS:
        if not row(db, "SELECT id FROM characters WHERE lower(name)=lower(?)", (ex["name"],)):
            made.append(create_character(db, ex))
    return made


# -------------------------------------------------------------------- memory
_STOP = set("the a an and or of to in is it i you he she we they that this for on with as at be are was "
            "were am my your me do does did not no yes have has had what when how can will just".split())


def _norm(text):
    return " ".join(re.sub(r"[^\w\s]", "", text.lower()).split())


def _tokens(text):
    return {w for w in re.findall(r"\w+", text.lower()) if w not in _STOP and len(w) > 2}


def _age_days(stamp):
    try:
        then = datetime.strptime(stamp[:19], "%Y-%m-%d %H:%M:%S")
        return max(0.0, (datetime.utcnow() - then).total_seconds() / 86400)
    except (TypeError, ValueError):
        return 0.0


def _is_duplicate(a, b):
    na, nb = _norm(a), _norm(b)
    return na == nb or difflib.SequenceMatcher(None, na, nb).ratio() > 0.88


def add_character_memory(db, cid, content, importance=3, source="chat"):
    content = (content or "").strip()[:500]
    if len(content) < 3:
        return None
    importance = max(1, min(5, int(importance)))
    for existing in rows(db, "SELECT id, content, importance FROM character_memories "
                             "WHERE character_id=? ORDER BY id DESC LIMIT 300", (cid,)):
        if _is_duplicate(existing["content"], content):
            if importance > existing["importance"]:
                run(db, "UPDATE character_memories SET importance=? WHERE id=?", (importance, existing["id"]))
            return {"id": existing["id"], "duplicate": True}
    mid = run(db, "INSERT INTO character_memories(character_id, content, importance, source) VALUES(?,?,?,?)",
              (cid, content, importance, source))
    return {"id": mid, "duplicate": False}


def add_shared_memory(db, participant_ids, content):
    content = (content or "").strip()[:400]
    if len(content) < 3:
        return None
    ids = sorted(set(participant_ids))
    for existing in rows(db, "SELECT id, content FROM shared_memories ORDER BY id DESC LIMIT 200"):
        if _is_duplicate(existing["content"], content):
            return {"id": existing["id"], "duplicate": True}
    mid = run(db, "INSERT INTO shared_memories(content, participants) VALUES(?,?)", (content, json.dumps(ids)))
    return {"id": mid, "duplicate": False}


def _score(text, importance, created_at, query_tokens):
    overlap = len(query_tokens & _tokens(text))
    recency = 1.0 / (1.0 + _age_days(created_at) / 30.0)
    return overlap, overlap * 2 + importance * 0.5 + recency


def retrieve_memories(db, cid, query, k=5):
    q = _tokens(query)
    scored = []
    for m in rows(db, "SELECT * FROM character_memories WHERE character_id=?", (cid,)):
        overlap, score = _score(m["content"], m["importance"], m["created_at"], q)
        if overlap > 0 or m["importance"] >= 4:
            scored.append((score, m))
    scored.sort(key=lambda p: p[0], reverse=True)
    top = [m for _, m in scored[:k]]
    for m in top:
        run(db, "UPDATE character_memories SET last_used=CURRENT_TIMESTAMP WHERE id=?", (m["id"],))
    return top


def retrieve_shared(db, cid, query, k=3):
    q = _tokens(query)
    scored = []
    for m in rows(db, "SELECT * FROM shared_memories"):
        try:
            if cid not in json.loads(m["participants"]):
                continue
        except ValueError:
            continue
        overlap, score = _score(m["content"], 3, m["created_at"], q)
        scored.append((score, m))
    scored.sort(key=lambda p: p[0], reverse=True)
    return [m for _, m in scored[:k]]


def confirmed_user_memories(db, limit=10):
    """The user's own confirmed memories (existing ED-H1 memories table). Read only."""
    try:
        return rows(db, "SELECT category, content FROM memories WHERE status='confirmed' "
                        "ORDER BY id DESC LIMIT ?", (limit,))
    except sqlite3.Error:
        return []


_REMEMBER_RULES = [
    (re.compile(r"\bremember (?:that )?(.{3,200})", re.I), 4),
    (re.compile(r"\bmy name is (\w[\w ]{0,40})", re.I), 5),
    (re.compile(r"\bi (?:really )?(?:like|love|hate|enjoy|prefer) (.{3,150})", re.I), 3),
]


def extract_memories_from_user_text(text):
    found = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n", text):
        for rule, importance in _REMEMBER_RULES:
            if rule.search(sentence):
                found.append((f"The user said: {sentence.strip()[:200]}", importance))
                break
    return found


async def compact_history(db, cid, llm, keep=20, trigger=40):
    """Turns old chat messages into a few long-term memories, then drops them."""
    total = row(db, "SELECT COUNT(*) AS n FROM character_messages WHERE character_id=?", (cid,))["n"]
    if total <= trigger:
        return 0
    c = get_character(db, cid)
    old = rows(db, "SELECT id, role, content FROM character_messages WHERE character_id=? "
                   "ORDER BY id LIMIT ?", (cid, total - keep))
    transcript = "\n".join(f"{'User' if m['role'] == 'user' else c['name']}: {m['content']}" for m in old)
    reply = await llm([
        {"role": "system", "content": "You write short factual notes. Output only 1-3 bullet lines "
                                      "starting with '- '. Include only facts, preferences or decisions "
                                      "clearly stated in the conversation. Never invent anything."},
        {"role": "user", "content": f"Conversation:\n{transcript[-6000:]}\n\nNotes worth remembering later:"},
    ], 200)
    added = 0
    for line in reply.splitlines():
        line = line.strip()
        if line.startswith(("-", "*")) and add_character_memory(db, cid, line.lstrip("-* ").strip(), 4, "summary"):
            added += 1
    ids = [m["id"] for m in old]
    c2 = _conn(db)
    try:
        c2.executemany("DELETE FROM character_messages WHERE id=?", [(i,) for i in ids])
        c2.commit()
    finally:
        c2.close()
    return added


# ------------------------------------------------------------- relationships
def get_relationship(db, from_id, to_id):
    r = row(db, "SELECT * FROM relationships WHERE from_id=? AND to_id=?", (from_id, to_id))
    if r:
        r["history"] = json.loads(r["history"] or "[]")
        return r
    return {"from_id": from_id, "to_id": to_id, "familiarity": 0.0, "trust": 0.0, "rapport": 0.0,
            "rivalry": 0.0, "interactions": 0, "history": []}


def _save_rel(db, rel):
    run(db, "INSERT INTO relationships(from_id,to_id,familiarity,trust,rapport,rivalry,interactions,history) "
            "VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(from_id,to_id) DO UPDATE SET "
            "familiarity=excluded.familiarity, trust=excluded.trust, rapport=excluded.rapport, "
            "rivalry=excluded.rivalry, interactions=excluded.interactions, history=excluded.history, "
            "updated_at=CURRENT_TIMESTAMP",
        (rel["from_id"], rel["to_id"], rel["familiarity"], rel["trust"], rel["rapport"], rel["rivalry"],
         rel["interactions"], json.dumps(rel["history"][-8:])))


def touch_relationship(db, from_id, to_id):
    """Each real exchange makes two characters slightly more familiar."""
    if from_id == to_id:
        return
    rel = get_relationship(db, from_id, to_id)
    rel["familiarity"] = min(1.0, rel["familiarity"] + 0.02)
    rel["interactions"] += 1
    _save_rel(db, rel)


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def apply_relationship_update(db, from_id, to_id, trust=0.0, rapport=0.0, rivalry=0.0, event=None):
    """Small, bounded changes judged from an actual conversation (see reflect_on_group)."""
    if from_id == to_id:
        return
    rel = get_relationship(db, from_id, to_id)
    rel["trust"] = _clamp(rel["trust"] + _clamp(float(trust), -0.1, 0.1), -1.0, 1.0)
    rel["rapport"] = _clamp(rel["rapport"] + _clamp(float(rapport), -0.1, 0.1), 0.0, 1.0)
    rel["rivalry"] = _clamp(rel["rivalry"] + _clamp(float(rivalry), -0.1, 0.1), 0.0, 1.0)
    if event:
        event = str(event).strip()[:160]
        if event and event not in rel["history"]:
            rel["history"].append(event)
    _save_rel(db, rel)


def describe_relationship(rel, other_name):
    f = rel["familiarity"]
    if f < 0.1:
        base = f"You barely know {other_name}."
    elif f < 0.4:
        base = f"You know {other_name} a little."
    elif f < 0.7:
        base = f"You are well acquainted with {other_name}."
    else:
        base = f"You are close to {other_name}."
    bits = []
    if rel["trust"] > 0.3:
        bits.append("you trust them")
    elif rel["trust"] < -0.3:
        bits.append("you are wary of them")
    if rel["rapport"] > 0.4:
        bits.append("you get along well")
    if rel["rivalry"] > 0.4:
        bits.append("you have a friendly rivalry")
    text = base + (" (" + ", ".join(bits) + ")" if bits else "")
    if rel["history"]:
        text += " Shared experiences: " + "; ".join(rel["history"][-3:]) + "."
    return text


def list_relationships(db):
    out = []
    for r in rows(db, "SELECT r.*, a.name AS from_name, b.name AS to_name FROM relationships r "
                      "JOIN characters a ON a.id=r.from_id JOIN characters b ON b.id=r.to_id "
                      "ORDER BY r.updated_at DESC"):
        r["history"] = json.loads(r["history"] or "[]")
        out.append(r)
    return out


# -------------------------------------------------------------- prompt build
def persona_prompt(c):
    parts = [f"You are {c['name']}" + (f", {c['role']}." if c["role"] else ".")]
    parts.append(f"Personality: {c['personality']}")
    if c["style"]:
        parts.append(f"Communication style: {c['style']}")
    if c["interests"]:
        parts.append(f"Interests: {c['interests']}")
    if c["extra_instructions"]:
        parts.append(c["extra_instructions"])
    parts.append("Stay fully in character. You are not ED-H1 and not any other character. "
                 "Keep replies short (1-4 sentences) unless asked for detail. Never invent memories "
                 "or facts about the user; only use the memories listed below.")
    return "\n".join(parts)


def memory_blocks(db, cid, query):
    blocks = []
    user_mem = confirmed_user_memories(db)
    if user_mem:
        blocks.append("About the user (confirmed):\n" + "\n".join(f"- {m['category']}: {m['content']}" for m in user_mem))
    own = retrieve_memories(db, cid, query)
    if own:
        blocks.append("Your own memories:\n" + "\n".join(f"- {m['content']}" for m in own))
    shared = retrieve_shared(db, cid, query)
    if shared:
        blocks.append("Shared experiences:\n" + "\n".join(f"- {m['content']}" for m in shared))
    return "\n\n".join(blocks)


def build_chat_messages(db, cid, user_text):
    c = get_character(db, cid)
    window = get_settings(db)["history_window"]
    system = persona_prompt(c)
    mem = memory_blocks(db, cid, user_text)
    if mem:
        system += "\n\n" + mem
    history = rows(db, "SELECT role, content FROM character_messages WHERE character_id=? "
                       "ORDER BY id DESC LIMIT ?", (cid, window))
    msgs = [{"role": "system", "content": system}]
    msgs += [{"role": h["role"], "content": h["content"]} for h in reversed(history)]
    msgs.append({"role": "user", "content": user_text})
    return msgs


async def character_chat(db, cid, text, llm):
    """One-to-one chat with a single character. Returns (reply, remembered_texts)."""
    text = (text or "").strip()
    if not text:
        raise AgentError("Message is empty")
    if len(text) > 10000:
        raise AgentError("Message is too long")
    c = get_character(db, cid)
    if not c["enabled"]:
        raise AgentError(f"{c['name']} is switched off")
    msgs = build_chat_messages(db, cid, text)
    reply = (await llm(msgs, 400) or "").strip()
    if not reply:
        raise AgentError("The AI returned an empty reply")
    run(db, "INSERT INTO character_messages(character_id, role, content) VALUES(?, 'user', ?)", (cid, text))
    run(db, "INSERT INTO character_messages(character_id, role, content) VALUES(?, 'assistant', ?)", (cid, reply))
    remembered = []
    for mem_text, imp in extract_memories_from_user_text(text):
        res = add_character_memory(db, cid, mem_text, imp, "user_statement")
        if res and not res["duplicate"]:
            remembered.append(mem_text)
    return reply, remembered


# -------------------------------------------------------------------- groups
def create_group(db, name, character_ids):
    name = (name or "").strip()
    if not name or len(name) > 60:
        raise AgentError("Group name is required (max 60 characters)")
    gid = run(db, "INSERT INTO groups_(name) VALUES(?)", (name,))
    for cid in dict.fromkeys(character_ids or []):
        get_character(db, cid)
        run(db, "INSERT OR IGNORE INTO group_members(group_id, character_id) VALUES(?,?)", (gid, cid))
    return get_group(db, gid)


def get_group(db, gid):
    g = row(db, "SELECT * FROM groups_ WHERE id=?", (gid,))
    if not g:
        raise AgentError("Group not found")
    g["members"] = [_char_out(r) for r in rows(
        db, "SELECT c.* FROM characters c JOIN group_members m ON m.character_id=c.id "
            "WHERE m.group_id=? ORDER BY c.id", (gid,))]
    return g


def list_groups(db):
    return [get_group(db, g["id"]) for g in rows(db, "SELECT id FROM groups_ ORDER BY id")]


def add_group_member(db, gid, cid):
    get_group(db, gid)
    get_character(db, cid)
    run(db, "INSERT OR IGNORE INTO group_members(group_id, character_id) VALUES(?,?)", (gid, cid))
    return get_group(db, gid)


def remove_group_member(db, gid, cid):
    get_group(db, gid)
    run(db, "DELETE FROM group_members WHERE group_id=? AND character_id=?", (gid, cid))
    return get_group(db, gid)


def delete_group(db, gid):
    get_group(db, gid)
    run(db, "DELETE FROM groups_ WHERE id=?", (gid,))


def group_messages(db, gid, limit=100):
    get_group(db, gid)
    found = rows(db, "SELECT * FROM group_messages WHERE group_id=? ORDER BY id DESC LIMIT ?", (gid, limit))
    return list(reversed(found))


def add_group_message(db, gid, kind, speaker_id, speaker_name, content):
    mid = run(db, "INSERT INTO group_messages(group_id, speaker_kind, speaker_id, speaker_name, content) "
                  "VALUES(?,?,?,?,?)", (gid, kind, speaker_id, speaker_name, content))
    return row(db, "SELECT * FROM group_messages WHERE id=?", (mid,))


def _clean_reply(text, name, other_names):
    t = (text or "").strip()
    t = re.sub(rf"^\W*{re.escape(name)}\W*[:\-]\s*", "", t, flags=re.I)
    kept = []
    for line in t.splitlines():
        if any(re.match(rf"^\W*{re.escape(o)}\W*:", line, re.I) for o in other_names + ["User", "You"]):
            break
        kept.append(line)
    return "\n".join(kept).strip().strip('"').strip()[:800]


def _is_pass(text):
    return not text or re.fullmatch(r"\W*pass\W*", text, re.I) is not None


def _pick_speaker(members, recent, spoken_this_run, last_speaker_id):
    candidates = [m for m in members if m["id"] != last_speaker_id] or members
    if recent:
        last_text = recent[-1]["content"].lower()
        for m in candidates:
            if m["name"].lower() in last_text and spoken_this_run.get(m["id"], 0) == 0:
                return m

    def last_index(m):
        for i in range(len(recent) - 1, -1, -1):
            if recent[i]["speaker_id"] == m["id"] and recent[i]["speaker_kind"] == "character":
                return i
        return -1

    return min(candidates, key=lambda m: (spoken_this_run.get(m["id"], 0), last_index(m), m["id"]))


def _transcript(msgs):
    return "\n".join(f"{'User' if m['speaker_kind'] == 'user' else m['speaker_name']}: {m['content']}" for m in msgs)


async def run_group_turns(db, gid, llm, max_turns=None, cancel=None, user_message=None, topic=None):
    """Lets the group's characters talk. Hard limits: turn cap, time budget, repeat/PASS detection.

    Returns {"messages": [...], "stopped": reason}.
    """
    g = get_group(db, gid)
    members = [m for m in g["members"] if m["enabled"]]
    if not members:
        raise AgentError("This group has no active characters")
    settings = get_settings(db)
    turns = min(int(max_turns or settings["max_turns_per_run"]), HARD_MAX_TURNS)
    deadline = time.monotonic() + settings["run_time_budget_seconds"]

    new_msgs = []
    if user_message and user_message.strip():
        if len(user_message) > 10000:
            raise AgentError("Message is too long")
        new_msgs.append(add_group_message(db, gid, "user", None, "User", user_message.strip()))
    elif topic and topic.strip():
        new_msgs.append(add_group_message(db, gid, "user", None, "User", f"(Topic suggested: {topic.strip()[:300]})"))

    window = settings["history_window"] + 8
    spoken, stopped, passes = {}, "turn limit reached", 0
    for _ in range(turns):
        if cancel is not None and cancel.is_set():
            stopped = "cancelled by user"
            break
        if time.monotonic() > deadline:
            stopped = "time budget reached"
            break
        recent = group_messages(db, gid, window)
        if not recent:
            stopped = "nothing to discuss yet"
            break
        last_char = next((m for m in reversed(recent) if m["speaker_kind"] == "character"), None)
        last_id = recent[-1]["speaker_id"] if recent[-1]["speaker_kind"] == "character" else None
        speaker = _pick_speaker(members, recent, spoken, last_id if len(members) > 1 else None)
        others = [m["name"] for m in members if m["id"] != speaker["id"]]

        system = persona_prompt(speaker)
        mem = memory_blocks(db, speaker["id"], _transcript(recent[-3:]))
        if mem:
            system += "\n\n" + mem
        system += (f"\n\nYou are in a group chat called '{g['name']}' with the user and: "
                   f"{', '.join(others) if others else 'nobody else'}.")
        for m in members:
            if m["id"] != speaker["id"]:
                system += "\n" + describe_relationship(get_relationship(db, speaker["id"], m["id"]), m["name"])
        prompt = (f"Conversation so far:\n{_transcript(recent)}\n\nIt is now your turn, {speaker['name']}. "
                  "Reply with only your own message (no name prefix). Do not repeat what was already said. "
                  "If you have nothing useful to add, reply exactly PASS.")
        reply = _clean_reply(await llm([{"role": "system", "content": system},
                                        {"role": "user", "content": prompt}], 250), speaker["name"], others)
        repeated = any(difflib.SequenceMatcher(None, _norm(reply), _norm(m["content"])).ratio() > 0.85
                       for m in recent[-4:])
        if _is_pass(reply) or repeated:
            passes += 1
            spoken[speaker["id"]] = spoken.get(speaker["id"], 0) + 1   # counts as their turn
            if passes >= min(2, len(members)):
                stopped = "conversation reached a natural pause"
                break
            continue
        passes = 0
        msg = add_group_message(db, gid, "character", speaker["id"], speaker["name"], reply)
        new_msgs.append(msg)
        spoken[speaker["id"]] = spoken.get(speaker["id"], 0) + 1
        if last_char and last_char["speaker_id"] != speaker["id"]:
            touch_relationship(db, speaker["id"], last_char["speaker_id"])
            touch_relationship(db, last_char["speaker_id"], speaker["id"])
    return {"messages": new_msgs, "stopped": stopped}


async def reflect_on_group(db, gid, llm, limit=16):
    """One extra LLM call after a discussion: bounded relationship changes + one shared memory."""
    g = get_group(db, gid)
    by_name = {m["name"].lower(): m["id"] for m in g["members"]}
    if len(by_name) < 2:
        return {"relationships": 0, "shared_memory": None}
    recent = group_messages(db, gid, limit)
    if sum(1 for m in recent if m["speaker_kind"] == "character") < 2:
        return {"relationships": 0, "shared_memory": None}
    names = ", ".join(m["name"] for m in g["members"])
    reply = await llm([
        {"role": "system", "content": "You analyse a chat and output ONLY JSON, no other text."},
        {"role": "user", "content":
            f"Characters: {names}\n\nChat:\n{_transcript(recent)}\n\n"
            'Return JSON: {"relationships":[{"from":"Name","to":"Name","trust":0.0,"rapport":0.0,'
            '"rivalry":0.0,"event":"short phrase"}],"shared_memory":"one sentence about what happened"}. '
            "Numbers are small changes between -0.1 and 0.1 and must reflect what actually happened in the chat. "
            "Use [] and null if nothing notable happened."}], 300)
    match = re.search(r"\{.*\}", reply or "", re.S)
    if not match:
        return {"relationships": 0, "shared_memory": None}
    try:
        data = json.loads(match.group(0))
    except ValueError:
        return {"relationships": 0, "shared_memory": None}
    changed = 0
    for rel in data.get("relationships") or []:
        a = by_name.get(str(rel.get("from", "")).lower())
        b = by_name.get(str(rel.get("to", "")).lower())
        if a and b and a != b:
            try:
                apply_relationship_update(db, a, b, rel.get("trust", 0), rel.get("rapport", 0),
                                          rel.get("rivalry", 0), rel.get("event"))
                changed += 1
            except (TypeError, ValueError):
                continue
    shared = data.get("shared_memory")
    saved = None
    if isinstance(shared, str) and shared.strip():
        saved = add_shared_memory(db, list(by_name.values()), shared)
    return {"relationships": changed, "shared_memory": shared if saved and not saved["duplicate"] else None}


# ------------------------------------------------------------------ autonomy
def _in_quiet_hours(spec, now):
    start, end = spec.split("-")
    s_h, s_m = map(int, start.split(":"))
    e_h, e_m = map(int, end.split(":"))
    cur = now.hour * 60 + now.minute
    s, e = s_h * 60 + s_m, e_h * 60 + e_m
    if s == e:
        return False
    return (s <= cur < e) if s < e else (cur >= s or cur < e)


def autonomy_candidate(db, now=None):
    """Decides whether ONE character may speak up now. No background thread: the app asks."""
    now = now or datetime.now()
    st = get_settings(db)
    if not st["autonomy_enabled"]:
        return {"allowed": False, "reason": "autonomy is switched off"}
    if _in_quiet_hours(st["quiet_hours"], now):
        return {"allowed": False, "reason": "quiet hours"}
    today = now.strftime("%Y-%m-%d")
    log = rows(db, "SELECT character_id, created_at FROM autonomy_log ORDER BY id DESC LIMIT 200")
    # created_at is stored in UTC by sqlite; compare using local 'now' converted the same way
    utc_today = datetime.utcnow().strftime("%Y-%m-%d")
    todays = [r for r in log if r["created_at"].startswith(utc_today)]
    if len(todays) >= st["initiatives_per_day"]:
        return {"allowed": False, "reason": "daily limit reached"}
    if log:
        last_age_min = _age_days(log[0]["created_at"]) * 1440
        if last_age_min < st["initiative_cooldown_minutes"]:
            return {"allowed": False, "reason": "cooling down"}
    chars = [c for c in list_characters(db) if c["enabled"] and c["can_initiate"]]
    if not chars:
        return {"allowed": False, "reason": "no character is allowed to start conversations"}
    last_spoke = {}
    for r in log:
        last_spoke.setdefault(r["character_id"], r["created_at"])
    chosen = min(chars, key=lambda c: (last_spoke.get(c["id"], ""), c["id"]))
    return {"allowed": True, "character": chosen, "date": today}


def log_autonomy(db, cid, message):
    run(db, "INSERT INTO autonomy_log(character_id, message) VALUES(?,?)", (cid, message[:300]))


async def make_initiative(db, character, llm):
    topic = (character["interests"] or "something interesting").split(",")[0].strip()
    recent = retrieve_memories(db, character["id"], topic, 2)
    memo = ("\nThings you remember: " + "; ".join(m["content"] for m in recent)) if recent else ""
    system = persona_prompt(character) + memo
    reply = await llm([
        {"role": "system", "content": system},
        {"role": "user", "content": f"Start a friendly conversation with the user about {topic}, or suggest a "
                                    "short game. One message, maximum 25 words, no greeting preamble."}], 80)
    return (reply or "").strip()[:300]


# ------------------------------------------------------- progress and rewards
_BADGES = [("first_win", "First Win"), ("streak_5", "5 Wins in a Row"),
           ("points_100", "100 Points"), ("points_500", "500 Points"), ("level_3", "Reached Level 3")]


def total_points(db):
    r = row(db, "SELECT value FROM agent_settings WHERE key='points'")
    return int(r["value"]) if r else 0


def record_result(db, game, skill, won, score=0):
    """Records a finished game, adapts difficulty and awards virtual points/badges (no real money)."""
    game = (game or "").strip().lower()[:40]
    skill = (skill or "general").strip().lower()[:40]
    if not game:
        raise AgentError("game is required")
    p = row(db, "SELECT * FROM game_progress WHERE game=? AND skill=?", (game, skill)) or {
        "game": game, "skill": skill, "level": 1, "played": 0, "won": 0, "best_score": 0,
        "win_streak": 0, "lose_streak": 0}
    p["played"] += 1
    p["best_score"] = max(p["best_score"], int(score or 0))
    if won:
        p["won"] += 1
        p["win_streak"] += 1
        p["lose_streak"] = 0
    else:
        p["lose_streak"] += 1
        p["win_streak"] = 0
    level_change = 0
    if p["win_streak"] >= 3 and p["level"] < 3:
        p["level"] += 1
        p["win_streak"] = 0
        level_change = 1
    elif p["lose_streak"] >= 3 and p["level"] > 1:
        p["level"] -= 1
        p["lose_streak"] = 0
        level_change = -1
    run(db, "INSERT INTO game_progress(game,skill,level,played,won,best_score,win_streak,lose_streak) "
            "VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(game,skill) DO UPDATE SET level=excluded.level, "
            "played=excluded.played, won=excluded.won, best_score=excluded.best_score, "
            "win_streak=excluded.win_streak, lose_streak=excluded.lose_streak",
        (game, skill, p["level"], p["played"], p["won"], p["best_score"], p["win_streak"], p["lose_streak"]))
    gained = 3 + (10 * p["level"] if won else 0)
    points = total_points(db) + gained
    run(db, "INSERT INTO agent_settings(key,value) VALUES('points',?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (str(points),))
    earned = []

    def award(key):
        label = dict(_BADGES)[key]
        if not row(db, "SELECT id FROM rewards WHERE name=?", (label,)):
            run(db, "INSERT INTO rewards(kind, name) VALUES('badge', ?)", (label,))
            earned.append(label)

    if won and p["won"] == 1:
        award("first_win")
    total_wins_row = row(db, "SELECT MAX(win_streak) AS s FROM game_progress")
    if total_wins_row and (total_wins_row["s"] or 0) >= 5:
        award("streak_5")
    if points >= 100:
        award("points_100")
    if points >= 500:
        award("points_500")
    if p["level"] >= 3:
        award("level_3")
    return {"game": game, "skill": skill, "level": p["level"], "level_change": level_change,
            "points_gained": gained, "points_total": points, "new_badges": earned}


def get_rewards(db):
    return {"points": total_points(db),
            "badges": rows(db, "SELECT name, earned_at FROM rewards ORDER BY id"),
            "progress": rows(db, "SELECT * FROM game_progress ORDER BY game, skill")}
