# ED-H1 - status (11 Nov 2026)

## Done and working
- Talk, mic, Music (yt-dlp), launcher/installer scripts, app-style window, ED-H1 logo.
- Multi-character engine: characters, per-character memory, shared memory, relationships,
  group chat + character-to-character talk (turn caps, PASS, cancel), autonomy (off by default).
- Room / Play / Media screens added to the existing pill navigation (same cream theme).
  - Room: draggable characters, 8 backgrounds, avatar customization (iStudio items), per-character voice,
    chat, group chat, memory viewer, autonomy settings, activity badges (real activity only).
  - Play: Tic-Tac-Toe, Sudoku, Scrabble with adaptive levels, points, badges.
  - Media: video player (local files / direct links), document upload + Q&A with per-character access.

## Tests (run in backend folder)
python tests_agents.py (35) | python tests_games.py (37) | python tests_files.py (14)

## Not yet verified on your PC
Real Ollama replies through the new routes, real PDF files, image understanding (needs: ollama pull llava),
Scrabble word list download (needs internet once), voices installed in Windows.

## Known limits
- Group replies arrive after the whole run finishes (not streamed); slow on CPU.
- Characters cannot see video frames; you describe what is happening.
- Scrabble AI only plays through existing tiles; word list quality depends on words.txt.

## Next
1. Clean-PC install test. 2. Setup.exe. 3. GPU driver fix. 4. Streaming group replies.
5. Local speech (Whisper) + Hindi/Punjabi TTS. 6. Android/iOS app.
