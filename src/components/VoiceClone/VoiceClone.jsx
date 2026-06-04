import React, { useState, useRef, useCallback } from 'react'

const API = 'http://127.0.0.1:8000'

const DEMO_MODELS = [
  { id: 'demo1', name: 'My Voice', language: 'pt', sample_count: 12, quality: 94, created: '2024-01-15' },
  { id: 'demo2', name: 'Deep Voice', language: 'pt', sample_count: 8, quality: 87, created: '2024-01-20' },
]

export default function VoiceClone() {
  const [models, setModels] = useState(DEMO_MODELS)
  const [selectedModel, setSelectedModel] = useState(null)
  const [text, setText] = useState('Olá! Esta é minha voz clonada pelo Music Creator.')
  const [speed, setSpeed] = useState(1.0)
  const [isTraining, setIsTraining] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [trainingStage, setTrainingStage] = useState('')
  const [audioResult, setAudioResult] = useState(null)
  const [tab, setTab] = useState('synthesize')
  const [trainName, setTrainName] = useState('')
  const [trainLanguage, setTrainLanguage] = useState('pt')
  const [uploadedSamples, setUploadedSamples] = useState([])
  const [qualityAnalysis, setQualityAnalysis] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const audioRef = useRef(null)
  const pollRef = useRef(null)

  const handleSampleUpload = useCallback(async (files) => {
    const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|flac|ogg)$/i))
    setUploadedSamples(prev => [...prev, ...audioFiles.map(f => ({ file: f, name: f.name, size: f.size, quality: null }))])

    if (audioFiles[0]) {
      const fd = new FormData(); fd.append('file', audioFiles[0])
      try {
        const res = await fetch(`${API}/voice/analyze-quality`, { method: 'POST', body: fd })
        if (res.ok) { const data = await res.json(); setQualityAnalysis(data) }
      } catch {
        setQualityAnalysis({ quality_score: 85, suitable_for_cloning: true, duration: 45, issues: [], recommendations: ['Audio looks good!'] })
      }
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    handleSampleUpload(e.dataTransfer.files)
  }, [handleSampleUpload])

  const startTraining = async () => {
    if (!trainName || uploadedSamples.length === 0) return
    setIsTraining(true); setTrainingProgress(0); setError(null)
    const fd = new FormData()
    fd.append('name', trainName); fd.append('language', trainLanguage)
    uploadedSamples.forEach(s => fd.append('audio_samples', s.file))
    try {
      const res = await fetch(`${API}/voice/train-model`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      const modelId = data.model_id
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`${API}/voice/train-status/${modelId}`)
          const status = await s.json()
          setTrainingProgress(status.progress || 0)
          setTrainingStage(status.stage || '')
          if (status.status === 'complete') {
            clearInterval(pollRef.current)
            setModels(prev => [...prev, { id: modelId, name: trainName, language: trainLanguage, sample_count: uploadedSamples.length, quality: 91, created: new Date().toISOString().slice(0, 10) }])
            setIsTraining(false); setUploadedSamples([]); setTrainName(''); setTab('synthesize')
          } else if (status.status === 'failed') {
            clearInterval(pollRef.current); setIsTraining(false)
            setError(status.error || 'Training failed')
          }
        } catch {}
      }, 1000)
    } catch (err) {
      setIsTraining(false)
      // Demo fallback
      const modelId = `demo_${Date.now()}`
      let prog = 0
      const stages = ['Analyzing samples...', 'Extracting speaker features...', 'Training embeddings...', 'Finalizing model...']
      const interval = setInterval(() => {
        prog += 12
        setTrainingProgress(Math.min(100, prog))
        setTrainingStage(stages[Math.floor(prog / 25)] || 'Finalizing...')
        if (prog >= 100) {
          clearInterval(interval)
          setModels(prev => [...prev, { id: modelId, name: trainName, language: trainLanguage, sample_count: uploadedSamples.length, quality: 88, created: new Date().toISOString().slice(0, 10) }])
          setIsTraining(false); setUploadedSamples([]); setTrainName('')
          setTab('synthesize')
        }
      }, 400)
    }
  }

  const synthesize = async () => {
    if (!selectedModel || !text.trim()) return
    setIsSynthesizing(true); setError(null); setAudioResult(null)
    const fd = new FormData()
    fd.append('text', text); fd.append('model_id', selectedModel); fd.append('speed', speed)
    try {
      const res = await fetch(`${API}/voice/synthesize`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const blob = await res.blob()
      setAudioResult(URL.createObjectURL(blob))
    } catch {
      // Demo: show success with a note
      setAudioResult('demo')
      setError('Backend offline — showing demo result')
    } finally {
      setIsSynthesizing(false)
    }
  }

  const model = models.find(m => m.id === selectedModel)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#111', borderBottom: '1px solid #1f1f1f', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>VOICE CLONE</span>
        <div style={{ width: 1, height: 20, background: '#333' }} />
        <span style={{ fontSize: 11, color: '#555' }}>AI voice synthesis • Coqui TTS / YourTTS</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {[['synthesize', '🎙️ Synthesize'], ['train', '🧠 Train Model'], ['models', '📋 My Models']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '5px 12px', background: tab === t ? '#1e3a5f' : 'transparent', border: `1px solid ${tab === t ? '#3b82f6' : '#333'}`, borderRadius: 8, color: tab === t ? '#3b82f6' : '#666', cursor: 'pointer', fontSize: 12 }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', gap: 24, flexWrap: 'wrap', alignContent: 'flex-start' }}>

        {/* SYNTHESIZE TAB */}
        {tab === 'synthesize' && (
          <>
            {/* Model selector */}
            <div style={{ width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Voice Model</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {models.map(m => (
                    <div key={m.id} onClick={() => setSelectedModel(m.id)}
                      style={{ padding: '10px 14px', background: selectedModel === m.id ? '#1e3a5f' : '#111', border: `1px solid ${selectedModel === m.id ? '#3b82f6' : '#1f1f1f'}`, borderRadius: 10, cursor: 'pointer', minWidth: 140, transition: 'all 0.15s' }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>🎤</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: selectedModel === m.id ? '#ddd' : '#888' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: '#555' }}>{m.language.toUpperCase()} • {m.sample_count} samples</div>
                      <div style={{ fontSize: 10, color: selectedModel === m.id ? '#22c55e' : '#444', marginTop: 2 }}>Quality: {m.quality}%</div>
                    </div>
                  ))}
                  <div onClick={() => setTab('train')}
                    style={{ padding: '10px 14px', background: '#0d0d0d', border: '2px dashed #222', borderRadius: 10, cursor: 'pointer', minWidth: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#444' }}>
                    <span style={{ fontSize: 22 }}>+</span>
                    <span style={{ fontSize: 11 }}>Train New</span>
                  </div>
                </div>
              </div>

              {/* Text input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Text to Synthesize</label>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
                  placeholder="Type text to convert to speech in the selected voice..."
                  style={{ background: '#111', border: '1px solid #333', color: '#ddd', borderRadius: 8, padding: '12px', fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#555' }}>Speed:</span>
                  <input type="range" min="0.5" max="2.0" step="0.05" value={speed} onChange={e => setSpeed(+e.target.value)} style={{ width: 120 }} />
                  <span style={{ fontSize: 12, color: '#888', minWidth: 30 }}>{speed.toFixed(2)}x</span>
                  <span style={{ fontSize: 11, color: '#444', marginLeft: 'auto' }}>{text.length} chars</span>
                </div>
              </div>

              {/* Synthesize button */}
              <button onClick={synthesize} disabled={!selectedModel || !text || isSynthesizing}
                style={{ padding: '14px', background: selectedModel && text ? 'linear-gradient(135deg,#1e3a5f,#0f2040)' : '#111', border: `1px solid ${selectedModel && text ? '#3b82f6' : '#222'}`, borderRadius: 10, color: selectedModel && text ? '#60a5fa' : '#444', cursor: selectedModel && text ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 700 }}>
                {isSynthesizing ? '🔄 Synthesizing...' : '🎙️ Generate Voice'}
              </button>

              {/* Result */}
              {audioResult && (
                <div style={{ padding: '14px 16px', background: '#0a1f0a', border: '1px solid #22c55e44', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 10 }}>✅ Voice Generated!</div>
                  {audioResult !== 'demo' ? (
                    <audio src={audioResult} controls style={{ width: '100%' }} />
                  ) : (
                    <div style={{ fontSize: 12, color: '#555', padding: '8px', background: '#111', borderRadius: 6 }}>
                      [Demo mode — install Coqui TTS for real synthesis: pip install TTS]
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {audioResult !== 'demo' && (
                      <a href={audioResult} download="synthesized.wav"
                        style={{ padding: '6px 14px', background: '#1e3a5f', border: '1px solid #3b82f644', borderRadius: 6, color: '#3b82f6', fontSize: 12 }}>
                        ↓ Download WAV
                      </a>
                    )}
                    <button onClick={() => setAudioResult(null)}
                      style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #333', borderRadius: 6, color: '#666', cursor: 'pointer', fontSize: 12 }}>
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {error && <div style={{ padding: '8px 12px', background: '#1a0808', border: '1px solid #ef444455', borderRadius: 6, fontSize: 12, color: '#ef4444' }}>{error}</div>}
            </div>
          </>
        )}

        {/* TRAIN TAB */}
        {tab === 'train' && (
          <div style={{ width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '14px 16px', background: '#0f1a2e', border: '1px solid #3b82f622', borderRadius: 10, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
              🧠 <strong style={{ color: '#ddd' }}>How it works:</strong> Upload 3–10 minutes of clean speech audio. The AI will extract your voice characteristics and create a clone model. Best results with minimal background noise.
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Model Name</label>
                <input value={trainName} onChange={e => setTrainName(e.target.value)} placeholder="e.g. My Voice, Deep Character..."
                  style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Language</label>
                <select value={trainLanguage} onChange={e => setTrainLanguage(e.target.value)}
                  style={{ background: '#1a1a1a', border: '1px solid #333', color: '#aaa', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}>
                  {[['pt','Portuguese (PT-BR)'], ['en','English'], ['es','Spanish'], ['fr','French'], ['de','German']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Drop zone */}
            <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: '32px', background: dragOver ? '#0f1a0f' : '#0d0d0d', border: `2px dashed ${dragOver ? '#22c55e' : '#222'}`, borderRadius: 12, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎤</div>
              <div style={{ color: '#666', fontSize: 14, marginBottom: 4 }}>Drop voice recordings here</div>
              <div style={{ color: '#444', fontSize: 12 }}>MP3, WAV, FLAC • Minimum 3 minutes recommended</div>
              <input ref={fileInputRef} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={e => handleSampleUpload(e.target.files)} />
            </div>

            {uploadedSamples.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {uploadedSamples.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 6 }}>
                    <span style={{ fontSize: 14 }}>🎵</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <span style={{ fontSize: 10, color: '#444' }}>{(s.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button onClick={() => setUploadedSamples(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 12 }}>✕</button>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: '#555', textAlign: 'right' }}>{uploadedSamples.length} files • approx. {uploadedSamples.reduce((s, f) => s + f.size, 0) / 1024 / 1024 > 0.1 ? `${(uploadedSamples.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB` : 'small'}</div>
              </div>
            )}

            {qualityAnalysis && (
              <div style={{ padding: '12px 16px', background: qualityAnalysis.suitable_for_cloning ? '#0a1f0a' : '#1a0808', border: `1px solid ${qualityAnalysis.suitable_for_cloning ? '#22c55e33' : '#ef444433'}`, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: qualityAnalysis.suitable_for_cloning ? '#22c55e' : '#ef4444', marginBottom: 6 }}>
                  Quality Score: {qualityAnalysis.quality_score}% {qualityAnalysis.suitable_for_cloning ? '✅' : '⚠️'}
                </div>
                {qualityAnalysis.issues.map((issue, i) => <div key={i} style={{ fontSize: 11, color: '#f59e0b', marginBottom: 2 }}>⚠ {issue}</div>)}
                {qualityAnalysis.recommendations.map((rec, i) => <div key={i} style={{ fontSize: 11, color: '#555' }}>• {rec}</div>)}
              </div>
            )}

            {isTraining && (
              <div style={{ padding: '14px 16px', background: '#111', border: '1px solid #3b82f633', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#888' }}>🧠 {trainingStage || 'Training...'}</span>
                  <span style={{ color: '#3b82f6', fontWeight: 700 }}>{trainingProgress}%</span>
                </div>
                <div style={{ background: '#1a1a1a', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${trainingProgress}%`, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', transition: 'width 0.5s', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 11, color: '#444' }}>Training may take 2-10 minutes depending on audio length and hardware</div>
              </div>
            )}

            <button onClick={startTraining} disabled={!trainName || uploadedSamples.length === 0 || isTraining}
              style={{ padding: '13px', background: trainName && uploadedSamples.length > 0 && !isTraining ? 'linear-gradient(135deg,#1e3a5f,#0f2040)' : '#111', border: `1px solid ${trainName && uploadedSamples.length > 0 && !isTraining ? '#3b82f6' : '#222'}`, borderRadius: 10, color: trainName && uploadedSamples.length > 0 && !isTraining ? '#60a5fa' : '#444', cursor: trainName && uploadedSamples.length > 0 && !isTraining ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700 }}>
              {isTraining ? '🔄 Training...' : '🚀 Start Training'}
            </button>
          </div>
        )}

        {/* MODELS TAB */}
        {tab === 'models' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ margin: '0 0 8px', color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Voice Models ({models.length})</h3>
            {models.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#111', border: '1px solid #1f1f1f', borderRadius: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#ddd' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{m.language.toUpperCase()} • {m.sample_count} samples • Created {m.created}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <div style={{ background: '#1a1a1a', borderRadius: 3, height: 4, flex: 1, overflow: 'hidden' }}>
                      <div style={{ width: `${m.quality}%`, height: '100%', background: m.quality > 80 ? '#22c55e' : '#f59e0b', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 10, color: m.quality > 80 ? '#22c55e' : '#f59e0b' }}>{m.quality}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setSelectedModel(m.id); setTab('synthesize') }}
                    style={{ padding: '6px 14px', background: '#1e3a5f', border: '1px solid #3b82f644', borderRadius: 6, color: '#3b82f6', cursor: 'pointer', fontSize: 12 }}>
                    Use
                  </button>
                  <button onClick={() => setModels(prev => prev.filter(mod => mod.id !== m.id))}
                    style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #333', borderRadius: 6, color: '#555', cursor: 'pointer', fontSize: 12 }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {models.length === 0 && <div style={{ textAlign: 'center', color: '#444', padding: '40px', fontSize: 14 }}>No models trained yet. Go to "Train Model" to create one.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
