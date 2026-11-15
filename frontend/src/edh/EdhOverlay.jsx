import React, { useEffect, useMemo, useState } from 'react';
import { ThemeCtx, makeTheme } from './ui.jsx';
import RoomScreen from './RoomScreen.jsx';
import GamesScreen from './GamesScreen.jsx';
import MediaScreen from './MediaScreen.jsx';

const SCREENS = ['room', 'games', 'media'];

// Sits on top of the main face, under the bottom pill navigation. Screens are created the first time
// you open them and then stay mounted, so chats, games and videos keep their state when you switch.
export default function EdhOverlay({ mode, isLight, speechLang }) {
  const theme = useMemo(() => makeTheme(isLight), [isLight]);
  const [seen, setSeen] = useState({});
  useEffect(() => {
    if (SCREENS.includes(mode)) setSeen((s) => (s[mode] ? s : { ...s, [mode]: true }));
  }, [mode]);
  const open = SCREENS.includes(mode);
  return (
    <ThemeCtx.Provider value={theme}>
      <div
        onClick={(e) => e.stopPropagation()}
        aria-hidden={!open}
        className={`fixed inset-0 z-20 overflow-y-auto px-3 pt-4 pb-28 ${theme.page} ${open ? '' : 'hidden'}`}
      >
        <div className={mode === 'room' ? '' : 'hidden'}>{seen.room && <RoomScreen active={mode === 'room'} speechLang={speechLang} />}</div>
        <div className={mode === 'games' ? '' : 'hidden'}>{seen.games && <GamesScreen active={mode === 'games'} />}</div>
        <div className={mode === 'media' ? '' : 'hidden'}>{seen.media && <MediaScreen active={mode === 'media'} />}</div>
      </div>
    </ThemeCtx.Provider>
  );
}
