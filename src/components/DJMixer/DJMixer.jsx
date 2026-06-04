import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { djActions } from '../../store'
import * as Tone from 'tone'

const KnobControl = ({ label, value, min, max, step = 0.01, onChange, size = 60, color = '#3b82f6' }) => {
  const canvasRef = useRef(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startVal = useRef(0)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const cx = c.width / 2, cy = c.height / 2, r = cx - 4
    const norm = (value - min) / (max - min)
    const startAngle = 0.75 * Math.PI
    const endAngle = startAngle + norm * 1.5 * Math.PI

    ctx.clearRect(0, 0, c.width, c.height)
    ctx.beginPath(); ctx.arc(cx, cy, r, startAngle, startAngle + 1.5 * Math.PI); ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, r, startAngle, endAngle); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke()
    ctx.beginPath(); const a = endAngle; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
  }, [value, min, max, color])

  const onMouseDown = (e) => { dragging.current = true; startY.current = e.clientY; startVal.current = value }
  const onMouseMove = (e) => {
    if (!dragging.current) return
    const delta = (startY.current - e.clientY) / 100 * (max - min)
    onChange(Math.max(min, Math.min(max, startVal.current + delta)))
  }
  const onMouseUp = () => { dragging.current = false }

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'ns-resize', userSelect: 'none' }}>
      <canvas ref={canvasRef} width={size} height={size} onMouseDown={onMouseDown} style={{ cursor: 'ns-resize' }} />
      <span style={{ fontSize: 11, color: '#888' }}>{label}</span>
    </div>
  )
}

const Deck = ({ deckKey, deck, bpm }) => {
  const dispatch = useDispatch()
  const fileInputRef = useRef(null)
  const [waveData, setWaveData] = useState([])
  const playerRef = useRef(null)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const rafRef = useRef(null)

  const loadFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const audioCtx = new AudioContext()
    const buf = await file.arrayBuffer()
    const decoded = await audioCtx.decodeAudioData(buf)
    const data = decoded.getChannelData(0)
    const points = []
    const step = Math.floor(data.length / 200)
    for (let i = 0; i < 200; i++) {
      let max = 0
      for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[i * step + j] || 0))
      points.push(max)
    }
    setWaveData(points)
    setDuration(decoded.duration)
    dispatch(djActions.loadDeck({ deck: deckKey, data: { file: url, bpm: estimateBpm(decoded) } }))
    playerRef.current = new Tone.Player(url).toDestination()
    await Tone.loaded()
  }

  const estimateBpm = (buffer) => {
    const data = buffer.getChannelData(0)
    const sampleRate = buffer.sampleRate
    const peaks = []
    const threshold = 0.5
    for (let i = 0; i < data.length - sampleRate; i += Math.floor(sampleRate * 0.01)) {
      if (Math.abs(data[i]) > threshold) { peaks.push(i / sampleRate); i += Math.floor(sampleRate * 0.2) }
    }
    if (peaks.length < 2) return 120
    const intervals = peaks.slice(1).map((p, i) => p - peaks[i])
    const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length
    return Math.round(60 / avg)
  }

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return
    if (deck.playing) {
      playerRef.current.stop()
      cancelAnimationFrame(rafRef.current)
    } else {
      Tone.start()
      playerRef.current.start()
      const tick = () => {
        if (playerRef.current?.state === 'started') {
          setPosition(Tone.now())
          rafRef.current = requestAnimationFrame(tick)
        }
      }
      tick()
    }
    dispatch(djActions.toggleDeck(deckKey))
  }, [deck.playing, deckKey, dispatch])

  const formatTime = (s) => {
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const color = deckKey === 'deckA' ? '#3b82f6' : '#f97316'

  return (
    <div style={{ flex: 1, background: '#1a1a1a', borderRadius: 12, padding: 16, border: `1px solid ${color}33` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{deckKey === 'deckA' ? 'DECK A' : 'DECK B'}</span>
        <span style={{ fontSize: 13, color: '#888', background: '#111', padding: '4px 10px', borderRadius: 20 }}>
          {deck.bpm ? `${deck.bpm} BPM` : '--- BPM'}
        </span>
        <button onClick={() => fileInputRef.current?.click()}
          style={{ padding: '6px 12px', background: '#222', border: `1px solid ${color}`, borderRadius: 8, color, cursor: 'pointer', fontSize: 13 }}>
          📂 Load
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={loadFile} />
      </div>

      {/* Track name */}
      <div style={{ fontSize: 13, color: deck.file ? '#fff' : '#555', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {deck.file ? 'Track loaded' : 'No track loaded'}
      </div>

      {/* Waveform */}
      <div style={{ height: 60, background: '#111', borderRadius: 8, marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 1, padding: '4px 2px' }}>
          {waveData.map((v, i) => (
            <div key={i} style={{ flex: 1, background: color, opacity: 0.7, height: `${Math.max(4, v * 100)}%`, minWidth: 1, borderRadius: 1 }} />
          ))}
          {waveData.length === 0 && <div style={{ color: '#333', fontSize: 12, margin: 'auto' }}>Load a track to see waveform</div>}
        </div>
        {duration > 0 && <div style={{ position: 'absolute', bottom: 4, right: 8, fontSize: 11, color: '#888' }}>{formatTime(duration)}</div>}
      </div>

      {/* Transport */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
        {['⏮', '⏪'].map((btn, i) => (
          <button key={i} style={{ width: 36, height: 36, background: '#222', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14 }}>{btn}</button>
        ))}
        <button onClick={togglePlay} style={{ width: 52, height: 52, borderRadius: '50%', background: deck.playing ? '#ef4444' : color, border: 'none', cursor: 'pointer', fontSize: 20 }}>
          {deck.playing ? '⏸' : '▶'}
        </button>
        {['⏩', '⏭'].map((btn, i) => (
          <button key={i} style={{ width: 36, height: 36, background: '#222', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14 }}>{btn}</button>
        ))}
      </div>

      {/* EQ Knobs */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 14 }}>
        {['low', 'mid', 'high'].map(band => (
          <KnobControl key={band} label={band.charAt(0).toUpperCase() + band.slice(1)} value={deck.eq[band]} min={-12} max={12} step={0.5} color={color}
            onChange={v => dispatch(djActions.setDeckEq({ deck: deckKey, eq: { [band]: v } }))} />
        ))}
      </div>

      {/* Volume + Rate */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>VOLUME</div>
          <input type="range" min={0} max={1} step={0.01} value={deck.volume} style={{ width: '100%' }}
            onChange={e => dispatch(djActions.setDeckVolume({ deck: deckKey, volume: +e.target.value }))} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>PITCH {deck.rate !== 1 ? `(${((deck.rate - 1) * 100).toFixed(1)}%)` : ''}</div>
          <input type="range" min={0.7} max={1.3} step={0.001} value={deck.rate} style={{ width: '100%' }}
            onChange={e => dispatch(djActions.setDeckRate({ deck: deckKey, rate: +e.target.value }))} />
        </div>
      </div>
    </div>
  )
}

export default function DJMixer() {
  const dispatch = useDispatch()
  const dj = useSelector(s => s.dj)
  const bpm = useSelector(s => s.project.bpm)

  return (
    <div style={{ background: '#111', borderRadius: 12, padding: 20, color: '#fff' }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600 }}>🎧 DJ Mixer</h2>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <Deck deckKey="deckA" deck={dj.deckA} bpm={bpm} />

        {/* Center Controls */}
        <div style={{ width: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>MASTER VOL</div>
          <KnobControl label="" value={dj.masterVolume} min={0} max={1.5} step={0.01} color="#22c55e"
            onChange={v => dispatch(djActions.setMasterVolume(v))} size={50} />

          <div style={{ fontSize: 11, color: '#888' }}>CROSSFADER</div>
          <div style={{ width: '100%' }}>
            <input type="range" min={0} max={1} step={0.01} value={dj.crossfader}
              onChange={e => dispatch(djActions.setCrossfader(+e.target.value))}
              style={{ width: '100%', WebkitAppearance: 'none', height: 8, borderRadius: 4, background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${dj.crossfader * 100}%, #f97316 ${dj.crossfader * 100}%, #f97316 100%)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginTop: 4 }}>
              <span>A</span><span>B</span>
            </div>
          </div>

          <button onClick={() => dispatch(djActions.toggleAutoSync())}
            style={{ padding: '8px 12px', background: dj.autoSync ? '#22c55e' : '#222', border: `1px solid ${dj.autoSync ? '#22c55e' : '#333'}`, borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12, textAlign: 'center' }}>
            {dj.autoSync ? '🔗 SYNC ON' : '🔗 SYNC'}
          </button>
        </div>

        <Deck deckKey="deckB" deck={dj.deckB} bpm={bpm} />
      </div>
    </div>
  )
}
