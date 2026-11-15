import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Palette,
  Brain,
  UserCheck,
  Cpu,
  Smile,
  Mic,
  MicOff,
  Music,
  Languages,
  SlidersHorizontal,
  X,
  Volume2,
  HelpCircle,
  Play,
  Pause,
  Send,
  Download,
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  PlayCircle,
  PauseCircle,
  Check,
  Copy,
  Wrench,
  Code2,
  Heart,
  Droplets,
  BookOpen,
  Pill,
  Hand
} from 'lucide-react';
import { Users as EdhUsers, Gamepad2 as EdhGamepad, Film as EdhFilm } from 'lucide-react';
import EdhOverlay from './edh/EdhOverlay.jsx';

const FAMILIES_PROFILES_PLACEHOLDER = true;
const EDH1_BACKEND_URL = 'http://127.0.0.1:8000';
const EDH1_SESSION_ID = 'edh1-local-session';

const LANGUAGES = [
  { code: 'en', name: 'English', short: 'EN', voiceCode: 'en-US', greeting: 'Hello! I am ED-H1, your companion.', backchannel: 'Mmhmm...', quickPrompts: ['Tell me something interesting', 'Help me plan my day', 'What do you remember about me?'] },
  { code: 'hi', name: 'हिन्दी (Hindi)', short: 'हि', voiceCode: 'hi-IN', greeting: 'नमस्ते! मैं ED-H1 हूँ, आपका साथी।', backchannel: 'हाँ जी...', quickPrompts: ['मुझे कुछ रोचक बताओ', 'आज का दिन प्लान करने में मदद करो', 'तुम्हें मेरे बारे में क्या याद है?'] },
  { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)', short: 'ਪੰ', voiceCode: 'pa-IN', greeting: 'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ! ਮੈਂ ED-H1 ਹਾਂ ਜੀ।', backchannel: 'ਹਾਂਜੀ...', quickPrompts: ['ਮੈਨੂੰ ਕੋਈ ਦਿਲਚਸਪ ਗੱਲ ਦੱਸੋ', 'ਮੇਰਾ ਅੱਜ ਦਾ ਦਿਨ ਬਣਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰੋ', 'ਤੁਹਾਨੂੰ ਮੇਰੇ ਬਾਰੇ ਕੀ ਯਾਦ ਹੈ?'] }
];

const FAMILY_PROFILES = [
  { id: 'parent', name: 'Parent / Adult', badge: 'Active Projects & Health', defaultLang: 'en', pitch: 1.0, rate: 1.0, desc: 'Balanced focus, project continuity, and daily wellness management.' },
  { id: 'elder', name: 'Grandparent / Elder', badge: 'Care & Gurbani', defaultLang: 'pa', pitch: 0.9, rate: 0.88, desc: 'Respectful honorifics, medication reminders, and calming audio.' },
  { id: 'child', name: 'Child / Student', badge: 'Socratic Homework', defaultLang: 'hi', pitch: 1.15, rate: 1.05, desc: 'Interactive textbook guidance without giving direct answers.' }
];

const WINDOWS = [
  { id: 'obsidian', name: 'Obsidian OLED', type: 'dark', skinBg: '#05070B', skinEdge: '#05070B', eyeColor: '#38BDF8', blushColor: null, mouthColor: '#38BDF8' },
  { id: 'ivory', name: 'Ivory Cream Plush', type: 'plush', skinBg: '#FAF6EE', skinEdge: '#E8DEC8', eyeColor: '#231F20', blushColor: '#F4978E', mouthColor: '#231F20' },
  { id: 'nightlight', name: 'Astral Nightlight', type: 'astral', skinBg: '#161224', skinEdge: '#0B0814', eyeColor: '#FDBA74', blushColor: '#FB7185', mouthColor: '#FDBA74' }
];

const PLUSH_SWATCHES = [
  { name: 'Matcha Mochi', skin: '#F0F4EC', edge: '#D5E0CD', eye: '#2C352D', blush: '#E5B8B7' },
  { name: 'Sakura Milk', skin: '#FDF2F4', edge: '#F7D9DE', eye: '#3B292E', blush: '#F4978E' },
  { name: 'Buttercup', skin: '#FEF9EC', edge: '#F7E9C4', eye: '#383020', blush: '#F5CD79' },
  { name: 'Taro Lavender', skin: '#F4F2F7', edge: '#DDD6E8', eye: '#312B3D', blush: '#D8B4E2' },
  { name: 'Sky Puffer', skin: '#F0F6FA', edge: '#D1E3F0', eye: '#1F2C38', blush: '#93C5FD' },
  { name: 'Terracotta', skin: '#FAF2EE', edge: '#EAD5CB', eye: '#3D2A24', blush: '#E0A996' }
];

const MOODS = {
  joy: { id: 'joy', label: '😊 Joyful', color: '#38BDF8', coreColor: '#E0F2FE', topLid: 0.05, eyeW: 76, eyeH: 88, radius: 38, spacing: 85, tiltL: 0, tiltR: 0, scaleL: 1, scaleR: 1, mouthCurve: 22, mouthWidth: 62, breathSpeed: 3.0 },
  curious: { id: 'curious', label: '🧐 Curious', color: '#F43F5E', coreColor: '#FFE4E6', topLid: 0.12, eyeW: 82, eyeH: 94, radius: 42, spacing: 88, tiltL: -6, tiltR: 8, scaleL: 1.1, scaleR: 0.9, mouthCurve: 14, mouthWidth: 48, breathSpeed: 2.6 },
  love: { id: 'love', label: '🩷 Affectionate', color: '#FB7185', coreColor: '#FFE4E6', topLid: 0.28, eyeW: 78, eyeH: 72, radius: 36, spacing: 82, tiltL: 4, tiltR: -4, scaleL: 1, scaleR: 1, mouthCurve: 26, mouthWidth: 54, breathSpeed: 3.5 },
  thinking: { id: 'thinking', label: '💡 Thinking', color: '#FBBF24', coreColor: '#FEF3C7', topLid: 0.22, eyeW: 72, eyeH: 80, radius: 34, spacing: 85, tiltL: -10, tiltR: 10, scaleL: 0.95, scaleR: 0.95, mouthCurve: 4, mouthWidth: 38, breathSpeed: 4.0 },
  vibe: { id: 'vibe', label: '🎧 Vibe', color: '#34D399', coreColor: '#D1FAE5', topLid: 0.35, eyeW: 84, eyeH: 64, radius: 32, spacing: 86, tiltL: -3, tiltR: 3, scaleL: 1.05, scaleR: 1.05, mouthCurve: 18, mouthWidth: 58, breathSpeed: 2.2 },
  sleepy: { id: 'sleepy', label: '🌙 Sleepy', color: '#A78BFA', coreColor: '#EDE9FE', topLid: 0.65, eyeW: 80, eyeH: 48, radius: 24, spacing: 84, tiltL: 0, tiltR: 0, scaleL: 1, scaleR: 1, mouthCurve: 8, mouthWidth: 32, breathSpeed: 5.0 }
};

const HEADWEAR_ITEMS = [
  { id: 'none', name: 'None', icon: '✨' },
  { id: 'sprout', name: 'Leaf Sprout', icon: '🌱' },
  { id: 'crown', name: 'Tiny Crown', icon: '👑' },
  { id: 'bow', name: 'Ribbon Bow', icon: '🎀' },
  { id: 'halo', name: 'Glow Halo', icon: '😇' },
  { id: 'wizard', name: 'Wizard Hat', icon: '🧙‍♂️' },
  { id: 'beret', name: 'Artist Beret', icon: '🎨' },
  { id: 'cat_ears', name: 'Neko Ears', icon: '🐱' },
  { id: 'antlers', name: 'Cozy Antlers', icon: '🦌' },
  { id: 'turban', name: 'Royal Turban', icon: '👳‍♂️' },
  { id: 'flower_crown', name: 'Flora Crown', icon: '🌸' },
  { id: 'headphones', name: 'Headphones', icon: '🎧' }
];

const EYEWEAR_ITEMS = [
  { id: 'none', name: 'None', icon: '⭕' },
  { id: 'round', name: 'Scholar Specs', icon: '👓' },
  { id: 'shades', name: 'Cool Shades', icon: '🕶️' },
  { id: 'star', name: 'Star Frames', icon: '⭐' },
  { id: 'monocle', name: 'Gentle Monocle', icon: '🧐' },
  { id: 'heart_glasses', name: 'Heart Shades', icon: '💖' },
  { id: 'cyber_visor', name: 'Holo Visor', icon: '🥽' }
];

const NECKWEAR_ITEMS = [
  { id: 'none', name: 'None', icon: '📿' },
  { id: 'bowtie', name: 'Dapper Bowtie', icon: '🎀' },
  { id: 'scarf', name: 'Knit Scarf', icon: '🧣' },
  { id: 'collar_bell', name: 'Golden Bell', icon: '🔔' },
  { id: 'pearls', name: 'Pearl Necklace', icon: '🦪' },
  { id: 'cape', name: 'Cozy Capelet', icon: '🦸' }
];

const CHEEK_MARKINGS = [
  { id: 'none', name: 'None', icon: '😊' },
  { id: 'freckles', name: 'Sun Freckles', icon: '🧡' },
  { id: 'whiskers', name: 'Kitty Whiskers', icon: '🐾' },
  { id: 'stars', name: 'Star Stickers', icon: '⭐' },
  { id: 'hearts', name: 'Heart Stamps', icon: '🩷' },
  { id: 'bandaid', name: 'Cute Bandaid', icon: '🩹' }
];

const PROP_ITEMS = [
  { id: 'none', name: 'None', icon: '✋' },
  { id: 'wand', name: 'Sparkle Wand', icon: '🪄' },
  { id: 'chai', name: 'Warm Chai', icon: '🍵' },
  { id: 'book', name: 'Study Book', icon: '📖' },
  { id: 'heart', name: 'Plush Heart', icon: '💖' },
  { id: 'brush', name: 'Paintbrush', icon: '🖌️' }
];

const AURA_EFFECTS = [
  { id: 'none', name: 'None', icon: '💤' },
  { id: 'sparkles', name: 'Sparkles', icon: '✨' },
  { id: 'hearts', name: 'Floating Hearts', icon: '🩷' },
  { id: 'notes', name: 'Melody Notes', icon: '🎵' },
  { id: 'fireflies', name: 'Fireflies', icon: '🔥' }
];

const STUDIO_PRESETS = [
  { id: 'professor', name: 'Professor Mochi', icon: '🧙‍♂️', headwear: 'wizard', eyewear: 'round', neckwear: 'none', cheek: 'none', prop: 'book', aura: 'sparkles' },
  { id: 'saathi', name: 'Punjabi Saathi', icon: '👳‍♂️', headwear: 'turban', eyewear: 'none', neckwear: 'scarf', cheek: 'freckles', prop: 'chai', aura: 'notes' },
  { id: 'neko', name: 'Lofi Neko', icon: '🐱', headwear: 'cat_ears', eyewear: 'shades', neckwear: 'collar_bell', cheek: 'whiskers', prop: 'heart', aura: 'hearts' },
  { id: 'weaver', name: 'Dream Weaver', icon: '🌸', headwear: 'flower_crown', eyewear: 'heart_glasses', neckwear: 'pearls', cheek: 'hearts', prop: 'wand', aura: 'fireflies' }
];

const INITIAL_PUE_MEMORIES = [
  { id: 'mem-1', type: 'preference', scope: 'technical_work', content: 'Prefers complete corrected files and step-by-step guidance over code snippets.', status: 'confirmed', evidenceKind: 'explicit', confidence: 1.0 },
  { id: 'mem-2', type: 'preference', scope: 'global', content: 'Speaks fluently in English, Hindi, and Punjabi.', status: 'confirmed', evidenceKind: 'explicit', confidence: 1.0 },
  { id: 'mem-3', type: 'project', scope: 'active_project', content: 'Active ED-H1 Project: Tabletop Robot UI & PUE Memory Architecture.', status: 'confirmed', evidenceKind: 'explicit', confidence: 1.0 },
  { id: 'mem-4', type: 'observation', scope: 'global', content: 'Often asks for trade-offs, cost, and maintenance considerations before deciding.', status: 'provisional', evidenceKind: 'inferred', confidence: 0.72 }
];

const INITIAL_PROJECT_TASKS = [
  { id: 't1', label: 'Configure local SQLite PUE store & schema migrations', done: true },
  { id: 't2', label: 'Implement 60fps Pixar spring-physics face & ghost morphing', done: true },
  { id: 't3', label: 'Add trilingual voice synthesis (EN, Hindi, Punjabi)', done: true },
  { id: 't4', label: 'Connect Ollama healthcare & Socratic homework engine', done: true }
];

const Music_STREAMS = [
  { id: 'lofi', title: 'Lofi Beats to Study & Relax To', channel: 'Lofi Girl', category: 'Focus & Study' },
  { id: 'raga', title: 'Morning Raga Flute & Sitar Ambient', channel: 'Meditation India', category: 'Wellness' },
  { id: 'gurbani', title: 'Soothing Gurbani Kirtan Ambient', channel: 'Peaceful Soul', category: 'Devotional' },
  { id: 'rain', title: 'Cozy Rain & Thunderstorm Sleep Sounds', channel: 'Ambient Worlds', category: 'Sleep & Rest' }
];

const loadSaved = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
};

export default function App() {
  const [windowId, setWindowId] = useState(() => loadSaved('edh1_window', 'ivory'));
  const [customColors, setCustomColors] = useState(() => loadSaved('edh1_swatch', PLUSH_SWATCHES[0]));
  const [activeProfile, setActiveProfile] = useState(() => loadSaved('edh1_profile', 'parent'));
  const [currentLang, setCurrentLang] = useState(() => loadSaved('edh1_lang', 'en'));
  const [moodKey, setMoodKey] = useState('joy');
  const [mode, setMode] = useState('companion');

  const currentLangObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
  const nextLangCode = currentLang === 'en' ? 'hi' : currentLang === 'hi' ? 'pa' : 'en';
  const provisionalCount = INITIAL_PUE_MEMORIES.filter((m) => m.status === 'provisional').length;

  const pillSurface = 'bg-stone-900/10 dark:bg-white/10 border-current/15 text-current shadow-lg';
  const pillButtonActive = 'bg-stone-900 text-stone-50 dark:bg-white dark:text-stone-900 shadow';
  const pillButtonIdle = 'hover:bg-current/10 opacity-80 hover:opacity-100';

  const ghostFill = windowId === 'ivory' ? customColors.skin : '#1E293B';
  const ghostStroke = windowId === 'ivory' ? customColors.edge : 'rgba(255,255,255,0.2)';

  const [isGhostForm, setIsGhostForm] = useState(false);
  const [freeWillActive, setFreeWillActive] = useState(() => loadSaved('edh1_freewill', true));
  const [willThought, setWillThought] = useState('');
  const [freeRoam, setFreeRoam] = useState(() => loadSaved('edh1_roam', true));
  const [showHands, setShowHands] = useState(() => loadSaved('edh1_hands', true));
  const [headwear, setHeadwear] = useState(() => loadSaved('edh1_headwear', 'sprout'));
  const [eyewear, setEyewear] = useState(() => loadSaved('edh1_eyewear', 'none'));
  const [neckwear, setNeckwear] = useState(() => loadSaved('edh1_neckwear', 'none'));
  const [cheekArt, setCheekArt] = useState(() => loadSaved('edh1_cheek', 'none'));
  const [auraEffect, setAuraEffect] = useState(() => loadSaved('edh1_aura', 'sparkles'));
  const [handProp, setHandProp] = useState(() => loadSaved('edh1_prop', 'none'));
  const [eyeSizeScale, setEyeSizeScale] = useState(() => loadSaved('edh1_eyescale', 1.0));
  const [blushIntensity, setBlushIntensity] = useState(() => loadSaved('edh1_blushint', 0.75));
  const [studioCategory, setStudioCategory] = useState('presets');
  const [handAction, setHandAction] = useState('idle');

  const [advancedMode, setAdvancedMode] = useState(() => loadSaved('edh1_advanced', false));
  const [showWhyUsedId, setShowWhyUsedId] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('istudio');
  const [pueMemories, setPueMemories] = useState(() => loadSaved('edh1_memories', INITIAL_PUE_MEMORIES));
  const [projectTasks, setProjectTasks] = useState(() => loadSaved('edh1_tasks', INITIAL_PROJECT_TASKS));
  const [pueLearningPaused, setPueLearningPaused] = useState(() => loadSaved('edh1_paused', false));
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [newMemoryScope, setNewMemoryScope] = useState('global');

  const [elderMedDone, setElderMedDone] = useState(false);
  const [elderWaterCount, setElderWaterCount] = useState(3);
  const [homeworkHintStep, setHomeworkHintStep] = useState(0);

  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5:7b');
  const [socraticMode, setSocraticMode] = useState(true);
  const [digiIdLinked, setDigiIdLinked] = useState(true);
  const [boardCurriculum, setBoardCurriculum] = useState('NCERT / CBSE Class 7');
  const [privacyLocalOnly, setPrivacyLocalOnly] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      role: 'assistant',
      text: 'Hello! I am ED-H1. Tap my face to say hi, or ask me anything—I remember how you like to work and learn.',
      pueUsed: ['Remembers your preferred style & active projects']
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [speechEnergy, setSpeechEnergy] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [ollamaStatus, setOllamaStatus] = useState('Local Memory Ready');

  const [ytQuery, setYtQuery] = useState('');
  const [activeStream, setActiveStream] = useState(Music_STREAMS[0]);
  const [customStreams, setCustomStreams] = useState(Music_STREAMS);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const loadedKeyRef = useRef('');
  const [musicStatus, setMusicStatus] = useState('');
  const [copied, setCopied] = useState(false);

  const [uiIdle, setUiIdle] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [blushPulse, setBlushPulse] = useState(1);

  useEffect(() => {
    try {
      localStorage.setItem('edh1_window', JSON.stringify(windowId));
      localStorage.setItem('edh1_swatch', JSON.stringify(customColors));
      localStorage.setItem('edh1_profile', JSON.stringify(activeProfile));
      localStorage.setItem('edh1_lang', JSON.stringify(currentLang));
      localStorage.setItem('edh1_advanced', JSON.stringify(advancedMode));
      localStorage.setItem('edh1_memories', JSON.stringify(pueMemories));
      localStorage.setItem('edh1_tasks', JSON.stringify(projectTasks));
      localStorage.setItem('edh1_paused', JSON.stringify(pueLearningPaused));
      localStorage.setItem('edh1_freewill', JSON.stringify(freeWillActive));
      localStorage.setItem('edh1_roam', JSON.stringify(freeRoam));
      localStorage.setItem('edh1_hands', JSON.stringify(showHands));
      localStorage.setItem('edh1_headwear', JSON.stringify(headwear));
      localStorage.setItem('edh1_eyewear', JSON.stringify(eyewear));
      localStorage.setItem('edh1_neckwear', JSON.stringify(neckwear));
      localStorage.setItem('edh1_cheek', JSON.stringify(cheekArt));
      localStorage.setItem('edh1_aura', JSON.stringify(auraEffect));
      localStorage.setItem('edh1_prop', JSON.stringify(handProp));
      localStorage.setItem('edh1_eyescale', JSON.stringify(eyeSizeScale));
      localStorage.setItem('edh1_blushint', JSON.stringify(blushIntensity));
    } catch (_) {}
  }, [
    windowId,
    customColors,
    activeProfile,
    currentLang,
    advancedMode,
    pueMemories,
    projectTasks,
    pueLearningPaused,
    freeWillActive,
    freeRoam,
    showHands,
    headwear,
    eyewear,
    neckwear,
    cheekArt,
    auraEffect,
    handProp,
    eyeSizeScale,
    blushIntensity
  ]);

  const mood = MOODS[moodKey] || MOODS.joy;
  const activeWindow = WINDOWS.find((w) => w.id === windowId) || WINDOWS[0];
  const isPlush = activeWindow.type === 'plush';
  const isAstral = activeWindow.type === 'astral';
  const isLight = windowId === 'ivory' || windowId === 'custom_plush';
  const profileObj = FAMILY_PROFILES.find((p) => p.id === activeProfile) || FAMILY_PROFILES[0];

  const palette = (() => {
    if (windowId === 'ivory') {
      return {
        bg: activeWindow.skinBg,
        edge: activeWindow.skinEdge,
        eye: activeWindow.eyeColor,
        blush: activeWindow.blushColor,
        mouth: activeWindow.mouthColor
      };
    }
    if (windowId === 'custom_plush') {
      return {
        bg: customColors.skin,
        edge: customColors.edge,
        eye: customColors.eye,
        blush: customColors.blush,
        mouth: customColors.eye
      };
    }
    if (windowId === 'nightlight') {
      return {
        bg: '#161224',
        edge: '#0B0814',
        eye: moodKey === 'love' ? '#FB7185' : moodKey === 'vibe' ? '#6EE7B7' : '#FDBA74',
        core: '#FFF7ED',
        blush: '#FB7185',
        mouth: '#FDBA74'
      };
    }
    return {
      bg: '#05070B',
      edge: '#05070B',
      eye: mood.color,
      core: mood.coreColor,
      blush: null,
      mouth: mood.color
    };
  })();

  const [pose, setPose] = useState({
    gazeX: 0,
    gazeY: 0,
    roamX: 0,
    roamY: 0,
    scaleX: 1,
    scaleY: 1,
    blink: 0,
    tilt: 0,
    faceScale: 1,
    faceOffsetY: 0,
    handLX: -175,
    handLY: 85,
    handLRot: -12,
    handRX: 175,
    handRY: 85,
    handRRot: 12,
    mouthOpen: 0,
    mouthWide: 1,
    browLift: 0,
    ghostWavePhase: 0,
    sparks: [],
    respiration: 1
  });

  const springsRef = useRef({
    gazeX: { val: 0, target: 0, vel: 0 },
    gazeY: { val: 0, target: 0, vel: 0 },
    roamX: { val: 0, target: 0, vel: 0 },
    roamY: { val: 0, target: 0, vel: 0 },
    scaleX: { val: 1, target: 1, vel: 0 },
    scaleY: { val: 1, target: 1, vel: 0 },
    blink: { val: 0, target: 0, vel: 0 },
    tilt: { val: 0, target: 0, vel: 0 },
    faceScale: { val: 1, target: 1, vel: 0 },
    faceOffsetY: { val: 0, target: 0, vel: 0 },
    handLX: { val: -175, target: -175, vel: 0 },
    handLY: { val: 85, target: 85, vel: 0 },
    handLRot: { val: -12, target: -12, vel: 0 },
    handRX: { val: 175, target: 175, vel: 0 },
    handRY: { val: 85, target: 85, vel: 0 },
    handRRot: { val: 12, target: 12, vel: 0 },
    mouthOpen: { val: 0, target: 0, vel: 0 },
    mouthWide: { val: 1, target: 1, vel: 0 },
    browLift: { val: 0, target: 0, vel: 0 },
    pointerActive: false,
    isHolding: false,
    isDraggingAvatar: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    lastBlink: Date.now(),
    nextBlinkDelay: 2800,
    lastSaccade: Date.now(),
    lastRoam: Date.now(),
    lastWillShift: Date.now(),
    nextWillDelay: 12000,
    speakingText: '',
    charIdx: 0
  });
  const idleTimerRef = useRef(null);
  const recognitionRef = useRef(null);

  const triggerWave = () => {
    setHandAction('wave');
    setMoodKey('joy');
    springsRef.current.scaleX.vel += 4.5;
    springsRef.current.scaleY.vel -= 3.8;
    springsRef.current.browLift.target = 10;
    setTimeout(() => {
      setHandAction('idle');
      springsRef.current.browLift.target = 0;
    }, 2200);
  };

  const speakWithEmotion = (text, langCode = currentLang) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langObj = LANGUAGES.find((l) => l.code === langCode) || LANGUAGES[0];
    utterance.lang = langObj.voiceCode;
    utterance.pitch = profileObj.pitch;
    utterance.rate = profileObj.rate;

    springsRef.current.speakingText = text;
    springsRef.current.charIdx = 0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeechEnergy(0.75);
      springsRef.current.browLift.target = 6;
    };
    utterance.onboundary = (event) => {
      const idx = event.charIndex || 0;
      springsRef.current.charIdx = idx;
      const wordSlice = text.slice(idx, idx + 5).toLowerCase();

      if (/[oauओऔउਓਔਉਊ]/.test(wordSlice)) {
        springsRef.current.mouthOpen.target = 0.92;
        springsRef.current.mouthWide.target = 0.72;
      } else if (/[aeiआएईअਆਏईਅ]/.test(wordSlice)) {
        springsRef.current.mouthOpen.target = 0.85;
        springsRef.current.mouthWide.target = 1.24;
      } else if (/[mbpमबపਮਬਪ]/.test(wordSlice)) {
        springsRef.current.mouthOpen.target = 0.08;
        springsRef.current.mouthWide.target = 1.08;
      } else {
        springsRef.current.mouthOpen.target = 0.55 + Math.random() * 0.35;
        springsRef.current.mouthWide.target = 0.92 + Math.random() * 0.25;
      }

      setSpeechEnergy(0.5 + Math.random() * 0.5);
      springsRef.current.scaleY.vel += 0.65;
      springsRef.current.tilt.target = (Math.random() - 0.5) * 8;
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeechEnergy(0);
      springsRef.current.mouthOpen.target = 0;
      springsRef.current.mouthWide.target = 1;
      springsRef.current.browLift.target = 0;
      springsRef.current.tilt.target = 0;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeechEnergy(0);
      springsRef.current.mouthOpen.target = 0;
      springsRef.current.mouthWide.target = 1;
    };
    window.speechSynthesis.speak(utterance);
  };

  const toggleMicInput = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setMode('voice');
      return;
    }

    if (isListeningMic && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListeningMic(false);
      return;
    }

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);

    const rec = new SpeechRec();
    const langObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
    rec.lang = langObj.voiceCode;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setIsListeningMic(true);
      setMoodKey('curious');
      springsRef.current.tilt.target = 6;
    };

    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setMode('voice');
        askAssistant(transcript);
      }
    };

    rec.onerror = () => setIsListeningMic(false);
    rec.onend = () => {
      setIsListeningMic(false);
      springsRef.current.tilt.target = 0;
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const handleLanguageChange = (langCode) => {
    setCurrentLang(langCode);
    const langObj = LANGUAGES.find((l) => l.code === langCode);
    if (langObj) {
      setMoodKey('love');
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          text: langObj.greeting,
          pueUsed: [`Language set to ${langObj.name}`]
        }
      ]);
      speakWithEmotion(langObj.greeting, langCode);
    }
  };

  const confirmPueMemory = (id) => {
    setPueMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'confirmed', confidence: 1.0 } : m))
    );
  };

  const deletePueMemory = (id) => {
    setPueMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const addExplicitMemory = (e) => {
    e.preventDefault();
    if (!newMemoryInput.trim()) return;
    const text = newMemoryInput.trim();

    const isShortOverride = /short|brief|concise/i.test(text);
    const updated = pueMemories.filter(
      (m) => !(isShortOverride && /complete|detailed/i.test(m.content) && m.scope === newMemoryScope)
    );

    const item = {
      id: 'mem-' + Date.now(),
      type: newMemoryScope === 'active_project' ? 'project' : 'preference',
      scope: newMemoryScope,
      content: text,
      status: 'confirmed',
      evidenceKind: 'explicit',
      confidence: 1.0
    };
    setPueMemories([item, ...updated]);
    setNewMemoryInput('');
  };

  const toggleProjectTask = (id) => {
    setProjectTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const exportPueProfile = () => {
    const dataStr = JSON.stringify(
      {
        schemaVersion: '1.0',
        exportedAt: new Date().toISOString(),
        activeProfile: profileObj.name,
        learningPaused: pueLearningPaused,
        memories: pueMemories,
        projectTasks
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ed-h1-personal-memory.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const askAssistant = async (queryText) => {
    if (!queryText.trim()) return;
    const userText = queryText.trim();
    setInputQuery('');
    setMessages((prev) => [...prev, { id: 'u-' + Date.now(), role: 'user', text: userText }]);
    setIsThinking(true);
    setMoodKey('thinking');

    const s = springsRef.current;
    s.gazeX.target = 22;
    s.gazeY.target = -26;
    s.tilt.target = -6;

    const langObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
    speakWithEmotion(langObj.backchannel, currentLang);

    const confirmedMemories = pueMemories.filter((m) => m.status === 'confirmed');
    const pueContextText = confirmedMemories.map((m) => `${m.content}`).join('; ');
    const friendlyUsed = confirmedMemories.slice(0, 2).map((m) => m.content);

    if (
      !pueLearningPaused &&
      /i prefer|remember that|always give me|only when|don't give me/i.test(userText)
    ) {
      setPueMemories((prev) => [
        {
          id: 'mem-' + Date.now(),
          type: 'preference',
          scope: 'global',
          content: userText,
          status: 'confirmed',
          evidenceKind: 'explicit',
          confidence: 1.0
        },
        ...prev
      ]);
    }

    try {
      const response = await fetch(`${EDH1_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          session_id: EDH1_SESSION_ID
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.detail || `Backend returned HTTP ${response.status}`);
      }

      const backendData = await response.json();
      const replyText = backendData.reply;
      if (!replyText) throw new Error('The AI backend returned an empty response.');
      setOllamaStatus(`Connected (${backendData.model || 'Ollama'})`);

      const finalReply = replyText || langObj.greeting;
      setMessages((prev) => [
        ...prev,
        { id: 'a-' + Date.now(), role: 'assistant', text: finalReply, pueUsed: friendlyUsed }
      ]);
      setMoodKey('joy');
      s.gazeX.target = 0;
      s.gazeY.target = 0;
      s.tilt.target = 0;
      speakWithEmotion(finalReply, currentLang);
    } catch (error) {
      const errorMessage = `I cannot reach my local AI engine right now. Please check that the ED-H1 backend is running at ${EDH1_BACKEND_URL}. Details: ${error?.message || 'Unknown connection error'}`;
      setOllamaStatus('Backend disconnected');
      setMessages((prev) => [
        ...prev,
        { id: 'a-' + Date.now(), role: 'assistant', text: errorMessage, pueUsed: friendlyUsed }
      ]);
      setMoodKey('thinking');
    } finally {
      setIsThinking(false);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    if (!isPlaying) {
      audio.pause();
      return undefined;
    }

    const query =
      activeStream.id === 'custom'
        ? activeStream.title
        : `${activeStream.title} ${activeStream.channel}`;

    if (loadedKeyRef.current === query && audio.src) {
      audio.play().catch(() => {});
      return undefined;
    }

    let cancelled = false;
    setMusicStatus('Finding audio...');

    fetch(`${EDH1_BACKEND_URL}/api/music/resolve?q=${encodeURIComponent(query)}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return null;
        loadedKeyRef.current = query;
        audio.src = `${EDH1_BACKEND_URL}${data.stream_path}`;
        setMusicStatus(`Now playing: ${data.title}`);
        return audio.play();
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return;
        setMusicStatus(`Music error: ${err.message}`);
        setIsPlaying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPlaying, activeStream]);

  const handleMusicSearch = (e) => {
    e.preventDefault();
    if (!ytQuery.trim()) return;
    const newTrack = {
      id: 'custom',
      title: ytQuery.trim(),
      channel: 'Ambient Audio',
      category: 'Focus & Wellness'
    };
    setCustomStreams((prev) => [newTrack, ...prev.slice(0, 3)]);
    setActiveStream(newTrack);
    setIsPlaying(true);
    setMoodKey('vibe');
    setYtQuery('');
  };

  const resetIdleTimer = () => {
    setUiIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setUiIdle(true), 3000);
  };

  useEffect(() => {
    resetIdleTimer();
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === '[' || e.key === ']') {
        const idx = WINDOWS.findIndex((w) => w.id === windowId);
        const nextIdx = e.key === ']' ? (idx + 1) % WINDOWS.length : (idx - 1 + WINDOWS.length) % WINDOWS.length;
        setWindowId(WINDOWS[nextIdx].id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [windowId]);

  useEffect(() => {
    if (!freeWillActive) return;
    if (mode === 'voice' || (mode === 'music' && isPlaying)) {
      const wantGhost = Math.random() < 0.68;
      if (wantGhost !== isGhostForm) {
        setIsGhostForm(wantGhost);
        springsRef.current.scaleX.vel += 5.2;
        springsRef.current.scaleY.vel -= 4.5;
        setWillThought(
          wantGhost
            ? '✨ Decided to float out into Ghost Form!'
            : '😊 Cozying back into Full-Screen Face!'
        );
        setTimeout(() => setWillThought(''), 3200);
      }
    }
  }, [mode, isPlaying]);

  useEffect(() => {
    const s = springsRef.current;
    if (mode === 'companion') {
      s.faceScale.target = isGhostForm ? 0.86 : 1.0;
      s.faceOffsetY.target = isGhostForm ? -15 : 0;
    } else {
      s.faceScale.target = isGhostForm ? 0.66 : 0.72;
      s.faceOffsetY.target = -110;
    }
  }, [mode, isGhostForm]);

  useEffect(() => {
    let frameId;
    let lastTime = performance.now();

    const stepSpring = (sp, stiffness, damping, dt) => {
      const force = (sp.target - sp.val) * stiffness;
      sp.vel = (sp.vel + force * dt) * Math.exp(-damping * dt);
      sp.val += sp.vel * dt;
      return sp.val;
    };

    const animate = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const t = now / 1000;
      const s = springsRef.current;

      if (Date.now() - s.lastBlink > s.nextBlinkDelay) {
        s.blink.val = 1.0;
        s.scaleX.vel += 1.4;
        s.scaleY.vel -= 1.3;
        s.lastBlink = Date.now();
        s.nextBlinkDelay = Math.random() < 0.2 ? 220 : 2500 + Math.random() * 3200;
      }

      if (freeWillActive && Date.now() - s.lastWillShift > s.nextWillDelay) {
        s.lastWillShift = Date.now();
        s.nextWillDelay = 11000 + Math.random() * 14000;

        const roll = Math.random();
        if (roll < 0.48) {
          setIsGhostForm((prev) => {
            const nextForm = !prev;
            s.scaleX.vel += 6.2;
            s.scaleY.vel -= 5.4;
            setWillThought(
              nextForm
                ? '👻 Popped into Ghost Form to float around!'
                : '🌟 Stretched out into Full-Screen Face!'
            );
            setTimeout(() => setWillThought(''), 3000);
            return nextForm;
          });
        } else if (roll < 0.78) {
          setHandAction('wave');
          s.browLift.target = 8;
          setTimeout(() => {
            setHandAction('idle');
            s.browLift.target = 0;
          }, 1800);
        } else {
          const spontaneousMoods = ['joy', 'curious', 'love', 'vibe'];
          const pick = spontaneousMoods[Math.floor(Math.random() * spontaneousMoods.length)];
          if (!isThinking && !isSpeaking) setMoodKey(pick);
        }
      }

      if (!s.pointerActive && !isThinking && Date.now() - s.lastSaccade > 2200) {
        s.gazeX.target = (Math.random() - 0.5) * 36;
        s.gazeY.target = (Math.random() - 0.5) * 20;
        s.tilt.target = (Math.random() - 0.5) * 7;
        s.lastSaccade = Date.now() + Math.random() * 1600;
      }

      if (freeRoam && !s.isDraggingAvatar && Date.now() - s.lastRoam > 3600) {
        const roamBoundX = mode === 'companion' ? 95 : 55;
        const roamBoundY = mode === 'companion' ? 50 : 25;
        s.roamX.target = (Math.random() - 0.5) * 2 * roamBoundX;
        s.roamY.target = (Math.random() - 0.5) * 2 * roamBoundY;
        s.lastRoam = Date.now() + 2400 + Math.random() * 2500;
      } else if (!freeRoam && !s.isDraggingAvatar) {
        s.roamX.target = 0;
        s.roamY.target = 0;
      }

      const breathFreq = mood.breathSpeed || 3.0;
      const respiration = Math.sin(t * (2 * Math.PI / breathFreq));
      const floatBob = isGhostForm ? Math.sin(t * 2.8) * 14 : Math.sin(t * 2.1) * 5;
      const respScaleX = 1.0 + respiration * 0.016;
      const respScaleY = 1.0 + respiration * 0.024;

      const musicPulse =
        (mode === 'music' && isPlaying) || moodKey === 'vibe' || isSpeaking
          ? Math.sin(t * 9.5) * (0.045 + speechEnergy * 0.04)
          : 0;
      const holdSquint = s.isHolding ? 0.16 : 0;

      s.scaleX.target = respScaleX + musicPulse + holdSquint;
      s.scaleY.target = respScaleY - musicPulse * 0.8 - holdSquint * 1.5;

      if (isSpeaking) {
        const syllableWave =
          Math.abs(Math.sin(t * 17.5)) * 0.55 +
          Math.abs(Math.cos(t * 11.2)) * 0.35 +
          Math.sin(t * 27.0) * 0.15;
        s.mouthOpen.target = Math.max(0.08, Math.min(1.0, syllableWave * (0.65 + speechEnergy * 0.5)));
        s.mouthWide.target = 0.82 + Math.sin(t * 9.4) * 0.26;
      } else if (isThinking) {
        s.mouthOpen.target = 0.16;
        s.mouthWide.target = 0.72;
      } else if (moodKey === 'joy' || moodKey === 'love') {
        s.mouthOpen.target = 0.22 + respiration * 0.05;
        s.mouthWide.target = 1.08;
      } else {
        s.mouthOpen.target = 0.02;
        s.mouthWide.target = 1.0;
      }

      const sideReach = isGhostForm ? 165 : 195;
      if (isThinking) {
        s.handLX.target = -sideReach * 0.78;
        s.handLY.target = 65 + Math.sin(t * 3) * 6;
        s.handLRot.target = -18;
        s.handRX.target = 48 + Math.sin(t * 6) * 4;
        s.handRY.target = 92 + Math.cos(t * 6) * 4;
        s.handRRot.target = -28;
      } else if (isListeningMic) {
        s.handLX.target = -sideReach * 0.85;
        s.handLY.target = 40;
        s.handLRot.target = -25;
        s.handRX.target = sideReach * 0.82;
        s.handRY.target = -20 + Math.sin(t * 5) * 5;
        s.handRRot.target = 35;
      } else if (handAction === 'wave') {
        s.handLX.target = -sideReach * 0.85;
        s.handLY.target = 75 + respiration * 8;
        s.handLRot.target = -15;
        s.handRX.target = sideReach * 0.92 + Math.sin(t * 16) * 28;
        s.handRY.target = -65 + Math.cos(t * 16) * 12;
        s.handRRot.target = 25 + Math.sin(t * 16) * 32;
      } else if (handAction === 'typing' || inputQuery.length > 0) {
        s.handLX.target = -85 + Math.sin(t * 14) * 14;
        s.handLY.target = 115 + Math.cos(t * 18) * 10;
        s.handLRot.target = 15;
        s.handRX.target = 85 + Math.cos(t * 14) * 14;
        s.handRY.target = 115 + Math.sin(t * 18) * 10;
        s.handRRot.target = -15;
      } else if ((mode === 'music' && isPlaying) || moodKey === 'vibe') {
        s.handLX.target = -sideReach + Math.sin(t * 6) * 24;
        s.handLY.target = 40 + Math.abs(Math.cos(t * 6)) * -35;
        s.handLRot.target = -20 + Math.sin(t * 6) * 25;
        s.handRX.target = sideReach - Math.sin(t * 6) * 24;
        s.handRY.target = 40 + Math.abs(Math.sin(t * 6)) * -35;
        s.handRRot.target = 20 - Math.sin(t * 6) * 25;
      } else if (isSpeaking) {
        s.handLX.target = -sideReach * 0.86 - speechEnergy * 22;
        s.handLY.target = 58 - speechEnergy * 26;
        s.handLRot.target = -15 - speechEnergy * 20;
        s.handRX.target = sideReach * 0.86 + speechEnergy * 22;
        s.handRY.target = 58 - speechEnergy * 26;
        s.handRRot.target = 15 + speechEnergy * 20;
      } else if (moodKey === 'love') {
        s.handLX.target = -105;
        s.handLY.target = 58 + respiration * 6;
        s.handLRot.target = 24;
        s.handRX.target = 105;
        s.handRY.target = 58 + respiration * 6;
        s.handRRot.target = -24;
      } else {
        s.handLX.target = -sideReach + s.gazeX.val * 0.25;
        s.handLY.target = 78 + respiration * 10 + s.gazeY.val * 0.2;
        s.handLRot.target = -14 + respiration * 5;
        s.handRX.target = sideReach + s.gazeX.val * 0.25;
        s.handRY.target = 78 + respiration * 10 + s.gazeY.val * 0.2;
        s.handRRot.target = 14 - respiration * 5;
      }

      const gx = stepSpring(s.gazeX, 180, 15, dt);
      const gy = stepSpring(s.gazeY, 180, 15, dt);
      const rx = stepSpring(s.roamX, 42, 9, dt);
      const ry = stepSpring(s.roamY, 42, 9, dt);
      const sx = stepSpring(s.scaleX, 240, 12, dt);
      const sy = stepSpring(s.scaleY, 240, 12, dt);
      const bl = Math.max(0, Math.min(1, stepSpring(s.blink, 400, 22, dt)));
      const tl = stepSpring(s.tilt, 140, 13, dt);
      const fs = stepSpring(s.faceScale, 160, 16, dt);
      const fy = stepSpring(s.faceOffsetY, 160, 16, dt);
      const hlx = stepSpring(s.handLX, 170, 14, dt);
      const hly = stepSpring(s.handLY, 170, 14, dt);
      const hlr = stepSpring(s.handLRot, 150, 13, dt);
      const hrx = stepSpring(s.handRX, 170, 14, dt);
      const hry = stepSpring(s.handRY, 170, 14, dt);
      const hrr = stepSpring(s.handRRot, 150, 13, dt);
      const mOpen = Math.max(0, stepSpring(s.mouthOpen, 340, 18, dt));
      const mWide = stepSpring(s.mouthWide, 260, 16, dt);
      const bLift = stepSpring(s.browLift, 180, 14, dt);

      setPose((prev) => ({
        gazeX: gx,
        gazeY: gy,
        roamX: rx,
        roamY: ry + floatBob,
        scaleX: sx,
        scaleY: sy,
        blink: bl,
        tilt: tl,
        faceScale: fs,
        faceOffsetY: fy,
        handLX: hlx,
        handLY: hly,
        handLRot: hlr,
        handRX: hrx,
        handRY: hry,
        handRRot: hrr,
        mouthOpen: mOpen,
        mouthWide: mWide,
        browLift: bLift,
        ghostWavePhase: t * 4.2,
        sparks: prev.sparks.filter((sp) => Date.now() - sp.id < 900),
        respiration
      }));
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [
    mode,
    isPlaying,
    moodKey,
    isThinking,
    isSpeaking,
    speechEnergy,
    mood,
    freeRoam,
    freeWillActive,
    isGhostForm,
    isListeningMic,
    handAction,
    inputQuery
  ]);

  const effectiveLid = Math.max(mood.topLid, pose.blink);
  const baseEyeW = mood.eyeW * pose.scaleX * eyeSizeScale;
  const baseEyeH = Math.max(10, mood.eyeH * pose.scaleY * eyeSizeScale * (1 - effectiveLid * 0.92));

  const visibleTabs = [
    { id: 'istudio', label: 'iStudio', icon: Sparkles },
    { id: 'look', label: 'Skins', icon: Palette },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'family', label: 'Family', icon: UserCheck },
    ...(advancedMode ? [{ id: 'system', label: 'Builder', icon: Cpu }] : [])
  ];

  const applyStudioPreset = (preset) => {
    setHeadwear(preset.headwear);
    setEyewear(preset.eyewear);
    setNeckwear(preset.neckwear);
    setCheekArt(preset.cheek);
    setHandProp(preset.prop);
    setAuraEffect(preset.aura);
    setShowHands(true);
    triggerWave();
  };

  const randomizeStudioLook = () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id;
    setHeadwear(pick(HEADWEAR_ITEMS));
    setEyewear(pick(EYEWEAR_ITEMS));
    setNeckwear(pick(NECKWEAR_ITEMS));
    setCheekArt(pick(CHEEK_MARKINGS));
    setHandProp(pick(PROP_ITEMS));
    setAuraEffect(pick(AURA_EFFECTS));
    triggerWave();
  };

  const w1 = Math.sin(pose.ghostWavePhase) * 12;
  const w2 = Math.cos(pose.ghostWavePhase * 1.1) * 12;
  const w3 = Math.sin(pose.ghostWavePhase * 0.9 + 1) * 12;
  const ghostSvgPath = `
    M 60,210
    C 60,72 145,24 260,24
    C 375,24 460,72 460,210
    C 460,295 470,355 470,415
    C 435,${442 + w1} 400,${390 - w1} 365,${418 + w2}
    C 330,${445 - w2} 295,${392 + w3} 260,${420 - w1}
    C 225,${448 + w1} 190,${392 - w3} 155,${418 + w2}
    C 120,${445 - w2} 85,${395 + w1} 50,415
    C 50,355 60,295 60,210 Z
  `;

  return (
    <div
      onMouseMove={(e) => {
        resetIdleTimer();
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        const s = springsRef.current;
        s.pointerActive = true;
        s.gazeX.target = Math.max(-48, Math.min(48, nx * 46));
        s.gazeY.target = Math.max(-30, Math.min(30, ny * 28));

        if (s.isDraggingAvatar) {
          s.roamX.target = e.clientX - window.innerWidth / 2;
          s.roamY.target = e.clientY - window.innerHeight / 2 - s.faceOffsetY.val;
          s.lastRoam = Date.now() + 4000;
        }
      }}
      onMouseLeave={() => {
        springsRef.current.pointerActive = false;
        springsRef.current.isDraggingAvatar = false;
        springsRef.current.gazeX.target = 0;
        springsRef.current.gazeY.target = 0;
      }}
      onMouseDown={() => {
        springsRef.current.isHolding = true;
      }}
      onMouseUp={() => {
        springsRef.current.isHolding = false;
        springsRef.current.isDraggingAvatar = false;
      }}
      onClick={(e) => {
        resetIdleTimer();
        const s = springsRef.current;
        s.scaleX.vel += 7.2;
        s.scaleY.vel -= 6.4;
        setBlushPulse(1.55);
        setTimeout(() => setBlushPulse(1), 750);
        if (moodKey === 'sleepy') setMoodKey('joy');
        setPose((prev) => ({
          ...prev,
          sparks: [...prev.sparks.slice(-5), { id: Date.now(), x: e.clientX, y: e.clientY }]
        }));
      }}
      className={`relative w-screen h-screen overflow-hidden select-none cursor-pointer flex flex-col items-center justify-center font-sans transition-colors duration-700 ${
        isLight ? 'text-stone-900' : 'text-slate-100'
      }`}
      style={{
        backgroundColor: palette.bg,
        backgroundImage: isPlush
          ? `radial-gradient(circle at 50% 42%, ${palette.bg} 35%, ${palette.edge} 100%)`
          : isAstral
          ? 'radial-gradient(circle at 50% 42%, #2A1F3D 0%, #161224 62%, #0B0813 100%)'
          : 'none'
      }}
    >
      {pose.sparks.map((sp) => (
        <div
          key={sp.id}
          className="pointer-events-none fixed z-40 animate-ping"
          style={{ left: sp.x - 14, top: sp.y - 14 }}
        >
          <Heart
            className="w-7 h-7"
            style={{
              color: isPlush ? palette.blush : palette.eye,
              fill: isPlush ? palette.blush : palette.eye
            }}
          />
        </div>
      ))}

      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          springsRef.current.isDraggingAvatar = true;
          springsRef.current.isHolding = true;
        }}
        title="Click to boop • Drag to move around • ED-H1 transforms into Ghost Form at its own free will!"
        className="relative z-10 flex flex-col items-center justify-center will-change-transform cursor-grab active:cursor-grabbing"
        style={{
          transform: `translate3d(${pose.roamX + pose.gazeX * 0.65}px, ${
            pose.faceOffsetY + pose.roamY + pose.gazeY * 0.65
          }px, 0) scale(${pose.faceScale}) rotate(${pose.tilt * 0.45 + pose.roamX * 0.025}deg)`
        }}
      >
        {willThought && (
          <div
            className={`pointer-events-none absolute -top-44 z-40 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide border backdrop-blur-xl animate-bounce ${pillSurface}`}
          >
            {willThought}
          </div>
        )}

        {auraEffect !== 'none' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
            {[-1, 1, -2, 2].map((idx) => {
              const angle = pose.ghostWavePhase * 0.45 + idx * 1.5;
              const px = Math.cos(angle) * (195 + Math.abs(idx) * 28);
              const py = Math.sin(angle * 1.3) * 115 - 20;
              const symbol =
                auraEffect === 'sparkles'
                  ? '✨'
                  : auraEffect === 'hearts'
                  ? '🩷'
                  : auraEffect === 'notes'
                  ? '🎵'
                  : '🔥';
              return (
                <span
                  key={idx}
                  className="absolute text-lg opacity-75 transition-transform"
                  style={{
                    transform: `translate3d(${px}px, ${py}px, 0) scale(${0.85 + Math.sin(angle) * 0.25})`
                  }}
                >
                  {symbol}
                </span>
              );
            })}
          </div>
        )}

        {(!isPlush || isGhostForm) && (
          <div
            className="pointer-events-none absolute rounded-full blur-[90px] transition-all duration-700"
            style={{
              width: isGhostForm ? 540 : 480,
              height: isGhostForm ? 480 : 310,
              background: isPlush
                ? 'rgba(35, 31, 32, 0.08)'
                : isAstral
                ? 'rgba(253, 186, 116, 0.25)'
                : mood.glowColor
            }}
          />
        )}

        {isGhostForm && (
          <>
            <svg
              width="580"
              height="520"
              viewBox="0 0 520 470"
              className="pointer-events-none absolute -top-36 transition-all duration-500 overflow-visible"
              style={{
                filter: isPlush
                  ? 'drop-shadow(0 28px 42px rgba(35, 31, 32, 0.16))'
                  : `drop-shadow(0 0 42px ${palette.eye}33)`
              }}
            >
              <defs>
                <radialGradient id="ghostGrad" cx="50%" cy="32%" r="68%">
                  <stop offset="0%" stopColor={ghostFill} />
                  <stop offset="72%" stopColor={isPlush ? palette.edge : ghostFill} />
                  <stop offset="100%" stopColor={isPlush ? palette.edge : '#05070B'} />
                </radialGradient>
              </defs>
              <path
                d={ghostSvgPath}
                fill="url(#ghostGrad)"
                stroke={ghostStroke}
                strokeWidth="3.5"
              />
              <ellipse
                cx="220"
                cy="62"
                rx="75"
                ry="22"
                fill="white"
                opacity={isLight ? 0.45 : 0.12}
              />
            </svg>
            <div
              className="pointer-events-none absolute rounded-full blur-xl transition-all duration-500"
              style={{
                width: `${220 - pose.roamY * 0.6}px`,
                height: '26px',
                bottom: '-185px',
                backgroundColor: isLight ? 'rgba(35, 31, 32, 0.14)' : 'rgba(0, 0, 0, 0.55)'
              }}
            />
          </>
        )}

        {headwear !== 'none' && (
          <div
            className="pointer-events-none absolute z-30 flex items-center justify-center transition-transform duration-300"
            style={{
              top: isGhostForm ? '-132px' : `${-baseEyeH * 0.78 - 44}px`,
              transform: `rotate(${pose.tilt * 0.9}deg)`
            }}
          >
            {headwear === 'sprout' && (
              <svg width="76" height="76" viewBox="0 0 64 64" className="drop-shadow-md">
                <path
                  d="M32 58 C32 40 30 28 32 18"
                  stroke="#16A34A"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M32 24 C16 10 6 22 18 32 C24 36 30 30 32 24 Z"
                  fill="#4ADE80"
                  stroke="#16A34A"
                  strokeWidth="2.5"
                />
                <path
                  d="M32 20 C46 6 58 18 46 28 C40 32 34 26 32 20 Z"
                  fill="#22C55E"
                  stroke="#16A34A"
                  strokeWidth="2.5"
                />
              </svg>
            )}
            {headwear === 'crown' && (
              <svg width="88" height="68" viewBox="0 0 80 60" className="drop-shadow-lg">
                <path
                  d="M10 48 L6 16 L26 32 L40 10 L54 32 L74 16 L70 48 Z"
                  fill="#FBBF24"
                  stroke="#B45309"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                <circle cx="40" cy="10" r="4.5" fill="#EF4444" />
                <circle cx="6" cy="16" r="4" fill="#38BDF8" />
                <circle cx="74" cy="16" r="4" fill="#38BDF8" />
              </svg>
            )}
            {headwear === 'bow' && (
              <svg width="86" height="60" viewBox="0 0 80 56" className="drop-shadow-md">
                <path
                  d="M40 28 C20 6 6 14 12 32 C16 44 30 38 40 28 Z"
                  fill="#FB7185"
                  stroke="#BE123C"
                  strokeWidth="2.5"
                />
                <path
                  d="M40 28 C60 6 74 14 68 32 C64 44 50 38 40 28 Z"
                  fill="#FB7185"
                  stroke="#BE123C"
                  strokeWidth="2.5"
                />
                <circle cx="40" cy="28" r="8" fill="#F43F5E" stroke="#BE123C" strokeWidth="2.5" />
              </svg>
            )}
            {headwear === 'halo' && (
              <div
                className="w-36 h-9 rounded-full border-[6px] border-amber-300"
                style={{
                  boxShadow: '0 0 28px rgba(252, 211, 77, 0.85)',
                  transform: 'rotateX(60deg)'
                }}
              />
            )}
            {headwear === 'wizard' && (
              <svg width="110" height="90" viewBox="0 0 100 84" className="drop-shadow-xl">
                <ellipse cx="50" cy="70" rx="46" ry="11" fill="#312E81" stroke="#FBBF24" strokeWidth="2.5" />
                <path
                  d="M22 68 L46 8 C50 2 56 6 58 14 L78 68 Z"
                  fill="#4338CA"
                  stroke="#FBBF24"
                  strokeWidth="2.5"
                />
                <text x="42" y="52" fontSize="16">⭐</text>
              </svg>
            )}
            {headwear === 'beret' && (
              <svg width="104" height="64" viewBox="0 0 100 60" className="drop-shadow-lg">
                <path d="M48 14 L52 4" stroke="#991B1B" strokeWidth="4" strokeLinecap="round" />
                <ellipse cx="52" cy="34" rx="42" ry="18" fill="#E11D48" stroke="#9F1239" strokeWidth="3" />
                <rect x="24" y="44" width="52" height="8" rx="4" fill="#1F2937" />
              </svg>
            )}
            {headwear === 'cat_ears' && (
              <div className="flex items-center justify-between" style={{ width: `${mood.spacing + 90}px` }}>
                <svg width="64" height="64" viewBox="0 0 60 60" className="-rotate-12 drop-shadow-md">
                  <polygon points="10,54 26,8 54,46" fill="#F43F5E" stroke="#881337" strokeWidth="3" strokeLinejoin="round" />
                  <polygon points="18,46 28,18 46,42" fill="#FDA4AF" />
                </svg>
                <svg width="64" height="64" viewBox="0 0 60 60" className="rotate-12 drop-shadow-md">
                  <polygon points="6,46 34,8 50,54" fill="#F43F5E" stroke="#881337" strokeWidth="3" strokeLinejoin="round" />
                  <polygon points="14,42 32,18 42,46" fill="#FDA4AF" />
                </svg>
              </div>
            )}
            {headwear === 'antlers' && (
              <div className="flex items-center justify-between" style={{ width: `${mood.spacing + 110}px` }}>
                <span className="text-5xl -rotate-12 select-none drop-shadow">🦌</span>
                <span className="text-5xl rotate-12 scale-x-[-1] select-none drop-shadow">🦌</span>
              </div>
            )}
            {headwear === 'turban' && (
              <svg width="130" height="82" viewBox="0 0 120 76" className="drop-shadow-xl">
                <path d="M16 58 C12 26 42 10 60 14 C78 10 108 26 104 58 C88 68 32 68 16 58 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="3" />
                <path d="M24 44 Q60 22 98 38" stroke="#D97706" strokeWidth="3.5" fill="none" />
                <path d="M28 54 Q60 34 92 50" stroke="#D97706" strokeWidth="3.5" fill="none" />
                <circle cx="60" cy="24" r="6" fill="#FEF3C7" stroke="#B45309" strokeWidth="2" />
              </svg>
            )}
            {headwear === 'flower_crown' && (
              <div className="flex items-center gap-2 text-3xl drop-shadow-md select-none">
                <span>🌸</span>
                <span>🌼</span>
                <span>🌺</span>
                <span>🌼</span>
                <span>🌸</span>
              </div>
            )}
            {headwear === 'headphones' && (
              <div
                className="pointer-events-none flex items-center justify-between"
                style={{
                  width: `${mood.spacing + baseEyeW * 1.45}px`,
                  marginTop: `${baseEyeH * 0.55}px`
                }}
              >
                <div className="w-9 h-20 rounded-2xl bg-rose-500 border-2 border-white/40 shadow-lg -ml-5" />
                <div className="w-9 h-20 rounded-2xl bg-rose-500 border-2 border-white/40 shadow-lg -mr-5" />
              </div>
            )}
          </div>
        )}

        {(palette.blush || cheekArt !== 'none') && (
          <div
            className="pointer-events-none absolute flex items-center justify-between transition-all duration-500"
            style={{
              width: `${mood.spacing + baseEyeW * 1.48}px`,
              top: `${baseEyeH * 0.62}px`
            }}
          >
            {[-1, 1].map((side) => (
              <div key={side} className="relative flex items-center justify-center">
                {palette.blush && (
                  <div
                    className="rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(58, baseEyeW * 0.65)}px`,
                      height: `${Math.max(34, baseEyeH * 0.36)}px`,
                      backgroundColor: palette.blush,
                      filter: 'blur(18px)',
                      opacity: blushIntensity * blushPulse,
                      transform: `scale(${blushPulse})`
                    }}
                  />
                )}
                {cheekArt === 'freckles' && (
                  <div className="absolute flex gap-1.5 opacity-65">
                    <span className="w-2 h-2 rounded-full bg-amber-900/70" />
                    <span className="w-2 h-2 rounded-full bg-amber-900/70 -mt-1.5" />
                    <span className="w-2 h-2 rounded-full bg-amber-900/70" />
                  </div>
                )}
                {cheekArt === 'whiskers' && (
                  <svg width="56" height="32" viewBox="0 0 56 32" className="absolute opacity-70">
                    <line x1="6" y1="8" x2="50" y2="12" stroke={palette.eye} strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="4" y1="18" x2="52" y2="18" stroke={palette.eye} strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="6" y1="28" x2="50" y2="24" stroke={palette.eye} strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                )}
                {cheekArt === 'stars' && <span className="absolute text-xl select-none">⭐</span>}
                {cheekArt === 'hearts' && <span className="absolute text-xl select-none">🩷</span>}
                {cheekArt === 'bandaid' && side === 1 && (
                  <span className="absolute text-2xl rotate-12 select-none">🩹</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className="pointer-events-none flex items-center justify-center mb-3 transition-transform"
          style={{
            gap: `${Math.max(44, mood.spacing - baseEyeW * 0.65)}px`,
            transform: `translate3d(${pose.gazeX * 0.25}px, ${-pose.browLift - Math.abs(pose.respiration) * 3}px, 0)`
          }}
        >
          {[-1, 1].map((side) => {
            const browTilt =
              moodKey === 'curious'
                ? side === -1
                  ? -14
                  : 12
                : moodKey === 'thinking'
                ? side === -1
                  ? -10
                  : 8
                : side * mood.tiltR * 1.4;
            return (
              <div
                key={side}
                className="rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(44, baseEyeW * 0.52)}px`,
                  height: isPlush ? '8px' : '6px',
                  backgroundColor: palette.eye,
                  opacity: 0.78,
                  transform: `rotate(${browTilt}deg)`
                }}
              />
            );
          })}
        </div>

        <div
          className="relative flex items-center justify-center"
          style={{ gap: `${Math.max(28, mood.spacing - baseEyeW)}px` }}
        >
          {[-1, 1].map((side) => {
            const sideScale = side === -1 ? mood.scaleL || 1 : mood.scaleR || 1;
            const w = baseEyeW * sideScale;
            const h = baseEyeH * sideScale;
            const rot = side === -1 ? mood.tiltL : mood.tiltR;
            return (
              <div
                key={side}
                className="relative transition-colors duration-500"
                style={{
                  width: `${w}px`,
                  height: `${h}px`,
                  borderRadius: `${mood.radius}px`,
                  transform: `rotate(${rot}deg)`,
                  background: isPlush
                    ? `radial-gradient(circle at 38% 30%, #484042 0%, ${palette.eye} 58%, #120F10 100%)`
                    : `radial-gradient(circle at 50% 38%, ${palette.core} 0%, ${palette.eye} 58%, ${palette.eye}dd 100%)`,
                  boxShadow: isPlush
                    ? '0 16px 32px rgba(35, 31, 32, 0.18), inset 0 -10px 20px rgba(0, 0, 0, 0.55)'
                    : `0 0 55px ${palette.eye}55`
                }}
              >
                {h > 24 && (
                  <>
                    <div
                      className="absolute rounded-full bg-white transition-transform"
                      style={{
                        width: `${Math.max(8, w * 0.22)}px`,
                        height: `${Math.max(8, w * 0.22)}px`,
                        top: '16%',
                        left: '20%',
                        transform: `translate3d(${pose.gazeX * 0.14}px, ${pose.gazeY * 0.14}px, 0)`,
                        boxShadow: '0 0 12px rgba(255, 255, 255, 0.95)'
                      }}
                    />
                    <div
                      className="absolute rounded-full bg-white/80 transition-transform"
                      style={{
                        width: `${Math.max(4, w * 0.09)}px`,
                        height: `${Math.max(4, w * 0.09)}px`,
                        bottom: '22%',
                        right: '22%',
                        transform: `translate3d(${pose.gazeX * 0.08}px, ${pose.gazeY * 0.08}px, 0)`
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}

          {eyewear !== 'none' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
              {eyewear === 'round' && (
                <div className="flex items-center">
                  <div
                    className="rounded-full border-[5px] border-amber-600/90 bg-sky-200/10"
                    style={{ width: baseEyeW * 1.16, height: baseEyeW * 1.16 }}
                  />
                  <div className="w-8 h-1.5 bg-amber-600" />
                  <div
                    className="rounded-full border-[5px] border-amber-600/90 bg-sky-200/10"
                    style={{ width: baseEyeW * 1.16, height: baseEyeW * 1.16 }}
                  />
                </div>
              )}
              {eyewear === 'shades' && (
                <div className="flex items-center">
                  <div
                    className="rounded-3xl border-4 border-stone-950 bg-stone-900/90 shadow-xl"
                    style={{ width: baseEyeW * 1.18, height: baseEyeW * 0.78 }}
                  />
                  <div className="w-8 h-2 bg-stone-950" />
                  <div
                    className="rounded-3xl border-4 border-stone-950 bg-stone-900/90 shadow-xl"
                    style={{ width: baseEyeW * 1.18, height: baseEyeW * 0.78 }}
                  />
                </div>
              )}
              {eyewear === 'star' && (
                <div className="flex items-center gap-12 text-7xl drop-shadow-lg opacity-90">
                  <span>⭐</span>
                  <span>⭐</span>
                </div>
              )}
              {eyewear === 'monocle' && (
                <div className="flex items-center">
                  <div style={{ width: baseEyeW * 1.15 }} />
                  <div className="w-8" />
                  <div
                    className="relative rounded-full border-[5px] border-amber-400 bg-amber-100/10 shadow-lg"
                    style={{ width: baseEyeW * 1.18, height: baseEyeW * 1.18 }}
                  >
                    <div className="absolute -bottom-12 right-3 w-1 h-12 bg-amber-400/80 rounded-full" />
                  </div>
                </div>
              )}
              {eyewear === 'heart_glasses' && (
                <div className="flex items-center gap-10 text-7xl drop-shadow-lg opacity-90">
                  <span>❤️</span>
                  <span>❤️</span>
                </div>
              )}
              {eyewear === 'cyber_visor' && (
                <div
                  className="rounded-full border-2 border-cyan-300 bg-gradient-to-r from-cyan-500/45 via-sky-400/60 to-indigo-500/45 backdrop-blur-sm shadow-lg"
                  style={{
                    width: `${mood.spacing + baseEyeW * 1.25}px`,
                    height: `${Math.max(42, baseEyeH * 0.52)}px`,
                    boxShadow: '0 0 28px rgba(34, 211, 238, 0.65)'
                  }}
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center z-20">
          {(() => {
            const mw = Math.max(24, mood.mouthWidth * pose.mouthWide * 1.55);
            const openAmt = pose.mouthOpen;
            const smileDepth = mood.mouthCurve * (0.75 + pose.respiration * 0.08);
            const cavityH = openAmt * 34;

            return (
              <svg
                width="120"
                height="64"
                viewBox="0 0 120 64"
                className="overflow-visible transition-transform"
                style={{
                  transform: `translate3d(${pose.gazeX * 0.18}px, ${pose.gazeY * 0.12}px, 0)`
                }}
              >
                <defs>
                  <clipPath id="mouthClip">
                    <path
                      d={`M ${60 - mw / 2},20 Q 60,${20 + smileDepth * 0.45 - cavityH * 0.28} ${
                        60 + mw / 2
                      },20 Q 60,${20 + smileDepth + cavityH * 1.25} ${60 - mw / 2},20 Z`}
                    />
                  </clipPath>
                </defs>

                {openAmt > 0.09 ? (
                  <g>
                    <path
                      d={`M ${60 - mw / 2},20 Q 60,${20 + smileDepth * 0.45 - cavityH * 0.28} ${
                        60 + mw / 2
                      },20 Q 60,${20 + smileDepth + cavityH * 1.25} ${60 - mw / 2},20 Z`}
                      fill="#7F1D1D"
                    />
                    <g clipPath="url(#mouthClip)">
                      <ellipse
                        cx="60"
                        cy={28 + cavityH * 0.62}
                        rx={mw * 0.36}
                        ry={Math.max(8, cavityH * 0.55)}
                        fill="#FB7185"
                      />
                    </g>
                    <path
                      d={`M ${60 - mw / 2},20 Q 60,${20 + smileDepth * 0.45 - cavityH * 0.28} ${
                        60 + mw / 2
                      },20 Q 60,${20 + smileDepth + cavityH * 1.25} ${60 - mw / 2},20 Z`}
                      fill="none"
                      stroke={palette.mouth}
                      strokeWidth={isPlush ? '4.5' : '3.8'}
                      strokeLinejoin="round"
                    />
                  </g>
                ) : (
                  <path
                    d={`M ${60 - mw / 2},22 Q 60,${22 + smileDepth} ${60 + mw / 2},22`}
                    fill="none"
                    stroke={palette.mouth}
                    strokeWidth={isPlush ? '5.2' : '4.5'}
                    strokeLinecap="round"
                  />
                )}
              </svg>
            );
          })()}
        </div>

        {neckwear !== 'none' && (
          <div className="pointer-events-none mt-2 flex items-center justify-center z-20 select-none">
            {neckwear === 'bowtie' && (
              <svg width="74" height="44" viewBox="0 0 74 44" className="drop-shadow-md">
                <polygon points="8,8 37,22 8,36" fill="#E11D48" stroke="#881337" strokeWidth="2.5" />
                <polygon points="66,8 37,22 66,36" fill="#E11D48" stroke="#881337" strokeWidth="2.5" />
                <circle cx="37" cy="22" r="7" fill="#F43F5E" stroke="#881337" strokeWidth="2.5" />
              </svg>
            )}
            {neckwear === 'scarf' && (
              <div className="relative flex items-center justify-center">
                <div className="w-44 h-9 rounded-full bg-amber-600 border-2 border-amber-800 shadow-md" />
                <div className="absolute top-5 right-8 w-9 h-16 rounded-b-xl bg-amber-500 border-2 border-amber-800 rotate-6 shadow" />
              </div>
            )}
            {neckwear === 'collar_bell' && (
              <div className="relative flex flex-col items-center">
                <div className="w-36 h-4 rounded-full bg-rose-600 border border-rose-900 shadow" />
                <div className="w-7 h-7 -mt-1.5 rounded-full bg-amber-400 border-2 border-amber-700 shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-amber-900" />
                </div>
              </div>
            )}
            {neckwear === 'pearls' && (
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <span
                    key={n}
                    className="w-4 h-4 rounded-full bg-stone-50 border border-stone-300 shadow-sm"
                  />
                ))}
              </div>
            )}
            {neckwear === 'cape' && (
              <div className="w-52 h-10 rounded-b-3xl bg-indigo-600/90 border-2 border-amber-400 shadow-lg flex items-center justify-center">
                <span className="w-4 h-4 rounded-full bg-amber-300 border border-amber-600" />
              </div>
            )}
          </div>
        )}

        {showHands && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-30">
            <div
              onClick={(e) => {
                e.stopPropagation();
                triggerWave();
              }}
              className="pointer-events-auto absolute rounded-full transition-colors duration-500 flex items-center justify-center"
              style={{
                width: isGhostForm ? '56px' : '64px',
                height: isGhostForm ? '48px' : '54px',
                transform: `translate3d(${pose.handLX}px, ${pose.handLY}px, 0) rotate(${pose.handLRot}deg)`,
                background: isPlush
                  ? `radial-gradient(circle at 35% 30%, ${palette.bg} 0%, ${palette.edge} 100%)`
                  : `radial-gradient(circle at 35% 30%, ${palette.core || '#fff'} 0%, ${palette.eye} 100%)`,
                border: isPlush ? `3px solid ${palette.eye}25` : `2px solid ${palette.eye}`,
                boxShadow: isPlush
                  ? '0 12px 24px rgba(35, 31, 32, 0.16)'
                  : `0 0 28px ${palette.eye}66`
              }}
            />

            <div
              onClick={(e) => {
                e.stopPropagation();
                triggerWave();
              }}
              title="Click hand for a wave!"
              className="pointer-events-auto absolute rounded-full transition-colors duration-500 flex items-center justify-center"
              style={{
                width: isGhostForm ? '56px' : '64px',
                height: isGhostForm ? '48px' : '54px',
                transform: `translate3d(${pose.handRX}px, ${pose.handRY}px, 0) rotate(${pose.handRRot}deg)`,
                background: isPlush
                  ? `radial-gradient(circle at 35% 30%, ${palette.bg} 0%, ${palette.edge} 100%)`
                  : `radial-gradient(circle at 35% 30%, ${palette.core || '#fff'} 0%, ${palette.eye} 100%)`,
                border: isPlush ? `3px solid ${palette.eye}25` : `2px solid ${palette.eye}`,
                boxShadow: isPlush
                  ? '0 12px 24px rgba(35, 31, 32, 0.16)'
                  : `0 0 28px ${palette.eye}66`
              }}
            >
              {handProp !== 'none' && (
                <span className="text-3xl select-none -mt-5 -mr-4 drop-shadow-md">
                  {PROP_ITEMS.find((p) => p.id === handProp)?.icon}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {mode === 'voice' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-20 inset-x-4 sm:inset-x-16 z-20 max-w-xl mx-auto flex flex-col gap-2 pointer-events-auto"
        >
          {activeProfile === 'elder' && (
            <div className={`px-3.5 py-2 rounded-2xl border backdrop-blur-xl flex items-center justify-between text-xs ${pillSurface}`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setElderMedDone(!elderMedDone);
                    setMoodKey('love');
                  }}
                  className={`px-2.5 py-1 rounded-xl font-semibold flex items-center gap-1.5 transition ${
                    elderMedDone ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
                  }`}
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>{elderMedDone ? 'Medicine Taken ✓' : 'Log Medicine'}</span>
                </button>
                <button
                  onClick={() => setElderWaterCount((c) => c + 1)}
                  className="px-2.5 py-1 rounded-xl bg-sky-500/15 text-sky-600 font-semibold flex items-center gap-1"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>{elderWaterCount} Glasses</span>
                </button>
              </div>
              <button
                onClick={() => {
                  setMode('music');
                  setActiveStream(Music_STREAMS[1]);
                  setIsPlaying(true);
                  setMoodKey('vibe');
                }}
                className="text-[11px] font-bold underline opacity-80 hover:opacity-100"
              >
                🎵 Play Peaceful Raga
              </button>
            </div>
          )}

          {activeProfile === 'child' && (
            <div className={`px-3.5 py-2 rounded-2xl border backdrop-blur-xl flex items-center justify-between text-xs ${pillSurface}`}>
              <span className="font-semibold flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                Homework Step-by-Step Helper
              </span>
              <div className="flex items-center gap-1">
                {['1. Concept', '2. Formula', '3. Check'].map((label, idx) => (
                  <button
                    key={label}
                    onClick={() => {
                      setHomeworkHintStep(idx + 1);
                      askAssistant(`Give me ${label} hint for my homework without giving away the final answer.`);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition ${
                      homeworkHintStep === idx + 1 ? pillButtonActive : pillButtonIdle
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {(Array.isArray(currentLangObj.quickPrompts) ? currentLangObj.quickPrompts : []).map((qp, i) => (
              <button
                key={i}
                onClick={() => askAssistant(qp)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-xl transition hover:scale-105 ${pillSurface}`}
              >
                ✨ {qp}
              </button>
            ))}
          </div>

          <div
            className={`max-h-44 overflow-y-auto space-y-2 p-3.5 rounded-3xl backdrop-blur-2xl border ${
              isLight
                ? 'bg-white/90 border-stone-900/15 text-stone-900 shadow-xl'
                : 'bg-slate-950/85 border-white/15 text-slate-100 shadow-2xl'
            }`}
          >
            {messages.slice(-3).map((m) => (
              <div
                key={m.id}
                className={`p-2.5 rounded-2xl text-xs leading-relaxed font-medium ${
                  m.role === 'user'
                    ? isLight
                      ? 'bg-stone-900 text-stone-50 ml-8'
                      : 'bg-sky-500/25 text-white ml-8'
                    : isLight
                    ? 'bg-stone-100 text-stone-900 mr-6 border border-stone-900/10'
                    : 'bg-white/10 text-slate-100 mr-6'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">{m.text}</div>
                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 shrink-0 opacity-60 hover:opacity-100">
                      <button
                        onClick={() => speakWithEmotion(m.text, currentLang)}
                        title="Read Aloud"
                        className="p-1 rounded-full hover:bg-current/10"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      {m.pueUsed && m.pueUsed.length > 0 && (
                        <button
                          onClick={() => setShowWhyUsedId(showWhyUsedId === m.id ? null : m.id)}
                          title="Why did ED-H1 answer this way?"
                          className="p-1 rounded-full hover:bg-current/10"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {showWhyUsedId === m.id && m.pueUsed && (
                  <div className="mt-2 pt-1.5 border-t border-current/10 flex items-center justify-between text-[10px] opacity-75">
                    <span>Tailored using: {m.pueUsed.join(' • ')}</span>
                    <button
                      onClick={() => {
                        setSettingsTab('memory');
                        setShowSettings(true);
                      }}
                      className="underline font-semibold ml-2 shrink-0"
                    >
                      Edit Memory
                    </button>
                  </div>
                )}
              </div>
            ))}

            {searchResults.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                <span className="opacity-60">Verified Sources:</span>
                {searchResults.map((s, i) => (
                  <a
                    key={i}
                    href={s.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 underline"
                  >
                    {s.title}
                  </a>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              askAssistant(inputQuery);
            }}
            className={`flex items-center gap-2 backdrop-blur-2xl border rounded-full px-3 py-1.5 ${
              isLight
                ? 'bg-white/95 border-stone-900/20 text-stone-900 shadow-lg'
                : 'bg-slate-900/90 border-white/20 text-white shadow-xl'
            }`}
          >
            <button
              type="button"
              onClick={toggleMicInput}
              title="Speak with Microphone"
              className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                isListeningMic
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-current/10 opacity-75 hover:opacity-100'
              }`}
            >
              {isListeningMic ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={
                isListeningMic
                  ? 'Listening... speak now'
                  : `Talk in ${currentLangObj.name} or tell me what you prefer...`
              }
              className={`bg-transparent border-0 outline-none text-xs font-medium w-full ${
                isLight ? 'text-stone-900 placeholder-stone-500' : 'text-white placeholder-slate-400'
              }`}
            />
            <button
              type="submit"
              className={`w-7 h-7 rounded-full flex items-center justify-center transition ${pillButtonActive}`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          if (audioRef.current && audioRef.current.src) {
            setMusicStatus('Playback error: the audio could not be loaded.');
            setIsPlaying(false);
          }
        }}
      />

      {mode === 'music' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`fixed bottom-20 inset-x-4 z-20 max-w-md mx-auto flex flex-col gap-2.5 pointer-events-auto p-4 rounded-3xl backdrop-blur-2xl border ${
            isLight
              ? 'bg-white/90 border-stone-900/15 text-stone-900 shadow-xl'
              : 'bg-slate-950/85 border-white/15 text-slate-100 shadow-2xl'
          }`}
        >
          <form onSubmit={handleMusicSearch} className="flex items-center gap-2">
            <Music className="w-5 h-5 text-red-500 shrink-0" />
            <input
              type="text"
              value={ytQuery}
              onChange={(e) => setYtQuery(e.target.value)}
              placeholder="Play lofi, flute ragas, gurbani, or rain sounds..."
              className={`border rounded-full px-3.5 py-1.5 text-xs font-medium outline-none w-full ${
                isLight
                  ? 'bg-stone-100 border-stone-900/15 text-stone-900 placeholder-stone-500'
                  : 'bg-white/10 border-white/15 text-white placeholder-slate-400'
              }`}
            />
            <button
              type="submit"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${pillButtonActive}`}
            >
              Play
            </button>
          </form>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{activeStream.title}</div>
              <div className="text-[11px] opacity-75 truncate">
                {activeStream.channel} &bull; {activeStream.category}
              </div>
              {musicStatus && (
                <div className="text-[11px] opacity-60 truncate">{musicStatus}</div>
              )}
            </div>
            <button
              onClick={() => {
                setIsPlaying(!isPlaying);
                setMoodKey(!isPlaying ? 'vibe' : 'joy');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 ${pillButtonActive}`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {customStreams.map((st, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveStream(st);
                  setIsPlaying(true);
                  setMoodKey('vibe');
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                  activeStream.title === st.title ? pillButtonActive : pillButtonIdle
                }`}
              >
                🎵 {st.title.slice(0, 24)}...
              </button>
            ))}
          </div>
        </div>
      )}

      <EdhOverlay mode={mode} isLight={isLight} speechLang={currentLangObj.voiceCode} />

      <div
        onClick={(e) => e.stopPropagation()}
        className={`fixed bottom-5 z-30 max-w-[calc(100vw-12px)] transition-all duration-700 ${
          uiIdle && !showSettings
            ? 'opacity-10 scale-95 hover:opacity-100 hover:scale-100'
            : 'opacity-100 scale-100'
        }`}
      >
        <div className={`flex items-center gap-1 p-1.5 rounded-full backdrop-blur-2xl border max-w-full overflow-x-auto [scrollbar-width:none] ${pillSurface}`}>
          {[
            { id: 'companion', label: 'Face', icon: Smile },
            { id: 'voice', label: 'Talk', icon: Mic },
            { id: 'music', label: 'Music', icon: Music },
            { id: 'room', label: 'Room', icon: EdhUsers, compact: true },
            { id: 'games', label: 'Play', icon: EdhGamepad, compact: true },
            { id: 'media', label: 'Media', icon: EdhFilm, compact: true }
          ].map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  active ? pillButtonActive : pillButtonIdle
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className={active ? '' : 'hidden sm:inline'}>{item.label}</span>
              </button>
            );
          })}

          <div className="h-4 w-[1px] bg-current opacity-15 mx-0.5" />

          <button
            onClick={() => {
              setSettingsTab('istudio');
              setShowSettings(true);
            }}
            title="Open iStudio Avatar & Accessory Customizer"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showSettings && settingsTab === 'istudio' ? pillButtonActive : pillButtonIdle
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">iStudio</span>
          </button>

          <button
            onClick={() => handleLanguageChange(nextLangCode)}
            title="Switch Language (English / Hindi / Punjabi)"
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${pillButtonIdle}`}
          >
            <Languages className="w-3.5 h-3.5 text-emerald-500" />
            <span>{currentLangObj.short}</span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            title="Personalize ED-H1"
            className={`relative p-2 rounded-full transition-all ${
              showSettings ? pillButtonActive : pillButtonIdle
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {provisionalCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex justify-end transition-opacity"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md h-full p-6 overflow-y-auto flex flex-col justify-between border-l shadow-2xl transition-transform ${
              isLight
                ? 'bg-[#FAF6EE]/95 border-stone-900/15 text-stone-900'
                : 'bg-[#0B0F17]/95 border-white/15 text-slate-100'
            }`}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-current/10 pb-3.5">
                <div>
                  <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    ED-H1 iStudio &amp; Companion Hub
                  </h2>
                  <p className="text-xs opacity-65">
                    iStudio customizer, autonomous traits, personal memory &amp; family profiles
                  </p>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 rounded-full bg-current/10 flex items-center justify-center hover:bg-current/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div
                className={`grid gap-1 p-1 rounded-2xl bg-current/5 border border-current/10 text-[11px] font-semibold ${
                  advancedMode ? 'grid-cols-5' : 'grid-cols-4'
                }`}
              >
                {visibleTabs.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSettingsTab(t.id)}
                      className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all ${
                        settingsTab === t.id ? pillButtonActive : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {settingsTab === 'istudio' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-sky-500/15 border border-current/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        iStudio Character Workshop
                      </div>
                      <p className="text-[10px] opacity-70 mt-0.5">
                        Mix hats, glasses, neckwear, cheek art, props &amp; proportions
                      </p>
                    </div>
                    <button
                      onClick={randomizeStudioLook}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition ${pillButtonActive}`}
                    >
                      🎲 Surprise Me
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: 'presets', label: '✨ Themes' },
                      { id: 'head', label: '👑 Headwear' },
                      { id: 'eyes', label: '👓 Eyewear' },
                      { id: 'neck', label: '🧣 Neck & Cheek' },
                      { id: 'props', label: '🪄 Props & Aura' },
                      { id: 'tuning', label: '🎚️ Tuning' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setStudioCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition ${
                          studioCategory === cat.id
                            ? pillButtonActive
                            : 'border-current/15 opacity-75 hover:opacity-100'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {studioCategory === 'presets' && (
                    <div className="grid grid-cols-2 gap-2">
                      {STUDIO_PRESETS.map((pr) => (
                        <button
                          key={pr.id}
                          onClick={() => applyStudioPreset(pr)}
                          className="p-3 rounded-2xl border border-current/15 hover:border-amber-500/60 bg-current/5 text-left transition flex items-center gap-2.5"
                        >
                          <span className="text-2xl">{pr.icon}</span>
                          <div>
                            <div className="text-xs font-bold">{pr.name}</div>
                            <div className="text-[10px] opacity-65">1-Tap Full Outfit</div>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() =>
                          applyStudioPreset({
                            headwear: 'none',
                            eyewear: 'none',
                            neckwear: 'none',
                            cheek: 'none',
                            prop: 'none',
                            aura: 'none'
                          })
                        }
                        className="col-span-2 py-2 rounded-xl border border-current/15 text-[11px] font-semibold opacity-75 hover:opacity-100"
                      >
                        Reset All Accessories to Pure Minimalist Face
                      </button>
                    </div>
                  )}

                  {studioCategory === 'head' && (
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                      {HEADWEAR_ITEMS.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setHeadwear(item.id)}
                          className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 text-xs font-semibold transition ${
                            headwear === item.id
                              ? 'border-amber-500 bg-amber-500/15'
                              : 'border-current/15 hover:bg-current/5'
                          }`}
                        >
                          <span className="text-xl">{item.icon}</span>
                          <span className="text-[11px] truncate">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {studioCategory === 'eyes' && (
                    <div className="grid grid-cols-2 gap-2">
                      {EYEWEAR_ITEMS.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setEyewear(item.id)}
                          className={`p-2.5 rounded-2xl border flex items-center gap-2.5 text-xs font-semibold transition ${
                            eyewear === item.id
                              ? 'border-amber-500 bg-amber-500/15'
                              : 'border-current/15 hover:bg-current/5'
                          }`}
                        >
                          <span className="text-xl">{item.icon}</span>
                          <span className="truncate">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {studioCategory === 'neck' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider opacity-60 block mb-2">
                          Neckwear &amp; Collars
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {NECKWEAR_ITEMS.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setNeckwear(item.id)}
                              className={`p-2 rounded-2xl border flex flex-col items-center gap-1 text-xs font-semibold transition ${
                                neckwear === item.id
                                  ? 'border-amber-500 bg-amber-500/15'
                                  : 'border-current/15 hover:bg-current/5'
                              }`}
                            >
                              <span className="text-lg">{item.icon}</span>
                              <span className="text-[10px] truncate">{item.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider opacity-60 block mb-2">
                          Cheek Markings &amp; Stickers
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {CHEEK_MARKINGS.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setCheekArt(item.id)}
                              className={`p-2 rounded-2xl border flex flex-col items-center gap-1 text-xs font-semibold transition ${
                                cheekArt === item.id
                                  ? 'border-rose-500 bg-rose-500/15'
                                  : 'border-current/15 hover:bg-current/5'
                              }`}
                            >
                              <span className="text-lg">{item.icon}</span>
                              <span className="text-[10px] truncate">{item.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {studioCategory === 'props' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider opacity-60 block mb-2">
                          Held Hand Props
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {PROP_ITEMS.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                setHandProp(item.id);
                                setShowHands(true);
                                triggerWave();
                              }}
                              className={`p-2 rounded-2xl border flex items-center gap-2 text-xs font-semibold transition ${
                                handProp === item.id
                                  ? 'border-emerald-500 bg-emerald-500/15'
                                  : 'border-current/15 hover:bg-current/5'
                              }`}
                            >
                              <span className="text-lg">{item.icon}</span>
                              <span className="truncate text-[11px]">{item.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider opacity-60 block mb-2">
                          Ambient Particle Aura
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {AURA_EFFECTS.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setAuraEffect(item.id)}
                              className={`p-2 rounded-2xl border flex flex-col items-center gap-1 text-xs font-semibold transition ${
                                auraEffect === item.id
                                  ? 'border-sky-500 bg-sky-500/15'
                                  : 'border-current/15 hover:bg-current/5'
                              }`}
                            >
                              <span className="text-lg">{item.icon}</span>
                              <span className="text-[10px] truncate">{item.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {studioCategory === 'tuning' && (
                    <div className="space-y-3 p-3 rounded-2xl bg-current/5 border border-current/10">
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span>Eye Size Proportion</span>
                          <span>{Math.round(eyeSizeScale * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.8"
                          max="1.25"
                          step="0.05"
                          value={eyeSizeScale}
                          onChange={(e) => setEyeSizeScale(parseFloat(e.target.value))}
                          className="w-full accent-amber-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span>Cheek Blush Warmth</span>
                          <span>{Math.round(blushIntensity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={blushIntensity}
                          onChange={(e) => setBlushIntensity(parseFloat(e.target.value))}
                          className="w-full accent-rose-500"
                        />
                      </div>

                      <div className="pt-2 border-t border-current/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold">Autonomous Free Will (Morph &amp; Emote)</div>
                            <div className="text-[10px] opacity-65">
                              ED-H1 shifts between Face &amp; Ghost Form on its own whim
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={freeWillActive}
                            onChange={(e) => setFreeWillActive(e.target.checked)}
                            className="accent-emerald-500 w-4 h-4"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium opacity-80">Expressive Floating Hands</span>
                          <input
                            type="checkbox"
                            checked={showHands}
                            onChange={(e) => setShowHands(e.target.checked)}
                            className="accent-emerald-500 w-4 h-4"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium opacity-80">Autonomous Screen Glide</span>
                          <input
                            type="checkbox"
                            checked={freeRoam}
                            onChange={(e) => setFreeRoam(e.target.checked)}
                            className="accent-emerald-500 w-4 h-4"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={triggerWave}
                    className={`w-full py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition ${pillButtonActive}`}
                  >
                    <Hand className="w-4 h-4" />
                    <span>Test Speech &amp; Hand Wave!</span>
                  </button>
                </div>
              )}

              {settingsTab === 'look' && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider opacity-60 block mb-2.5">
                      Companion Skin &amp; Material
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {WINDOWS.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => setWindowId(w.id)}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            windowId === w.id
                              ? 'border-amber-500 bg-amber-500/10 font-bold'
                              : 'border-current/15 hover:bg-current/5'
                          }`}
                        >
                          <div className="text-xs">{w.name}</div>
                          <div className="text-[10px] opacity-60 mt-0.5 capitalize">{w.type} Finish</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider opacity-60 block mb-2.5">
                      Plush Color Palette
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {PLUSH_SWATCHES.map((sw) => (
                        <button
                          key={sw.name}
                          onClick={() => {
                            setWindowId('custom_plush');
                            setCustomColors(sw);
                          }}
                          className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-semibold transition ${
                            windowId === 'custom_plush' && customColors.name === sw.name
                              ? 'border-stone-900 bg-stone-900/10'
                              : 'border-current/15'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: sw.skin }}
                          />
                          <span className="truncate text-[11px]">{sw.name.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider opacity-60 block mb-2.5">
                      Current Mood
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.values(MOODS).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setMoodKey(m.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                            moodKey === m.id ? pillButtonActive : 'border-current/15 hover:bg-current/5'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'memory' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-2xl bg-current/5 border border-current/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-emerald-500" />
                        What ED-H1 Remembers
                      </div>
                      <p className="text-[10px] opacity-65 mt-0.5">
                        Saved privately on your device &bull; {pueLearningPaused ? 'Paused' : 'Learning Active'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPueLearningPaused(!pueLearningPaused)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1 border ${
                          pueLearningPaused
                            ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                            : 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                        }`}
                      >
                        {pueLearningPaused ? <PlayCircle className="w-3 h-3" /> : <PauseCircle className="w-3 h-3" />}
                        <span>{pueLearningPaused ? 'Resume' : 'Pause'}</span>
                      </button>
                      <button
                        onClick={exportPueProfile}
                        title="Backup Memory"
                        className="p-1.5 rounded-xl border border-current/15 hover:bg-current/10"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {activeProfile === 'parent' && (
                    <div className="p-3 rounded-2xl bg-current/5 border border-current/10 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                        Active Project Continuity (ED-H1)
                      </div>
                      <div className="space-y-1.5">
                        {projectTasks.map((task) => (
                          <label
                            key={task.id}
                            onClick={() => toggleProjectTask(task.id)}
                            className="flex items-center gap-2 text-xs cursor-pointer hover:opacity-90"
                          >
                            <input
                              type="checkbox"
                              checked={task.done}
                              onChange={() => {}}
                              className="accent-emerald-500 rounded"
                            />
                            <span className={task.done ? 'line-through opacity-55' : ''}>{task.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={addExplicitMemory} className="space-y-2 p-3 rounded-2xl bg-current/5 border border-current/10">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                        Teach ED-H1 a Preference
                      </label>
                      {advancedMode && (
                        <select
                          value={newMemoryScope}
                          onChange={(e) => setNewMemoryScope(e.target.value)}
                          className="text-[10px] font-semibold rounded-lg px-2 py-0.5 bg-black/20 border border-current/15 outline-none"
                        >
                          <option value="global">Global</option>
                          <option value="technical_work">Technical Work</option>
                          <option value="active_project">Project</option>
                          <option value="family_care">Family Care</option>
                        </select>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newMemoryInput}
                        onChange={(e) => setNewMemoryInput(e.target.value)}
                        placeholder="e.g., Give me step-by-step explanations..."
                        className="w-full rounded-xl px-3 py-1.5 text-xs bg-black/10 border border-current/15 outline-none"
                      />
                      <button
                        type="submit"
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 ${pillButtonActive}`}
                      >
                        <Plus className="w-3.5 h-3.5" /> Save
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {pueMemories.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-2xl border text-xs space-y-1 transition ${
                          m.status === 'provisional'
                            ? 'border-amber-500/40 bg-amber-500/5'
                            : 'border-current/15 bg-current/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {m.status === 'confirmed' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                            <span className="font-semibold text-[11px] opacity-75">
                              {m.status === 'provisional' ? 'Thing ED-H1 Noticed' : 'Saved Preference'}
                              {advancedMode ? ` • ${m.scope} (${Math.round(m.confidence * 100)}%)` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {m.status === 'provisional' && (
                              <button
                                onClick={() => confirmPueMemory(m.id)}
                                className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-500 text-[10px] font-bold hover:bg-emerald-500/30"
                              >
                                Keep
                              </button>
                            )}
                            <button
                              onClick={() => deletePueMemory(m.id)}
                              title="Forget this"
                              className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="leading-relaxed opacity-90">{m.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {settingsTab === 'family' && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider opacity-60 block mb-2.5">
                      Who is using ED-H1?
                    </label>
                    <div className="space-y-2">
                      {FAMILY_PROFILES.map((prof) => (
                        <button
                          key={prof.id}
                          onClick={() => {
                            setActiveProfile(prof.id);
                            handleLanguageChange(prof.defaultLang);
                          }}
                          className={`w-full p-3 rounded-2xl border text-left transition-all ${
                            activeProfile === prof.id
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-current/15 hover:bg-current/5'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{prof.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 font-semibold">
                              {prof.badge}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-70 mt-1 leading-relaxed">{prof.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-current/5 border border-current/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                        Homework Hint Mode (No Direct Answers)
                      </span>
                      <input
                        type="checkbox"
                        checked={socraticMode}
                        onChange={(e) => setSocraticMode(e.target.checked)}
                        className="accent-emerald-500 w-4 h-4"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium opacity-80">School Syllabus Sync</span>
                      <input
                        type="checkbox"
                        checked={digiIdLinked}
                        onChange={(e) => setDigiIdLinked(e.target.checked)}
                        className="accent-emerald-500 w-4 h-4"
                      />
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'system' && advancedMode && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-current/5 border border-current/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                        Local AI Model Adapter
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 font-semibold">
                        {ollamaStatus}
                      </span>
                    </div>
                    <div>
                      <label className="text-[11px] opacity-65 block mb-1">Local Endpoint (Ollama / llama.cpp)</label>
                      <input
                        type="text"
                        value={ollamaHost}
                        onChange={(e) => setOllamaHost(e.target.value)}
                        className="w-full rounded-xl px-3 py-1.5 text-xs font-mono bg-black/15 border border-current/15 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] opacity-65 block mb-1">Model Name</label>
                      <input
                        type="text"
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        className="w-full rounded-xl px-3 py-1.5 text-xs font-mono bg-black/15 border border-current/15 outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-current/5 border border-current/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                          Strict Offline Mode
                        </div>
                        <p className="text-[11px] opacity-65 mt-0.5">
                          Disables external web fallback; runs 100% locally.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={privacyLocalOnly}
                        onChange={(e) => setPrivacyLocalOnly(e.target.checked)}
                        className="accent-amber-500 w-4 h-4 shrink-0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-current/10 flex items-center justify-between text-[11px]">
              <span className="opacity-55">ED-H1 Companion OS</span>
              <button
                onClick={() => {
                  const next = !advancedMode;
                  setAdvancedMode(next);
                  if (!next && settingsTab === 'system') setSettingsTab('istudio');
                }}
                className={`px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold transition ${
                  advancedMode ? 'bg-amber-500/20 text-amber-500' : 'opacity-50 hover:opacity-90'
                }`}
              >
                <Wrench className="w-3 h-3" />
                <span>{advancedMode ? 'Builder Mode: ON' : 'Builder Mode'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}