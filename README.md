# MusicCreator

Desktop DAW (Digital Audio Workstation) built with Electron and React. A browser-based music production environment with a Python audio processing backend.

---

## Features

- Multi-track audio editing and arrangement
- Real-time waveform visualization
- Audio effects and processing via Python backend
- Native desktop experience (Electron)
- Cross-platform: Windows, macOS, Linux

## Stack

| Layer | Technology |
|-------|-----------|
| UI | React + Vite |
| Desktop shell | Electron |
| Audio backend | Python (FastAPI + uvicorn) |

## Getting Started

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && pip install -r requirements.txt && cd ..

# Run in development mode (Electron + React + Python backend)
npm run start          # launches Electron + React (port 3000)
npm run backend        # start Python audio server (port 8000)
```

## Build

```bash
npm run build
```

Outputs a distributable desktop app via `electron-builder`.
