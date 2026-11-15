import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Film, FileText, Maximize, Pause, Play, RotateCcw, RotateCw, Send, Trash2, Upload, Volume2, VolumeX } from 'lucide-react';
import { api } from './api.js';
import { speak } from './voice.js';
import { setActivity } from './activity.js';
import { Btn, Card, Notice, Tabs, TextArea, TextInput, useT } from './ui.jsx';

const fmt = (s) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const mediaErrors = {
  1: 'Playback was stopped.',
  2: 'A network problem interrupted the video.',
  3: 'This file looks damaged or uses a format the browser cannot decode.',
  4: 'This format is not supported. MP4 (H.264) and WebM work best.'
};

export default function MediaScreen({ active }) {
  const [tab, setTab] = useState('video');
  const [chars, setChars] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (active) api.get('/api/characters').then((r) => setChars(r.characters.filter((c) => c.enabled))).catch((e) => setErr(e.message));
  }, [active]);
  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'video', label: 'Video', icon: <Film className="w-3.5 h-3.5" /> },
        { id: 'files', label: 'Documents', icon: <FileText className="w-3.5 h-3.5" /> }
      ]} />
      {err && <Notice kind="error">{err}</Notice>}
      {/* both stay mounted so the position and text are kept when you switch tabs */}
      <div className={tab === 'video' ? '' : 'hidden'}><VideoPlayer active={active && tab === 'video'} chars={chars} /></div>
      <div className={tab === 'files' ? '' : 'hidden'}><Documents active={active && tab === 'files'} chars={chars} /></div>
    </div>
  );
}

/* ----------------------------------------------------------------- video */
function VideoPlayer({ active, chars }) {
  const t = useT();
  const vref = useRef(null);
  const box = useRef(null);
  const objUrl = useRef(null);
  const [src, setSrc] = useState('');
  const [title, setTitle] = useState('');
  const [urlText, setUrlText] = useState('');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [err, setErr] = useState('');
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!active && vref.current && !vref.current.paused) vref.current.pause(); }, [active]);
  useEffect(() => () => { if (objUrl.current) URL.revokeObjectURL(objUrl.current); }, []);
  useEffect(() => { if (!who && chars[0]) setWho(String(chars[0].id)); }, [chars, who]);

  function openFile(file) {
    if (!file) return;
    if (!/^(video|audio)\//.test(file.type) && !/\.(mp4|webm|mkv|mov|m4v|mp3|wav|ogg)$/i.test(file.name)) { setErr('Please choose a video or audio file.'); return; }
    if (objUrl.current) URL.revokeObjectURL(objUrl.current);
    objUrl.current = URL.createObjectURL(file);
    setErr(''); setSrc(objUrl.current); setTitle(file.name); setTime(0); setDur(0);
  }
  function openUrl() {
    let u;
    try { u = new URL(urlText.trim()); } catch (_) { setErr('That is not a valid web address.'); return; }
    if (!/^https?:$/.test(u.protocol)) { setErr('Only http and https links are supported.'); return; }
    if (/(youtube\.com|youtu\.be|vimeo\.com)$/i.test(u.hostname.replace(/^www\./, ''))) { setErr('Web pages like YouTube cannot be played here. Use a direct video file link (.mp4 or .webm), or use the Music screen for audio.'); return; }
    setErr(''); setSrc(u.href); setTitle(u.pathname.split('/').pop() || u.hostname); setTime(0); setDur(0);
  }
  const toggle = () => { const v = vref.current; if (!v || !src) return; if (v.paused) v.play().catch((e) => setErr(`Could not start playback: ${e.message}`)); else v.pause(); };
  const seek = (s) => { const v = vref.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, s)); };
  const full = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else box.current?.requestFullscreen?.().catch(() => setErr('Full screen is not available here.'));
  };

  async function discuss() {
    if (!who || busy) return;
    setBusy(true); setReply('');
    const c = chars.find((x) => String(x.id) === who);
    setActivity(c.id, `🎬 Watching ${title || 'a video'}`);
    try {
      const msg = `We are watching "${title || 'a video'}" together${src ? ` and we are at ${fmt(time)}` : ''}. ${note}`.trim();
      const r = await api.post(`/api/characters/${c.id}/chat`, { message: msg });
      setReply(`${c.name}: ${r.reply}`);
      speak(c.id, r.reply, c.voice);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); setActivity(c.id, null); }
  }

  return (
    <div className="space-y-3">
      <div ref={box} className="relative rounded-3xl overflow-hidden bg-black border border-black/20 shadow-lg">
        {src ? (
          <video
            ref={vref} src={src} className="w-full max-h-[52vh] bg-black" playsInline preload="metadata"
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
            onError={(e) => setErr(mediaErrors[e.currentTarget.error?.code] || 'This video could not be played.')}
            onClick={toggle}
          />
        ) : (
          <div className="h-48 flex items-center justify-center text-sm text-white/70">Choose a video to start watching</div>
        )}
        <div className="px-3 py-2 bg-black/80 text-white space-y-1.5">
          <input aria-label="Seek" type="range" min="0" max={dur || 0} step="0.1" value={Math.min(time, dur || 0)} disabled={!src} onChange={(e) => seek(Number(e.target.value))} className="w-full" />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button aria-label={playing ? 'Pause' : 'Play'} onClick={toggle} disabled={!src} className="p-1.5 rounded-full bg-white/15 disabled:opacity-40">{playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
            <button aria-label="Back 10 seconds" onClick={() => seek(time - 10)} disabled={!src} className="p-1.5 rounded-full bg-white/15 disabled:opacity-40"><RotateCcw className="w-4 h-4" /></button>
            <button aria-label="Forward 10 seconds" onClick={() => seek(time + 10)} disabled={!src} className="p-1.5 rounded-full bg-white/15 disabled:opacity-40"><RotateCw className="w-4 h-4" /></button>
            <span className="tabular-nums">{fmt(time)} / {fmt(dur)}</span>
            <button aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => { setMuted(!muted); if (vref.current) vref.current.muted = !muted; }} className="ml-auto p-1.5">{muted || vol === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
            <input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={muted ? 0 : vol} className="w-20" onChange={(e) => { const v = Number(e.target.value); setVol(v); setMuted(false); if (vref.current) { vref.current.volume = v; vref.current.muted = false; } }} />
            <select aria-label="Speed" value={rate} className="bg-white/15 rounded-full px-2 py-1" onChange={(e) => { const r = Number(e.target.value); setRate(r); if (vref.current) vref.current.playbackRate = r; }}>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r} className="text-black">{r}x</option>)}
            </select>
            <button aria-label="Full screen" onClick={full} className="p-1.5"><Maximize className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
      {err && <Notice kind="error">{err} <button className="underline ml-1" onClick={() => setErr('')}>dismiss</button></Notice>}
      <Card className="space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <label className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 ${t.active}`}>
            <Upload className="w-3.5 h-3.5" />Open a video from this computer
            <input type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <div className="flex-1 min-w-[180px] flex gap-1.5">
            <TextInput value={urlText} placeholder="…or paste a direct video link (.mp4, .webm)" onChange={(e) => setUrlText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && openUrl()} />
            <Btn onClick={openUrl} disabled={!urlText.trim()}>Open</Btn>
          </div>
        </div>
        <div className={`text-[11px] ${t.muted}`}>Respect each video's licence and its platform's terms. Your files stay on this computer.</div>
      </Card>
      {chars.length > 0 && (
        <Card className="space-y-2">
          <div className="text-xs font-bold">Talk about it <span className={`font-normal ${t.muted}`}>(characters cannot see the video; tell them what is happening)</span></div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <select className={`rounded-full border px-3 py-1.5 text-xs ${t.input}`} value={who} onChange={(e) => setWho(e.target.value)}>
              {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className={`text-[11px] ${t.muted}`}>{title ? `“${title}” at ${fmt(time)}` : 'No video open'}</span>
          </div>
          <TextArea rows={2} value={note} placeholder="What's going on? What do you want to ask?" onChange={(e) => setNote(e.target.value)} />
          <Btn active onClick={discuss} disabled={busy || !who}><Send className="w-3.5 h-3.5" />{busy ? 'Thinking…' : 'Send'}</Btn>
          {reply && <Notice>{reply}</Notice>}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- documents */
const MAX_MB = 10;
const readB64 = (file) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
  fr.onerror = () => reject(new Error('Could not read that file.'));
  fr.readAsDataURL(file);
});

function Documents({ active, chars }) {
  const t = useT();
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(null);
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');

  const load = useCallback(() => api.get('/api/files').then((r) => setFiles(r.files)).catch((e) => setErr(e.message)), []);
  useEffect(() => { if (active) load(); }, [active, load]);

  async function upload(file) {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) { setErr(`That file is larger than ${MAX_MB} MB.`); return; }
    setBusy(true); setErr('');
    try {
      const f = await api.post('/api/files', { name: file.name, data_base64: await readB64(file) });
      await load(); setSel(f.id);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }
  async function setAccess(f, cid) {
    const ids = f.character_ids.includes(cid) ? f.character_ids.filter((x) => x !== cid) : [...f.character_ids, cid];
    try { await api.put(`/api/files/${f.id}/access`, { character_ids: ids }); load(); } catch (e) { setErr(e.message); }
  }
  const file = files.find((f) => f.id === sel);
  const allowed = file ? chars.filter((c) => file.character_ids.includes(c.id)) : [];
  useEffect(() => { if (allowed.length && !allowed.some((c) => String(c.id) === who)) setWho(String(allowed[0].id)); }, [sel, files]); // eslint-disable-line

  async function ask(mode) {
    const c = chars.find((x) => String(x.id) === who);
    if (!file || !c) return;
    setBusy(true); setAnswer(''); setErr('');
    setActivity(c.id, `📖 Reading ${file.name}`);
    try {
      const r = await api.post(`/api/files/${file.id}/ask`, { character_id: c.id, question: q, mode });
      setAnswer(`${c.name}: ${r.reply}`);
      speak(c.id, r.reply, c.voice);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); setActivity(c.id, null); }
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <label className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 ${t.active}`}>
          <Upload className="w-3.5 h-3.5" />{busy ? 'Working…' : 'Add a document'}
          <input type="file" className="hidden" disabled={busy} accept=".txt,.md,.csv,.json,.pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.gif,.webp" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <div className={`text-[11px] ${t.muted}`}>Text, Word, PowerPoint, Excel, PDF and images, up to {MAX_MB} MB. Nobody can read a file until you allow them below. Images need a vision model (ollama pull llava).</div>
      </Card>
      {err && <Notice kind="error">{err} <button className="underline ml-1" onClick={() => setErr('')}>dismiss</button></Notice>}
      {files.length === 0 && <Card className={`text-sm ${t.muted}`}>No documents yet.</Card>}
      {files.map((f) => (
        <Card key={f.id} className={`space-y-1.5 ${sel === f.id ? 'ring-2 ring-amber-400/70' : ''}`}>
          <div className="flex items-center gap-2 text-sm">
            <button className="flex-1 text-left font-semibold truncate" onClick={() => { setSel(f.id); setAnswer(''); }}>{f.kind === 'image' ? '🖼️' : '📄'} {f.name} <span className={`text-[11px] font-normal ${t.muted}`}>{Math.max(1, Math.round(f.size / 1024))} KB</span></button>
            <button title="Delete" onClick={async () => { if (window.confirm(`Delete ${f.name}?`)) { await api.del(`/api/files/${f.id}`).catch((e) => setErr(e.message)); if (sel === f.id) setSel(null); load(); } }}><Trash2 className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className={t.muted}>Who may read it:</span>
            {chars.length === 0 && <span className={t.muted}>(create a character first)</span>}
            {chars.map((c) => <Btn key={c.id} active={f.character_ids.includes(c.id)} onClick={() => setAccess(f, c.id)}>{c.name}</Btn>)}
          </div>
        </Card>
      ))}
      {file && (
        <Card className="space-y-2">
          <div className="text-xs font-bold">Ask about “{file.name}”</div>
          {allowed.length === 0 ? <Notice>Allow at least one character to read this file first.</Notice> : (
            <>
              <select className={`rounded-full border px-3 py-1.5 text-xs ${t.input}`} value={who} onChange={(e) => setWho(e.target.value)}>
                {allowed.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <TextInput value={q} placeholder="Ask a question about this file…" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask('ask')} />
              <div className="flex gap-2">
                <Btn active onClick={() => ask('ask')} disabled={busy || !q.trim()}><Send className="w-3.5 h-3.5" />Ask</Btn>
                <Btn onClick={() => ask('summarize')} disabled={busy || file.kind === 'image'}>Summarize</Btn>
              </div>
              {busy && <div className={`text-xs ${t.muted}`}>Reading… this can take a while on CPU.</div>}
              {answer && <Notice>{answer}</Notice>}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
