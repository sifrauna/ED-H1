
import os
import sqlite3
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from music import router as music_router
from characters import router as characters_router
from extras import router as extras_router

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "edh1_memory.db"

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

app = FastAPI(title="ED-H1 Intelligence Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(music_router)
app.include_router(characters_router)
app.include_router(extras_router)

SYSTEM_PROMPT = """
You are ED-H1, a personal AI companion.

Be conversational, thoughtful, helpful and honest.
Adapt your communication to confirmed user preferences.
Do not invent personal facts or claim to remember
information that is not present in supplied memory.
Respect user corrections.
"""


def connect_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_db():
    with connect_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                content TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'confirmed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)


initialize_db()


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class MemoryRequest(BaseModel):
    category: str
    content: str


@app.get("/api/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            response.raise_for_status()
            models = response.json().get("models", [])

        return {
            "status": "online",
            "engine": "ED-H1",
            "ollama": "connected",
            "model": OLLAMA_MODEL,
            "available_models": [m["name"] for m in models],
        }

    except Exception as exc:
        return {
            "status": "degraded",
            "ollama": "disconnected",
            "error": str(exc),
        }


@app.post("/api/chat")
async def chat(request: ChatRequest):
    user_message = request.message.strip()

    if not user_message:
        raise HTTPException(400, "Message cannot be empty")

    if len(user_message) > 10000:
        raise HTTPException(413, "Message is too long")

    with connect_db() as conn:
        memories = conn.execute("""
            SELECT category, content
            FROM memories
            WHERE status = 'confirmed'
            ORDER BY id DESC
            LIMIT 30
        """).fetchall()

        history = conn.execute("""
            SELECT role, content
            FROM conversations
            WHERE session_id = ?
            ORDER BY id DESC
            LIMIT 12
        """, (request.session_id,)).fetchall()

        conn.execute("""
            INSERT INTO conversations (session_id, role, content)
            VALUES (?, 'user', ?)
        """, (request.session_id, user_message))

    memory_context = "\n".join(
        f"- {m['category']}: {m['content']}"
        for m in memories
    )

    messages = [{
        "role": "system",
        "content": SYSTEM_PROMPT
        + "\n\nConfirmed user memories:\n"
        + (memory_context or "No confirmed memories yet.")
    }]

    for item in reversed(history):
        messages.append({
            "role": item["role"],
            "content": item["content"]
        })

    messages.append({
        "role": "user",
        "content": user_message
    })

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False
                }
            )
            response.raise_for_status()
            answer = response.json()["message"]["content"]

    except Exception as exc:
        raise HTTPException(502, f"AI engine error: {str(exc)}")

    with connect_db() as conn:
        conn.execute("""
            INSERT INTO conversations (session_id, role, content)
            VALUES (?, 'assistant', ?)
        """, (request.session_id, answer))

    return {
        "reply": answer,
        "model": OLLAMA_MODEL,
        "memory_count": len(memories)
    }


@app.get("/api/memories")
async def get_memories():
    with connect_db() as conn:
        rows = conn.execute("""
            SELECT id, category, content, status, created_at
            FROM memories ORDER BY id DESC
        """).fetchall()

    return {"memories": [dict(row) for row in rows]}


@app.post("/api/memories")
async def add_memory(request: MemoryRequest):
    category = request.category.strip()
    content = request.content.strip()

    if not category or not content:
        raise HTTPException(400, "Category and content are required")

    with connect_db() as conn:
        cursor = conn.execute("""
            INSERT INTO memories (category, content, status)
            VALUES (?, ?, 'confirmed')
        """, (category, content))

        memory_id = cursor.lastrowid

    return {"status": "saved", "memory_id": memory_id}


@app.delete("/api/memories/{memory_id}")
async def delete_memory(memory_id: int):
    with connect_db() as conn:
        cursor = conn.execute(
            "DELETE FROM memories WHERE id = ?",
            (memory_id,)
        )

    if cursor.rowcount == 0:
        raise HTTPException(404, "Memory not found")

    return {"status": "deleted", "memory_id": memory_id}


# --- serve the built web interface (added by patch_serve_frontend.py) ---
# Must stay at the END of the file so the /api routes above take priority.
import mimetypes
from fastapi.staticfiles import StaticFiles

mimetypes.add_type("application/javascript", ".js")  # Windows sometimes maps .js wrongly
mimetypes.add_type("text/css", ".css")

FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
