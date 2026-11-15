import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Brain, Eye, EyeOff, House, MessageCircle, Mic, Palette, Plus, Send, Sparkles, Trash2, Users, Volume2, VolumeX, X
} from 'lucide-react';
import { api } from './api.js';
import { onSpeaking, speak, stopSpeaking, voicesAvailable } from './voice.js';
import { setActivity, useActivities } from './activity.js';
import MiniAvatar, { EYEWEAR, HEADWEAR, SWATCHES } from './MiniAvatar.jsx';
import { Btn, Card, Field, Notice, Tabs, TextArea, TextInput, useT } from './ui.jsx';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Light, cheap backgrounds: a gradient and three decorative emoji. No images, no animation.
export const ENVIRONMENTS = [
  { id: 'living_room', name: 'Living room', bg: 'linear-gradient(180deg,#FBF3E4 0%,#F1E2C6 62%,#D9C3A0 62%,#CDB48C 100%)', props: [['🛋️', 12, 64, 44], ['🪴', 88, 60, 36], ['🖼️', 50, 14, 34]] },
  { id: 'library', name: 'Library', bg: 'linear-gradient(180deg,#E9D8BC 0%,#CDAE84 62%,#8B6B45 62%,#7A5B38 100%)', props: [['📚', 10, 30, 44], ['🕰️', 90, 24, 34], ['🪑', 86, 66, 38]] },
  { id: 'classroom', name: 'Classroom', bg: 'linear-gradient(180deg,#E7F0E4 0%,#CFE2CB 62%,#B7A27F 62%,#A38F6D 100%)', props: [['📐', 12, 28, 34], ['🔬', 88, 62, 38], ['🌍', 50, 18, 38]] },
  { id: 'office', name: 'Office', bg: 'linear-gradient(180deg,#EEF1F5 0%,#DDE3EB 62%,#B8C0CC 62%,#A7B0BD 100%)', props: [['💻', 14, 62, 38], ['🗂️', 88, 28, 34], ['☕', 82, 70, 28]] },
  { id: 'space_station', name: 'Space station', bg: 'linear-gradient(180deg,#0B1026 0%,#1B2250 70%,#2A3270 70%,#1E2557 100%)', props: [['🪐', 14, 24, 42], ['⭐', 80, 18, 24], ['🛰️', 88, 56, 34]] },
  { id: 'garden', name: 'Garden', bg: 'linear-gradient(180deg,#DDF0FA 0%,#E8F6EC 55%,#9CCB7A 55%,#85B866 100%)', props: [['🌳', 10, 46, 52], ['🌷', 88, 66, 30], ['🦋', 62, 24, 26]] },
  { id: 'studio', name: 'Creative studio', bg: 'linear-gradient(180deg,#F1E9FA 0%,#E2D4F2 62%,#C9B5E4 62%,#B9A1DA 100%)', props: [['🎨', 12, 34, 38], ['🎹', 88, 64, 40], ['🖌️', 82, 24, 28]] },
  { id: 'gaming_room', name: 'Gaming room', bg: 'linear-gradient(180deg,#1B1233 0%,#2E1F55 62%,#3B2A6B 62%,#2A1D4D 100%)', props: [['🎮', 12, 66, 38], ['🕹️', 86, 62, 34], ['👾', 50, 20, 34]] }
];

const NAME_COLORS = ['#B45309', '#0F766E', '#7C3AED', '#BE185D', '#1D4ED8', '#15803D'];
const colorFor = (id) => NAME_COLORS[Math.abs(Number(id) || 0) % NAME_COLORS.length];
const CSS = `@keyframes edh-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.edh-bob{animation:edh-bob 3.4s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.edh-bob{animation:none}}`;

const EMPTY_FORM = {
  name: '', role: '', personality: '', style: '', interests: '', extra_instructions: '',
  can_initiate: false, enabled: true, voice: {}, appearance: { swatch: 'Ivory Cream', headwear: 'sprout', eyewear: 'none' }
};

export default function RoomScreen({ active, speechLang }) {
  const t = useT();
  const [chars, setChars] = useState([]);
  const [room, setRoom] = useState({ environment: 'living_room', show_names: true, voice_replies: true });
  const [settings, setSettings] = useState(null);
  const [selId, setSelId] = useState(null);
  const [tab, setTab] = useState('chat');
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [thinking, setThinking] = useState({});
  const [hist, setHist] = useState({});
  const [suggestion, setSuggestion] = useState(null);
  const [posOverride, setPosOverride] = useState({});
  const acts = useActivities();
  const stageRef = useRef(null);
  const drag = useRef(null);
  const lastPos = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [c, r, s] = await Promise.all([api.get('/api/characters'), api.get('/api/room'), api.get('/api/agents/settings')]);
      setChars(c.characters);
      setRoom(r);
      setSettings(s);
      setErr('');
      setSelId((cur) => (cur && c.characters.some((x) => x.id === cur) ? cur : c.characters[0]?.id ?? null));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { if (active && !loaded) refresh(); }, [active, loaded, refresh]);
  useEffect(() => onSpeaking(setSpeakingId), []);
  useEffect(() => { if (!active) stopSpeaking(); }, [active]);

  // Autonomy is "pull": we ask now and then, only while this screen is open and the user enabled it.
  useEffect(() => {
    if (!active || !settings?.autonomy_enabled) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const r = await api.get('/api/autonomy/suggest');
        if (!stop && r.suggestion) setSuggestion(r.suggestion);
      } catch (_) {}
    };
    const first = setTimeout(tick, 4000);
    const iv = setInterval(tick, 300000);
    return () => { stop = true; clearTimeout(first); clearInterval(iv); };
  }, [active, settings?.autonomy_enabled]);

  const sel = chars.find((c) => c.id === selId) || null;
  const env = ENVIRONMENTS.find((e) => e.id === room.environment) || ENVIRONMENTS[0];
  const dark = env.id === 'space_station' || env.id === 'gaming_room';
  const posOf = (c, i) => ({ x: 22 + (i % 4) * 19, y: 66, scale: 1, visible: true, ...(c.appearance?.room || {}), ...(posOverride[c.id] || {}) });
  const replaceChar = (c) => setChars((list) => list.map((x) => (x.id === c.id ? c : x)));

  async function saveAppearance(c, patch) {
    try {
      const updated = await api.put(`/api/characters/${c.id}`, { appearance: { ...(c.appearance || {}), ...patch } });
      replaceChar(updated);
    } catch (e) { setErr(e.message); }
  }

  const onDown = (e, c) => {
    e.preventDefault();
    drag.current = { id: c.id, sx: e.clientX, sy: e.clientY, moved: false, rect: stageRef.current.getBoundingClientRect() };
    lastPos.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
    d.moved = true;
    const p = { x: clamp(((e.clientX - d.rect.left) / d.rect.width) * 100, 6, 94), y: clamp(((e.clientY - d.rect.top) / d.rect.height) * 100, 30, 92) };
    lastPos.current = p;
    setPosOverride((o) => ({ ...o, [d.id]: p }));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { setSelId(d.id); return; }
    const c = chars.find((x) => x.id === d.id);
    if (c && lastPos.current) saveAppearance(c, { room: { ...(c.appearance?.room || {}), ...lastPos.current } }).then(() => setPosOverride((o) => { const n = { ...o }; delete n[d.id]; return n; }));
  };

  const badgeFor = (c) => {
    if (speakingId === c.id) return '🔊 Speaking';
    if (thinking[c.id]) return '💭 Thinking';
    return acts.get(c.id) || null;
  };

  async function seedExamples() {
    try { await api.post('/api/characters/seed-examples'); await refresh(); } catch (e) { setErr(e.message); }
  }

  if (!loaded) return <Card className="mt-2 text-sm">{err ? <Notice kind="error">{err}</Notice> : 'Opening the room…'}</Card>;
  const visible = chars.filter((c) => c.enabled && posOf(c, 0).visible !== false);

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <style>{CSS}</style>
      {err && <Notice kind="error">{err} <button className="underline ml-1" onClick={() => setErr('')}>dismiss</button></Notice>}

      <div
        ref={stageRef}
        className="relative w-full overflow-hidden rounded-3xl border border-black/10 select-none touch-none shadow-lg"
        style={{ height: 'min(50vh, 400px)', minHeight: 250, background: env.bg }}
      >
        {env.props.map(([emoji, x, y, size], i) => (
          <span key={i} className="pointer-events-none absolute opacity-80" style={{ left: `${x}%`, top: `${y}%`, fontSize: size, transform: 'translate(-50%,-50%)' }}>{emoji}</span>
        ))}
        {chars.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4">
            <div className={`text-sm font-semibold ${dark ? 'text-white' : 'text-stone-800'}`}>The room is empty</div>
            <div className="flex gap-2 flex-wrap justify-center">
              <Btn active onClick={seedExamples}><Sparkles className="w-3.5 h-3.5" />Add Otto, Milo &amp; Luna</Btn>
              <Btn onClick={() => { setSelId(null); setTab('look'); }}><Plus className="w-3.5 h-3.5" />Create my own</Btn>
            </div>
          </div>
        )}
        {visible.map((c, i) => {
          const p = posOf(c, i);
          const badge = badgeFor(c);
          const width = Math.round(112 * clamp(p.scale || 1, 0.6, 1.6));
          return (
            <div
              key={c.id}
              onPointerDown={(e) => onDown(e, c)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              className="absolute cursor-grab active:cursor-grabbing"
              style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-62%)', zIndex: Math.round(p.y) }}
            >
              <div className="flex flex-col items-center">
                {badge && <span className="mb-0.5 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold whitespace-nowrap">{badge}</span>}
                <div className={`edh-bob rounded-full ${selId === c.id ? 'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-transparent' : ''}`} style={{ animationDelay: `${i * 0.4}s` }}>
                  <MiniAvatar look={c.appearance} size={width} speaking={speakingId === c.id} thinking={!!thinking[c.id]} />
                </div>
                {room.show_names && <span className="mt-0.5 px-2 py-0.5 rounded-full bg-white/85 text-stone-800 text-[11px] font-bold shadow">{c.name}</span>}
              </div>
            </div>
          );
        })}
        {suggestion && (
          <div className="absolute top-2 left-2 right-2 z-50 rounded-2xl bg-white/95 text-stone-800 border border-amber-400/50 shadow-lg px-3 py-2 text-xs flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold">{suggestion.character} <span className="font-normal opacity-60">(started this on its own; you can turn this off in Scene)</span></div>
              <div>{suggestion.message}</div>
              <div className="flex gap-2 mt-1">
                <button className="underline font-semibold" onClick={() => { setSelId(suggestion.character_id); setTab('chat'); setHist((h) => ({ ...h, [suggestion.character_id]: [...(h[suggestion.character_id] || []), { role: 'assistant', content: suggestion.message }] })); setSuggestion(null); }}>Reply</button>
                <button className="underline opacity-70" onClick={() => setSuggestion(null)}>Not now</button>
              </div>
            </div>
            <button onClick={() => setSuggestion(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'chat', label: 'Chat', icon: <MessageCircle className="w-3.5 h-3.5" /> },
          { id: 'group', label: 'Group', icon: <Users className="w-3.5 h-3.5" /> },
          { id: 'look', label: 'Edit', icon: <Palette className="w-3.5 h-3.5" /> },
          { id: 'memory', label: 'Memory', icon: <Brain className="w-3.5 h-3.5" /> },
          { id: 'scene', label: 'Scene', icon: <House className="w-3.5 h-3.5" /> }
        ]}
      />

      {tab === 'chat' && <ChatTab {...{ sel, chars, setSelId, hist, setHist, room, thinking, setThinking, setErr, speechLang }} />}
      {tab === 'group' && <GroupTab {...{ chars, room, setErr, setThinking }} />}
      {tab === 'look' && <EditTab {...{ sel, setSelId, refresh, setErr, replaceChar }} />}
      {tab === 'memory' && <MemoryTab {...{ sel, chars, setErr }} />}
      {tab === 'scene' && <SceneTab {...{ chars, room, setRoom, settings, setSettings, setErr, replaceChar, saveAppearance }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ chat */
function CharPicker({ chars, selId, onPick }) {
  return (
    <div className="flex flex-wrap gap-1">
      {chars.map((c) => <Btn key={c.id} active={c.id === selId} onClick={() => onPick(c.id)}>{c.name}</Btn>)}
    </div>
  );
}

function ChatTab({ sel, chars, setSelId, hist, setHist, room, thinking, setThinking, setErr, speechLang }) {
  const t = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [listening, setListening] = useState(false);
  const endRef = useRef(null);
  const id = sel?.id;
  const msgs = (id && hist[id]) || [];

  useEffect(() => {
    if (!id || hist[id]) return;
    api.get(`/api/characters/${id}/messages?limit=40`).then((r) => setHist((h) => ({ ...h, [id]: r.messages }))).catch(() => setHist((h) => ({ ...h, [id]: [] })));
  }, [id]); // eslint-disable-line
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [msgs.length]);

  if (!sel) return <Card className={`text-sm ${t.muted}`}>Pick or create a character to start talking.</Card>;

  async function send(raw) {
    const message = (raw ?? text).trim();
    if (!message || busy) return;
    setText(''); setNote(''); setBusy(true);
    setThinking((m) => ({ ...m, [id]: true }));
    setHist((h) => ({ ...h, [id]: [...(h[id] || []), { role: 'user', content: message }] }));
    try {
      const r = await api.post(`/api/characters/${id}/chat`, { message });
      setHist((h) => ({ ...h, [id]: [...(h[id] || []), { role: 'assistant', content: r.reply }] }));
      if (room.voice_replies) speak(id, r.reply, sel.voice);
      if (r.remembered?.length) setNote(`${sel.name} will remember that.`);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); setThinking((m) => ({ ...m, [id]: false })); }
  }

  function mic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr('Voice input needs Chrome or Edge.'); return; }
    const r = new SR();
    r.lang = speechLang || 'en-US';
    r.interimResults = false;
    r.onresult = (e) => send(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    stopSpeaking(); setListening(true); r.start();
  }

  return (
    <Card className="space-y-2.5">
      <CharPicker chars={chars} selId={id} onPick={setSelId} />
      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
        {msgs.length === 0 && <div className={`text-xs ${t.muted}`}>Say hello to {sel.name}. {sel.role && `(${sel.role})`}</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`text-sm rounded-2xl px-3 py-1.5 max-w-[88%] ${m.role === 'user' ? `ml-auto ${t.active}` : t.btn}`}>
            {m.role !== 'user' && <div className="text-[10px] font-bold opacity-60">{sel.name}</div>}
            {m.content}
          </div>
        ))}
        {busy && <div className={`text-xs ${t.muted}`}>{sel.name} is thinking… (this can take a little while on CPU)</div>}
        <div ref={endRef} />
      </div>
      {note && <Notice kind="ok">{note}</Notice>}
      <div className="flex gap-1.5 items-center">
        <TextInput value={text} placeholder={`Message ${sel.name}…`} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <Btn onClick={mic} active={listening} title="Speak to this character"><Mic className="w-3.5 h-3.5" /></Btn>
        <Btn active onClick={() => send()} disabled={busy || !text.trim()} title="Send"><Send className="w-3.5 h-3.5" /></Btn>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- group */
function GroupTab({ chars, room, setErr, setThinking }) {
  const t = useT();
  const [groups, setGroups] = useState([]);
  const [gid, setGid] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [turns, setTurns] = useState(4);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMembers, setNewMembers] = useState([]);

  const loadGroups = useCallback(async () => {
    try { const r = await api.get('/api/groups'); setGroups(r.groups); setGid((g) => (g && r.groups.some((x) => x.id === g) ? g : r.groups[0]?.id ?? null)); } catch (e) { setErr(e.message); }
  }, [setErr]);
  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => {
    if (!gid) { setMsgs([]); return; }
    api.get(`/api/groups/${gid}/messages?limit=60`).then((r) => setMsgs(r.messages)).catch((e) => setErr(e.message));
  }, [gid, setErr]);

  const group = groups.find((g) => g.id === gid);

  async function createGroup() {
    try {
      const g = await api.post('/api/groups', { name: newName, character_ids: newMembers });
      setCreating(false); setNewName(''); setNewMembers([]); await loadGroups(); setGid(g.id);
    } catch (e) { setErr(e.message); }
  }

  async function run(kind) {
    if (!group || busy) return;
    if (kind === 'message' && !text.trim()) return;
    setBusy(true); setNote('');
    group.members.forEach((m) => { setThinking((x) => ({ ...x, [m.id]: true })); setActivity(m.id, `💬 ${group.name}`); });
    try {
      const body = kind === 'message' ? { message: text, max_turns: turns } : { topic: text.trim() || undefined, max_turns: turns };
      const r = await api.post(`/api/groups/${gid}/${kind}`, body);
      setMsgs((m) => [...m, ...r.messages]);
      setText('');
      setNote(`Stopped: ${r.stopped}.`);
      if (room.voice_replies) r.messages.filter((m) => m.speaker_kind === 'character').forEach((m) => speak(m.speaker_id, m.content, group.members.find((x) => x.id === m.speaker_id)?.voice));
    } catch (e) { setErr(e.message); }
    finally {
      setBusy(false);
      group.members.forEach((m) => { setThinking((x) => ({ ...x, [m.id]: false })); setActivity(m.id, null); });
    }
  }

  if (chars.length < 2) return <Card className={`text-sm ${t.muted}`}>Create at least two characters to start a group.</Card>;

  return (
    <Card className="space-y-2.5">
      <div className="flex flex-wrap gap-1 items-center">
        {groups.map((g) => <Btn key={g.id} active={g.id === gid} onClick={() => setGid(g.id)}>{g.name}</Btn>)}
        <Btn onClick={() => setCreating((c) => !c)}><Plus className="w-3.5 h-3.5" />New group</Btn>
      </div>
      {creating && (
        <div className="space-y-2">
          <TextInput placeholder="Group name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div className="flex flex-wrap gap-1">
            {chars.map((c) => <Btn key={c.id} active={newMembers.includes(c.id)} onClick={() => setNewMembers((m) => (m.includes(c.id) ? m.filter((x) => x !== c.id) : [...m, c.id]))}>{c.name}</Btn>)}
          </div>
          <Btn active onClick={createGroup} disabled={!newName.trim() || newMembers.length < 2}>Create group</Btn>
        </div>
      )}
      {!group && !creating && <div className={`text-xs ${t.muted}`}>Make a group to hear your characters talk to each other.</div>}
      {group && (
        <>
          <div className="flex flex-wrap gap-1 items-center text-xs">
            <span className={t.muted}>Members:</span>
            {group.members.map((m) => (
              <span key={m.id} className={`px-2 py-0.5 rounded-full ${t.btn} inline-flex items-center gap-1`}>
                {m.name}
                <button title="Remove" onClick={async () => { try { await api.del(`/api/groups/${gid}/members/${m.id}`); loadGroups(); } catch (e) { setErr(e.message); } }}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {chars.filter((c) => !group.members.some((m) => m.id === c.id)).map((c) => (
              <button key={c.id} className={`px-2 py-0.5 rounded-full border border-dashed ${t.line}`} onClick={async () => { try { await api.post(`/api/groups/${gid}/members`, { character_id: c.id }); loadGroups(); } catch (e) { setErr(e.message); } }}>+ {c.name}</button>
            ))}
            <button className="ml-auto underline opacity-70" onClick={async () => { if (window.confirm(`Delete group "${group.name}" and its history?`)) { try { await api.del(`/api/groups/${gid}`); loadGroups(); } catch (e) { setErr(e.message); } } }}>Delete group</button>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {msgs.length === 0 && <div className={`text-xs ${t.muted}`}>No messages yet. Say something, or press “Let them talk”.</div>}
            {msgs.map((m, i) => (
              <div key={m.id ?? i} className={`text-sm rounded-2xl px-3 py-1.5 max-w-[92%] ${m.speaker_kind === 'user' ? `ml-auto ${t.active}` : t.btn}`}>
                <div className="text-[10px] font-bold" style={m.speaker_kind === 'user' ? undefined : { color: colorFor(m.speaker_id) }}>{m.speaker_kind === 'user' ? 'You' : m.speaker_name}</div>
                {m.content}
              </div>
            ))}
            {busy && <div className={`text-xs ${t.muted}`}>The group is talking… up to {turns} turns; this can take a minute on CPU.</div>}
          </div>
          {note && <div className={`text-[11px] ${t.muted}`}>{note}</div>}
          <TextInput value={text} placeholder="Say something to the group, or type a topic…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run('message')} />
          <div className="flex flex-wrap items-center gap-1.5">
            <Btn active onClick={() => run('message')} disabled={busy || !text.trim()}><Send className="w-3.5 h-3.5" />Send</Btn>
            <Btn onClick={() => run('discuss')} disabled={busy}><Users className="w-3.5 h-3.5" />Let them talk</Btn>
            {busy && <Btn onClick={() => api.post(`/api/groups/${gid}/cancel`).catch(() => {})}>Stop</Btn>}
            <label className={`ml-auto text-[11px] flex items-center gap-1 ${t.muted}`}>Turns
              <input type="range" min="1" max="8" value={turns} onChange={(e) => setTurns(Number(e.target.value))} />{turns}
            </label>
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ edit */
function EditTab({ sel, setSelId, refresh, setErr, replaceChar }) {
  const t = useT();
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [voices, setVoices] = useState(voicesAvailable());
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const synth = window.speechSynthesis;
    const upd = () => setVoices(voicesAvailable());
    if (synth) synth.addEventListener?.('voiceschanged', upd);
    return () => synth && synth.removeEventListener?.('voiceschanged', upd);
  }, []);
  useEffect(() => {
    setSaved('');
    if (!isNew && sel) setForm({ ...EMPTY_FORM, ...sel, appearance: { ...EMPTY_FORM.appearance, ...(sel.appearance || {}) }, voice: sel.voice || {} });
  }, [sel?.id, isNew]); // eslint-disable-line

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const look = (k, v) => setForm((f) => ({ ...f, appearance: { ...f.appearance, [k]: v } }));
  const voice = (k, v) => setForm((f) => ({ ...f, voice: { ...f.voice, [k]: v } }));

  async function save() {
    try {
      const body = { name: form.name, role: form.role, personality: form.personality, style: form.style, interests: form.interests,
        extra_instructions: form.extra_instructions, can_initiate: form.can_initiate, enabled: form.enabled, voice: form.voice, appearance: form.appearance };
      const c = isNew || !sel ? await api.post('/api/characters', body) : await api.put(`/api/characters/${sel.id}`, body);
      if (isNew || !sel) { await refresh(); setSelId(c.id); setIsNew(false); } else replaceChar(c);
      setSaved('Saved.'); setErr('');
    } catch (e) { setErr(e.message); }
  }
  async function remove() {
    if (!sel || !window.confirm(`Delete ${sel.name}? Their memories and relationships will be deleted too.`)) return;
    try { await api.del(`/api/characters/${sel.id}`); await refresh(); } catch (e) { setErr(e.message); }
  }
  const creating = isNew || !sel;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap gap-1 items-center">
        {!creating && <span className="text-xs font-bold">Editing {sel.name}</span>}
        <Btn onClick={() => { setIsNew(true); setForm(EMPTY_FORM); setSaved(''); }} active={creating}><Plus className="w-3.5 h-3.5" />New character</Btn>
        {creating && sel && <Btn onClick={() => setIsNew(false)}>Cancel</Btn>}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex justify-center sm:w-40 shrink-0"><MiniAvatar look={form.appearance} size={130} /></div>
        <div className="flex-1 space-y-2">
          <Field label="Name"><TextInput value={form.name} maxLength={40} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Role (optional)"><TextInput value={form.role} placeholder="e.g. logical thinker" onChange={(e) => set('role', e.target.value)} /></Field>
        </div>
      </div>
      <Field label="Personality"><TextArea rows={3} value={form.personality} onChange={(e) => set('personality', e.target.value)} placeholder="How does this character think and behave?" /></Field>
      <div className="grid sm:grid-cols-2 gap-2">
        <Field label="Communication style"><TextInput value={form.style} onChange={(e) => set('style', e.target.value)} /></Field>
        <Field label="Interests"><TextInput value={form.interests} onChange={(e) => set('interests', e.target.value)} /></Field>
      </div>
      <Field label="Extra instructions"><TextInput value={form.extra_instructions} onChange={(e) => set('extra_instructions', e.target.value)} /></Field>

      <div className="space-y-1.5">
        <div className={`text-[11px] font-semibold uppercase tracking-wide ${t.muted}`}>Appearance (changing it never changes memories or personality)</div>
        <div className="flex flex-wrap gap-1.5">
          {SWATCHES.map((s) => (
            <button key={s.name} title={s.name} onClick={() => look('swatch', s.name)} className={`w-7 h-7 rounded-full border-2 ${form.appearance.swatch === s.name ? 'border-amber-500 scale-110' : 'border-black/10'}`} style={{ background: `linear-gradient(135deg,${s.skin},${s.edge})` }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1">{HEADWEAR.map((h) => <Btn key={h.id} active={form.appearance.headwear === h.id} onClick={() => look('headwear', h.id)} title={h.name}>{h.icon}</Btn>)}</div>
        <div className="flex flex-wrap gap-1">{EYEWEAR.map((h) => <Btn key={h.id} active={form.appearance.eyewear === h.id} onClick={() => look('eyewear', h.id)} title={h.name}>{h.icon}</Btn>)}</div>
        {!creating && (
          <label className={`text-[11px] flex items-center gap-2 ${t.muted}`}>Size
            <input type="range" min="0.6" max="1.6" step="0.1" value={form.appearance.room?.scale ?? 1} onChange={(e) => look('room', { ...(form.appearance.room || {}), scale: Number(e.target.value) })} />
          </label>
        )}
      </div>

      <div className="space-y-1.5">
        <div className={`text-[11px] font-semibold uppercase tracking-wide ${t.muted}`}>Voice</div>
        <select className={`w-full rounded-2xl border px-3 py-2 text-sm ${t.input}`} value={form.voice.voiceName || ''} onChange={(e) => voice('voiceName', e.target.value)}>
          <option value="">Default voice</option>
          {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <label className={`text-[11px] ${t.muted}`}>Speed {Number(form.voice.rate ?? 1).toFixed(2)}<input className="w-full" type="range" min="0.6" max="1.6" step="0.05" value={form.voice.rate ?? 1} onChange={(e) => voice('rate', Number(e.target.value))} /></label>
          <label className={`text-[11px] ${t.muted}`}>Pitch {Number(form.voice.pitch ?? 1).toFixed(2)}<input className="w-full" type="range" min="0.6" max="1.6" step="0.05" value={form.voice.pitch ?? 1} onChange={(e) => voice('pitch', Number(e.target.value))} /></label>
        </div>
        <Btn onClick={() => { stopSpeaking(); speak(sel?.id ?? 0, `Hello, I am ${form.name || 'your new character'}.`, form.voice); }}><Volume2 className="w-3.5 h-3.5" />Test voice</Btn>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />Switched on</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.can_initiate} onChange={(e) => set('can_initiate', e.target.checked)} />May start conversations (only if Autonomy is on)</label>
      </div>
      <div className="flex items-center gap-2">
        <Btn active onClick={save} disabled={!form.name.trim() || !form.personality.trim()}>{creating ? 'Create character' : 'Save changes'}</Btn>
        {!creating && <Btn onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete</Btn>}
        {saved && <span className="text-xs text-emerald-600">{saved}</span>}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- memory */
function MemoryTab({ sel, chars, setErr }) {
  const t = useT();
  const [mems, setMems] = useState([]);
  const [shared, setShared] = useState([]);
  const [rels, setRels] = useState([]);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    try {
      if (sel) setMems((await api.get(`/api/characters/${sel.id}/memories`)).memories);
      setShared((await api.get('/api/shared-memories')).memories);
      setRels((await api.get('/api/relationships')).relationships);
    } catch (e) { setErr(e.message); }
  }, [sel?.id, setErr]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  if (!sel) return <Card className={`text-sm ${t.muted}`}>Pick a character to see what they remember.</Card>;
  const mine = rels.filter((r) => r.from_id === sel.id);
  const label = (v) => (v >= 0.7 ? 'close' : v >= 0.4 ? 'well acquainted' : v >= 0.1 ? 'know a little' : 'barely know');

  return (
    <Card className="space-y-3">
      <div className="text-xs font-bold">{sel.name}'s memories <span className={`font-normal ${t.muted}`}>(you can read, add and delete them)</span></div>
      <div className="max-h-44 overflow-y-auto space-y-1">
        {mems.length === 0 && <div className={`text-xs ${t.muted}`}>Nothing yet. Say “remember that…” in a chat, or add one below.</div>}
        {mems.map((m) => (
          <div key={m.id} className={`flex items-start gap-2 text-xs rounded-xl px-2.5 py-1.5 ${t.btn}`}>
            <span className="flex-1">{m.content}</span>
            <span className="opacity-50">{'★'.repeat(m.importance)}</span>
            <button title="Delete" onClick={async () => { await api.del(`/api/characters/${sel.id}/memories/${m.id}`).catch((e) => setErr(e.message)); load(); }}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <TextInput value={text} placeholder="Add a memory…" onChange={(e) => setText(e.target.value)} />
        <Btn active disabled={!text.trim()} onClick={async () => { await api.post(`/api/characters/${sel.id}/memories`, { content: text, importance: 4 }).catch((e) => setErr(e.message)); setText(''); load(); }}>Add</Btn>
        {mems.length > 0 && <Btn onClick={async () => { if (window.confirm(`Delete all of ${sel.name}'s memories?`)) { await api.del(`/api/characters/${sel.id}/memories`).catch((e) => setErr(e.message)); load(); } }}>Clear all</Btn>}
      </div>
      <div className="text-xs font-bold">Shared experiences</div>
      <div className="max-h-28 overflow-y-auto space-y-1">
        {shared.length === 0 && <div className={`text-xs ${t.muted}`}>None yet. They appear after characters talk together.</div>}
        {shared.map((m) => (
          <div key={m.id} className={`flex items-start gap-2 text-xs rounded-xl px-2.5 py-1.5 ${t.btn}`}>
            <span className="flex-1">{m.content}</span>
            <button title="Delete" onClick={async () => { await api.del(`/api/shared-memories/${m.id}`).catch((e) => setErr(e.message)); load(); }}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="text-xs font-bold">Relationships</div>
      {mine.length === 0 && <div className={`text-xs ${t.muted}`}>{sel.name} has not formed relationships yet.</div>}
      {mine.map((r) => (
        <div key={r.to_id} className="text-xs">
          <b>{r.to_name}</b>: {label(r.familiarity)}
          {r.trust > 0.3 ? ', trusts them' : r.trust < -0.3 ? ', wary of them' : ''}
          {r.rivalry > 0.4 ? ', friendly rivalry' : ''}
          {r.history.length > 0 && <span className={t.muted}> — {r.history.slice(-2).join('; ')}</span>}
        </div>
      ))}
    </Card>
  );
}

/* ----------------------------------------------------------------- scene */
function SceneTab({ chars, room, setRoom, settings, setSettings, setErr, saveAppearance }) {
  const t = useT();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState('');
  useEffect(() => setForm(settings), [settings]);

  const saveRoom = async (patch) => {
    try { setRoom(await api.put('/api/room', patch)); } catch (e) { setErr(e.message); }
  };
  async function saveSettings() {
    try { setSettings(await api.put('/api/agents/settings', form)); setSaved('Saved.'); setErr(''); } catch (e) { setErr(e.message); }
  }

  return (
    <Card className="space-y-3">
      <div className="text-xs font-bold">Background</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {ENVIRONMENTS.map((e) => (
          <button key={e.id} onClick={() => saveRoom({ environment: e.id })} className={`h-14 rounded-2xl border text-[11px] font-bold flex items-end justify-start p-1.5 ${room.environment === e.id ? 'ring-2 ring-amber-400' : ''} ${e.id === 'space_station' || e.id === 'gaming_room' ? 'text-white' : 'text-stone-800'}`} style={{ background: e.bg }}>{e.name}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={room.show_names} onChange={(e) => saveRoom({ show_names: e.target.checked })} />Show names</label>
        <label className="flex items-center gap-1.5">{room.voice_replies ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}<input type="checkbox" checked={room.voice_replies} onChange={(e) => saveRoom({ voice_replies: e.target.checked })} />Characters speak their replies</label>
      </div>
      {chars.length > 0 && (
        <>
          <div className="text-xs font-bold">Who is in the room</div>
          <div className="flex flex-wrap gap-1">
            {chars.map((c) => {
              const vis = c.appearance?.room?.visible !== false;
              return <Btn key={c.id} active={vis} onClick={() => saveAppearance(c, { room: { ...(c.appearance?.room || {}), visible: !vis } })}>{vis ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}{c.name}</Btn>;
            })}
          </div>
        </>
      )}
      {form && (
        <>
          <div className="text-xs font-bold">Autonomy <span className={`font-normal ${t.muted}`}>(characters starting conversations on their own)</span></div>
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={form.autonomy_enabled} onChange={(e) => setForm({ ...form, autonomy_enabled: e.target.checked })} />Allow it (off by default; each character also needs permission in Edit)</label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Max per day"><TextInput type="number" min="0" max="20" value={form.initiatives_per_day} onChange={(e) => setForm({ ...form, initiatives_per_day: Number(e.target.value) })} /></Field>
            <Field label="Minutes between"><TextInput type="number" min="5" max="1440" value={form.initiative_cooldown_minutes} onChange={(e) => setForm({ ...form, initiative_cooldown_minutes: Number(e.target.value) })} /></Field>
            <Field label="Quiet hours (HH:MM-HH:MM)"><TextInput value={form.quiet_hours} onChange={(e) => setForm({ ...form, quiet_hours: e.target.value })} /></Field>
            <Field label="Max turns per group run (1-8)"><TextInput type="number" min="1" max="8" value={form.max_turns_per_run} onChange={(e) => setForm({ ...form, max_turns_per_run: Number(e.target.value) })} /></Field>
          </div>
          <div className="flex items-center gap-2"><Btn active onClick={saveSettings}>Save autonomy settings</Btn>{saved && <span className="text-xs text-emerald-600">{saved}</span>}</div>
        </>
      )}
    </Card>
  );
}
