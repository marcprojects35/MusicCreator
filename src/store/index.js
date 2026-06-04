import { configureStore, createSlice } from '@reduxjs/toolkit'
import { v4 as uuid } from 'uuid'

// ─── PROJECT SLICE ────────────────────────────────────────────────────────────
const projectSlice = createSlice({
  name: 'project',
  initialState: {
    id: null, name: 'Untitled Project', bpm: 120, key: 'C', scale: 'major',
    tracks: [], duration: 0, saved: true, history: [], historyIndex: -1
  },
  reducers: {
    newProject: (state) => {
      state.id = uuid(); state.name = 'Untitled Project'; state.bpm = 120
      state.tracks = []; state.saved = false
    },
    setProjectName: (state, a) => { state.name = a.payload; state.saved = false },
    setBpm: (state, a) => { state.bpm = Math.max(20, Math.min(999, a.payload)) },
    setKey: (state, a) => { state.key = a.payload },
    setScale: (state, a) => { state.scale = a.payload },
    addTrack: (state, a) => {
      state.tracks.push({
        id: uuid(), name: a.payload?.name || 'Track', type: a.payload?.type || 'audio',
        volume: 1, pan: 0, mute: false, solo: false, armed: false,
        color: a.payload?.color || '#3b82f6', clips: [], effects: []
      })
    },
    removeTrack: (state, a) => { state.tracks = state.tracks.filter(t => t.id !== a.payload) },
    updateTrack: (state, a) => {
      const t = state.tracks.find(t => t.id === a.payload.id)
      if (t) Object.assign(t, a.payload.changes)
    },
    addClipToTrack: (state, a) => {
      const t = state.tracks.find(t => t.id === a.payload.trackId)
      if (t) t.clips.push({ id: uuid(), ...a.payload.clip })
    },
    removeClip: (state, a) => {
      state.tracks.forEach(t => { t.clips = t.clips.filter(c => c.id !== a.payload) })
    },
    addEffectToTrack: (state, a) => {
      const t = state.tracks.find(t => t.id === a.payload.trackId)
      if (t) t.effects.push({ id: uuid(), enabled: true, ...a.payload.effect })
    },
    removeEffect: (state, a) => {
      state.tracks.forEach(t => { t.effects = t.effects.filter(e => e.id !== a.payload) })
    },
    updateEffect: (state, a) => {
      state.tracks.forEach(t => {
        const e = t.effects.find(e => e.id === a.payload.id)
        if (e) Object.assign(e, a.payload.changes)
      })
    },
    setSaved: (state, a) => { state.saved = a.payload }
  }
})

// ─── PLAYBACK SLICE ───────────────────────────────────────────────────────────
const playbackSlice = createSlice({
  name: 'playback',
  initialState: {
    playing: false, recording: false, looping: false,
    currentTime: 0, loopStart: 0, loopEnd: 4, metronome: false, volume: 1
  },
  reducers: {
    play: (state) => { state.playing = true },
    pause: (state) => { state.playing = false },
    stop: (state) => { state.playing = false; state.currentTime = 0 },
    toggleRecording: (state) => { state.recording = !state.recording },
    toggleLoop: (state) => { state.looping = !state.looping },
    toggleMetronome: (state) => { state.metronome = !state.metronome },
    setCurrentTime: (state, a) => { state.currentTime = a.payload },
    setLoopPoints: (state, a) => { state.loopStart = a.payload.start; state.loopEnd = a.payload.end },
    setVolume: (state, a) => { state.volume = a.payload }
  }
})

// ─── UI SLICE ─────────────────────────────────────────────────────────────────
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    activeView: 'timeline', showLibrary: true, showMixer: true, showEffects: false,
    theme: 'dark', selectedTrackId: null, selectedClipId: null, zoom: 1,
    notifications: [], modalOpen: null
  },
  reducers: {
    setView: (state, a) => { state.activeView = a.payload },
    toggleLibrary: (state) => { state.showLibrary = !state.showLibrary },
    toggleMixer: (state) => { state.showMixer = !state.showMixer },
    toggleEffects: (state) => { state.showEffects = !state.showEffects },
    setTheme: (state, a) => { state.theme = a.payload },
    selectTrack: (state, a) => { state.selectedTrackId = a.payload },
    selectClip: (state, a) => { state.selectedClipId = a.payload },
    setZoom: (state, a) => { state.zoom = Math.max(0.1, Math.min(10, a.payload)) },
    addNotification: (state, a) => {
      state.notifications.push({ id: uuid(), ...a.payload })
      if (state.notifications.length > 5) state.notifications.shift()
    },
    removeNotification: (state, a) => {
      state.notifications = state.notifications.filter(n => n.id !== a.payload)
    },
    openModal: (state, a) => { state.modalOpen = a.payload },
    closeModal: (state) => { state.modalOpen = null }
  }
})

// ─── BEAT MAKER SLICE ─────────────────────────────────────────────────────────
const beatMakerSlice = createSlice({
  name: 'beatMaker',
  initialState: {
    steps: 16, swing: 0, patterns: {},
    currentPattern: 'Pattern 1',
    rows: [
      { id: 'kick', name: 'Kick', sample: 'kick_808.wav', volume: 1, steps: new Array(16).fill(false) },
      { id: 'snare', name: 'Snare', sample: 'snare_trap.wav', volume: 0.9, steps: new Array(16).fill(false) },
      { id: 'hihat', name: 'Hi-Hat', sample: 'hihat_closed.wav', volume: 0.7, steps: new Array(16).fill(false) },
      { id: 'clap', name: 'Clap', sample: 'clap_808.wav', volume: 0.8, steps: new Array(16).fill(false) },
      { id: 'openhat', name: 'Open Hat', sample: 'hihat_open.wav', volume: 0.6, steps: new Array(16).fill(false) },
      { id: 'perc', name: 'Perc', sample: 'perc_01.wav', volume: 0.7, steps: new Array(16).fill(false) }
    ]
  },
  reducers: {
    toggleStep: (state, a) => {
      const row = state.rows.find(r => r.id === a.payload.rowId)
      if (row) row.steps[a.payload.step] = !row.steps[a.payload.step]
    },
    setSteps: (state, a) => {
      state.steps = a.payload
      state.rows.forEach(r => {
        while (r.steps.length < a.payload) r.steps.push(false)
        r.steps = r.steps.slice(0, a.payload)
      })
    },
    setSwing: (state, a) => { state.swing = a.payload },
    setRowVolume: (state, a) => {
      const row = state.rows.find(r => r.id === a.payload.rowId)
      if (row) row.volume = a.payload.volume
    },
    setRowSample: (state, a) => {
      const row = state.rows.find(r => r.id === a.payload.rowId)
      if (row) row.sample = a.payload.sample
    },
    addRow: (state, a) => {
      state.rows.push({ id: uuid(), name: a.payload.name, sample: '', volume: 1, steps: new Array(state.steps).fill(false) })
    },
    removeRow: (state, a) => { state.rows = state.rows.filter(r => r.id !== a.payload) },
    clearPattern: (state) => { state.rows.forEach(r => r.steps.fill(false)) },
    randomizePattern: (state) => { state.rows.forEach(r => r.steps = r.steps.map(() => Math.random() > 0.75)) },
    savePattern: (state, a) => { state.patterns[a.payload] = JSON.parse(JSON.stringify(state.rows)) },
    loadPattern: (state, a) => { if (state.patterns[a.payload]) state.rows = state.patterns[a.payload] }
  }
})

// ─── LIBRARY SLICE ────────────────────────────────────────────────────────────
const librarySlice = createSlice({
  name: 'library',
  initialState: {
    samples: [], favorites: [], recent: [],
    filter: { category: 'all', genre: 'all', bpm: null, search: '' }
  },
  reducers: {
    setSamples: (state, a) => { state.samples = a.payload },
    toggleFavorite: (state, a) => {
      if (state.favorites.includes(a.payload)) state.favorites = state.favorites.filter(f => f !== a.payload)
      else state.favorites.push(a.payload)
    },
    addRecent: (state, a) => {
      state.recent = [a.payload, ...state.recent.filter(r => r !== a.payload)].slice(0, 20)
    },
    setFilter: (state, a) => { state.filter = { ...state.filter, ...a.payload } }
  }
})

// ─── VOICE SLICE ──────────────────────────────────────────────────────────────
const voiceSlice = createSlice({
  name: 'voice',
  initialState: {
    isRecording: false, takes: [], selectedTake: null,
    effects: {
      autotune: { enabled: false, intensity: 0.8, speed: 'fast', style: 'natural' },
      pitchShift: { enabled: false, semitones: 0, formantShift: 0 },
      reverb: { enabled: false, type: 'room', wetDry: 0.3, size: 0.5 },
      delay: { enabled: false, time: 250, feedback: 0.3, wetDry: 0.3 },
      compressor: { enabled: false, threshold: -20, ratio: 4, attack: 10, release: 100 },
      eq: { enabled: false, low: 0, mid: 0, high: 0, presence: 0 },
      deBreath: { enabled: false, sensitivity: 0.5, mode: 'auto' },
      distortion: { enabled: false, type: 'soft', amount: 0.3 },
      chorus: { enabled: false, rate: 1.5, depth: 0.5, wetDry: 0.3 },
      deEsser: { enabled: false, frequency: 7000, threshold: -20 }
    }
  },
  reducers: {
    startRecording: (state) => { state.isRecording = true },
    stopRecording: (state) => { state.isRecording = false },
    addTake: (state, a) => { state.takes.push({ id: uuid(), ...a.payload }) },
    selectTake: (state, a) => { state.selectedTake = a.payload },
    removeTake: (state, a) => { state.takes = state.takes.filter(t => t.id !== a.payload) },
    updateEffect: (state, a) => {
      if (state.effects[a.payload.effect]) {
        state.effects[a.payload.effect] = { ...state.effects[a.payload.effect], ...a.payload.params }
      }
    },
    toggleEffect: (state, a) => {
      if (state.effects[a.payload]) state.effects[a.payload].enabled = !state.effects[a.payload].enabled
    }
  }
})

// ─── DJ SLICE ─────────────────────────────────────────────────────────────────
const djSlice = createSlice({
  name: 'dj',
  initialState: {
    deckA: { file: null, playing: false, volume: 1, rate: 1, bpm: null, cuePoints: [], loop: null, eq: { low: 0, mid: 0, high: 0 } },
    deckB: { file: null, playing: false, volume: 1, rate: 1, bpm: null, cuePoints: [], loop: null, eq: { low: 0, mid: 0, high: 0 } },
    crossfader: 0.5, masterVolume: 1, autoSync: false
  },
  reducers: {
    loadDeck: (state, a) => { state[a.payload.deck] = { ...state[a.payload.deck], ...a.payload.data } },
    toggleDeck: (state, a) => { state[a.payload].playing = !state[a.payload].playing },
    setDeckVolume: (state, a) => { state[a.payload.deck].volume = a.payload.volume },
    setDeckRate: (state, a) => { state[a.payload.deck].rate = a.payload.rate },
    setDeckEq: (state, a) => {
      state[a.payload.deck].eq = { ...state[a.payload.deck].eq, ...a.payload.eq }
    },
    setCrossfader: (state, a) => { state.crossfader = a.payload },
    setMasterVolume: (state, a) => { state.masterVolume = a.payload },
    toggleAutoSync: (state) => { state.autoSync = !state.autoSync },
    addCuePoint: (state, a) => { state[a.payload.deck].cuePoints.push(a.payload.time) }
  }
})

// ─── MIDI SLICE ───────────────────────────────────────────────────────────────
const midiSlice = createSlice({
  name: 'midi',
  initialState: {
    devices: [], activeDevice: null, notes: [], recording: false,
    quantization: '1/16', velocity: 100, octave: 4
  },
  reducers: {
    setDevices: (state, a) => { state.devices = a.payload },
    setActiveDevice: (state, a) => { state.activeDevice = a.payload },
    addNote: (state, a) => { state.notes.push({ id: uuid(), ...a.payload }) },
    removeNote: (state, a) => { state.notes = state.notes.filter(n => n.id !== a.payload) },
    updateNote: (state, a) => {
      const n = state.notes.find(n => n.id === a.payload.id)
      if (n) Object.assign(n, a.payload.changes)
    },
    clearNotes: (state) => { state.notes = [] },
    setQuantization: (state, a) => { state.quantization = a.payload },
    setOctave: (state, a) => { state.octave = Math.max(0, Math.min(9, a.payload)) },
    toggleRecording: (state) => { state.recording = !state.recording }
  }
})

// ─── STORE ────────────────────────────────────────────────────────────────────
export const store = configureStore({
  reducer: {
    project: projectSlice.reducer,
    playback: playbackSlice.reducer,
    ui: uiSlice.reducer,
    beatMaker: beatMakerSlice.reducer,
    library: librarySlice.reducer,
    voice: voiceSlice.reducer,
    dj: djSlice.reducer,
    midi: midiSlice.reducer
  }
})

export const projectActions = projectSlice.actions
export const playbackActions = playbackSlice.actions
export const uiActions = uiSlice.actions
export const beatMakerActions = beatMakerSlice.actions
export const libraryActions = librarySlice.actions
export const voiceActions = voiceSlice.actions
export const djActions = djSlice.actions
export const midiActions = midiSlice.actions
