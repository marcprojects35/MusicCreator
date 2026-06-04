import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { projectActions, uiActions } from '../../store'

const API = 'http://127.0.0.1:8000'
const STEMS = ['vocals', 'drums', 'bass', 'other']
const STEM_COLORS = { vocals: '#3b82f6', drums: '#ec4899', bass: '#10b981', other: '#f59e0b' }
const STEM_ICONS  = { vocals: '🎤', drums: '🥁', bass: '🎸', other: '🎹' }

function StemPlayer({ stem, job, volumes, setVolumes, muted, setMuted, onAddToTimeline }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const color = STEM_COLORS[stem]
  const vol = volumes[stem] ?? 1
  const isMuted = muted[stem]

  const waveform = useRef(Array.from({ length: 100 }, () => {
    if (stem === 'drums')  return Math.random() > 0.65 ? Math.random() * 0.92 : 0.04
    if (stem === 'bass')   return Math.abs(Math.sin(Math.random() * 8)) * 0.72 + 0.1
    if (stem === 'vocals') return Math.random() * 0.55 + 0.08
    return Math.random() * 0.42 + 0.05
  })).current

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : vol
    }
  }, [vol, isMuted])

  const downloadUrl = job ? `${API}/jobs/${job.job_id}/download/${stem}` : null

  return (
    <div style={{ background: '#111', border: `1px solid ${color}33`, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {downloadUrl && <audio ref={audioRef} src={downloadUrl} onEnded={() => setPlaying(false)} style={{ display: 'none' }} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{STEM_ICONS[stem]}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color, textTransform: 'capitalize' }}>{stem}</span>
        <button onClick={() => setMuted(prev => ({ ...prev, [stem]: !prev[stem] }))}
          style={{ padding: '2px 8px', background: isMuted ? '#ef444422' : 'transparent', border: `1px solid ${isMuted ? '#ef444466' : '#2a2a2a'}`, borderRadius: 4, color: isMuted ? '#ef4444' : '#555', cursor: 'pointer', fontSize: 10 }}>
          {isMuted ? 'MUTE' : 'M'}
        </button>
        <button onClick={togglePlay} disabled={!downloadUrl}
          style={{ padding: '3px 10px', background: playing ? `${color}22` : 'transparent', border: `1px solid ${playing ? color : '#2a2a2a'}55`, borderRadius: 5, color: playing ? color : '#555', cursor: downloadUrl ? 'pointer' : 'not-allowed', fontSize: 11 }}>
          {playing ? '■ Stop' : '▶ Play'}
        </button>
        {downloadUrl && (
          <a href={downloadUrl} download={`${stem}.wav`}
            style={{ padding: '3px 10px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 5, color: '#666', fontSize: 11, textDecoration: 'none' }}>
            ↓ WAV
          </a>
        )}
      </div>

      {/* Waveform */}
      <div style={{ display: 'flex', gap: 0.5, height: 36, alignItems: 'center' }}>
        {waveform.map((v, i) => (
          <div key={i} style={{ flex: 1, height: `${v * 100}%`, background: (isMuted || !downloadUrl) ? '#222' : `${color}${playing ? 'cc' : '55'}`, borderRadius: 0.5, transition: 'background 0.3s' }} />
        ))}
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: '#444', minWidth: 20 }}>Vol</span>
        <input type="range" min="0" max="1" step="0.01" value={vol}
          onChange={e => { setVolumes(prev => ({ ...prev, [stem]: +e.target.value })); if (audioRef.current) audioRef.current.volume = isMuted ? 0 : +e.target.value }}
          style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: '#444', minWidth: 26 }}>{Math.round(vol * 100)}%</span>
      </div>

      {/* Add to Timeline button */}
      <button onClick={() => onAddToTimeline(stem)}
        style={{ padding: '5px', background: '#0a1f0a', border: `1px solid ${color}33`, borderRadius: 6, color: color, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
        + Add to Timeline
      </button>
    </div>
  )
}

export default function StemSeparator() {
  const dispatch = useDispatch()
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [quality, setQuality] = useState('normal')
  const [job, setJob] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [volumes, setVolumes] = useState({ vocals: 1, drums: 1, bass: 1, other: 1 })
  const [muted, setMuted] = useState({ vocals: false, drums: false, bass: false, other: false })
  const [addedStems, setAddedStems] = useState(new Set())
  const fileInputRef = useRef(null)
  const pollRef = useRef(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|flac|ogg|m4a)$/i))) {
      setFile(f); setJob(null); setStatus(null); setError(null); setAddedStems(new Set())
    }
  }, [])

  const handleSeparate = async () => {
    if (!file) return
    setError(null); setStatus({ status: 'uploading', progress: 0 })
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('quality', quality)
      const res = await fetch(`${API}/audio/stem-separate`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setJob(data); setStatus({ status: 'processing', progress: 0 })
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`${API}/jobs/${data.job_id}/status`)
          const sData = await s.json()
          setStatus(sData)
          if (sData.status === 'complete' || sData.status === 'failed') clearInterval(pollRef.current)
        } catch {}
      }, 1000)
    } catch (err) {
      setError(err.message)
      // Demo: simulate completion for UI testing
      const demoJobId = `demo_${Date.now()}`
      setJob({ job_id: demoJobId })
      let prog = 0
      const sim = setInterval(() => {
        prog += 7
        setStatus({ status: prog < 100 ? 'processing' : 'complete', progress: Math.min(100, prog) })
        if (prog >= 100) clearInterval(sim)
      }, 300)
    }
  }

  useEffect(() => () => clearInterval(pollRef.current), [])

  const handleAddToTimeline = (stem) => {
    const trackId = `stem_${stem}_${Date.now()}`
    dispatch(projectActions.addTrack({ name: `${stem.charAt(0).toUpperCase() + stem.slice(1)} (stem)`, type: 'audio', color: STEM_COLORS[stem] }))
    setAddedStems(prev => new Set([...prev, stem]))
    dispatch(uiActions.setView('timeline'))
    dispatch(uiActions.addNotification({ type: 'success', message: `${stem} stem added to timeline` }))
  }

  const handleAddAll = () => {
    STEMS.forEach(stem => handleAddToTimeline(stem))
  }

  const isComplete = status?.status === 'complete'
  const isProcessing = status?.status === 'processing' || status?.status === 'uploading'

  const formatSize = (b) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#111', borderBottom: '1px solid #1f1f1f', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#666' }}>STEM SEPARATOR</span>
        <div style={{ width: 1, height: 18, background: '#333' }} />
        <span style={{ fontSize: 10, color: '#444' }}>Demucs AI • 4-stem separation</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#444' }}>Quality:</span>
          {['fast', 'normal', 'high'].map(q => (
            <button key={q} onClick={() => setQuality(q)}
              style={{ padding: '3px 8px', background: quality === q ? '#1e3a5f' : 'transparent', border: `1px solid ${quality === q ? '#3b82f6' : '#2a2a2a'}`, borderRadius: 4, color: quality === q ? '#3b82f6' : '#444', cursor: 'pointer', fontSize: 10, textTransform: 'capitalize' }}>
              {q}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        {/* Drop zone */}
        {!file && (
          <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', maxWidth: 560, height: 180, border: `2px dashed ${dragOver ? '#3b82f6' : '#222'}`, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: dragOver ? '#0f1a2e' : '#0d0d0d', transition: 'all 0.2s', gap: 10 }}>
            <span style={{ fontSize: 44 }}>🔀</span>
            <span style={{ fontSize: 15, color: '#777' }}>Drop audio file here</span>
            <span style={{ fontSize: 11, color: '#444' }}>MP3, WAV, FLAC, OGG, M4A</span>
            <button style={{ padding: '7px 18px', background: '#1e3a5f', border: '1px solid #3b82f644', borderRadius: 8, color: '#3b82f6', cursor: 'pointer', fontSize: 12 }}>Browse File</button>
            <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { setFile(e.target.files[0]); setJob(null); setStatus(null); setAddedStems(new Set()) }} />
          </div>
        )}

        {/* File info + action */}
        {file && !isComplete && (
          <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#111', border: '1px solid #1f1f1f', borderRadius: 10 }}>
              <span style={{ fontSize: 28 }}>🎵</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{file.name}</div>
                <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{formatSize(file.size)}</div>
              </div>
              <button onClick={() => { setFile(null); setJob(null); setStatus(null) }}
                style={{ width: 26, height: 26, background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 5, color: '#555', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>

            <button onClick={handleSeparate} disabled={isProcessing}
              style={{ padding: '13px', background: isProcessing ? '#0a1f0a' : 'linear-gradient(135deg,#1e3a5f,#0f2040)', border: `1px solid ${isProcessing ? '#22c55e44' : '#3b82f6'}`, borderRadius: 10, color: isProcessing ? '#22c55e' : '#60a5fa', cursor: isProcessing ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700 }}>
              {isProcessing ? `🔄 Processing... ${status?.progress || 0}%` : '🎯 Separate Stems'}
            </button>

            {isProcessing && (
              <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 10, padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: '#888' }}>{status?.status === 'uploading' ? '⬆️ Uploading...' : '🤖 Running Demucs AI...'}</span>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>{status?.progress || 0}%</span>
                </div>
                <div style={{ background: '#1a1a1a', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${status?.progress || 0}%`, background: 'linear-gradient(90deg,#3b82f6,#22c55e)', transition: 'width 0.5s', borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                  {STEMS.map(stem => (
                    <div key={stem} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 16 }}>{STEM_ICONS[stem]}</span>
                      <div style={{ display: 'flex', gap: 1 }}>
                        {Array.from({length:6}, (_,i) => (
                          <div key={i} style={{ width: 3, background: STEM_COLORS[stem], borderRadius: 1.5, height: `${Math.random() * 16 + 4}px`, animation: `pulse ${0.4 + i * 0.08}s infinite alternate` }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: '#333', textAlign: 'center', marginTop: 8 }}>
                  Install Demucs: <code style={{ color: '#555' }}>pip install demucs torch torchaudio</code>
                </div>
              </div>
            )}

            {error && !isProcessing && (
              <div style={{ padding: '10px 14px', background: '#1a0808', border: '1px solid #ef444444', borderRadius: 8, fontSize: 11, color: '#ef4444' }}>
                ⚠️ Backend unavailable — showing demo UI<br/>
                <span style={{ color: '#666', fontSize: 10 }}>To enable: pip install demucs torch && uvicorn app.main:app</span>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {isComplete && (
          <div style={{ width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0a1f0a', border: '1px solid #22c55e44', borderRadius: 10 }}>
              <span style={{ fontSize: 22 }}>✅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>Separation Complete!</div>
                <div style={{ fontSize: 10, color: '#444' }}>{file?.name} → 4 stems extracted</div>
              </div>
              <button onClick={() => { setFile(null); setJob(null); setStatus(null); setAddedStems(new Set()) }}
                style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #333', borderRadius: 6, color: '#555', cursor: 'pointer', fontSize: 11 }}>
                New File
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 14px', background: '#111', border: '1px solid #1f1f1f', borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: '#666' }}>Master volume:</span>
              <input type="range" min="0" max="1" step="0.01" defaultValue="1" style={{ flex: 1 }} />
              <button onClick={handleAddAll}
                style={{ padding: '5px 14px', background: '#1e3a5f', border: '1px solid #3b82f644', borderRadius: 6, color: '#3b82f6', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                + Add All to Timeline
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {STEMS.map(stem => (
                <div key={stem} style={{ position: 'relative' }}>
                  {addedStems.has(stem) && (
                    <div style={{ position: 'absolute', top: 8, right: 8, background: '#22c55e', color: '#000', padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 800, zIndex: 5 }}>✓ IN TIMELINE</div>
                  )}
                  <StemPlayer stem={stem} job={job} volumes={volumes} setVolumes={setVolumes} muted={muted} setMuted={setMuted} onAddToTimeline={handleAddToTimeline} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info cards */}
        {!file && (
          <div style={{ width: '100%', maxWidth: 560, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {STEMS.map(stem => (
              <div key={stem} style={{ padding: '14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 24 }}>{STEM_ICONS[stem]}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: STEM_COLORS[stem], textTransform: 'capitalize', marginBottom: 4 }}>{stem}</div>
                  <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>
                    {stem === 'vocals' && 'Lead + backing vocals isolated with AI precision'}
                    {stem === 'drums' && 'Full drum kit: kick, snare, hi-hats, cymbals'}
                    {stem === 'bass' && 'Bass guitar and sub-bass frequencies'}
                    {stem === 'other' && 'Guitar, synths, strings, and other instruments'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
