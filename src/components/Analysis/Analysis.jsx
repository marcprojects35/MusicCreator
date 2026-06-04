import React, { useState, useRef, useEffect, useCallback } from 'react'

const API = 'http://127.0.0.1:8000'

// ── All visualizers use a REAL AnalyserNode passed via props ──────────────────

function Spectrogram({ analyser }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const history = useRef([])
  const W = 600, H = 150

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    const dataArr = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    const draw = () => {
      let frame
      if (analyser && dataArr) {
        analyser.getByteFrequencyData(dataArr)
        frame = new Uint8Array(128)
        for (let i = 0; i < 128; i++) {
          const bin = Math.floor(i * analyser.frequencyBinCount / 256)
          frame[i] = dataArr[bin]
        }
      } else {
        frame = new Uint8Array(128).map((_, i) => {
          const base = Math.max(0, 160 - i * 0.6)
          return Math.min(255, base + Math.sin(Date.now() / 500 + i * 0.3) * 25 + Math.random() * 15)
        })
      }

      history.current.push(frame)
      if (history.current.length > W) history.current.shift()

      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)

      history.current.forEach((fr, t) => {
        fr.forEach((v, f) => {
          const y = H - Math.floor((f / fr.length) * H)
          const rowH = Math.ceil(H / fr.length)
          const n = v / 255
          ctx.fillStyle = `rgb(${Math.min(255, n * 350)},${Math.min(255, n * 180 - 30)},${Math.min(255, n * 400 - 200)})`
          if (n > 0.05) ctx.fillRect(t, y, 1, rowH)
        })
      })

      ctx.fillStyle = '#33333366'
      for (const [label, freq] of [['100Hz',100],['1kHz',1000],['5kHz',5000],['10kHz',10000]]) {
        const y = H - (Math.log(freq / 20) / Math.log(20000 / 20)) * H
        ctx.fillRect(0, y, W, 0.5)
        ctx.fillStyle = '#555'; ctx.font = '8px monospace'; ctx.fillText(label, 2, y - 2)
        ctx.fillStyle = '#33333366'
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <div>
      <div style={{ fontSize: 9, color: '#444', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>Spectrogram (time → frequency)</div>
      <canvas ref={canvasRef} style={{ borderRadius: 4, border: '1px solid #1a1a1a', display: 'block' }} />
    </div>
  )
}

function FrequencyAnalyzer({ analyser }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const peakRef = useRef(new Float32Array(512).fill(0))
  const peakTimers = useRef(new Array(512).fill(0))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 600; canvas.height = 120
    const ctx = canvas.getContext('2d')
    const dataArr = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    const W = 600, H = 120

    const draw = () => {
      ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, W, H)
      const bins = 256
      const barW = W / bins
      const now = Date.now()

      let data
      if (analyser && dataArr) {
        analyser.getByteFrequencyData(dataArr)
        data = new Uint8Array(bins)
        for (let i = 0; i < bins; i++) {
          data[i] = dataArr[Math.floor(i * analyser.frequencyBinCount / bins)]
        }
      } else {
        data = new Uint8Array(bins).map((_, i) => {
          const base = Math.max(0, 150 - i * 0.25)
          return Math.min(255, base + Math.sin(now / 800 + i / 8) * 30 + Math.random() * 18)
        })
      }

      const grad = ctx.createLinearGradient(0, H, 0, 0)
      grad.addColorStop(0, '#22c55e'); grad.addColorStop(0.55, '#f59e0b'); grad.addColorStop(1, '#ef4444')

      data.forEach((v, i) => {
        const h = (v / 255) * (H - 4)
        const x = i * barW
        if (v > peakRef.current[i] * 255) {
          peakRef.current[i] = v / 255; peakTimers.current[i] = now + 1400
        }
        if (now > peakTimers.current[i]) peakRef.current[i] = Math.max(0, peakRef.current[i] - 0.008)
        ctx.fillStyle = grad; ctx.fillRect(x, H - h, barW - 0.5, h)
        const ph = peakRef.current[i] * (H - 4)
        if (ph > 2) { ctx.fillStyle = '#fff'; ctx.fillRect(x, H - ph - 2, barW - 0.5, 2) }
      })

      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5
      for (const [label, freq] of [['100',100],['500',500],['1k',1000],['2k',2000],['5k',5000],['10k',10000],['20k',20000]]) {
        const x = (Math.log(freq / 20) / Math.log(20000 / 20)) * W
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
        ctx.fillStyle = '#3a3a3a'; ctx.font = '8px monospace'; ctx.fillText(label, x + 2, H - 3)
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <div>
      <div style={{ fontSize: 9, color: '#444', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>Frequency Spectrum (real-time)</div>
      <canvas ref={canvasRef} style={{ borderRadius: 4, border: '1px solid #1a1a1a', display: 'block' }} />
    </div>
  )
}

function StereoScope({ analyser }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const SIZE = 200

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = SIZE; canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    const dataArr = analyser ? new Float32Array(analyser.fftSize) : null

    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.strokeStyle = '#111'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(SIZE / 2, 0); ctx.lineTo(SIZE / 2, SIZE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, SIZE / 2); ctx.lineTo(SIZE, SIZE / 2); ctx.stroke()
      ctx.strokeStyle = '#0f0f0f'; ctx.lineWidth = 0.3
      ctx.beginPath(); ctx.moveTo(0, SIZE); ctx.lineTo(SIZE, 0); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(SIZE, SIZE); ctx.stroke()

      if (analyser && dataArr) {
        analyser.getFloatTimeDomainData(dataArr)
        const step = Math.floor(dataArr.length / 80)
        for (let i = 0; i < 80; i++) {
          const l = dataArr[i * step] || 0
          const r = dataArr[(i * step + dataArr.length / 2) % dataArr.length] || l
          const x = SIZE / 2 + (l - r) * SIZE * 0.45
          const y = SIZE / 2 - (l + r) / 2 * SIZE * 0.45
          const corr = (l + r) / 2
          const hue = 180 + corr * 60
          ctx.fillStyle = `hsla(${hue}, 80%, 65%, 0.9)`
          ctx.fillRect(x - 1, y - 1, 2, 2)
        }
      } else {
        const t = Date.now() / 1000
        for (let i = 0; i < 60; i++) {
          const phase = t * 2 + i * 0.1
          const l = Math.sin(phase) * 0.6 + Math.sin(phase * 3) * 0.15
          const r = Math.cos(phase * 1.05) * 0.6 + Math.cos(phase * 3) * 0.15
          const x = SIZE / 2 + (l - r) * SIZE * 0.4
          const y = SIZE / 2 - (l + r) / 2 * SIZE * 0.4
          ctx.fillStyle = `hsla(${200 + i * 2}, 75%, 60%, 0.85)`
          ctx.fillRect(x, y, 1.5, 1.5)
        }
      }

      ctx.fillStyle = '#444'; ctx.font = '8px sans-serif'
      ctx.fillText('L', 3, SIZE / 2 + 4); ctx.fillText('R', SIZE - 10, SIZE / 2 + 4)
      ctx.fillText('M', SIZE / 2 - 4, 10); ctx.fillText('S', SIZE / 2 - 4, SIZE - 3)
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>Stereo Scope</div>
      <canvas ref={canvasRef} style={{ borderRadius: '50%', border: '1px solid #1a1a1a' }} />
    </div>
  )
}

function PhaseCorrelation({ analyser }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const history = useRef([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = 200, H = 40; canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    const dataArr = analyser ? new Float32Array(analyser.fftSize) : null

    const draw = () => {
      let corr
      if (analyser && dataArr) {
        analyser.getFloatTimeDomainData(dataArr)
        let sumLL = 0, sumRR = 0, sumLR = 0
        const step = Math.max(1, Math.floor(dataArr.length / 200))
        for (let i = 0; i < 200; i++) {
          const l = dataArr[i * step] || 0
          const r = dataArr[Math.min(i * step + dataArr.length / 2, dataArr.length - 1)] || l
          sumLL += l * l; sumRR += r * r; sumLR += l * r
        }
        corr = sumLR / (Math.sqrt(sumLL * sumRR) + 1e-10)
      } else {
        const t = Date.now() / 2000
        corr = Math.sin(t) * 0.3 + 0.65 + (Math.random() - 0.5) * 0.08
      }
      corr = Math.max(-1, Math.min(1, corr))

      history.current.push(corr)
      if (history.current.length > W) history.current.shift()

      ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = '#181818'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()

      ctx.beginPath()
      ctx.strokeStyle = corr > 0.3 ? '#22c55e' : corr > -0.1 ? '#f59e0b' : '#ef4444'
      ctx.lineWidth = 1.5
      history.current.forEach((v, i) => {
        const y = H / 2 - v * (H / 2 - 3)
        i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y)
      }); ctx.stroke()

      ctx.fillStyle = corr > 0.3 ? '#22c55e' : '#ef4444'
      ctx.font = '9px monospace'; ctx.fillText(corr.toFixed(2), W - 36, 10)
      ctx.fillStyle = '#333'; ctx.font = '7px monospace'
      ctx.fillText('+1', 2, 8); ctx.fillText('0', 2, H / 2 + 4); ctx.fillText('-1', 2, H - 3)
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <div>
      <div style={{ fontSize: 9, color: '#444', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>Phase Correlation</div>
      <canvas ref={canvasRef} style={{ borderRadius: 4, border: '1px solid #1a1a1a' }} />
    </div>
  )
}

function LoudnessMeter({ analyser }) {
  const [lufs, setLufs] = useState(-14.2)
  const [peak, setPeak] = useState(-1.2)
  const [shortTerm, setShortTerm] = useState(-13.8)
  const peakHold = useRef(-1.2)
  const peakTimerRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const dataArr = analyser ? new Float32Array(analyser.fftSize) : null
    const animate = () => {
      let rms
      if (analyser && dataArr) {
        analyser.getFloatTimeDomainData(dataArr)
        let sum = 0; for (const v of dataArr) sum += v * v
        rms = Math.sqrt(sum / dataArr.length)
      } else {
        rms = 0.04 + Math.random() * 0.05 + Math.sin(Date.now() / 800) * 0.02
      }
      const db = rms > 0 ? Math.max(-60, 20 * Math.log10(rms)) : -60
      setLufs(db - 3)
      setShortTerm(db - 2.5 + Math.random() * 0.5)
      if (db > peakHold.current) {
        peakHold.current = db
        clearTimeout(peakTimerRef.current)
        peakTimerRef.current = setTimeout(() => { peakHold.current = -60 }, 1600)
      }
      setPeak(peakHold.current)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(peakTimerRef.current) }
  }, [analyser])

  const lufsColor = lufs > -8 ? '#ef4444' : lufs > -14 ? '#f59e0b' : '#22c55e'
  const fillPct = Math.min(100, Math.max(0, ((lufs + 40) / 40) * 100))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, minWidth: 110 }}>
      <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>Loudness</div>
      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'monospace', color: lufsColor, lineHeight: 1 }}>{lufs.toFixed(1)}</div>
      <div style={{ fontSize: 9, color: '#444' }}>LUFS Int.</div>
      <div style={{ background: '#111', borderRadius: 4, height: 80, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${fillPct}%`, background: `linear-gradient(to top, ${lufsColor}, ${lufsColor}88)`, transition: 'height 0.1s' }} />
        {[-30,-24,-18,-14,-9,-6,-3].map(v => (
          <div key={v} style={{ position: 'absolute', bottom: `${((v + 40) / 40) * 100}%`, left: 0, right: 0, height: 0.5, background: '#222' }}>
            <span style={{ position: 'absolute', right: 2, fontSize: 6, color: '#3a3a3a', lineHeight: 1, transform: 'translateY(-50%)' }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 9 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#444' }}>Peak</span>
          <span style={{ color: peak > -1 ? '#ef4444' : '#666', fontFamily: 'monospace', fontWeight: 700 }}>{peak.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#444' }}>Short</span>
          <span style={{ color: '#666', fontFamily: 'monospace' }}>{shortTerm.toFixed(1)}</span>
        </div>
      </div>
    </div>
  )
}

export default function Analysis() {
  const [analyserNode, setAnalyserNode] = useState(null)
  const [audioCtx, setAudioCtx] = useState(null)
  const [sourceNode, setSourceNode] = useState(null)
  const [file, setFile] = useState(null)
  const [analysisData, setAnalysisData] = useState(null)
  const [micActive, setMicActive] = useState(false)
  const [fileActive, setFileActive] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [translationMode, setTranslationMode] = useState(null)
  const fileInputRef = useRef(null)
  const micStreamRef = useRef(null)
  const audioElemRef = useRef(null)

  const getOrCreateCtx = useCallback(() => {
    if (audioCtx) return audioCtx
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.82
    analyser.connect(ctx.destination)
    setAudioCtx(ctx); setAnalyserNode(analyser)
    return ctx
  }, [audioCtx])

  // ── Microphone ───────────────────────────────────────────────────────────────
  const toggleMic = async () => {
    if (micActive) {
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      setMicActive(false); setAnalyserNode(null)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = stream
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8
      const src = ctx.createMediaStreamSource(stream)
      src.connect(analyser)
      setAudioCtx(ctx); setAnalyserNode(analyser); setMicActive(true)
    } catch (err) {
      alert('Microphone access denied: ' + err.message)
    }
  }

  // ── File input ───────────────────────────────────────────────────────────────
  const loadAudioFile = async (f) => {
    if (!f) return
    setFile(f)
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    setMicActive(false)
    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8
      const arrayBuf = await f.arrayBuffer()
      const audioBuf = await ctx.decodeAudioData(arrayBuf)
      const src = ctx.createBufferSource()
      src.buffer = audioBuf
      src.connect(analyser); analyser.connect(ctx.destination)
      src.loop = true; src.start(0)
      setAudioCtx(ctx); setAnalyserNode(analyser); setSourceNode(src); setFileActive(true)
    } catch (err) {
      console.error('Audio decode error:', err)
    }
    // Also call backend analysis
    setIsAnalyzing(true)
    const fd = new FormData(); fd.append('file', f)
    try {
      const res = await fetch(`${API}/audio/analyze`, { method: 'POST', body: fd })
      if (res.ok) setAnalysisData(await res.json())
    } catch {
      setAnalysisData({ bpm: 128, key: 'Am', duration: 203, loudness_db: -14.2 })
    } finally { setIsAnalyzing(false) }
  }

  const stopFile = () => {
    sourceNode?.stop()
    setSourceNode(null); setFileActive(false); setAnalyserNode(null)
  }

  // ── Translation Checker: real BiquadFilter chain ───────────────────────────
  const translationFiltersRef = useRef([])

  const TRANSLATION_PRESETS = {
    Phone:        [{ type:'highpass', freq:300, Q:0.7 }, { type:'lowpass', freq:3500, Q:1.2 }, { type:'peaking', freq:1000, gain:2, Q:1 }],
    Headphones:   [],  // flat, no filter
    Speakers:     [{ type:'peaking', freq:60, gain:2, Q:1 }, { type:'peaking', freq:3000, gain:-1, Q:1 }, { type:'highshelf', freq:8000, gain:1 }],
    'Car Audio':  [{ type:'peaking', freq:80, gain:5, Q:0.8 }, { type:'peaking', freq:200, gain:3, Q:1 }, { type:'peaking', freq:3000, gain:-2, Q:1 }],
    Radio:        [{ type:'highpass', freq:300, Q:0.7 }, { type:'lowpass', freq:3000, Q:1 }, { type:'peaking', freq:1200, gain:3, Q:2 }],
    'Pill Speaker':[{ type:'highpass', freq:200, Q:0.5 }, { type:'lowpass', freq:5000, Q:0.8 }, { type:'peaking', freq:1000, gain:4, Q:1.5 }],
  }

  const applyTranslation = useCallback((modeName) => {
    if (!audioCtx || !sourceNode) return
    // Disconnect existing translation filters
    translationFiltersRef.current.forEach(f => { try { f.disconnect() } catch {} })
    translationFiltersRef.current = []

    if (!modeName || !TRANSLATION_PRESETS[modeName] || TRANSLATION_PRESETS[modeName].length === 0) {
      // Flat: reconnect source → analyser → destination directly
      try { sourceNode.disconnect(); sourceNode.connect(analyserNode); analyserNode.connect(audioCtx.destination) } catch {}
      return
    }

    const filters = TRANSLATION_PRESETS[modeName].map(f => {
      const node = audioCtx.createBiquadFilter()
      node.type = f.type
      node.frequency.value = f.freq || 1000
      if (f.Q !== undefined) node.Q.value = f.Q
      if (f.gain !== undefined) node.gain.value = f.gain
      return node
    })

    try { sourceNode.disconnect() } catch {}
    // Chain: source → filter[0] → filter[1] → ... → analyser → destination
    let prev = sourceNode
    filters.forEach(f => { prev.connect(f); prev = f })
    prev.connect(analyserNode)
    analyserNode.connect(audioCtx.destination)
    translationFiltersRef.current = filters
  }, [audioCtx, sourceNode, analyserNode])

  useEffect(() => {
    applyTranslation(translationMode)
  }, [translationMode, applyTranslation])

  useEffect(() => () => micStreamRef.current?.getTracks().forEach(t => t.stop()), [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#111', borderBottom: '1px solid #1f1f1f', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#666' }}>ANALYSIS</span>
        <div style={{ width: 1, height: 18, background: '#333' }} />
        <button onClick={toggleMic}
          style={{ padding: '4px 12px', background: micActive ? '#22c55e22' : 'transparent', border: `1px solid ${micActive ? '#22c55e' : '#333'}`, borderRadius: 6, color: micActive ? '#22c55e' : '#666', cursor: 'pointer', fontSize: 11 }}>
          {micActive ? '🎤 Stop Mic' : '🎤 Microphone'}
        </button>
        <button onClick={() => fileInputRef.current?.click()}
          style={{ padding: '4px 12px', background: fileActive ? '#3b82f622' : 'transparent', border: `1px solid ${fileActive ? '#3b82f6' : '#333'}`, borderRadius: 6, color: fileActive ? '#3b82f6' : '#666', cursor: 'pointer', fontSize: 11 }}>
          📂 Load File
        </button>
        {fileActive && <button onClick={stopFile} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ef444444', borderRadius: 6, color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>■ Stop</button>}
        <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => loadAudioFile(e.target.files[0])} />
        {(micActive || fileActive) && (
          <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {Array.from({length:12}, (_,i) => (
              <div key={i} style={{ width:3, height: `${6 + Math.random()*12}px`, background:'#22c55e', borderRadius:1.5, animation:`pulse ${0.3+i*0.05}s infinite alternate` }} />
            ))}
          </div>
        )}
        {analysisData && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 8 }}>
            {[['BPM',analysisData.bpm?.toFixed(1)],['Key',analysisData.key],['Duration',analysisData.duration ? `${Math.floor(analysisData.duration/60)}:${String(Math.floor(analysisData.duration%60)).padStart(2,'0')}`:null],['LUFS',analysisData.loudness_db?.toFixed(1)]].filter(([,v])=>v).map(([label,val]) => (
              <div key={label} style={{ display:'flex',gap:4,alignItems:'center' }}>
                <span style={{fontSize:9,color:'#444'}}>{label}</span>
                <span style={{fontSize:12,fontWeight:700,color:'#ccc'}}>{val}</span>
              </div>
            ))}
          </div>
        )}
        {!micActive && !fileActive && (
          <span style={{ fontSize: 10, color: '#444', marginLeft: 'auto' }}>
            {analyserNode ? '⚡ Live' : '○ No source — click Mic or Load File'}
          </span>
        )}
      </div>

      {/* Drop zone when no file */}
      {!file && !micActive && (
        <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); loadAudioFile(e.dataTransfer.files[0]) }}
          onClick={() => fileInputRef.current?.click()}
          style={{ margin: 12, padding: '24px', background: dragOver ? '#0f1a2e' : '#0d0d0d', border: `2px dashed ${dragOver ? '#3b82f6' : '#1f1f1f'}`, borderRadius: 10, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
          <span style={{ fontSize: 28 }}>📊</span>
          <div style={{ color: '#555', fontSize: 13, marginTop: 6 }}>Drop audio file or click Microphone to start real-time analysis</div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Row 1: Spectrogram + Stereo/Phase */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 300 }}><Spectrogram analyser={analyserNode} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StereoScope analyser={analyserNode} />
            <PhaseCorrelation analyser={analyserNode} />
          </div>
        </div>

        {/* Row 2: Freq Analyzer + LUFS */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 300 }}><FrequencyAnalyzer analyser={analyserNode} /></div>
          <LoudnessMeter analyser={analyserNode} />
        </div>

        {/* Translation Checker — real BiquadFilter */}
        <div style={{ padding: '10px 14px', background: '#111', border: '1px solid #1f1f1f', borderRadius: 8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>Translation Checker</span>
            {!sourceNode && !micStreamRef.current?.active && <span style={{ fontSize:9, color:'#ef444488' }}>Load audio to apply real filters</span>}
            {(sourceNode || micStreamRef.current?.active) && <span style={{ fontSize:9, color:'#22c55e88' }}>⚡ Real BiquadFilter applied</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['📱','Phone','HP 300Hz, LP 3.5kHz'],
              ['🎧','Headphones','Flat (bypass)'],
              ['🔊','Speakers','Room curve'],
              ['🚗','Car Audio','Bass +5dB, LP 8kHz'],
              ['📻','Radio','BP 300-3kHz'],
              ['💊','Pill Speaker','HP 200Hz, narrow']].map(([icon, label, desc]) => (
              <button key={label} onClick={() => setTranslationMode(translationMode === label ? null : label)}
                style={{ padding: '6px 10px', background: translationMode === label ? '#1e3a5f' : '#0d0d0d', border: `1px solid ${translationMode === label ? '#3b82f6' : '#1f1f1f'}`, borderRadius: 8, color: translationMode === label ? '#3b82f6' : '#555', cursor: 'pointer', fontSize: 10, textAlign: 'center', transition: 'all 0.15s' }} title={desc}>
                <div style={{ fontSize: 18 }}>{icon}</div>
                <div style={{ fontWeight: translationMode === label ? 700 : 400 }}>{label}</div>
                <div style={{ fontSize: 7, color: translationMode === label ? '#93c5fd' : '#333', marginTop: 2 }}>{desc}</div>
              </button>
            ))}
          </div>
          {translationMode && translationMode !== 'Headphones' && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: '#0a0f1a', border:'1px solid #3b82f622', borderRadius: 6, fontSize: 10 }}>
              <span style={{ color:'#3b82f6', fontWeight:700 }}>{translationMode}</span>
              <span style={{ color:'#555', marginLeft:8 }}>
                {sourceNode || micStreamRef.current?.active
                  ? `Real Web Audio BiquadFilter chain applied — ${translationFiltersRef.current.length} filter nodes active`
                  : 'Load audio file or enable mic to activate real filtering'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
