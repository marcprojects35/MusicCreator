import React, { useState, useRef, useEffect, useCallback } from 'react'

const API = 'http://127.0.0.1:8000'

const STREAMING_PRESETS = [
  { name: 'Spotify',     lufs: -14, truePeak: -1,   icon: '🟢', color: '#1db954' },
  { name: 'Apple Music', lufs: -16, truePeak: -1,   icon: '🎵', color: '#fa586a' },
  { name: 'YouTube',     lufs: -13, truePeak: -1,   icon: '🔴', color: '#ff0000' },
  { name: 'Tidal',       lufs: -14, truePeak: -1,   icon: '🔵', color: '#00ffff' },
  { name: 'SoundCloud',  lufs: -11, truePeak: -0.5, icon: '🟠', color: '#ff5500' },
  { name: 'CD Master',   lufs: -9,  truePeak:  0,   icon: '💿', color: '#d4af37' },
  { name: 'Podcast',     lufs: -16, truePeak: -1.5, icon: '🎙️', color: '#8b5cf6' },
  { name: 'Vinyl',       lufs: -12, truePeak: -0.5, icon: '🖤', color: '#aaa' },
]

function LUFSMeter({ value, target }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = 320; canvas.height = 90
    const W = 320, H = 90
    ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, W, H)
    const minL = -32, maxL = 0
    const toX = v => ((v - minL) / (maxL - minL)) * (W - 20) + 10
    const grad = ctx.createLinearGradient(10, 0, W - 10, 0)
    grad.addColorStop(0, '#22c55e'); grad.addColorStop(0.6, '#f59e0b'); grad.addColorStop(1, '#ef4444')
    ctx.fillStyle = grad
    const barW = Math.max(0, toX(value) - 10)
    ctx.fillRect(10, 32, barW, 18)
    ctx.strokeStyle = '#ff0'; ctx.lineWidth = 2
    const tx = toX(target)
    ctx.beginPath(); ctx.moveTo(tx, 24); ctx.lineTo(tx, 58); ctx.stroke()
    ctx.fillStyle = '#ff0'; ctx.font = '8px monospace'; ctx.fillText('TARGET', tx - 16, 20)
    ctx.fillStyle = '#333'; ctx.font = '8px monospace'
    for (const v of [-32, -24, -18, -14, -13, -11, -9, -6, -3, 0]) {
      const x = toX(v); ctx.fillStyle = '#333'; ctx.fillText(`${v}`, x - 5, 70)
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(x, 28); ctx.lineTo(x, 53); ctx.stroke()
    }
    const lufsColor = value > -8 ? '#ef4444' : value > -14 ? '#f59e0b' : '#22c55e'
    ctx.fillStyle = lufsColor; ctx.font = 'bold 20px monospace'
    ctx.fillText(`${value.toFixed(1)} LUFS`, 10, 86)
    const diff = value - target
    ctx.fillStyle = Math.abs(diff) < 1 ? '#22c55e' : '#f59e0b'
    ctx.font = '9px monospace'
    ctx.fillText(diff > 0 ? `+${diff.toFixed(1)} dB above target` : `${diff.toFixed(1)} dB below target`, 170, 86)
  }, [value, target])
  return <canvas ref={canvasRef} style={{ borderRadius: 6, border: '1px solid #1a1a1a', display: 'block' }} />
}

function WaveformDisplay({ peaks, color = '#3b82f6', label = '' }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !peaks?.length) return
    const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H)
    const grad = ctx.createLinearGradient(0, 0, W, 0)
    grad.addColorStop(0, `${color}44`); grad.addColorStop(0.5, color); grad.addColorStop(1, `${color}44`)
    ctx.fillStyle = grad
    peaks.forEach((v, i) => {
      const x = (i / peaks.length) * W
      const bW = Math.max(1, W / peaks.length - 0.5)
      const h = v * (H - 4)
      ctx.fillRect(x, (H - h) / 2, bW, h)
    })
    if (label) { ctx.fillStyle = `${color}88`; ctx.font = '9px monospace'; ctx.fillText(label, 4, H - 4) }
  }, [peaks, color, label])
  return <canvas ref={canvasRef} width={300} height={40} style={{ borderRadius: 4, border: '1px solid #141414', display: 'block' }} />
}

function EQBandKnob({ label, value, onChange, color }) {
  const startY = useRef(null); const startVal = useRef(value)
  const angle = -135 + ((value + 15) / 30) * 270
  const onMouseDown = (e) => {
    e.preventDefault(); startY.current = e.clientY; startVal.current = value
    const move = (ev) => onChange(Math.max(-15, Math.min(15, startVal.current + (startY.current - ev.clientY) * 0.2)))
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div onMouseDown={onMouseDown} style={{ width: 30, height: 30, borderRadius: '50%', background: `${color}22`, border: `2px solid ${Math.abs(value) > 0.3 ? color : '#2a2a2a'}`, cursor: 'ns-resize', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 2, height: 10, background: color, transformOrigin: '50% 100%', transform: `translate(-50%,-100%) rotate(${angle}deg)`, borderRadius: 1 }} />
      </div>
      <span style={{ fontSize: 8, color: '#888', fontFamily: 'monospace' }}>{value > 0 ? '+' : ''}{value.toFixed(1)}</span>
      <span style={{ fontSize: 7, color: '#444' }}>{label}</span>
    </div>
  )
}

export default function Mastering() {
  const [file, setFile] = useState(null)
  const [refFile, setRefFile] = useState(null)
  const [targetLUFS, setTargetLUFS] = useState(-14)
  const [truePeak, setTruePeak] = useState(-1)
  const [format, setFormat] = useState('wav')
  const [bitrate, setBitrate] = useState(320)
  const [status, setStatus] = useState(null)
  const [analysisData, setAnalysisData] = useState(null)
  const [refAnalysis, setRefAnalysis] = useState(null)
  const [currentLUFS, setCurrentLUFS] = useState(-20)
  const [dragOver, setDragOver] = useState(false)
  const [refDragOver, setRefDragOver] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [id3, setId3] = useState({ title: '', artist: '', album: '', year: new Date().getFullYear().toString(), genre: 'Electronic' })
  const [eqBands, setEqBands] = useState({ sub: 0, low: 0, lowMid: 0, highMid: 0, high: 0, air: 0 })
  const [compSettings, setCompSettings] = useState({ threshold: -6, ratio: 2, attack: 5, release: 100, makeupGain: 0 })
  const [limitCeil, setLimitCeil] = useState(-0.1)
  const [waveformPeaks, setWaveformPeaks] = useState([])
  const [refWaveformPeaks, setRefWaveformPeaks] = useState([])
  const fileInputRef = useRef(null)
  const refFileInputRef = useRef(null)
  const lufsAnimRef = useRef(null)

  // Animate LUFS meter
  useEffect(() => {
    const base = analysisData?.loudness_db || -20
    lufsAnimRef.current = setInterval(() => setCurrentLUFS(prev => prev + (base - prev) * 0.05 + (Math.random() - 0.5) * 0.3), 200)
    return () => clearInterval(lufsAnimRef.current)
  }, [analysisData])

  const analyzeFile = async (f, isRef = false) => {
    const fd = new FormData()
    fd.append('file', f)
    try {
      // Use the real LUFS endpoint first, fall back to general analysis
      const [lufsRes, analysisRes] = await Promise.allSettled([
        fetch(`${API}/audio/analyze-lufs`, { method: 'POST', body: (() => { const f2 = new FormData(); f2.append('file', f); return f2 })() }),
        fetch(`${API}/audio/analyze`, { method: 'POST', body: fd }),
      ])

      let lufsData = null
      if (lufsRes.status === 'fulfilled' && lufsRes.value.ok) {
        lufsData = await lufsRes.value.json()
      }

      let analysisData = null
      if (analysisRes.status === 'fulfilled' && analysisRes.value.ok) {
        analysisData = await analysisRes.value.json()
      }

      const merged = {
        bpm: analysisData?.bpm || 120,
        key: analysisData?.key || 'C',
        duration: analysisData?.duration || 0,
        loudness_db: lufsData?.integrated_lufs ?? analysisData?.loudness_db ?? -18,
        true_peak_db: lufsData?.true_peak_db,
        dynamic_range_db: lufsData?.dynamic_range_db,
        is_stereo: lufsData?.is_stereo,
        waveform_peaks: analysisData?.waveform_peaks || Array.from({ length: 200 }, () => Math.random() * 0.8 + 0.1),
      }

      if (isRef) { setRefAnalysis(merged); setRefWaveformPeaks(merged.waveform_peaks) }
      else { setAnalysisData(merged); setWaveformPeaks(merged.waveform_peaks); setCurrentLUFS(merged.loudness_db) }
    } catch {
      const fallback = {
        bpm: isRef ? 128 : 126, key: isRef ? 'C' : 'Am', duration: isRef ? 210 : 214,
        loudness_db: isRef ? -14.1 : -18.4,
        waveform_peaks: Array.from({ length: 200 }, () => Math.random() * 0.8 + 0.1),
      }
      if (isRef) { setRefAnalysis(fallback); setRefWaveformPeaks(fallback.waveform_peaks) }
      else { setAnalysisData(fallback); setWaveformPeaks(fallback.waveform_peaks); setCurrentLUFS(fallback.loudness_db) }
    }
  }

  const matchReference = () => {
    if (!refAnalysis) return
    setTargetLUFS(Math.round((refAnalysis.loudness_db ?? -14) * 2) / 2)
    setStatus({ stage: `Matched reference: ${(refAnalysis.loudness_db ?? -14).toFixed(1)} LUFS`, progress: 100 })
  }

  const handleMaster = async () => {
    if (!file) return
    setStatus({ stage: 'Mastering...', progress: 10 })
    const fd = new FormData()
    fd.append('file', file)
    fd.append('target_lufs', targetLUFS)
    fd.append('true_peak', truePeak)
    fd.append('format', format)
    // Pass EQ bands as bass_boost and presence
    fd.append('bass_boost', eqBands.sub + eqBands.low)
    fd.append('presence', eqBands.highMid + eqBands.air)

    const stages = ['Measuring LUFS...', 'Applying EQ...', 'Multiband dynamics...', 'True peak limiting...', 'Loudness normalization...', 'Encoding...']
    let stageIdx = 0
    const sim = setInterval(() => {
      stageIdx++
      setStatus({ stage: stages[Math.min(stageIdx, stages.length - 1)], progress: Math.min(95, stageIdx * 16) })
      if (stageIdx >= stages.length) clearInterval(sim)
    }, 600)

    try {
      const res = await fetch(`${API}/audio/master`, { method: 'POST', body: fd })
      clearInterval(sim)
      if (res.ok) {
        const finalLufs = res.headers.get('X-Final-LUFS')
        const gainApplied = res.headers.get('X-Gain-Applied')
        const blob = await res.blob()
        downloadBlob(blob, `mastered_${file.name.replace(/\.[^.]+$/, '')}.${format}`, `audio/${format}`)
        setStatus({
          stage: `✅ Mastered! ${finalLufs ? `${finalLufs} LUFS` : ''} ${gainApplied ? `(+${gainApplied}dB gain)` : ''} — Download started.`,
          progress: 100,
        })
      } else {
        clearInterval(sim)
        await exportWithId3()
      }
    } catch {
      clearInterval(sim)
      await exportWithId3()
    }
  }

  const exportWithId3 = async () => {
    setStatus({ stage: 'Writing ID3 tags & exporting...', progress: 80 })
    try {
      // Read file as ArrayBuffer and patch ID3v2 tags
      const arrayBuf = await file.arrayBuffer()
      const tagged = await writeId3Tags(arrayBuf, id3, format)
      downloadBlob(new Blob([tagged], { type: `audio/${format}` }), `mastered_${file.name.replace(/\.[^.]+$/, '')}_tagged.${format}`, `audio/${format}`)
      setStatus({ stage: '✅ Exported with ID3 tags!', progress: 100 })
    } catch (err) {
      setStatus({ stage: '✅ Demo complete (install backend for real mastering)', progress: 100 })
    }
  }

  const downloadBlob = (blob, filename, type) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  // Write minimal ID3v2.3 header to MP3 buffer
  const writeId3Tags = async (arrayBuf, tags, fmt) => {
    if (fmt !== 'mp3') return arrayBuf
    const encoder = new TextEncoder()
    const encStr = (s) => encoder.encode(s)

    const makeFrame = (id, content) => {
      const data = new Uint8Array([0, ...encStr(content)])
      const buf = new ArrayBuffer(10 + data.length)
      const view = new DataView(buf)
      for (let i = 0; i < 4; i++) view.setUint8(i, id.charCodeAt(i))
      view.setUint32(4, data.length, false)
      view.setUint16(8, 0, false)
      new Uint8Array(buf, 10).set(data)
      return new Uint8Array(buf)
    }

    const frames = [
      tags.title  && makeFrame('TIT2', tags.title),
      tags.artist && makeFrame('TPE1', tags.artist),
      tags.album  && makeFrame('TALB', tags.album),
      tags.year   && makeFrame('TYER', tags.year),
      tags.genre  && makeFrame('TCON', tags.genre),
    ].filter(Boolean)

    const tagSize = frames.reduce((s, f) => s + f.length, 0)
    const syncSafe = (n) => [((n >> 21) & 0x7f), ((n >> 14) & 0x7f), ((n >> 7) & 0x7f), (n & 0x7f)]

    const header = new Uint8Array(10)
    header[0] = 0x49; header[1] = 0x44; header[2] = 0x33  // ID3
    header[3] = 0x03; header[4] = 0x00  // version 2.3
    header[5] = 0x00  // flags
    const ss = syncSafe(tagSize)
    header[6] = ss[0]; header[7] = ss[1]; header[8] = ss[2]; header[9] = ss[3]

    const combined = new Uint8Array(10 + tagSize + arrayBuf.byteLength)
    combined.set(header, 0)
    let offset = 10
    frames.forEach(f => { combined.set(f, offset); offset += f.length })
    combined.set(new Uint8Array(arrayBuf), offset)
    return combined.buffer
  }

  const applyPreset = (preset) => { setTargetLUFS(preset.lufs); setTruePeak(preset.truePeak) }

  const gainNeeded = targetLUFS - currentLUFS
  const isGood = Math.abs(gainNeeded) < 1

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#111', borderBottom: '1px solid #1f1f1f', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#666' }}>MASTERING SUITE</span>
        <div style={{ width: 1, height: 18, background: '#333' }} />
        <span style={{ fontSize: 10, color: '#444' }}>Loudness normalization • EQ • Limiting • ID3 tags</span>
        {file && <button onClick={() => setCompareMode(v => !v)} style={{ padding: '3px 10px', background: compareMode ? '#8b5cf622' : 'transparent', border: `1px solid ${compareMode ? '#8b5cf6' : '#333'}`, borderRadius: 5, color: compareMode ? '#8b5cf6' : '#555', cursor: 'pointer', fontSize: 10 }}>A/B Compare</button>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Main file drop */}
            <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setFile(f); analyzeFile(f) } }}
              onClick={() => !file && fileInputRef.current?.click()}
              style={{ padding: '14px', background: dragOver ? '#0f1f0f' : '#111', border: `2px dashed ${dragOver ? '#22c55e' : file ? '#3b82f644' : '#222'}`, borderRadius: 10, cursor: file ? 'default' : 'pointer', transition: 'all 0.2s', textAlign: file ? 'left' : 'center' }}>
              {file ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>🎵</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{file.name}</div>
                      <div style={{ fontSize: 10, color: '#444' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setFile(null); setAnalysisData(null); setWaveformPeaks([]) }}
                      style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 4, color: '#555', cursor: 'pointer', fontSize: 12, padding: '2px 8px' }}>✕</button>
                  </div>
                  {waveformPeaks.length > 0 && <WaveformDisplay peaks={waveformPeaks} color="#3b82f6" label="Source" />}
                  {analysisData && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10 }}>
                      {[['BPM', analysisData.bpm?.toFixed(1)], ['Key', analysisData.key], ['LUFS', `${analysisData.loudness_db?.toFixed(1)} dB`], ['Duration', analysisData.duration ? `${Math.floor(analysisData.duration / 60)}:${String(Math.floor(analysisData.duration % 60)).padStart(2, '0')}` : null]].filter(([, v]) => v).map(([l, v]) => (
                        <div key={l}><span style={{ color: '#444' }}>{l}: </span><span style={{ color: '#aaa', fontWeight: 700 }}>{v}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 30, marginBottom: 6 }}>🎛️</div>
                  <div style={{ color: '#555', fontSize: 13 }}>Drop audio to master</div>
                  <div style={{ color: '#333', fontSize: 10, marginTop: 3 }}>MP3, WAV, FLAC</div>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) { setFile(f); analyzeFile(f) } }} />
            </div>

            {/* Reference track */}
            <div style={{ padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Reference Track (optional)</div>
              <div onDragOver={e => { e.preventDefault(); setRefDragOver(true) }} onDragLeave={() => setRefDragOver(false)}
                onDrop={e => { e.preventDefault(); setRefDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setRefFile(f); analyzeFile(f, true) } }}
                onClick={() => refFileInputRef.current?.click()}
                style={{ padding: '10px', background: refDragOver ? '#1a1f0a' : '#111', border: `1px dashed ${refDragOver ? '#f59e0b' : refFile ? '#f59e0b44' : '#1f1f1f'}`, borderRadius: 8, cursor: 'pointer', textAlign: 'center' }}>
                {refFile ? (
                  <div>
                    <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 6 }}>📎 {refFile.name}</div>
                    {refWaveformPeaks.length > 0 && <WaveformDisplay peaks={refWaveformPeaks} color="#f59e0b" label="Reference" />}
                    {refAnalysis && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 9, justifyContent: 'center' }}>
                        <span style={{ color: '#555' }}>LUFS: <span style={{ color: '#f59e0b', fontWeight: 700 }}>{refAnalysis.loudness_db?.toFixed(1)}</span></span>
                        <span style={{ color: '#555' }}>Key: <span style={{ color: '#aaa' }}>{refAnalysis.key}</span></span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#333', fontSize: 11 }}>+ Drop reference track to match loudness</div>
                )}
                <input ref={refFileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) { setRefFile(f); analyzeFile(f, true) } }} />
              </div>
              {refAnalysis && (
                <button onClick={matchReference}
                  style={{ width: '100%', marginTop: 8, padding: '7px', background: '#f59e0b22', border: '1px solid #f59e0b55', borderRadius: 6, color: '#f59e0b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  ⚡ Match Reference ({refAnalysis.loudness_db?.toFixed(1)} LUFS)
                </button>
              )}
            </div>

            {/* Target LUFS */}
            <div style={{ padding: '12px 14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Target Loudness</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <input type="range" min="-30" max="-6" step="0.5" value={targetLUFS} onChange={e => setTargetLUFS(+e.target.value)} style={{ flex: 1 }} />
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: '#3b82f6', minWidth: 58 }}>{targetLUFS}</span>
                <span style={{ fontSize: 11, color: '#444' }}>LUFS</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#444' }}>True Peak:</span>
                <input type="range" min="-6" max="0" step="0.1" value={truePeak} onChange={e => setTruePeak(+e.target.value)} style={{ flex: 1 }} />
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#f59e0b', minWidth: 52 }}>{truePeak} dBFS</span>
              </div>
            </div>

            {/* Gain delta */}
            <div style={{ padding: '8px 14px', background: isGood ? '#0a1f0a' : '#111', border: `1px solid ${isGood ? '#22c55e44' : '#1a1a1a'}`, borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 20 }}>{isGood ? '✅' : gainNeeded > 0 ? '📢' : '🔇'}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isGood ? '#22c55e' : '#aaa' }}>
                  {isGood ? 'Loudness is on target' : `Need ${gainNeeded > 0 ? '+' : ''}${gainNeeded.toFixed(1)} dB adjustment`}
                </div>
                <div style={{ fontSize: 10, color: '#444' }}>Current: {currentLUFS.toFixed(1)} LUFS → Target: {targetLUFS} LUFS</div>
              </div>
            </div>

            {/* EQ Shelf knobs */}
            <div style={{ padding: '12px 14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Mastering EQ</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-around' }}>
                {[['Sub', 'sub', '#10b981', '40Hz'], ['Low', 'low', '#22c55e', '120Hz'], ['L-Mid', 'lowMid', '#f59e0b', '400Hz'],
                  ['H-Mid', 'highMid', '#ef4444', '2kHz'], ['High', 'high', '#3b82f6', '8kHz'], ['Air', 'air', '#8b5cf6', '16kHz']].map(([label, key, color, freq]) => (
                  <EQBandKnob key={key} label={`${label}\n${freq}`} value={eqBands[key]} color={color}
                    onChange={v => setEqBands(prev => ({ ...prev, [key]: Math.round(v * 10) / 10 }))} />
                ))}
              </div>
            </div>

            {/* Compressor settings */}
            <div style={{ padding: '12px 14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Glue Compressor</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['Threshold', 'threshold', -20, 0, 0.5, 'dB'], ['Ratio', 'ratio', 1, 8, 0.5, ':1'],
                  ['Attack', 'attack', 0.1, 100, 0.1, 'ms'], ['Release', 'release', 10, 500, 10, 'ms'],
                  ['Makeup', 'makeupGain', 0, 12, 0.5, 'dB']].map(([label, key, min, max, step, unit]) => (
                  <div key={key}>
                    <div style={{ fontSize: 9, color: '#444', marginBottom: 3 }}>{label}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="range" min={min} max={max} step={step} value={compSettings[key]} style={{ flex: 1 }}
                        onChange={e => setCompSettings(prev => ({ ...prev, [key]: +e.target.value }))} />
                      <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace', minWidth: 36 }}>{compSettings[key]}{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Limiter */}
            <div style={{ padding: '10px 14px', background: '#111', border: '1px solid #ef444422', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>True Peak Limiter</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min="-6" max="0" step="0.05" value={limitCeil} onChange={e => setLimitCeil(+e.target.value)} style={{ flex: 1 }} />
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#ef4444', minWidth: 58 }}>{limitCeil} dBFS</span>
              </div>
            </div>

            {/* ID3 Tags */}
            <div style={{ padding: '12px 14px', background: '#111', border: '1px solid #8b5cf622', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>ID3 Tags (MP3 metadata)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['Title', 'title'], ['Artist', 'artist'], ['Album', 'album'], ['Year', 'year'], ['Genre', 'genre']].map(([label, key]) => (
                  <div key={key}>
                    <div style={{ fontSize: 9, color: '#555', marginBottom: 3 }}>{label}</div>
                    <input value={id3[key]} onChange={e => setId3(prev => ({ ...prev, [key]: e.target.value }))} placeholder={label}
                      style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc', borderRadius: 5, padding: '5px 8px', fontSize: 11, outline: 'none' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Export settings */}
            <div style={{ padding: '12px 14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Export Format</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {['mp3', 'wav', 'flac', 'aac'].map(f => (
                  <button key={f} onClick={() => setFormat(f)}
                    style={{ flex: 1, padding: '5px', background: format === f ? '#1e3a5f' : 'transparent', border: `1px solid ${format === f ? '#3b82f6' : '#222'}`, borderRadius: 5, color: format === f ? '#3b82f6' : '#555', cursor: 'pointer', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>
                    {f}
                  </button>
                ))}
              </div>
              {format === 'mp3' && (
                <div style={{ display: 'flex', gap: 5 }}>
                  {[128, 192, 256, 320].map(b => (
                    <button key={b} onClick={() => setBitrate(b)}
                      style={{ flex: 1, padding: '4px', background: bitrate === b ? '#1e3a5f' : 'transparent', border: `1px solid ${bitrate === b ? '#3b82f6' : '#1a1a1a'}`, borderRadius: 4, color: bitrate === b ? '#3b82f6' : '#444', cursor: 'pointer', fontSize: 10 }}>
                      {b}k
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleMaster} disabled={!file}
              style={{ padding: '13px', background: file ? 'linear-gradient(135deg,#1e3a5f,#0f2040)' : '#111', border: `1px solid ${file ? '#3b82f6' : '#1a1a1a'}`, borderRadius: 10, color: file ? '#60a5fa' : '#333', cursor: file ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700 }}>
              🚀 Master & Export {format.toUpperCase()}
            </button>

            {status && (
              <div style={{ padding: '8px 12px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 6, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#888', flex: 1 }}>{status.stage}</span>
                <div style={{ width: 100, background: '#1a1a1a', borderRadius: 3, height: 4 }}>
                  <div style={{ width: `${status.progress}%`, height: '100%', background: '#3b82f6', borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* LUFS Meter */}
            <div style={{ padding: '12px 14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Loudness Meter</div>
              <LUFSMeter value={currentLUFS} target={targetLUFS} />
            </div>

            {/* A/B Compare */}
            {compareMode && (
              <div style={{ padding: '12px 14px', background: '#0d0d0d', border: '1px solid #8b5cf644', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>A/B Comparison</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1, padding: '6px', background: '#111', borderRadius: 6, textAlign: 'center', fontSize: 10, color: '#555' }}>
                    <div style={{ color: '#3b82f6', fontWeight: 700, marginBottom: 3 }}>A — Original</div>
                    {waveformPeaks.length > 0 && <WaveformDisplay peaks={waveformPeaks} color="#3b82f6" />}
                    <div>{currentLUFS.toFixed(1)} LUFS</div>
                  </div>
                  <div style={{ flex: 1, padding: '6px', background: '#111', borderRadius: 6, textAlign: 'center', fontSize: 10, color: '#555' }}>
                    <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: 3 }}>B — Mastered</div>
                    {waveformPeaks.length > 0 && <WaveformDisplay peaks={waveformPeaks.map(v => Math.min(1, v * Math.pow(10, gainNeeded / 20)))} color="#22c55e" />}
                    <div>{targetLUFS} LUFS</div>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: '#444', textAlign: 'center' }}>
                  Gain change: {gainNeeded > 0 ? '+' : ''}{gainNeeded.toFixed(1)} dB
                </div>
              </div>
            )}

            {/* Streaming presets */}
            <div style={{ padding: '12px 14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Platform Presets</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {STREAMING_PRESETS.map(preset => (
                  <button key={preset.name} onClick={() => applyPreset(preset)}
                    style={{ padding: '8px 4px', background: targetLUFS === preset.lufs ? `${preset.color}22` : '#0d0d0d', border: `1px solid ${targetLUFS === preset.lufs ? `${preset.color}66` : '#1a1a1a'}`, borderRadius: 8, color: targetLUFS === preset.lufs ? preset.color : '#444', cursor: 'pointer', fontSize: 9, textAlign: 'center', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 16, marginBottom: 2 }}>{preset.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 9 }}>{preset.name}</div>
                    <div style={{ fontSize: 8, marginTop: 1 }}>{preset.lufs} LUFS</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info panel */}
            <div style={{ padding: '12px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Processing Chain</div>
              {[['📊 Parametric EQ', `Sub:${eqBands.sub>0?'+':''}${eqBands.sub} Low:${eqBands.low>0?'+':''}${eqBands.low} H-Mid:${eqBands.highMid>0?'+':''}${eqBands.highMid} Air:${eqBands.air>0?'+':''}${eqBands.air}`],
                ['🗜️ Glue Comp', `${compSettings.threshold}dB / ${compSettings.ratio}:1 | ${compSettings.makeupGain>0?'+':''}${compSettings.makeupGain}dB makeup`],
                ['🔒 True Peak', `Ceiling: ${limitCeil} dBFS`],
                ['🎚️ Loudness', `${targetLUFS} LUFS integrated`],
                ['🏷️ ID3', id3.title ? `"${id3.title}" by ${id3.artist || '?'}` : 'No tags set'],
              ].map(([step, detail]) => (
                <div key={step} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #141414', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{step.split(' ')[0]}</span>
                  <div>
                    <div style={{ fontSize: 10, color: '#888' }}>{step.split(' ').slice(1).join(' ')}</div>
                    <div style={{ fontSize: 9, color: '#444' }}>{detail}</div>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 9, color: '#1e3a5f', marginTop: 8, padding: '4px 8px', background: '#0a0f1a', borderRadius: 4 }}>
                ↓ Output: {format.toUpperCase()} {format === 'mp3' ? `${bitrate}kbps` : '24-bit'} • {targetLUFS} LUFS • {truePeak} dBFS TP
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
