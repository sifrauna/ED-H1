ED-H1 - your personal AI companion (runs on your own PC)
=========================================================

START
  Double-click "Start ED-H1.bat". Keep the black window open while you use ED-H1; close it to stop.
  The first start installs what is missing (Python, Ollama, the AI model) and needs internet. It can take a while.

WHAT YOU GET
  Talk (typing or microphone), Music (yt-dlp), Room (characters you can customise, group chat),
  Play (Tic-Tac-Toe, Sudoku, Scrabble) and Media (video player, document questions).

CHOOSING THE AI MODEL
  The model name is on the first line of launcher\model.txt (default: llama3.2:3b).
  If replies are slow or fail, try a smaller one: llama3.2:1b

IF SOMETHING GOES WRONG
  - Page shows "Not Found": the folder frontend\dist is missing. Use the release zip, or install Node.js and start again.
  - "Port 8000 is used": close the other program, then start ED-H1 again.
  - Music does not play: start ED-H1 again (it updates yt-dlp once a day).
  - Scrabble accepts any word: the word list could not be downloaded; it is retried at the next start.

CHECK YOUR FOLDER
  powershell -ExecutionPolicy Bypass -File .\Check-ED-H1.ps1
  Add -ForSharing before you zip it for someone else.

PRIVACY
  Your conversations, memories and uploaded files stay on this PC (backend\edh1_memory.db).
  Never share that file, backend\.venv or OllamaModels.
