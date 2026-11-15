import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbulb, RotateCcw, Shuffle, Trophy } from 'lucide-react';
import { api } from './api.js';
import { speak } from './voice.js';
import { setActivity } from './activity.js';
import { Btn, Card, Notice, useT } from './ui.jsx';

const LEVELS = ['', 'Easy', 'Medium', 'Hard'];
const GAMES = [
  { id: 'tictactoe', name: 'Tic-Tac-Toe', emoji: '⭕', blurb: 'Quick game against the computer.' },
  { id: 'sudoku', name: 'Sudoku', emoji: '🔢', blurb: 'Fill the grid. Hints explain why.' },
  { id: 'scrabble', name: 'Scrabble', emoji: '🔤', blurb: 'Build words, win points.' }
];

export default function GamesScreen({ active }) {
  const t = useT();
  const [rewards, setRewards] = useState({ points: 0, badges: [], progress: [] });
  const [chars, setChars] = useState([]);
  const [host, setHost] = useState(null);
  const [game, setGame] = useState(null);
  const [toast, setToast] = useState('');
  const [reaction, setReaction] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      setRewards(await api.get('/api/rewards'));
      const c = await api.get('/api/characters');
      setChars(c.characters.filter((x) => x.enabled));
      setErr('');
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { if (active) load(); }, [active, load]);

  // The host character is only shown as "playing" while a game is really open.
  useEffect(() => {
    if (host == null || !game) return undefined;
    setActivity(host, `🎮 ${GAMES.find((g) => g.id === game)?.name}`);
    return () => setActivity(host, null);
  }, [host, game]);

  const levelFor = (id) => rewards.progress.find((p) => p.game === id && p.skill === 'general')?.level || 1;

  async function finish(id, won, score = 0, drew = false) {
    try {
      const r = await api.post(`/api/progress/${id}`, { skill: 'general', won, score });
      const parts = [`+${r.points_gained} points`];
      if (r.level_change === 1) parts.push('Level up! 🎉');
      if (r.level_change === -1) parts.push('Level adjusted to keep it fun.');
      if (r.new_badges.length) parts.push(`New badge: ${r.new_badges.join(', ')} 🏅`);
      setToast(parts.join(' · '));
      load();
      const hostChar = chars.find((c) => c.id === host);
      if (hostChar) {
        const outcome = won ? 'I won' : drew ? 'it was a draw' : 'I lost';
        const reply = await api.post(`/api/characters/${hostChar.id}/chat`, { message: `We just finished a game of ${GAMES.find((g) => g.id === id).name} and ${outcome}. React in one short sentence.` });
        setReaction(`${hostChar.name}: ${reply.reply}`);
        speak(hostChar.id, reply.reply, hostChar.voice);
      }
    } catch (e) { setErr(e.message); }
  }

  const props = { level: game ? levelFor(game) : 1, onFinish: finish, onExit: () => { setGame(null); load(); } };

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {err && <Notice kind="error">{err}</Notice>}
      <Card className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold flex items-center gap-1"><Trophy className="w-4 h-4 text-amber-500" />{rewards.points} points</span>
        {rewards.badges.map((b) => <span key={b.name} className={`px-2 py-0.5 rounded-full ${t.btn}`}>🏅 {b.name}</span>)}
        {chars.length > 0 && (
          <label className="ml-auto flex items-center gap-1.5">Play with
            <select className={`rounded-full border px-2 py-1 ${t.input}`} value={host ?? ''} onChange={(e) => setHost(e.target.value ? Number(e.target.value) : null)}>
              <option value="">nobody</option>
              {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
      </Card>
      {toast && <Notice kind="ok">{toast}</Notice>}
      {reaction && <Notice>{reaction}</Notice>}

      {!game && (
        <div className="grid sm:grid-cols-3 gap-2">
          {GAMES.map((g) => (
            <Card key={g.id} className="space-y-2">
              <div className="text-2xl">{g.emoji}</div>
              <div className="font-bold text-sm">{g.name}</div>
              <div className={`text-xs ${t.muted}`}>{g.blurb}</div>
              <div className={`text-[11px] ${t.muted}`}>Your level: {LEVELS[levelFor(g.id)]}</div>
              <Btn active onClick={() => { setToast(''); setReaction(''); setGame(g.id); }}>Play</Btn>
            </Card>
          ))}
        </div>
      )}
      {game === 'tictactoe' && <TicTacToe {...props} />}
      {game === 'sudoku' && <Sudoku {...props} />}
      {game === 'scrabble' && <Scrabble {...props} host={chars.find((c) => c.id === host)?.name} />}
    </div>
  );
}

/* ---------------------------------------------------------- Tic-Tac-Toe */
function TicTacToe({ level, onFinish, onExit }) {
  const t = useT();
  const [board, setBoard] = useState(Array(9).fill(''));
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const reported = useRef(false);

  async function play(i) {
    if (busy || res || board[i]) return;
    setBusy(true);
    try {
      const r = await api.post('/api/games/tictactoe/move', { board, move: i, level });
      setBoard(r.board);
      if (r.winner) {
        setRes(r.result);
        if (!reported.current) { reported.current = true; onFinish('tictactoe', r.result === 'win', r.result === 'win' ? 10 : r.result === 'draw' ? 5 : 0, r.result === 'draw'); }
      }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }
  const again = () => { setBoard(Array(9).fill('')); setRes(null); reported.current = false; };
  return (
    <Card className="space-y-3 text-center">
      <div className="text-xs font-semibold">You are X · {LEVELS[level]}</div>
      <div className="grid grid-cols-3 gap-2 w-60 mx-auto">
        {board.map((v, i) => (
          <button key={i} onClick={() => play(i)} aria-label={`square ${i + 1}`} className={`aspect-square rounded-2xl text-3xl font-black ${t.btn} ${v === 'X' ? 'text-sky-500' : 'text-rose-500'}`}>{v}</button>
        ))}
      </div>
      <div className="text-sm font-semibold h-5">{res === 'win' ? 'You won! 🎉' : res === 'loss' ? 'The computer won this time.' : res === 'draw' ? "It's a draw." : busy ? '…' : 'Your move'}</div>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="flex justify-center gap-2"><Btn active onClick={again}><RotateCcw className="w-3.5 h-3.5" />New game</Btn><Btn onClick={onExit}>Back</Btn></div>
    </Card>
  );
}

/* --------------------------------------------------------------- Sudoku */
function Sudoku({ level, onFinish, onExit }) {
  const t = useT();
  const [given, setGiven] = useState(null);
  const [grid, setGrid] = useState(null);
  const [sel, setSel] = useState(null);
  const [bad, setBad] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const reported = useRef(false);
  const rootRef = useRef(null);

  const fresh = useCallback(async (lv) => {
    setLoading(true); setErr(''); setMsg(''); setBad([]); setSel(null); reported.current = false;
    try {
      const r = await api.post('/api/games/sudoku/new', { level: lv });
      setGiven(r.puzzle.map((v) => v !== 0)); setGrid(r.puzzle);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fresh(level); }, []); // eslint-disable-line  (only when the game opens, never when the level changes mid-game)

  const put = useCallback((v) => {
    setGrid((g) => (g && sel != null && !given[sel] ? g.map((x, i) => (i === sel ? v : x)) : g));
    setBad([]); setMsg('');
  }, [sel, given]);

  useEffect(() => {
    const onKey = (e) => {
      if (!rootRef.current || rootRef.current.offsetParent === null) return;           // screen is hidden
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;          // typing somewhere else
      if (/^[1-9]$/.test(e.key)) put(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') put(0);
      else if (sel != null && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key];
        setSel((s) => (s + d >= 0 && s + d < 81 ? s + d : s));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [put, sel]);

  async function check() {
    try {
      const r = await api.post('/api/games/sudoku/check', { grid });
      setBad(r.conflicts);
      if (r.solved) {
        setMsg('Solved! 🎉');
        if (!reported.current) { reported.current = true; onFinish('sudoku', true, 100 * level); }
      } else if (r.conflicts.length) setMsg('Some numbers clash. They are highlighted.');
      else setMsg(r.complete ? 'Complete, but not solved.' : 'No clashes so far. Keep going!');
    } catch (e) { setErr(e.message); }
  }
  async function hint() {
    try {
      const r = await api.post('/api/games/sudoku/hint', { grid });
      setGrid((g) => g.map((x, i) => (i === r.index ? r.value : x)));
      setGiven((g) => g.map((x, i) => (i === r.index ? true : x)));
      setSel(r.index); setMsg(r.reason); setErr('');
    } catch (e) { setErr(e.message); }
  }

  if (!grid) return <div ref={rootRef}><Card className="text-sm">{loading ? 'Making a puzzle…' : err}</Card></div>;
  return (
    <div ref={rootRef}>
    <Card className="space-y-3">
      <div className="text-xs font-semibold text-center">Sudoku · {LEVELS[level]}</div>
      <div className="grid grid-cols-9 w-full max-w-[440px] mx-auto border-2 border-current/40 rounded-xl overflow-hidden">
        {grid.map((v, i) => {
          const r = Math.floor(i / 9), c = i % 9;
          return (
            <button
              key={i}
              onClick={() => setSel(i)}
              className={`aspect-square text-sm sm:text-lg font-bold border border-current/10 ${c % 3 === 2 && c !== 8 ? 'border-r-2 border-r-current/40' : ''} ${r % 3 === 2 && r !== 8 ? 'border-b-2 border-b-current/40' : ''} ${bad.includes(i) ? 'bg-rose-500/30' : sel === i ? 'bg-amber-400/40' : ''} ${given[i] ? '' : 'text-sky-600'}`}
            >{v || ''}</button>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <Btn key={n} onClick={() => put(n)} className="w-8 !px-0">{n}</Btn>)}
        <Btn onClick={() => put(0)}>Erase</Btn>
      </div>
      {msg && <Notice kind={msg.startsWith('Solved') ? 'ok' : 'info'}>{msg}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      <div className="flex flex-wrap justify-center gap-2">
        <Btn active onClick={check}>Check</Btn>
        <Btn onClick={hint}><Lightbulb className="w-3.5 h-3.5" />Hint</Btn>
        <Btn onClick={() => fresh(level)} disabled={loading}><RotateCcw className="w-3.5 h-3.5" />New puzzle</Btn>
        <Btn onClick={onExit}>Back</Btn>
      </div>
    </Card>
    </div>
  );
}

/* ------------------------------------------------------------- Scrabble */
const VALUES = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10, '?': 0 };
const PREM = {};
const addPrem = (cells, k) => cells.forEach(([r, c]) => { PREM[`${r},${c}`] = k; });
addPrem([[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]], 'TW');
addPrem([[1,1],[2,2],[3,3],[4,4],[1,13],[2,12],[3,11],[4,10],[13,1],[12,2],[11,3],[10,4],[13,13],[12,12],[11,11],[10,10],[7,7]], 'DW');
addPrem([[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],[13,5],[13,9]], 'TL');
addPrem([[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],[6,12],[7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],[12,6],[12,8],[14,3],[14,11]], 'DL');
const PREM_STYLE = { TW: 'bg-rose-500/55', DW: 'bg-rose-300/55', TL: 'bg-sky-500/50', DL: 'bg-sky-300/50' };

function Scrabble({ level, onFinish, onExit, host }) {
  const t = useT();
  const [game, setGame] = useState(undefined);       // undefined = loading, null = none
  const [pending, setPending] = useState([]);        // {r,c,letter,blank,ri}
  const [selRack, setSelRack] = useState(null);
  const [pickBlank, setPickBlank] = useState(false);
  const [preview, setPreview] = useState(null);
  const [exchange, setExchange] = useState(null);    // null or array of rack indexes
  const [blankLetter, setBlankLetter] = useState(null);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const reported = useRef(false);
  const opponent = host || 'Computer';

  useEffect(() => { api.get('/api/games/scrabble/latest').then((r) => setGame(r.game)).catch((e) => { setErr(e.message); setGame(null); }); }, []);

  async function start() {
    try {
      const g = await api.post('/api/games/scrabble/new', { ai_name: opponent });
      reported.current = false; setGame(g); setPending([]); setPreview(null); setMsg(''); setErr('');
    } catch (e) { setErr(e.message); }
  }

  useEffect(() => {
    if (!game || !pending.length) { setPreview(null); return undefined; }
    const h = setTimeout(() => {
      api.post(`/api/games/scrabble/${game.id}/check`, { placements: pending.map(({ r, c, letter, blank }) => ({ r, c, letter, blank })) })
        .then(setPreview).catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(h);
  }, [pending, game?.id]); // eslint-disable-line

  useEffect(() => {
    if (game?.over && !reported.current) {
      reported.current = true;
      onFinish('scrabble', game.winner === 'human', Math.max(0, game.scores.human), game.winner === 'draw');
    }
  }, [game?.over]); // eslint-disable-line

  const rackIdx = game ? game.rack.map((_, i) => i) : [];
  const shown = order && order.length === rackIdx.length ? order : rackIdx;
  const used = new Set(pending.map((p) => p.ri));

  function clickRack(i) {
    if (exchange) { setExchange((e) => (e.includes(i) ? e.filter((x) => x !== i) : [...e, i])); return; }
    if (used.has(i)) return;
    setSelRack(i === selRack ? null : i);
    setPickBlank(game.rack[i] === '?' && i !== selRack);
  }
  function clickCell(r, c) {
    if (game.over || game.turn !== 'human' || busy) return;
    const here = pending.find((p) => p.r === r && p.c === c);
    if (here) { setPending((p) => p.filter((x) => x !== here)); return; }
    if (game.board[r][c] || selRack == null || pickBlank) return;
    const letter = game.rack[selRack];
    setPending((p) => [...p, { r, c, letter, blank: false, ri: selRack }]);
    setSelRack(null);
  }
  function chooseBlank(letter) {
    setPickBlank(false);
    setBlankLetter(letter);          // the next square you tap receives the blank as this letter
  }
  function clickCellWithBlank(r, c) {
    if (blankLetter && selRack != null && !game.board[r][c] && !pending.find((p) => p.r === r && p.c === c)) {
      setPending((p) => [...p, { r, c, letter: blankLetter, blank: true, ri: selRack }]);
      setSelRack(null);
      setBlankLetter(null);
      return;
    }
    clickCell(r, c);
  }

  async function aiTurn(g) {
    if (g.over || g.turn !== 'ai') return;
    setBusy(true); setMsg(`${opponent} is thinking…`);
    try {
      const r = await api.post(`/api/games/scrabble/${g.id}/ai`, { level });
      setGame(r.game);
      const m = r.move;
      setMsg(m.action === 'play' ? `${opponent} played ${m.words.join(', ')} for ${m.score} points.` : m.action === 'exchange' ? `${opponent} swapped some tiles.` : m.note || `${opponent} passed.`);
    } catch (e) { setErr(e.message); setMsg(''); }
    finally { setBusy(false); }
  }
  async function act(fn) {
    setBusy(true); setErr('');
    try { const g = await fn(); setPending([]); setSelRack(null); setBlankLetter(null); setExchange(null); setPreview(null); setGame(g); setBusy(false); await aiTurn(g); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  const play = () => act(async () => {
    const r = await api.post(`/api/games/scrabble/${game.id}/play`, { placements: pending.map(({ r, c, letter, blank }) => ({ r, c, letter, blank })) });
    setMsg(`You scored ${r.result.score}${r.result.bingo ? ' (BINGO +50!)' : ''}.`);
    return r.game;
  });
  const pass = () => act(async () => { setMsg('You passed.'); return api.post(`/api/games/scrabble/${game.id}/pass`); });
  const swap = () => act(async () => { setMsg('You swapped tiles.'); return api.post(`/api/games/scrabble/${game.id}/exchange`, { letters: exchange.map((i) => game.rack[i]) }); });

  if (game === undefined) return <Card className="text-sm">Loading…</Card>;
  if (game === null || !game) {
    return (
      <Card className="space-y-2 text-center">
        <div className="text-sm font-semibold">Scrabble against {opponent}</div>
        {err && <Notice kind="error">{err}</Notice>}
        <div className="flex justify-center gap-2"><Btn active onClick={start}>New game</Btn><Btn onClick={onExit}>Back</Btn></div>
      </Card>
    );
  }

  const cellAt = (r, c) => pending.find((p) => p.r === r && p.c === c) || game.board[r][c];
  const myTurn = game.turn === 'human' && !game.over && !busy;
  return (
    <Card className="space-y-3">
      {!game.dictionary_loaded && <Notice>No word list is installed, so words are not checked and {opponent} can only pass. Connect to the internet and restart ED-H1 once to download it, or place words.txt in backend\data.</Notice>}
      <div className="flex flex-wrap items-center justify-between text-xs font-semibold gap-2">
        <span>You {game.scores.human}</span>
        <span className={t.muted}>{game.bag_count} tiles left · {LEVELS[level]}</span>
        <span>{opponent} {game.scores.ai}</span>
      </div>
      <div className="w-full max-w-[560px] mx-auto grid gap-px p-px rounded-lg bg-black/20" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
        {Array.from({ length: 225 }, (_, n) => {
          const r = Math.floor(n / 15), c = n % 15;
          const cell = cellAt(r, c);
          const isPending = pending.some((p) => p.r === r && p.c === c);
          const prem = PREM[`${r},${c}`];
          return (
            <button key={n} onClick={() => clickCellWithBlank(r, c)} aria-label={`row ${r + 1} column ${c + 1}`}
              className={`aspect-square flex items-center justify-center text-[9px] sm:text-xs font-black leading-none ${cell ? (isPending ? 'bg-amber-300 text-stone-900 ring-1 ring-amber-600' : 'bg-amber-100 text-stone-900') : prem ? PREM_STYLE[prem] : 'bg-emerald-700/15'}`}>
              {cell ? (cell.blank ? <span className="opacity-60">{cell.letter}</span> : cell.letter) : r === 7 && c === 7 ? '★' : prem ? <span className="opacity-60 text-[7px] sm:text-[9px]">{prem}</span> : ''}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {shown.map((i) => {
          const L = game.rack[i];
          const isUsed = used.has(i);
          const marked = exchange?.includes(i);
          return (
            <button key={i} onClick={() => clickRack(i)} disabled={!myTurn} className={`relative w-9 h-9 rounded-lg font-black text-base border-2 ${isUsed ? 'opacity-25' : ''} ${selRack === i ? 'border-amber-500 -translate-y-1' : marked ? 'border-rose-500' : 'border-amber-300'} bg-amber-100 text-stone-900`}>
              {L === '?' ? '' : L}<span className="absolute bottom-0 right-0.5 text-[8px] font-bold">{VALUES[L] || ''}</span>
            </button>
          );
        })}
      </div>
      {pickBlank && (
        <div className="flex flex-wrap justify-center gap-1">
          <span className="text-xs w-full text-center">Blank tile: pick its letter, then tap a square.</span>
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => <Btn key={l} onClick={() => chooseBlank(l)} className="w-7 !px-0">{l}</Btn>)}
        </div>
      )}
      {blankLetter && <div className="text-xs text-center">Placing blank as <b>{blankLetter}</b>: tap a square.</div>}
      {preview && pending.length > 0 && (
        preview.valid
          ? <Notice kind="ok">{preview.words.map((w) => `${w.word} (${w.score})`).join(', ')} → {preview.score} points{preview.unverified ? ' · words not verified' : ''}</Notice>
          : <Notice kind="error">{preview.error}</Notice>
      )}
      {msg && <div className="text-xs text-center font-semibold">{msg}</div>}
      {err && <Notice kind="error">{err}</Notice>}
      {game.over && <Notice kind={game.winner === 'human' ? 'ok' : 'info'}>{game.winner === 'human' ? 'You won! 🎉' : game.winner === 'draw' ? 'A draw.' : `${opponent} won this one.`} Final {game.scores.human} to {game.scores.ai}.</Notice>}
      <div className="flex flex-wrap justify-center gap-2">
        {exchange ? (
          <><Btn active onClick={swap} disabled={!myTurn || !exchange.length}>Swap {exchange.length} tile(s)</Btn><Btn onClick={() => setExchange(null)}>Cancel</Btn></>
        ) : (
          <>
            <Btn active onClick={play} disabled={!myTurn || !preview?.valid}>Play word</Btn>
            <Btn onClick={() => { setPending([]); setSelRack(null); setBlankLetter(null); }} disabled={!pending.length}>Recall</Btn>
            <Btn onClick={() => setOrder([...shown].sort(() => Math.random() - 0.5))}><Shuffle className="w-3.5 h-3.5" />Shuffle</Btn>
            <Btn onClick={() => setExchange([])} disabled={!myTurn || game.bag_count < 7}>Swap tiles</Btn>
            <Btn onClick={pass} disabled={!myTurn}>Pass</Btn>
          </>
        )}
        <Btn onClick={start}>New game</Btn>
        <Btn onClick={onExit}>Back</Btn>
      </div>
      {game.log.length > 0 && (
        <div className={`text-[11px] ${t.muted} text-center`}>
          Last: {game.log.slice(-3).map((m) => `${m.who === 'human' ? 'You' : opponent} ${m.words.length ? m.words.join('/') + ' ' + m.score : m.passed ? 'passed' : 'swapped'}`).join(' · ')}
        </div>
      )}
    </Card>
  );
}
