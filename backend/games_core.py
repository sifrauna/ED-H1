"""ED-H1 game engines. Pure Python, no web code, fully testable.

Levels 1-3 = easy / medium / hard everywhere, so the adaptive-difficulty system can drive them.
"""
import random
from collections import Counter
from pathlib import Path


class GameError(Exception):
    """A rule violation or bad input (shown to the player as a normal message)."""


# ============================================================ Tic-Tac-Toe
_LINES = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]


def ttt_winner(b):
    for x, y, z in _LINES:
        if b[x] and b[x] == b[y] == b[z]:
            return b[x]
    return "draw" if all(b) else None


def _minimax(b, turn, me):
    w = ttt_winner(b)
    if w == me:
        return 1
    if w == "draw":
        return 0
    if w:
        return -1
    scores = []
    for i in range(9):
        if not b[i]:
            b[i] = turn
            scores.append(_minimax(b, "O" if turn == "X" else "X", me))
            b[i] = ""
    return max(scores) if turn == me else min(scores)


def _ttt_pick(b, ai, level, rng):
    empty = [i for i in range(9) if not b[i]]
    human = "X" if ai == "O" else "O"
    if level <= 1:
        return rng.choice(empty)
    for who in (ai, human):                      # win first, then block
        for i in empty:
            b[i] = who
            hit = ttt_winner(b) == who
            b[i] = ""
            if hit:
                return i
    if level == 2:
        return 4 if not b[4] and rng.random() < 0.6 else rng.choice(empty)
    best, best_moves = -2, []
    for i in empty:
        b[i] = ai
        s = _minimax(b, human, ai)
        b[i] = ""
        if s > best:
            best, best_moves = s, [i]
        elif s == best:
            best_moves.append(i)
    return rng.choice(best_moves)


def ttt_play(board, move, level=2, human="X", rng=None):
    rng = rng or random.Random()
    if not (isinstance(board, list) and len(board) == 9 and all(c in ("", "X", "O") for c in board)):
        raise GameError("Invalid board")
    if ttt_winner(board):
        raise GameError("This game is already finished")
    if not isinstance(move, int) or not 0 <= move < 9 or board[move]:
        raise GameError("That square is not available")
    ai = "O" if human == "X" else "X"
    b = list(board)
    b[move] = human
    ai_move = None
    if not ttt_winner(b):
        ai_move = _ttt_pick(b, ai, max(1, min(3, int(level))), rng)
        b[ai_move] = ai
    w = ttt_winner(b)
    return {"board": b, "ai_move": ai_move, "winner": w,
            "result": None if not w else ("draw" if w == "draw" else ("win" if w == human else "loss"))}


# ================================================================ Sudoku
def _peers_masks():
    rows, cols, boxes = [0] * 9, [0] * 9, [0] * 9
    return rows, cols, boxes


def _solve(grid, limit=1, rng=None):
    """Backtracking with most-constrained-cell choice. Returns up to `limit` solutions."""
    rows, cols, boxes = _peers_masks()
    for i, v in enumerate(grid):
        if v:
            bit = 1 << v
            r, c = divmod(i, 9)
            b = (r // 3) * 3 + c // 3
            if rows[r] & bit or cols[c] & bit or boxes[b] & bit:
                return []
            rows[r] |= bit
            cols[c] |= bit
            boxes[b] |= bit
    out, g = [], list(grid)

    def rec():
        best, best_opts = None, None
        for i in range(81):
            if not g[i]:
                r, c = divmod(i, 9)
                used = rows[r] | cols[c] | boxes[(r // 3) * 3 + c // 3]
                opts = [v for v in range(1, 10) if not used & (1 << v)]
                if not opts:
                    return
                if best is None or len(opts) < len(best_opts):
                    best, best_opts = i, opts
                    if len(opts) == 1:
                        break
        if best is None:
            out.append(list(g))
            return
        if rng:
            rng.shuffle(best_opts)
        r, c = divmod(best, 9)
        b = (r // 3) * 3 + c // 3
        for v in best_opts:
            bit = 1 << v
            g[best] = v
            rows[r] |= bit
            cols[c] |= bit
            boxes[b] |= bit
            rec()
            rows[r] &= ~bit
            cols[c] &= ~bit
            boxes[b] &= ~bit
            g[best] = 0
            if len(out) >= limit:
                return

    rec()
    return out


_CLUES = {1: 40, 2: 32, 3: 27}


def sudoku_new(level=2, rng=None):
    rng = rng or random.Random()
    level = max(1, min(3, int(level)))
    full = _solve([0] * 81, 1, rng)[0]
    puzzle = list(full)
    order = list(range(81))
    rng.shuffle(order)
    clues = 81
    for i in order:
        if clues <= _CLUES[level]:
            break
        keep = puzzle[i]
        puzzle[i] = 0
        if len(_solve(puzzle, 2)) != 1:          # keep the puzzle uniquely solvable
            puzzle[i] = keep
        else:
            clues -= 1
    return {"puzzle": puzzle, "level": level, "clues": clues}


def _conflicts(grid):
    bad = set()
    for unit in ([[r * 9 + c for c in range(9)] for r in range(9)]
                 + [[r * 9 + c for r in range(9)] for c in range(9)]
                 + [[(br * 3 + r) * 9 + bc * 3 + c for r in range(3) for c in range(3)]
                    for br in range(3) for bc in range(3)]):
        seen = {}
        for i in unit:
            v = grid[i]
            if v:
                if v in seen:
                    bad.update((i, seen[v]))
                seen[v] = i
    return sorted(bad)


def _valid_grid(grid):
    if not (isinstance(grid, list) and len(grid) == 81 and all(isinstance(v, int) and 0 <= v <= 9 for v in grid)):
        raise GameError("Invalid Sudoku grid")


def sudoku_check(grid):
    _valid_grid(grid)
    bad = _conflicts(grid)
    complete = all(grid)
    return {"conflicts": bad, "complete": complete, "solved": complete and not bad}


def sudoku_hint(grid):
    _valid_grid(grid)
    if _conflicts(grid):
        raise GameError("Fix the highlighted conflicts first, then ask for a hint")
    sol = _solve(grid, 1)
    if not sol:
        raise GameError("This position has no solution. Some earlier number is wrong")
    best, best_n = None, 10
    for i in range(81):
        if not grid[i]:
            r, c = divmod(i, 9)
            used = {grid[r * 9 + k] for k in range(9)} | {grid[k * 9 + c] for k in range(9)}
            br, bc = r // 3 * 3, c // 3 * 3
            used |= {grid[(br + a) * 9 + bc + b] for a in range(3) for b in range(3)}
            n = 9 - len({u for u in used if u})
            if n < best_n:
                best, best_n = i, n
    if best is None:
        raise GameError("The grid is already full")
    r, c = divmod(best, 9)
    why = (f"Row {r + 1}, column {c + 1}: only {sol[0][best]} fits here." if best_n == 1 else
           f"Row {r + 1}, column {c + 1} must be {sol[0][best]} (found by solving ahead).")
    return {"index": best, "value": sol[0][best], "reason": why}


# =============================================================== Scrabble
TILES = {"A": 9, "B": 2, "C": 2, "D": 4, "E": 12, "F": 2, "G": 3, "H": 2, "I": 9, "J": 1, "K": 1, "L": 4,
         "M": 2, "N": 6, "O": 8, "P": 2, "Q": 1, "R": 6, "S": 4, "T": 6, "U": 4, "V": 2, "W": 2, "X": 1,
         "Y": 2, "Z": 1, "?": 2}
VALUES = {"A": 1, "B": 3, "C": 3, "D": 2, "E": 1, "F": 4, "G": 2, "H": 4, "I": 1, "J": 8, "K": 5, "L": 1,
          "M": 3, "N": 1, "O": 1, "P": 3, "Q": 10, "R": 1, "S": 1, "T": 1, "U": 1, "V": 4, "W": 4, "X": 8,
          "Y": 4, "Z": 10, "?": 0}
_TW = [(0, 0), (0, 7), (0, 14), (7, 0), (7, 14), (14, 0), (14, 7), (14, 14)]
_DW = [(1, 1), (2, 2), (3, 3), (4, 4), (1, 13), (2, 12), (3, 11), (4, 10), (13, 1), (12, 2), (11, 3), (10, 4),
       (13, 13), (12, 12), (11, 11), (10, 10), (7, 7)]
_TL = [(1, 5), (1, 9), (5, 1), (5, 5), (5, 9), (5, 13), (9, 1), (9, 5), (9, 9), (9, 13), (13, 5), (13, 9)]
_DL = [(0, 3), (0, 11), (2, 6), (2, 8), (3, 0), (3, 7), (3, 14), (6, 2), (6, 6), (6, 8), (6, 12), (7, 3), (7, 11),
       (8, 2), (8, 6), (8, 8), (8, 12), (11, 0), (11, 7), (11, 14), (12, 6), (12, 8), (14, 3), (14, 11)]
PREMIUM = {}
for _name, _cells in (("TW", _TW), ("DW", _DW), ("TL", _TL), ("DL", _DL)):
    for _cell in _cells:
        PREMIUM[_cell] = _name
BINGO_BONUS = 50


class Dictionary:
    """Word list loader. Without a word list the game still works but words are 'unverified'."""

    def __init__(self, words=None):
        self.words = set(words) if words is not None else set()
        self._by_len = None

    @classmethod
    def from_file(cls, path):
        p = Path(path)
        if not p.exists():
            return cls(None)
        words = {w.strip().upper() for w in p.read_text(encoding="utf-8", errors="ignore").splitlines()}
        return cls({w for w in words if 2 <= len(w) <= 15 and w.isalpha() and w.isascii()})

    @property
    def loaded(self):
        return bool(self.words)

    def valid(self, word):
        return word.upper() in self.words if self.loaded else (len(word) >= 2 and word.isalpha())

    def short_words(self, max_len=9):
        if self._by_len is None:
            self._by_len = sorted((w for w in self.words if len(w) <= max_len), key=lambda w: -len(w))
        return self._by_len


def scrabble_new(ai_name="ED-H1", rng=None):
    rng = rng or random.Random()
    bag = [l for l, n in TILES.items() for _ in range(n)]
    rng.shuffle(bag)
    st = {"board": [[None] * 15 for _ in range(15)], "bag": bag, "racks": {"human": [], "ai": []},
          "scores": {"human": 0, "ai": 0}, "turn": "human", "passes": 0, "first": True, "over": False,
          "winner": None, "log": [], "ai_name": ai_name}
    for who in ("human", "ai"):
        _draw(st, who)
    return st


def _draw(st, who):
    rack = st["racks"][who]
    while len(rack) < 7 and st["bag"]:
        rack.append(st["bag"].pop())


def _word_at(board, r, c, dr, dc):
    """Contiguous word through (r, c) in direction (dr, dc) -> (cells, string)."""
    while 0 <= r - dr < 15 and 0 <= c - dc < 15 and board[r - dr][c - dc]:
        r, c = r - dr, c - dc
    cells = []
    while 0 <= r < 15 and 0 <= c < 15 and board[r][c]:
        cells.append((r, c))
        r, c = r + dr, c + dc
    return cells, "".join(board[a][b]["l"] for a, b in cells)


def scrabble_check(st, who, placements, dic):
    """Validates a move WITHOUT changing the game. Returns {valid, error?, words, score}."""
    try:
        return _check(st, who, placements, dic)
    except GameError as exc:
        return {"valid": False, "error": str(exc), "words": [], "score": 0}


def _check(st, who, placements, dic):
    if not placements or len(placements) > 7:
        raise GameError("Place between 1 and 7 tiles")
    board = [row[:] for row in st["board"]]
    spots = set()
    for p in placements:
        r, c, letter = p.get("r"), p.get("c"), str(p.get("letter", "")).upper()
        if not (isinstance(r, int) and isinstance(c, int) and 0 <= r < 15 and 0 <= c < 15):
            raise GameError("A tile is outside the board")
        if board[r][c] or (r, c) in spots:
            raise GameError("A square is already taken")
        if len(letter) != 1 or not letter.isalpha():
            raise GameError("Tiles must be letters")
        spots.add((r, c))
    need = Counter(("?" if p.get("blank") else str(p["letter"]).upper()) for p in placements)
    have = Counter(st["racks"][who])
    if any(need[k] > have[k] for k in need):
        raise GameError("You do not have those tiles")
    for p in placements:
        board[p["r"]][p["c"]] = {"l": str(p["letter"]).upper(), "blank": bool(p.get("blank")), "new": True}
    rs, cs = {p["r"] for p in placements}, {p["c"] for p in placements}
    if len(rs) > 1 and len(cs) > 1:
        raise GameError("Tiles must be in one row or one column")
    horizontal = len(rs) == 1
    if len(placements) > 1:
        line = sorted(cs) if horizontal else sorted(rs)
        fixed = next(iter(rs)) if horizontal else next(iter(cs))
        for k in range(line[0], line[-1] + 1):
            cell = board[fixed][k] if horizontal else board[k][fixed]
            if not cell:
                raise GameError("There are gaps between your tiles")
    if st["first"]:
        if (7, 7) not in spots:
            raise GameError("The first word must cover the centre star")
        if len(placements) < 2:
            raise GameError("The first word needs at least 2 letters")
    else:
        touching = any(
            0 <= p["r"] + dr < 15 and 0 <= p["c"] + dc < 15 and st["board"][p["r"] + dr][p["c"] + dc]
            for p in placements for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if not touching:
            raise GameError("Your word must connect to tiles already on the board")

    found, seen = [], set()

    def add_word(cells, text):
        key = tuple(cells)
        if len(text) >= 2 and key not in seen:
            seen.add(key)
            found.append((cells, text))

    anchor = placements[0]
    for dr, dc in ((0, 1), (1, 0)):
        if len(placements) == 1 or (horizontal and (dr, dc) == (0, 1)) or (not horizontal and (dr, dc) == (1, 0)):
            add_word(*_word_at(board, anchor["r"], anchor["c"], dr, dc))
    for p in placements:                                  # cross words
        dr, dc = (1, 0) if horizontal else (0, 1)
        if len(placements) > 1:
            add_word(*_word_at(board, p["r"], p["c"], dr, dc))
    if not found:
        raise GameError("That does not form a word")

    total, words = 0, []
    for cells, text in found:
        if not dic.valid(text):
            raise GameError(f"'{text}' is not in the dictionary")
        score, mult = 0, 1
        for (r, c) in cells:
            cell = board[r][c]
            val = 0 if cell["blank"] else VALUES[cell["l"]]
            if cell.get("new"):
                prem = PREMIUM.get((r, c))
                if prem == "DL":
                    val *= 2
                elif prem == "TL":
                    val *= 3
                elif prem == "DW":
                    mult *= 2
                elif prem == "TW":
                    mult *= 3
            score += val
        words.append({"word": text, "score": score * mult})
        total += score * mult
    bingo = len(placements) == 7
    if bingo:
        total += BINGO_BONUS
    return {"valid": True, "words": words, "score": total, "bingo": bingo,
            "unverified": not dic.loaded}


def _finish_if_over(st):
    out_of_tiles = not st["bag"] and (not st["racks"]["human"] or not st["racks"]["ai"])
    if not (out_of_tiles or st["passes"] >= 6):
        return
    st["over"] = True
    left = {w: sum(VALUES[t] for t in st["racks"][w]) for w in ("human", "ai")}
    for w in ("human", "ai"):
        st["scores"][w] -= left[w]
    if out_of_tiles:
        out = "human" if not st["racks"]["human"] else "ai"
        other = "ai" if out == "human" else "human"
        st["scores"][out] += left[other]
    h, a = st["scores"]["human"], st["scores"]["ai"]
    st["winner"] = "human" if h > a else "ai" if a > h else "draw"


def scrabble_play(st, who, placements, dic):
    if st["over"]:
        raise GameError("The game is over")
    if st["turn"] != who:
        raise GameError("It is not your turn")
    res = scrabble_check(st, who, placements, dic)
    if not res["valid"]:
        raise GameError(res["error"])
    for p in placements:
        tile = "?" if p.get("blank") else str(p["letter"]).upper()
        st["racks"][who].remove(tile)
        st["board"][p["r"]][p["c"]] = {"l": str(p["letter"]).upper(), "blank": bool(p.get("blank"))}
    st["scores"][who] += res["score"]
    st["first"], st["passes"] = False, 0
    st["log"].append({"who": who, "words": [w["word"] for w in res["words"]], "score": res["score"]})
    _draw(st, who)
    st["turn"] = "ai" if who == "human" else "human"
    _finish_if_over(st)
    return res


def scrabble_pass(st, who):
    if st["over"] or st["turn"] != who:
        raise GameError("It is not your turn")
    st["passes"] += 1
    st["log"].append({"who": who, "words": [], "score": 0, "passed": True})
    st["turn"] = "ai" if who == "human" else "human"
    _finish_if_over(st)


def scrabble_exchange(st, who, letters):
    if st["over"] or st["turn"] != who:
        raise GameError("It is not your turn")
    if len(st["bag"]) < 7:
        raise GameError("Not enough tiles left in the bag to exchange")
    rack, give = st["racks"][who], [str(l).upper() for l in letters]
    if not give or Counter(give) - Counter(rack):
        raise GameError("You can only exchange tiles you hold")
    for l in give:
        rack.remove(l)
    st["bag"].extend(give)
    random.shuffle(st["bag"])
    _draw(st, who)
    st["passes"] += 1
    st["log"].append({"who": who, "words": [], "score": 0, "exchanged": len(give)})
    st["turn"] = "ai" if who == "human" else "human"
    _finish_if_over(st)


def _candidates(st, who, dic, limit=1500):
    rack = st["racks"][who]
    rc = Counter(rack)
    blanks = rc.get("?", 0)
    board_letters = {st["board"][r][c]["l"] for r in range(15) for c in range(15) if st["board"][r][c]}
    allowed = set(rc) | board_letters
    spots = [(r, c) for r in range(15) for c in range(15) if st["board"][r][c]]
    words = []
    for w in dic.short_words(9):
        if len(w) > len(rack) + (0 if st["first"] else 1):
            continue
        if not blanks and any(ch not in allowed for ch in w):
            continue
        words.append(w)
        if len(words) >= limit:
            break
    moves = []

    def fill(word, positions):
        pool, out = Counter(rc), []
        for (r, c), ch in positions:
            if pool.get(ch, 0) > 0:
                pool[ch] -= 1
                out.append({"r": r, "c": c, "letter": ch})
            elif pool.get("?", 0) > 0:
                pool["?"] -= 1
                out.append({"r": r, "c": c, "letter": ch, "blank": True})
            else:
                return None
        return out

    if st["first"]:
        for w in words:
            for dr, dc in ((0, 1), (1, 0)):
                for off in range(len(w)):
                    r0, c0 = 7 - dr * off, 7 - dc * off
                    pos = [((r0 + dr * k, c0 + dc * k), w[k]) for k in range(len(w))]
                    if all(0 <= a < 15 and 0 <= b < 15 for (a, b), _ in pos):
                        pl = fill(w, pos)
                        if pl:
                            moves.append(pl)
        return moves
    for w in words:
        for (r, c) in spots:
            ch = st["board"][r][c]["l"]
            for i, letter in enumerate(w):
                if letter != ch:
                    continue
                for dr, dc in ((0, 1), (1, 0)):
                    pos = []
                    for k, l2 in enumerate(w):
                        if k == i:
                            continue
                        rr, cc = r + dr * (k - i), c + dc * (k - i)
                        if not (0 <= rr < 15 and 0 <= cc < 15) or st["board"][rr][cc]:
                            pos = None
                            break
                        pos.append(((rr, cc), l2))
                    if pos:
                        pl = fill(w, pos)
                        if pl:
                            moves.append(pl)
    return moves


def scrabble_ai_move(st, dic, level=2, rng=None):
    """Basic opponent: tries words through tiles already on the board (or the centre on move one)."""
    rng = rng or random.Random()
    who = "ai"
    if st["over"] or st["turn"] != who:
        raise GameError("It is not the computer's turn")
    if not dic.loaded:
        scrabble_pass(st, who)
        return {"action": "pass", "note": "No word list installed, so the computer cannot play."}
    scored = []
    for pl in _candidates(st, who, dic):
        res = scrabble_check(st, who, pl, dic)
        if res["valid"]:
            scored.append((res["score"], pl, res))
    if not scored:
        if len(st["bag"]) >= 7:
            scrabble_exchange(st, who, st["racks"][who][:3])
            return {"action": "exchange"}
        scrabble_pass(st, who)
        return {"action": "pass"}
    scored.sort(key=lambda t: -t[0])
    pool = {1: scored[len(scored) // 2:], 2: scored[:5], 3: scored[:1]}[max(1, min(3, int(level)))] or scored[:1]
    score, pl, _ = rng.choice(pool)
    res = scrabble_play(st, who, pl, dic)
    return {"action": "play", "words": [w["word"] for w in res["words"]], "score": res["score"]}


def public_state(st, hide_ai_rack=True):
    """What the browser may see (never the bag order or the computer's rack)."""
    out = {k: v for k, v in st.items() if k not in ("bag", "racks")}
    out["rack"] = list(st["racks"]["human"])
    out["bag_count"] = len(st["bag"])
    out["ai_rack_count"] = len(st["racks"]["ai"])
    if not hide_ai_rack:
        out["ai_rack"] = list(st["racks"]["ai"])
    return out
