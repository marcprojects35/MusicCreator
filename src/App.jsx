import React, { useEffect, useState, useCallback } from 'react'
import { Provider, useDispatch, useSelector } from 'react-redux'
import { store, uiActions, playbackActions, projectActions } from './store'
import BeatMaker from './components/BeatMaker/BeatMaker'
import VoiceEditor from './components/VoiceEditor/VoiceEditor'
import DJMixer from './components/DJMixer/DJMixer'
import Timeline from './components/Timeline/Timeline'
import PianoRoll from './components/MidiSequencer/PianoRoll'
import Mixer from './components/Mixer/Mixer'
import Library from './components/Library/Library'
import EffectsRack from './components/Effects/EffectsRack'
import StemSeparator from './components/StemSeparator/StemSeparator'
import Mastering from './components/Mastering/Mastering'
import Composition from './components/Composition/Composition'
import Analysis from './components/Analysis/Analysis'
import Collaboration from './components/Collaboration/Collaboration'
import Marketplace from './components/Marketplace/Marketplace'
import VoiceClone from './components/VoiceClone/VoiceClone'
import { useAudioEngine } from './hooks/useAudioEngine'
import * as Tone from 'tone'

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: 'timeline',     label: 'Timeline',     icon: '🎼', shortcut: 'F1' },
  { id: 'beatmaker',    label: 'Beat Maker',   icon: '🥁', shortcut: 'F2' },
  { id: 'voice',        label: 'Voice',        icon: '🎤', shortcut: 'F3' },
  { id: 'dj',           label: 'DJ Mixer',     icon: '🎧', shortcut: 'F4' },
  { id: 'midi',         label: 'Piano Roll',   icon: '🎹', shortcut: 'F5' },
  { id: 'mixer',        label: 'Mixer',        icon: '🎚', shortcut: 'F6' },
  { id: 'library',      label: 'Library',      icon: '📚', shortcut: 'F7' },
  { id: 'effects',      label: 'Effects',      icon: '✨', shortcut: 'F8' },
  { id: 'stems',        label: 'Stems',        icon: '🔀', shortcut: 'F9' },
  { id: 'mastering',    label: 'Mastering',    icon: '🎛️' },
  { id: 'composition',  label: 'Composition',  icon: '🎵' },
  { id: 'analysis',     label: 'Analysis',     icon: '📊' },
  { id: 'voiceclone',   label: 'Voice Clone',  icon: '🤖' },
  { id: 'collab',       label: 'Collab',       icon: '👥' },
  { id: 'marketplace',  label: 'Market',       icon: '🛍️' },
  { id: 'settings',     label: 'Settings',     icon: '⚙️' },
]

function Sidebar() {
  const dispatch = useDispatch()
  const activeView = useSelector(s => s.ui.activeView)

  return (
    <div style={{ width: 62, background: '#0d0d0d', borderRight: '1px solid #1f1f1f', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6, gap: 2, overflowY: 'auto', overflowX: 'hidden', flexShrink: 0 }}>
      <div style={{ fontSize: 18, marginBottom: 8 }}>🎵</div>
      {VIEWS.map(view => (
        <button key={view.id} title={`${view.label}${view.shortcut ? ` (${view.shortcut})` : ''}`}
          onClick={() => dispatch(uiActions.setView(view.id))}
          style={{ width: 46, height: 44, background: activeView === view.id ? '#1e3a5f' : 'transparent', border: `1px solid ${activeView === view.id ? '#3b82f6' : 'transparent'}`, borderRadius: 9, cursor: 'pointer', fontSize: 18, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {view.icon}
        </button>
      ))}
    </div>
  )
}

// ─── TITLE BAR ────────────────────────────────────────────────────────────────
function TitleBar() {
  const projectName = useSelector(s => s.project.name)
  const saved = useSelector(s => s.project.saved)
  const minimize = () => window.electronAPI?.minimize()
  const maximize = () => window.electronAPI?.maximize()
  const close = () => window.electronAPI?.close()
  return (
    <div style={{ height: 36, background: '#0d0d0d', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', paddingLeft: 16, WebkitAppRegion: 'drag', userSelect: 'none', flexShrink: 0 }}>
      <span style={{ fontSize: 13, color: '#888', flex: 1 }}>
        Music Creator Pro — <span style={{ color: '#fff' }}>{projectName}</span>
        {!saved && <span style={{ color: '#f59e0b', marginLeft: 6 }}>●</span>}
      </span>
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        {[['minimize', '─', '#888'], ['maximize', '□', '#888'], ['close', '✕', '#ef4444']].map(([action, icon, color]) => (
          <button key={action} onClick={() => ({ minimize, maximize, close }[action])()}
            style={{ width: 46, height: 36, background: 'transparent', border: 'none', color, cursor: 'pointer', fontSize: 14, transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = action === 'close' ? '#ef444433' : '#ffffff22'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── TRANSPORT BAR ────────────────────────────────────────────────────────────
function TransportBar() {
  const dispatch = useDispatch()
  const { playing, recording, looping, metronome, currentTime } = useSelector(s => s.playback)
  const bpm = useSelector(s => s.project.bpm)
  const key = useSelector(s => s.project.key)
  const scale = useSelector(s => s.project.scale)
  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  return (
    <div style={{ height: 50, background: '#0d0d0d', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', paddingLeft: 12, gap: 6, flexShrink: 0, overflow: 'hidden' }}>
      <button onClick={() => { dispatch(playbackActions.stop()); Tone.Transport.stop() }} style={btnStyle('#ef4444')}>⏹</button>
      <button onClick={() => { Tone.start(); dispatch(playing ? playbackActions.pause() : playbackActions.play()); playing ? Tone.Transport.pause() : Tone.Transport.start() }}
        style={btnStyle(playing ? '#f59e0b' : '#22c55e', 50)}>
        {playing ? '⏸' : '▶'}
      </button>
      <button onClick={() => dispatch(playbackActions.toggleRecording())}
        style={{ ...btnStyle('#ef4444'), background: recording ? '#ef4444' : 'transparent', border: `1px solid ${recording ? '#ef4444' : '#333'}` }}>⏺</button>
      <button onClick={() => dispatch(playbackActions.toggleLoop())}
        style={{ ...btnStyle('#3b82f6'), background: looping ? '#1e3a5f' : 'transparent', border: `1px solid ${looping ? '#3b82f6' : '#333'}` }}>🔁</button>
      <button onClick={() => dispatch(playbackActions.toggleMetronome())}
        style={{ ...btnStyle('#8b5cf6'), background: metronome ? '#2d1b69' : 'transparent', border: `1px solid ${metronome ? '#8b5cf6' : '#333'}` }}>🎵</button>

      <div style={{ width: 1, height: 28, background: '#333', margin: '0 4px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#666' }}>BPM</span>
        <input type="number" min="20" max="999" value={bpm}
          onChange={e => dispatch(projectActions.setBpm(+e.target.value))}
          style={{ width: 52, background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '3px 6px', fontSize: 13, textAlign: 'center' }} />
        <button onClick={() => dispatch(projectActions.setBpm(bpm - 1))} style={miniBtn}>-</button>
        <button onClick={() => dispatch(projectActions.setBpm(bpm + 1))} style={miniBtn}>+</button>
      </div>

      <div style={{ width: 1, height: 28, background: '#333', margin: '0 4px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#666' }}>Key</span>
        <select value={key} onChange={e => dispatch(projectActions.setKey(e.target.value))}
          style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '3px 6px', fontSize: 12 }}>
          {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map(n => <option key={n}>{n}</option>)}
        </select>
        <select value={scale} onChange={e => dispatch(projectActions.setScale(e.target.value))}
          style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888', borderRadius: 6, padding: '3px 6px', fontSize: 11 }}>
          {['major','minor','dorian','phrygian','lydian','mixolydian','pentatonic','blues'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ width: 1, height: 28, background: '#333', margin: '0 4px' }} />

      <div style={{ fontFamily: 'monospace', fontSize: 18, color: playing ? '#22c55e' : '#888', letterSpacing: 2, minWidth: 72 }}>
        {formatTime(currentTime)}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, paddingRight: 12, alignItems: 'center' }}>
        {playing && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s infinite' }} />}
        {recording && <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 11 }}>● REC</span>}
      </div>
    </div>
  )
}

const btnStyle = (color, size = 34) => ({
  width: size, height: size, background: 'transparent', border: `1px solid ${color}44`, borderRadius: size / 2,
  color, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0
})
const miniBtn = { width: 20, height: 20, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#888', cursor: 'pointer', fontSize: 12, padding: 0 }

// ─── STATUS BAR ───────────────────────────────────────────────────────────────
function StatusBar() {
  const [cpuLoad, setCpuLoad] = useState(12)
  useEffect(() => {
    const t = setInterval(() => setCpuLoad(Math.random() * 25 + 8), 2000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ height: 22, background: '#0d0d0d', borderTop: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', paddingLeft: 12, gap: 16, fontSize: 10, color: '#555', flexShrink: 0 }}>
      <span>Music Creator Pro v2.0</span>
      <span>44100 Hz</span>
      <span>512 buf</span>
      <span style={{ marginLeft: 'auto', paddingRight: 12, color: cpuLoad > 70 ? '#ef4444' : '#444' }}>
        CPU {cpuLoad.toFixed(1)}%
      </span>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function App() {
  const dispatch = useDispatch()
  const activeView = useSelector(s => s.ui.activeView)
  useAudioEngine()

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.key === ' ') { e.preventDefault(); dispatch(playbackActions.play()) }
      const keyMap = { F1: 'timeline', F2: 'beatmaker', F3: 'voice', F4: 'dj', F5: 'midi', F6: 'mixer', F7: 'library', F8: 'effects', F9: 'stems' }
      if (keyMap[e.code]) dispatch(uiActions.setView(keyMap[e.code]))
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') dispatch({ type: 'project/undo' })
      if ((e.ctrlKey || e.metaKey) && e.key === 's') dispatch(projectActions.setSaved(true))
    }
    window.addEventListener('keydown', handleKey)
    window.electronAPI?.on('menu:new-project', () => dispatch(projectActions.newProject()))
    window.electronAPI?.on('menu:save', () => dispatch(projectActions.setSaved(true)))
    window.electronAPI?.on('menu:view', (view) => dispatch(uiActions.setView(view)))
    return () => window.removeEventListener('keydown', handleKey)
  }, [dispatch])

  const renderView = () => {
    switch (activeView) {
      case 'timeline':    return <Timeline />
      case 'beatmaker':   return <BeatMaker />
      case 'voice':       return <VoiceEditor />
      case 'dj':          return <DJMixer />
      case 'midi':        return <PianoRoll />
      case 'mixer':       return <Mixer />
      case 'library':     return <Library />
      case 'effects':     return <EffectsRack />
      case 'stems':       return <StemSeparator />
      case 'mastering':   return <Mastering />
      case 'composition': return <Composition />
      case 'analysis':    return <Analysis />
      case 'voiceclone':  return <VoiceClone />
      case 'collab':      return <Collaboration />
      case 'marketplace': return <Marketplace />
      case 'settings':    return <SettingsView />
      default:            return <SettingsView />
    }
  }

  return (
    <div style={{ height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <TitleBar />
      <TransportBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderView()}
        </div>
      </div>
      <StatusBar />
      <style>{`
        * { box-sizing: border-box; }
        input[type=range] { -webkit-appearance: none; width: 100%; background: #2a2a2a; border-radius: 4px; height: 4px; outline: none; cursor: pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #3b82f6; cursor: pointer; }
        input[type=range]::-webkit-slider-thumb:hover { background: #60a5fa; }
        select { outline: none; cursor: pointer; }
        button:hover { opacity: 0.85; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function SettingsView() {
  const dispatch = useDispatch()
  const bpm = useSelector(s => s.project.bpm)
  return (
    <div style={{ maxWidth: 620, padding: 24, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ marginTop: 0, fontSize: 18, color: '#ddd' }}>⚙️ Settings</h2>

      {[['PROJECT', [
        ['Default BPM', <input type="number" value={bpm} onChange={e => dispatch(projectActions.setBpm(+e.target.value))} style={settingInput} />],
      ]], ['AUDIO', [
        ['Sample Rate', <span style={{ color: '#888' }}>44100 Hz</span>],
        ['Buffer Size', <span style={{ color: '#888' }}>512 samples</span>],
        ['Latency', <span style={{ color: '#888' }}>~12ms</span>],
        ['Audio Driver', <span style={{ color: '#888' }}>Default (WebAudio API)</span>],
      ]], ['MODULES', [
        ['Timeline', <span style={{ color: '#22c55e' }}>✓ Active</span>],
        ['Piano Roll', <span style={{ color: '#22c55e' }}>✓ Active</span>],
        ['Mixer', <span style={{ color: '#22c55e' }}>✓ Active</span>],
        ['Stem Separator', <span style={{ color: '#f59e0b' }}>⚡ Requires Demucs</span>],
        ['Voice Clone', <span style={{ color: '#f59e0b' }}>⚡ Requires Coqui TTS</span>],
        ['AI Composition', <span style={{ color: '#22c55e' }}>✓ Active</span>],
      ]], ['BACKEND', [
        ['API URL', <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 12 }}>http://127.0.0.1:8000</span>],
        ['Status', <BackendStatus />],
      ]]].map(([section, items]) => (
        <div key={section} style={{ background: '#111', borderRadius: 12, padding: '16px 20px', marginBottom: 14 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, color: '#555', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{section}</h3>
          {items.map(([label, control]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1a1a1a', fontSize: 13 }}>
              <span style={{ color: '#aaa' }}>{label}</span>
              {control}
            </div>
          ))}
        </div>
      ))}

      <div style={{ background: '#111', borderRadius: 12, padding: '16px 20px' }}>
        <h3 style={{ marginTop: 0, color: '#555', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>💜 Support the Project</h3>
        <p style={{ fontSize: 12, color: '#666', lineHeight: 1.6, margin: '0 0 12px' }}>Music Creator Pro is open-source and free forever. Support development!</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['R$5', 'R$15', 'R$30', 'R$50', 'Custom'].map(amt => (
            <button key={amt} style={{ padding: '8px 16px', background: '#1e3a5f', border: '1px solid #3b82f644', borderRadius: 8, color: '#ddd', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
              💙 Donate {amt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function BackendStatus() {
  const [status, setStatus] = useState('checking')
  useEffect(() => {
    fetch('http://127.0.0.1:8000/health')
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'))
  }, [])
  return <span style={{ color: status === 'online' ? '#22c55e' : status === 'checking' ? '#f59e0b' : '#ef4444', fontWeight: 700, fontSize: 12 }}>
    {status === 'online' ? '● Online' : status === 'checking' ? '◌ Checking...' : '● Offline (run: python backend/app/main.py)'}
  </span>
}

const settingInput = { background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: 80, outline: 'none' }

export default function Root() {
  return <Provider store={store}><App /></Provider>
}
