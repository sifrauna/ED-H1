"""ED-H1 document intake: validation, text extraction, storage and relevance search. No web code."""
import base64
import binascii
import io
import re
import sqlite3
import zipfile
from xml.etree import ElementTree

MAX_BYTES = 10 * 1024 * 1024
MAX_TEXT = 400_000
TEXT_EXT = {".txt", ".md", ".csv", ".json", ".log", ".py", ".js", ".html", ".xml", ".yaml", ".yml", ".ini", ".tsv"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
OFFICE_EXT = {".docx", ".pptx", ".xlsx"}
ALLOWED = TEXT_EXT | IMAGE_EXT | OFFICE_EXT | {".pdf"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, ext TEXT NOT NULL, kind TEXT NOT NULL,
    size INTEGER NOT NULL, text TEXT DEFAULT '', data BLOB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS file_access (
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, character_id));
CREATE TABLE IF NOT EXISTS saved_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, state TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
"""


class FileError(Exception):
    pass


def _xml_text(xml_bytes, tag_suffix):
    root = ElementTree.fromstring(xml_bytes)
    return [el.text or "" for el in root.iter() if el.tag.endswith(tag_suffix)]


def _safe_zip(data):
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise FileError("This file is damaged or is not a valid Office document")
    if sum(i.file_size for i in z.infolist()) > 60 * 1024 * 1024:
        raise FileError("This document expands to an unsafe size")
    return z


def extract_text(ext, data):
    """Returns plain text for text, docx, pptx, xlsx and pdf files."""
    if ext in TEXT_EXT:
        return data.decode("utf-8", errors="replace")
    if ext == ".docx":
        z = _safe_zip(data)
        root = ElementTree.fromstring(z.read("word/document.xml"))
        paras = []
        for p in root.iter():
            if p.tag.endswith("}p"):
                paras.append("".join(t.text or "" for t in p.iter() if t.tag.endswith("}t")))
        return "\n".join(paras)
    if ext == ".pptx":
        z = _safe_zip(data)
        slides = sorted((n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
                        key=lambda n: int(re.findall(r"\d+", n)[0]))
        return "\n\n".join(f"[Slide {i + 1}]\n" + "\n".join(t for t in _xml_text(z.read(n), "}t") if t.strip())
                           for i, n in enumerate(slides))
    if ext == ".xlsx":
        z = _safe_zip(data)
        if "xl/sharedStrings.xml" not in z.namelist():
            return ""
        return "\n".join(t for t in _xml_text(z.read("xl/sharedStrings.xml"), "}t") if t.strip())
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError:
            raise FileError("Reading PDFs needs the 'pypdf' package. Close ED-H1 and start it again to install it.")
        try:
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                raise FileError("This PDF is password protected")
            return "\n\n".join((p.extract_text() or "") for p in reader.pages)
        except FileError:
            raise
        except Exception:
            raise FileError("This PDF could not be read")
    raise FileError("Unsupported file type")


def add_file(db_run, db_row, name, data_b64):
    name = (name or "").strip().replace("\\", "/").split("/")[-1][:120]
    ext = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
    if ext not in ALLOWED:
        raise FileError("Unsupported file type. Allowed: text, Word, PowerPoint, Excel, PDF and images")
    try:
        data = base64.b64decode(data_b64 or "", validate=True)
    except (binascii.Error, ValueError):
        raise FileError("The file data is not valid")
    if not data:
        raise FileError("The file is empty")
    if len(data) > MAX_BYTES:
        raise FileError(f"File is too large (limit {MAX_BYTES // 1024 // 1024} MB)")
    if ext in IMAGE_EXT:
        kind, text, blob = "image", "", data
    else:
        kind, blob = "document", None
        text = re.sub(r"\n{3,}", "\n\n", extract_text(ext, data)).strip()[:MAX_TEXT]
        if not text:
            raise FileError("No readable text was found in this file")
    fid = db_run("INSERT INTO files(name, ext, kind, size, text, data) VALUES(?,?,?,?,?,?)",
                 (name, ext, kind, len(data), text, blob))
    return db_row("SELECT id, name, ext, kind, size, created_at FROM files WHERE id=?", (fid,))


def split_chunks(text, size=900):
    out, cur = [], ""
    for para in re.split(r"\n\s*\n|(?<=[.!?])\s+", text):
        if len(cur) + len(para) + 1 > size and cur:
            out.append(cur.strip())
            cur = ""
        cur += para + "\n"
    if cur.strip():
        out.append(cur.strip())
    return out


_STOP = set("the a an and or of to in is it i you he she we they that this for on with as at be are was were what "
            "when how can will about does did who which from into than then there their your have has had".split())


def _tok(t):
    return {w for w in re.findall(r"\w+", t.lower()) if w not in _STOP and len(w) > 2}


def relevant_excerpts(text, question, k=4):
    chunks = split_chunks(text)
    q = _tok(question)
    scored = sorted(((len(q & _tok(c)), -i, c) for i, c in enumerate(chunks)), reverse=True)
    best = [c for s, _, c in scored[:k] if s > 0] or chunks[:k]
    return [c for c in chunks if c in best]          # keep document order


def overview_excerpt(text, budget=6000):
    if len(text) <= budget:
        return text
    third = budget // 3
    mid = len(text) // 2
    return text[:third] + "\n[...]\n" + text[mid - third // 2: mid + third // 2] + "\n[...]\n" + text[-third:]
