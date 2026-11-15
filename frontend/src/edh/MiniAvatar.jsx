import React from 'react';

// Small plush-style face used for characters in the Room.
// RECONSTRUCTED from usage: <MiniAvatar look size speaking thinking /> plus SWATCHES, HEADWEAR, EYEWEAR.
// The item ids match the main avatar in App.jsx so a character can reuse the same look.

export const SWATCHES = [
  { name: 'Ivory Cream', skin: '#FAF6EE', edge: '#E8DEC8', eye: '#231F20', blush: '#F4978E' },
  { name: 'Matcha Mochi', skin: '#F0F4EC', edge: '#D5E0CD', eye: '#2C352D', blush: '#E5B8B7' },
  { name: 'Sakura Milk', skin: '#FDF2F4', edge: '#F7D9DE', eye: '#3B292E', blush: '#F4978E' },
  { name: 'Buttercup', skin: '#FEF9EC', edge: '#F7E9C4', eye: '#383020', blush: '#F5CD79' },
  { name: 'Taro Lavender', skin: '#F4F2F7', edge: '#DDD6E8', eye: '#312B3D', blush: '#D8B4E2' },
  { name: 'Sky Puffer', skin: '#F0F6FA', edge: '#D1E3F0', eye: '#1F2C38', blush: '#93C5FD' },
  { name: 'Terracotta', skin: '#FAF2EE', edge: '#EAD5CB', eye: '#3D2A24', blush: '#E0A996' }
];

export const HEADWEAR = [
  { id: 'none', name: 'None', icon: '✨' },
  { id: 'sprout', name: 'Leaf Sprout', icon: '🌱' },
  { id: 'crown', name: 'Tiny Crown', icon: '👑' },
  { id: 'bow', name: 'Ribbon Bow', icon: '🎀' },
  { id: 'halo', name: 'Glow Halo', icon: '😇' },
  { id: 'wizard', name: 'Wizard Hat', icon: '🧙' },
  { id: 'beret', name: 'Artist Beret', icon: '🎨' },
  { id: 'cat_ears', name: 'Neko Ears', icon: '🐱' },
  { id: 'antlers', name: 'Cozy Antlers', icon: '🦌' },
  { id: 'turban', name: 'Royal Turban', icon: '👳' },
  { id: 'flower_crown', name: 'Flora Crown', icon: '🌸' },
  { id: 'headphones', name: 'Headphones', icon: '🎧' }
];

export const EYEWEAR = [
  { id: 'none', name: 'None', icon: '⭕' },
  { id: 'round', name: 'Scholar Specs', icon: '👓' },
  { id: 'shades', name: 'Cool Shades', icon: '🕶️' },
  { id: 'star', name: 'Star Frames', icon: '⭐' },
  { id: 'monocle', name: 'Gentle Monocle', icon: '🧐' },
  { id: 'heart_glasses', name: 'Heart Shades', icon: '💖' },
  { id: 'cyber_visor', name: 'Holo Visor', icon: '🥽' }
];

const iconOf = (list, id) => (list.find((x) => x.id === id) || list[0]).icon;

export default function MiniAvatar({ look = {}, size = 96, speaking = false, thinking = false }) {
  const sw = SWATCHES.find((s) => s.name === look.swatch) || SWATCHES[0];
  const head = look.headwear && look.headwear !== 'none' ? iconOf(HEADWEAR, look.headwear) : null;
  const eyes = look.eyewear && look.eyewear !== 'none' ? iconOf(EYEWEAR, look.eyewear) : null;
  const eyeH = thinking ? 7 : 13;
  const mouth = speaking ? 'M38 66 Q50 80 62 66 Q50 72 38 66 Z' : 'M40 66 Q50 74 60 66';

  return (
    <div style={{ position: 'relative', width: size, height: size }} role="img" aria-label="Character avatar">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id={`edh-skin-${sw.name}`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor={sw.skin} />
            <stop offset="100%" stopColor={sw.edge} />
          </radialGradient>
        </defs>
        <circle cx="50" cy="54" r="38" fill={`url(#edh-skin-${sw.name})`} stroke={sw.edge} strokeWidth="1.5" />
        <ellipse cx="34" cy="50" rx="6.5" ry={eyeH / 2 + 5} fill={sw.eye} />
        <ellipse cx="66" cy="50" rx="6.5" ry={eyeH / 2 + 5} fill={sw.eye} />
        <circle cx="26" cy="62" r="5" fill={sw.blush} opacity="0.7" />
        <circle cx="74" cy="62" r="5" fill={sw.blush} opacity="0.7" />
        <path d={mouth} fill={speaking ? sw.eye : 'none'} stroke={sw.eye} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {head && <span style={{ position: 'absolute', left: '50%', top: -size * 0.04, transform: 'translateX(-50%)', fontSize: size * 0.34, lineHeight: 1 }}>{head}</span>}
      {eyes && <span style={{ position: 'absolute', left: '50%', top: size * 0.36, transform: 'translateX(-50%)', fontSize: size * 0.4, lineHeight: 1 }}>{eyes}</span>}
    </div>
  );
}
