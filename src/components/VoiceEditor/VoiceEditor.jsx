import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { voiceActions } from '../../store'
import * as Tone from 'tone'

const EFFECT_PRESETS = {
  'Pop': { autotune: { enabled: true, intensity: 0.5 }, reverb: { enabled: true, wetDry: 0.25 }, compressor: { enabled: true, threshold: -18, ratio: 4 }, eq: { enabled: true, low: 2, mid: 1, high: 3, presence: 2 } },
  'Trap': { autotune: { enabled: true, intensity: 0.95, style: 'robotic' }, reverb: { enabled: true, wetDry: 0.4, type: 'hall' }, delay: { enabled: true, time: 250, feedback: 0.35 }, compressor: { enabled: true, threshold: -20, ratio: 6 } },
  'Metal': { distortion: { enabled: true, type: 'hard', amount: 0.7 }, compressor: { enabled: true, threshold: -25, ratio: 8 }, eq: { enabled: true, low: 4, mid: -2, high: 2, presence: 4 } },
  'R&B': { autotune: { enabled: true, intensity: 0.3 }, reverb: { enabled: true, wetDry: 0.35, type: 'plate' }, compressor: { enabled: true, threshold: -16, ratio: 3 }, eq: { enabled: true, low: 3, mid: 1, high: 1, presence: 1 } },
  'Raw': { deBreath: { enabled: true, sensitivity: 0.5 }, compressor: { enabled: true, threshold: -20, ratio: 4 } }
}

const GENRE_EFFECTS = {
  'Trap': ['autotune', 'reverb', 'delay', 'compressor'],
  'Metal': ['distortion', 'compressor', 'eq'],
  'Pop': ['autotune', 'compressor', 'reverb', 'eq', 'deEsser'],
  'R&B': ['autotune', 'reverb', 'compressor', 'chorus'],
  'Drill': ['autotune', 'reverb', 'delay', 'compressor']
}

export default function VoiceEditor() {
  const dispatch = useDispatch()
  const { isRecording, takes, selectedTake, effects } = useSelector(s => s.voice)

  const [inputLevel, setInputLevel] = useState(0)
  const [activeTab, setActiveTab] = useState('record')
  const [recordingTime, setRecordingTime] = useState(0)
  const [playingTakeId, setPlayingTakeId] = useState(null)
  const [showPresets, setShowPresets] = useState(false)

  // Advanced tab state
  const [autotuneKey, setAutotuneKey] = useState('C')
  const [autotuneScale, setAutotuneScale] = useState('major')
  const [autotuneIntensity, setAutotuneIntensity] = useState(0.8)
  const [harmonyIntervals, setHarmonyIntervals] = useState([4, 7])
  const [harmonyMix, setHarmonyMix] = useState(0.5)
  const [processing, setProcessing] = useState(null) // 'autotune'|'harmony'|'debreath'|null
  const [processResult, setProcessResult] = useState(null) // {url, type, info}
  const [processError, setProcessError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const timerRef = useRef(null)
  const playerRef = useRef(null)

  const startRec = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 44100, channelCount: 1 }
      })
      streamRef.current = stream
      chunksRef.current = []

      audioCtxRef.current = new AudioContext()
      const src = audioCtxRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 512
      src.connect(analyserRef.current)

      const mime = 'audio/webm'
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: mime })
      mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorderRef.current.start(100)

      dispatch(voiceActions.startRecording())
      setRecordingTime(0)

      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)

      const tick = () => {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteTimeDomainData(data)
        const rms = Math.sqrt(data.reduce((s, v) => s + ((v - 128) / 128) ** 2, 0) / data.length)
        setInputLevel(Math.min(1, rms * 4))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (err) { alert('Microphone access denied: ' + err.message) }
  }, [dispatch])

  const stopRec = useCallback(() => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    setInputLevel(0)

    if (!mediaRecorderRef.current) return
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const url = URL.createObjectURL(blob)
      dispatch(voiceActions.addTake({ url, duration: recordingTime, name: `Take ${takes.length + 1}`, timestamp: Date.now() }))
      dispatch(voiceActions.stopRecording())
    }
    mediaRecorderRef.current.stop()
    audioCtxRef.current?.close()
  }, [dispatch, recordingTime, takes.length])

  const playTake = useCallback((take) => {
    playerRef.current?.stop()
    const audio = new Audio(take.url)
    audio.onended = () => setPlayingTakeId(null)
    audio.play()
    playerRef.current = audio
    setPlayingTakeId(take.id)
  }, [])

  const applyPreset = (name) => {
    const preset = EFFECT_PRESETS[name]
    Object.entries(preset).forEach(([effect, params]) => {
      dispatch(voiceActions.updateEffect({ effect, params }))
    })
    setShowPresets(false)
  }

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const selectedTakeObj = takes.find(t => t.id === selectedTake)

  const processWithBackend = useCallback(async (endpoint, formFields, type) => {
    if (!selectedTakeObj) return
    setProcessing(type)
    setProcessError(null)
    setProcessResult(null)
    try {
      const blob = await fetch(selectedTakeObj.url).then(r => r.blob())
      const fd = new FormData()
      fd.append('file', blob, 'take.wav')
      Object.entries(formFields).forEach(([k, v]) => fd.append(k, String(v)))
      const res = await fetch(`http://127.0.0.1:8000${endpoint}`, { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || res.statusText)
      }
      const outBlob = await res.blob()
      const url = URL.createObjectURL(outBlob)
      const corrections = res.headers.get('X-Corrections')
      const voices = res.headers.get('X-Voices-Added')
      setProcessResult({ url, type, info: corrections ? `${corrections} corrections applied` : voices ? `${voices} harmony voice(s) added` : 'Done' })
    } catch (err) {
      setProcessError(err.message)
    } finally {
      setProcessing(null)
    }
  }, [selectedTakeObj])

  const saveProcessedTake = useCallback(() => {
    if (!processResult) return
    dispatch(voiceActions.addTake({
      url: processResult.url,
      duration: selectedTakeObj?.duration || 0,
      name: `${selectedTakeObj?.name || 'Take'} (${processResult.type})`,
      timestamp: Date.now()
    }))
    setProcessResult(null)
  }, [processResult, selectedTakeObj, dispatch])

  const HARMONY_OPTIONS = [
    { label: '3rd', semitones: 4 },
    { label: '5th', semitones: 7 },
    { label: '6th', semitones: 9 },
    { label: '8va', semitones: 12 },
    { label: '-3rd', semitones: -3 },
    { label: '-Oct', semitones: -12 },
  ]

  const tabs = ['record', 'effects', 'advanced']

  return (
    <div style={{ background: '#111', borderRadius: 12, padding: 20, color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>🎤 Voice Editor</h2>
        <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: 8, padding: 4 }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: '6px 14px', background: activeTab === tab ? '#3b82f6' : 'transparent', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, textTransform: 'capitalize' }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* RECORD TAB */}
      {activeTab === 'record' && (
        <div>
          {/* Recording controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: 20, background: '#1a1a1a', borderRadius: 10 }}>
            <button onClick={isRecording ? stopRec : startRec}
              style={{ width: 60, height: 60, borderRadius: '50%', background: isRecording ? '#ef4444' : '#22c55e', border: 'none', cursor: 'pointer', fontSize: 24 }}>
              {isRecording ? '⏹' : '🎙'}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                {isRecording ? <span style={{ color: '#ef4444' }}>⚫ Recording... {formatTime(recordingTime)}</span> : 'Click to Record'}
              </div>
              {/* Level meter */}
              <div style={{ height: 12, background: '#333', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${inputLevel * 100}%`, height: '100%', background: inputLevel > 0.8 ? '#ef4444' : inputLevel > 0.5 ? '#eab308' : '#22c55e', transition: 'width 0.05s', borderRadius: 6 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: inputLevel * 20 > i ? (i > 16 ? '#ef4444' : i > 12 ? '#eab308' : '#22c55e') : '#333' }} />
                ))}
              </div>
            </div>
          </div>

          {/* Takes list */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 10, fontWeight: 600 }}>TAKES ({takes.length})</div>
            {takes.length === 0 && <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: 20 }}>No takes yet. Hit record!</div>}
            {takes.map((take, i) => (
              <div key={take.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: selectedTake === take.id ? '#1e3a5f' : '#1a1a1a', borderRadius: 8, marginBottom: 6, border: `1px solid ${selectedTake === take.id ? '#3b82f6' : '#333'}`, cursor: 'pointer' }}
                onClick={() => dispatch(voiceActions.selectTake(take.id))}>
                <span style={{ color: '#3b82f6', fontWeight: 700, minWidth: 24 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 14 }}>{take.name}</span>
                <span style={{ fontSize: 12, color: '#666' }}>{formatTime(take.duration)}</span>
                <button onClick={e => { e.stopPropagation(); playTake(take) }}
                  style={{ padding: '4px 10px', background: playingTakeId === take.id ? '#eab308' : '#222', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12 }}>
                  {playingTakeId === take.id ? '⏸' : '▶'}
                </button>
                <button onClick={e => { e.stopPropagation(); dispatch(voiceActions.removeTake(take.id)) }}
                  style={{ padding: '4px 8px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EFFECTS TAB */}
      {activeTab === 'effects' && (
        <div>
          {/* Presets */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#888', alignSelf: 'center' }}>Quick preset:</span>
            {Object.keys(EFFECT_PRESETS).map(name => (
              <button key={name} onClick={() => applyPreset(name)}
                style={{ padding: '6px 14px', background: '#222', border: '1px solid #444', borderRadius: 20, color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                {name}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <EffectCard name="🎼 Auto-Tune" effectKey="autotune" effects={effects} dispatch={dispatch}>
              <Slider label="Intensity" val={effects.autotune.intensity} min={0} max={1} step={0.01} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'autotune', params: { intensity: v } }))} />
              <Select label="Style" val={effects.autotune.style} opts={['natural','robotic','extreme']} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'autotune', params: { style: v } }))} />
            </EffectCard>

            <EffectCard name="🎚 Pitch Shift" effectKey="pitchShift" effects={effects} dispatch={dispatch}>
              <Slider label="Semitones" val={effects.pitchShift.semitones} min={-12} max={12} step={1} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'pitchShift', params: { semitones: v } }))} format={v => `${v > 0 ? '+' : ''}${v} st`} />
              <Slider label="Formant" val={effects.pitchShift.formantShift} min={-12} max={12} step={1} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'pitchShift', params: { formantShift: v } }))} format={v => `${v > 0 ? '+' : ''}${v} st`} />
            </EffectCard>

            <EffectCard name="🏛 Reverb" effectKey="reverb" effects={effects} dispatch={dispatch}>
              <Select label="Type" val={effects.reverb.type} opts={['room','hall','plate','chamber','spring']} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'reverb', params: { type: v } }))} />
              <Slider label="Wet/Dry" val={effects.reverb.wetDry} min={0} max={1} step={0.01} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'reverb', params: { wetDry: v } }))} format={v => `${Math.round(v * 100)}%`} />
              <Slider label="Size" val={effects.reverb.size} min={0} max={1} step={0.01} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'reverb', params: { size: v } }))} />
            </EffectCard>

            <EffectCard name="⏱ Delay" effectKey="delay" effects={effects} dispatch={dispatch}>
              <Slider label="Time" val={effects.delay.time} min={50} max={1000} step={10} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'delay', params: { time: v } }))} format={v => `${v}ms`} />
              <Slider label="Feedback" val={effects.delay.feedback} min={0} max={0.9} step={0.01} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'delay', params: { feedback: v } }))} format={v => `${Math.round(v * 100)}%`} />
              <Slider label="Wet/Dry" val={effects.delay.wetDry} min={0} max={1} step={0.01} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'delay', params: { wetDry: v } }))} format={v => `${Math.round(v * 100)}%`} />
            </EffectCard>

            <EffectCard name="📉 Compressor" effectKey="compressor" effects={effects} dispatch={dispatch}>
              <Slider label="Threshold" val={effects.compressor.threshold} min={-60} max={0} step={1} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'compressor', params: { threshold: v } }))} format={v => `${v}dB`} />
              <Slider label="Ratio" val={effects.compressor.ratio} min={1} max={20} step={0.5} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'compressor', params: { ratio: v } }))} format={v => `${v}:1`} />
            </EffectCard>

            <EffectCard name="🎚 EQ 3-Band" effectKey="eq" effects={effects} dispatch={dispatch}>
              <Slider label="Bass" val={effects.eq.low} min={-12} max={12} step={0.5} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'eq', params: { low: v } }))} format={v => `${v > 0 ? '+' : ''}${v}dB`} />
              <Slider label="Mid" val={effects.eq.mid} min={-12} max={12} step={0.5} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'eq', params: { mid: v } }))} format={v => `${v > 0 ? '+' : ''}${v}dB`} />
              <Slider label="High" val={effects.eq.high} min={-12} max={12} step={0.5} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'eq', params: { high: v } }))} format={v => `${v > 0 ? '+' : ''}${v}dB`} />
            </EffectCard>

            <EffectCard name="🌬 De-Breath" effectKey="deBreath" effects={effects} dispatch={dispatch}>
              <Slider label="Sensitivity" val={effects.deBreath.sensitivity} min={0} max={1} step={0.05} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'deBreath', params: { sensitivity: v } }))} />
              <Select label="Mode" val={effects.deBreath.mode} opts={['auto','manual','aggressive','gentle']} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'deBreath', params: { mode: v } }))} />
            </EffectCard>

            <EffectCard name="🔥 Distortion" effectKey="distortion" effects={effects} dispatch={dispatch}>
              <Select label="Type" val={effects.distortion.type} opts={['soft','hard','clip','tube','fuzz','screamer','metal']} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'distortion', params: { type: v } }))} />
              <Slider label="Amount" val={effects.distortion.amount} min={0} max={1} step={0.01} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'distortion', params: { amount: v } }))} format={v => `${Math.round(v * 100)}%`} />
            </EffectCard>

            <EffectCard name="🌀 Chorus" effectKey="chorus" effects={effects} dispatch={dispatch}>
              <Slider label="Rate" val={effects.chorus.rate} min={0.1} max={8} step={0.1} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'chorus', params: { rate: v } }))} format={v => `${v.toFixed(1)} Hz`} />
              <Slider label="Depth" val={effects.chorus.depth} min={0} max={1} step={0.01} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'chorus', params: { depth: v } }))} />
              <Slider label="Wet/Dry" val={effects.chorus.wetDry} min={0} max={1} step={0.01} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'chorus', params: { wetDry: v } }))} format={v => `${Math.round(v * 100)}%`} />
            </EffectCard>

            <EffectCard name="🎯 De-Esser" effectKey="deEsser" effects={effects} dispatch={dispatch}>
              <Slider label="Frequency" val={effects.deEsser.frequency} min={2000} max={16000} step={100} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'deEsser', params: { frequency: v } }))} format={v => `${(v/1000).toFixed(1)}kHz`} />
              <Slider label="Threshold" val={effects.deEsser.threshold} min={-40} max={0} step={1} onChange={v => dispatch(voiceActions.updateEffect({ effect: 'deEsser', params: { threshold: v } }))} format={v => `${v}dB`} />
            </EffectCard>
          </div>
        </div>
      )}

      {/* ADVANCED TAB */}
      {activeTab === 'advanced' && (
        <div style={{ display: 'grid', gap: 14 }}>

          {/* Selected take indicator */}
          {!selectedTakeObj ? (
            <div style={{ padding: '14px 16px', background: '#1a1a1a', borderRadius: 8, color: '#666', fontSize: 13, textAlign: 'center' }}>
              Select a take in the Record tab to apply AI processing
            </div>
          ) : (
            <div style={{ padding: '10px 14px', background: '#0f1a2e', border: '1px solid #3b82f633', borderRadius: 8, fontSize: 12, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🎯</span>
              <span>Processing: <strong>{selectedTakeObj.name}</strong></span>
              <span style={{ color: '#555', marginLeft: 'auto' }}>{formatTime(selectedTakeObj.duration)}</span>
            </div>
          )}

          {/* Process result */}
          {processResult && (
            <div style={{ padding: '12px 14px', background: '#0a1f0a', border: '1px solid #22c55e44', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, marginBottom: 8 }}>✅ {processResult.info}</div>
              <audio src={processResult.url} controls style={{ width: '100%', height: 32 }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={saveProcessedTake}
                  style={{ padding: '6px 14px', background: '#22c55e22', border: '1px solid #22c55e44', borderRadius: 6, color: '#22c55e', cursor: 'pointer', fontSize: 12 }}>
                  + Save as New Take
                </button>
                <a href={processResult.url} download="processed.wav"
                  style={{ padding: '6px 14px', background: '#1e3a5f', border: '1px solid #3b82f644', borderRadius: 6, color: '#3b82f6', fontSize: 12, textDecoration: 'none' }}>
                  ↓ Download
                </a>
                <button onClick={() => setProcessResult(null)}
                  style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #333', borderRadius: 6, color: '#555', cursor: 'pointer', fontSize: 12 }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {processError && (
            <div style={{ padding: '8px 12px', background: '#1a0808', border: '1px solid #ef444455', borderRadius: 6, fontSize: 12, color: '#ef4444' }}>
              {processError.includes('offline') || processError.includes('fetch') ? '⚠ Backend offline — start: uvicorn app.main:app --reload --port 8000' : `⚠ ${processError}`}
            </div>
          )}

          {/* AutoTune */}
          <div style={{ padding: 16, background: '#1a1a1a', borderRadius: 10, border: '1px solid #333' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#3b82f6' }}>🎼 AutoTune — Pitch Correction</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Key</div>
                <select value={autotuneKey} onChange={e => setAutotuneKey(e.target.value)} style={selStyle}>
                  {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Scale</div>
                <select value={autotuneScale} onChange={e => setAutotuneScale(e.target.value)} style={selStyle}>
                  {['major','minor','pentatonic','blues','chromatic'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <Slider label="Correction Intensity" val={autotuneIntensity} min={0} max={1} step={0.05}
              onChange={setAutotuneIntensity}
              format={v => v < 0.3 ? `${Math.round(v*100)}% — subtle` : v > 0.85 ? `${Math.round(v*100)}% — robotic` : `${Math.round(v*100)}%`} />
            <button
              disabled={!selectedTakeObj || processing === 'autotune'}
              onClick={() => processWithBackend('/voice/autotune', { scale: autotuneScale, key: autotuneKey, intensity: autotuneIntensity }, 'AutoTune')}
              style={{ width: '100%', padding: '10px', background: selectedTakeObj ? '#1e3a5f' : '#111', border: `1px solid ${selectedTakeObj ? '#3b82f6' : '#222'}`, borderRadius: 8, color: selectedTakeObj ? '#60a5fa' : '#444', cursor: selectedTakeObj ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
              {processing === 'autotune' ? '⏳ Processing...' : '🎼 Apply AutoTune'}
            </button>
          </div>

          {/* Harmony Generator */}
          <div style={{ padding: 16, background: '#1a1a1a', borderRadius: 10, border: '1px solid #333' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#22c55e' }}>🎵 Harmony Generator</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>Select harmony intervals:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {HARMONY_OPTIONS.map(opt => {
                  const active = harmonyIntervals.includes(opt.semitones)
                  return (
                    <button key={opt.label}
                      onClick={() => setHarmonyIntervals(prev => active ? prev.filter(s => s !== opt.semitones) : [...prev, opt.semitones])}
                      style={{ padding: '5px 12px', background: active ? '#0a2a1a' : 'transparent', border: `1px solid ${active ? '#22c55e' : '#444'}`, borderRadius: 6, color: active ? '#22c55e' : '#666', cursor: 'pointer', fontSize: 12 }}>
                      {opt.label} {active && '✓'}
                    </button>
                  )
                })}
              </div>
            </div>
            <Slider label="Harmony Volume" val={harmonyMix} min={0.1} max={1} step={0.05}
              onChange={setHarmonyMix} format={v => `${Math.round(v * 100)}%`} />
            <button
              disabled={!selectedTakeObj || harmonyIntervals.length === 0 || processing === 'harmony'}
              onClick={() => processWithBackend('/voice/harmony', { intervals: harmonyIntervals.join(','), mix_level: harmonyMix }, 'Harmony')}
              style={{ width: '100%', padding: '10px', background: selectedTakeObj && harmonyIntervals.length ? '#0a2a1a' : '#111', border: `1px solid ${selectedTakeObj && harmonyIntervals.length ? '#22c55e' : '#222'}`, borderRadius: 8, color: selectedTakeObj && harmonyIntervals.length ? '#22c55e' : '#444', cursor: selectedTakeObj && harmonyIntervals.length ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
              {processing === 'harmony' ? '⏳ Generating...' : `🎵 Generate ${harmonyIntervals.length} Voice Harmony`}
            </button>
          </div>

          {/* De-Breath via backend */}
          <div style={{ padding: 16, background: '#1a1a1a', borderRadius: 10, border: '1px solid #333' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#8b5cf6' }}>🌬 De-Breath (AI)</div>
            <p style={{ fontSize: 12, color: '#666', lineHeight: 1.5, margin: '0 0 12px' }}>Remove breath sounds from the take using AI backend (requires librosa).</p>
            <button
              disabled={!selectedTakeObj || processing === 'debreath'}
              onClick={() => processWithBackend('/voice/debreath', { sensitivity: effects.deBreath.sensitivity, mode: effects.deBreath.mode }, 'De-Breath')}
              style={{ width: '100%', padding: '10px', background: selectedTakeObj ? '#1a0f2e' : '#111', border: `1px solid ${selectedTakeObj ? '#8b5cf6' : '#222'}`, borderRadius: 8, color: selectedTakeObj ? '#a78bfa' : '#444', cursor: selectedTakeObj ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
              {processing === 'debreath' ? '⏳ Processing...' : '🌬 Remove Breaths'}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── SUBCOMPONENTS ────────────────────────────────────────────────────────────

const EffectCard = ({ name, effectKey, effects, dispatch, children }) => (
  <div style={{ padding: 14, background: '#1a1a1a', borderRadius: 10, border: `1px solid ${effects[effectKey]?.enabled ? '#3b82f6' : '#333'}` }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: effects[effectKey]?.enabled ? '#fff' : '#888' }}>{name}</span>
      <div style={{ width: 36, height: 20, borderRadius: 10, background: effects[effectKey]?.enabled ? '#3b82f6' : '#333', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
        onClick={() => dispatch(voiceActions.toggleEffect(effectKey))}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: effects[effectKey]?.enabled ? 18 : 2, transition: 'left 0.2s' }} />
      </div>
    </div>
    <div style={{ opacity: effects[effectKey]?.enabled ? 1 : 0.4, pointerEvents: effects[effectKey]?.enabled ? 'auto' : 'none' }}>
      {children}
    </div>
  </div>
)

const Slider = ({ label, val, min, max, step, onChange, format }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#aaa', fontWeight: 600 }}>{format ? format(val) : val}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={val} onChange={e => onChange(+e.target.value)} style={{ width: '100%' }} />
  </div>
)

const selStyle = { width: '100%', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 13 }

const Select = ({ label, val, opts, onChange }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
    <select value={val} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 13 }}>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
)
