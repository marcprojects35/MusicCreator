import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { projectActions, midiActions } from '../../store'
import * as Tone from 'tone'

const API = 'http://127.0.0.1:8000'
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const SCALES = {
  major: [0,2,4,5,7,9,11], minor: [0,2,3,5,7,8,10], dorian: [0,2,3,5,7,9,10],
  phrygian:[0,1,3,5,7,8,10], lydian:[0,2,4,6,7,9,11], mixolydian:[0,2,4,5,7,9,10],
  pentatonic:[0,2,4,7,9], blues:[0,3,5,6,7,10],
}
const CHORD_TYPES = {
  '': [0,4,7], 'm': [0,3,7], '7': [0,4,7,10], 'maj7': [0,4,7,11],
  'm7': [0,3,7,10], 'dim': [0,3,6], 'aug': [0,4,8], 'sus4': [0,5,7],
  '9': [0,4,7,10,14], 'add9': [0,4,7,14],
}
const PROGRESSIONS = {
  'I-IV-V-I': [0,3,4,0], 'I-V-vi-IV': [0,4,5,3], 'I-vi-IV-V': [0,5,3,4],
  'ii-V-I': [1,4,0], 'vi-IV-I-V': [5,3,0,4], 'I-V-vi-iii-IV': [0,4,5,2,3],
  'i-VII-VI-VII': [0,6,5,6], 'i-iv-V-i': [0,3,4,0],
}
const SONG_SECTIONS = ['Intro','Verse','Pre-Chorus','Chorus','Bridge','Outro','Solo','Hook','Break','Drop','Build']
const SECTION_COLORS = { Intro:'#555',Verse:'#3b82f6','Pre-Chorus':'#8b5cf6',Chorus:'#ec4899',Bridge:'#f59e0b',Outro:'#555',Solo:'#ef4444',Hook:'#10b981',Break:'#06b6d4',Drop:'#f97316',Build:'#84cc16' }
const DEGREE_NAMES = ['I','II','III','IV','V','VI','VII']

function getSynth() {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.04, decay: 0.3, sustain: 0.55, release: 0.8 }
  }).toDestination()
}

// ── Chord Progression Builder ─────────────────────────────────────────────────
function ChordProgressionBuilder({ rootKey, scaleName }) {
  const [progression, setProgression] = useState([
    {degree:0,type:'',bars:1},{degree:3,type:'',bars:1},{degree:4,type:'',bars:1},{degree:0,type:'',bars:1}
  ])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [bpm, setBpmLocal] = useState(120)
  const [suggestions, setSuggestions] = useState([])
  const [loadingSug, setLoadingSug] = useState(false)
  const synthRef = useRef(null)

  const scale = SCALES[scaleName] || SCALES.major
  const rootMidi = NOTES.indexOf(rootKey)

  const getChordNotes = (degree, type) => {
    const intervals = CHORD_TYPES[type] || [0,4,7]
    const base = (rootMidi + (scale[degree % scale.length] || 0)) % 12
    return intervals.map(i => Tone.Frequency(48 + base + i, 'midi').toNote())
  }
  const getChordName = (degree, type) => `${NOTES[(rootMidi + (scale[degree % scale.length] || 0)) % 12]}${type}`

  const playProgression = async () => {
    await Tone.start()
    if (!synthRef.current) synthRef.current = getSynth()
    Tone.Transport.stop(); Tone.Transport.cancel()
    Tone.Transport.bpm.value = bpm
    let time = 0
    progression.forEach((chord, i) => {
      const beats = chord.bars * 4
      const dur = beats * 60 / bpm
      Tone.Transport.schedule(t => { synthRef.current.triggerAttackRelease(getChordNotes(chord.degree, chord.type), `${dur * 0.9}s`, t); setCurrentIdx(i) }, time + 's')
      time += dur
    })
    Tone.Transport.schedule(() => { setIsPlaying(false); setCurrentIdx(-1) }, time + 's')
    Tone.Transport.start(); setIsPlaying(true)
  }

  const stopPlayback = () => {
    Tone.Transport.stop(); Tone.Transport.cancel(); setIsPlaying(false); setCurrentIdx(-1)
    synthRef.current?.releaseAll()
  }

  const loadPreset = (name) => {
    const degrees = PROGRESSIONS[name]
    setProgression(degrees.map(d => ({ degree: d, type: (d === 1 || d === 2 || d === 5) ? 'm' : '', bars: 1 })))
  }

  const fetchSuggestions = async () => {
    if (progression.length === 0) return
    const last = progression[progression.length - 1]
    const chordName = getChordName(last.degree, last.type)
    setLoadingSug(true)
    try {
      const fd = new FormData(); fd.append('current_chord', chordName); fd.append('key', rootKey); fd.append('scale', scaleName)
      const res = await fetch(`${API}/composition/suggest-chords`, { method: 'POST', body: fd })
      if (res.ok) { const data = await res.json(); setSuggestions(data.suggestions || []) }
      else { throw new Error() }
    } catch {
      setSuggestions([{ chord: getChordName(3, ''), function: 'IV', probability: 0.85 },
        { chord: getChordName(4, ''), function: 'V', probability: 0.72 },
        { chord: getChordName(5, 'm'), function: 'vi', probability: 0.65 }])
    } finally { setLoadingSug(false) }
  }

  const addSuggestion = (sug) => {
    const noteClass = NOTES.indexOf(sug.chord.replace(/m|7|maj7|sus4|dim|aug|add9/, ''))
    const degree = scale.findIndex(s => (rootMidi + s) % 12 === noteClass)
    const type = sug.chord.replace(/^[A-G]#?/, '')
    setProgression(prev => [...prev, { degree: Math.max(0, degree), type, bars: 1 }])
    setSuggestions([])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Presets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Object.keys(PROGRESSIONS).map(name => (
          <button key={name} onClick={() => loadPreset(name)} style={smallBtn}>{name}</button>
        ))}
      </div>

      {/* Chord strip */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, alignItems: 'stretch' }}>
        {progression.map((chord, i) => {
          const name = getChordName(chord.degree, chord.type)
          const isCurrent = currentIdx === i
          return (
            <div key={i}
              style={{ minWidth: 88, background: isCurrent ? '#1e3a5f' : '#111', border: `1px solid ${isCurrent ? '#3b82f6' : '#1f1f1f'}`, borderRadius: 10, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', flexShrink: 0, cursor: 'pointer', position: 'relative' }}
              onClick={() => Tone.start().then(() => { if (!synthRef.current) synthRef.current = getSynth(); synthRef.current.triggerAttackRelease(getChordNotes(chord.degree, chord.type), '2n') })}>
              <button onClick={e => { e.stopPropagation(); setProgression(prev => prev.filter((_, j) => j !== i)) }}
                style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>✕</button>
              <span style={{ fontSize: 8, color: '#444' }}>{DEGREE_NAMES[chord.degree % 7]}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: isCurrent ? '#3b82f6' : '#ddd', lineHeight: 1 }}>{name}</span>
              <select value={chord.degree} onClick={e => e.stopPropagation()} onChange={e => setProgression(prev => prev.map((c, j) => j === i ? { ...c, degree: +e.target.value } : c))}
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 4, padding: '2px 2px', fontSize: 9 }}>
                {scale.map((_, d) => <option key={d} value={d}>{DEGREE_NAMES[d]} — {NOTES[(rootMidi + scale[d]) % 12]}</option>)}
              </select>
              <select value={chord.type} onClick={e => e.stopPropagation()} onChange={e => setProgression(prev => prev.map((c, j) => j === i ? { ...c, type: e.target.value } : c))}
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 4, padding: '2px 2px', fontSize: 9 }}>
                {Object.keys(CHORD_TYPES).map(t => <option key={t} value={t}>{t || 'major'}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1,2,4].map(b => (
                  <button key={b} onClick={e => { e.stopPropagation(); setProgression(prev => prev.map((c, j) => j === i ? { ...c, bars: b } : c)) }}
                    style={{ width: 20, height: 20, background: chord.bars === b ? '#1e3a5f' : 'transparent', border: `1px solid ${chord.bars === b ? '#3b82f6' : '#2a2a2a'}`, borderRadius: 3, color: chord.bars === b ? '#3b82f6' : '#444', cursor: 'pointer', fontSize: 8 }}>
                    {b}b
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        <button onClick={() => setProgression(prev => [...prev, { degree: 0, type: '', bars: 1 }])}
          style={{ minWidth: 50, background: '#0d0d0d', border: '2px dashed #1a1a1a', borderRadius: 10, color: '#333', cursor: 'pointer', fontSize: 22, flexShrink: 0 }}>+</button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={isPlaying ? stopPlayback : playProgression}
          style={{ padding: '7px 18px', background: isPlaying ? '#ef444422' : '#22c55e22', border: `1px solid ${isPlaying ? '#ef4444' : '#22c55e'}55`, borderRadius: 8, color: isPlaying ? '#ef4444' : '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          {isPlaying ? '■ Stop' : '▶ Play'}
        </button>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#444' }}>BPM</span>
          <input type="number" min="40" max="200" value={bpm} onChange={e => setBpmLocal(+e.target.value)} style={{ width: 52, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: 5, padding: '3px 6px', fontSize: 12, outline: 'none' }} />
        </div>
        <button onClick={fetchSuggestions} disabled={loadingSug}
          style={{ padding: '7px 14px', background: '#8b5cf622', border: '1px solid #8b5cf644', borderRadius: 8, color: '#8b5cf6', cursor: 'pointer', fontSize: 11 }}>
          {loadingSug ? '⏳ Loading...' : '✨ Suggest Next'}
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#444' }}>
          {progression.map(c => getChordName(c.degree, c.type)).join(' → ')}
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ padding: '10px 12px', background: '#0d0d0d', border: '1px solid #8b5cf633', borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: '#8b5cf6', marginBottom: 6 }}>AI Suggestions (click to add):</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suggestions.map((sug, i) => (
              <button key={i} onClick={() => addSuggestion(sug)}
                style={{ padding: '5px 12px', background: '#1a1a2e', border: '1px solid #8b5cf644', borderRadius: 8, color: '#8b5cf6', cursor: 'pointer', fontSize: 11 }}>
                <span style={{ fontWeight: 700 }}>{sug.chord}</span>
                <span style={{ color: '#555', marginLeft: 4, fontSize: 9 }}>({sug.function})</span>
                <span style={{ color: '#3b82f6', marginLeft: 4, fontSize: 9 }}>{Math.round(sug.probability * 100)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Melody Builder ─────────────────────────────────────────────────────────────
function MelodyBuilder({ rootKey, scaleName }) {
  const [selectedNotes, setSelectedNotes] = useState([])
  const [octave, setOctave] = useState(4)
  const [arpeggioMode, setArpeggioMode] = useState(false)
  const [arpeggioPattern, setArpeggioPattern] = useState('up')
  const [aiMelody, setAiMelody] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const synthRef = useRef(null)

  const scale = SCALES[scaleName] || SCALES.major
  const rootMidi = NOTES.indexOf(rootKey)

  const isInScale = (midiNote) => scale.includes(((midiNote - rootMidi) % 12 + 12) % 12)

  const getOrCreateSynth = () => {
    if (!synthRef.current) {
      synthRef.current = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.5 } }).toDestination()
    }
    return synthRef.current
  }

  const playNote = async (midiNote) => {
    await Tone.start()
    getOrCreateSynth().triggerAttackRelease(Tone.Frequency(midiNote, 'midi').toNote(), '8n')
  }

  const toggleNote = (midiNote) => {
    setSelectedNotes(prev => prev.includes(midiNote) ? prev.filter(n => n !== midiNote) : [...prev, midiNote])
    playNote(midiNote)
  }

  const playMelody = async () => {
    if (selectedNotes.length === 0) return
    await Tone.start()
    Tone.Transport.stop(); Tone.Transport.cancel()
    const synth = getOrCreateSynth()
    let notes = [...selectedNotes]
    if (arpeggioPattern === 'up') notes.sort((a, b) => a - b)
    else if (arpeggioPattern === 'down') notes.sort((a, b) => b - a)
    else if (arpeggioPattern === 'up-down') { const s = [...notes].sort((a, b) => a - b); notes = [...s, ...[...s].reverse().slice(1)] }
    else if (arpeggioPattern === 'random') notes = notes.sort(() => Math.random() - 0.5)
    notes.forEach((note, i) => {
      Tone.Transport.schedule(t => synth.triggerAttackRelease(Tone.Frequency(note, 'midi').toNote(), '8n', t), `${i * 0.28}s`)
    })
    Tone.Transport.start()
  }

  const generateAIMelody = async () => {
    setLoadingAI(true)
    const chords = 'C Am F G'
    const fd = new FormData(); fd.append('chords', chords); fd.append('style', scaleName); fd.append('bars', '8')
    try {
      const res = await fetch(`${API}/composition/generate-melody`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setAiMelody(data.notes)
        await Tone.start()
        Tone.Transport.stop(); Tone.Transport.cancel()
        const synth = getOrCreateSynth()
        data.notes.slice(0, 20).forEach(note => {
          Tone.Transport.schedule(t => synth.triggerAttackRelease(Tone.Frequency(note.pitch, 'midi').toNote(), `${note.durationBeats * 60 / 120}s`, t), `${note.startBeat * 60 / 120}s`)
        })
        Tone.Transport.start()
      } else throw new Error()
    } catch {
      const fallbackNotes = scale.slice(0, 5).map((s, i) => ({ pitch: rootMidi + 60 + s, startBeat: i * 0.5, durationBeats: 0.5, velocity: 80 + i * 4 }))
      setAiMelody(fallbackNotes)
      await Tone.start(); Tone.Transport.stop(); Tone.Transport.cancel()
      const synth = getOrCreateSynth()
      fallbackNotes.forEach(note => Tone.Transport.schedule(t => synth.triggerAttackRelease(Tone.Frequency(note.pitch, 'midi').toNote(), '8n', t), `${note.startBeat * 0.4}s`))
      Tone.Transport.start()
    } finally { setLoadingAI(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Scale piano */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {Array.from({ length: 24 }, (_, i) => {
          const midiNote = 12 + rootMidi + i + octave * 12
          const noteClass = ((midiNote - rootMidi) % 12 + 12) % 12
          const inScale = scale.includes(noteClass)
          const isBlack = [1,3,6,8,10].includes(noteClass)
          const isSelected = selectedNotes.includes(midiNote)
          return (
            <button key={midiNote} onClick={() => toggleNote(midiNote)}
              style={{ width: 36, height: inScale ? 68 : 48, background: isSelected ? '#3b82f6' : isBlack ? '#1a1a1a' : inScale ? '#1e2030' : '#111', border: `1px solid ${isSelected ? '#3b82f6' : inScale ? '#3b82f633' : '#1a1a1a'}`, borderRadius: 4, color: isSelected ? '#fff' : inScale ? '#6688ff' : '#333', cursor: 'pointer', fontSize: 9, fontWeight: inScale ? 700 : 400, transition: 'all 0.1s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <span>{NOTES[noteClass]}</span>
              {inScale && <span style={{ fontSize: 6, opacity: 0.7 }}>{Math.floor(midiNote / 12) - 1}</span>}
            </button>
          )
        })}
      </div>

      {selectedNotes.length > 0 && (
        <div style={{ padding: '6px 10px', background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#444' }}>Notes:</span>
          {selectedNotes.map(n => (
            <span key={n} style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', cursor: 'pointer' }} onClick={() => toggleNote(n)}>
              {NOTES[((n - rootMidi) % 12 + 12) % 12]}
            </span>
          ))}
        </div>
      )}

      {/* AI generated melody display */}
      {aiMelody && (
        <div style={{ padding: '8px 12px', background: '#0d0d0d', border: '1px solid #22c55e33', borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: '#22c55e', marginBottom: 6 }}>AI Generated Melody ({aiMelody.length} notes)</div>
          <div style={{ display: 'flex', gap: 2, height: 28, alignItems: 'flex-end' }}>
            {aiMelody.slice(0, 32).map((note, i) => (
              <div key={i} style={{ flex: 1, background: '#22c55e', borderRadius: '2px 2px 0 0', height: `${((note.pitch - 48) / 36) * 100}%`, opacity: note.velocity / 127, minHeight: 2, minWidth: 2 }} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={playMelody}
          style={{ padding: '6px 14px', background: '#22c55e22', border: '1px solid #22c55e55', borderRadius: 7, color: '#22c55e', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>▶ Play</button>
        <button onClick={() => setSelectedNotes([])}
          style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 7, color: '#555', cursor: 'pointer', fontSize: 11 }}>Clear</button>
        <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11, color: '#888', cursor: 'pointer' }}>
          <input type="checkbox" checked={arpeggioMode} onChange={e => setArpeggioMode(e.target.checked)} />Arpeggio
        </label>
        {arpeggioMode && (
          <select value={arpeggioPattern} onChange={e => setArpeggioPattern(e.target.value)}
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 5, padding: '3px 6px', fontSize: 11 }}>
            {['up','down','up-down','random'].map(p => <option key={p}>{p}</option>)}
          </select>
        )}
        <button onClick={generateAIMelody} disabled={loadingAI}
          style={{ padding: '6px 14px', background: '#8b5cf622', border: '1px solid #8b5cf644', borderRadius: 7, color: '#8b5cf6', cursor: 'pointer', fontSize: 11 }}>
          {loadingAI ? '⏳ Generating...' : '✨ AI Generate'}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#444' }}>Oct:</span>
          <button onClick={() => setOctave(o => Math.max(1, o - 1))} style={miniBtn}>-</button>
          <span style={{ fontSize: 12, color: '#888', minWidth: 14, textAlign: 'center' }}>{octave}</span>
          <button onClick={() => setOctave(o => Math.min(7, o + 1))} style={miniBtn}>+</button>
        </div>
      </div>
    </div>
  )
}

// ── Song Structure Planner ─────────────────────────────────────────────────────
function SongStructurePlanner() {
  const [sections, setSections] = useState([
    {id:'s1',type:'Intro',bars:4}, {id:'s2',type:'Verse',bars:16}, {id:'s3',type:'Pre-Chorus',bars:8},
    {id:'s4',type:'Chorus',bars:16}, {id:'s5',type:'Verse',bars:16}, {id:'s6',type:'Pre-Chorus',bars:8},
    {id:'s7',type:'Chorus',bars:16}, {id:'s8',type:'Bridge',bars:8}, {id:'s9',type:'Chorus',bars:16}, {id:'s10',type:'Outro',bars:8},
  ])
  const [dragSec, setDragSec] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [bpm, setBpm] = useState(120)

  const totalBars = sections.reduce((s, x) => s + x.bars, 0)
  const totalSeconds = totalBars * 4 * 60 / bpm
  const fmt = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`

  const STRUCTURES = {
    'Pop (Verse-Chorus)': ['Intro','Verse','Pre-Chorus','Chorus','Verse','Pre-Chorus','Chorus','Bridge','Chorus','Outro'],
    'EDM (Build-Drop)':   ['Intro','Build','Drop','Break','Build','Drop','Outro'],
    'Hip-Hop (Hook)':     ['Intro','Verse','Hook','Verse','Hook','Bridge','Verse','Outro'],
    'Ballad':             ['Intro','Verse','Chorus','Verse','Chorus','Bridge','Chorus','Outro'],
    'Electronic':         ['Intro','Build','Drop','Break','Drop','Outro'],
  }
  const DEFAULT_BARS = { Intro:4,Verse:16,'Pre-Chorus':8,Chorus:16,Bridge:8,Outro:8,Hook:8,Break:8,Drop:16,Build:8,Solo:8 }

  const addSection = (type) => setSections(prev => [...prev, { id: `s_${Date.now()}`, type, bars: DEFAULT_BARS[type] || 8 }])
  const duplicateSection = (id) => {
    const idx = sections.findIndex(s => s.id === id)
    const copy = { ...sections[idx], id: `s_${Date.now()}` }
    setSections(prev => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Quick templates */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#444' }}>Templates:</span>
        {Object.entries(STRUCTURES).map(([name, types]) => (
          <button key={name} onClick={() => setSections(types.map((t, i) => ({ id: `s_${i}`, type: t, bars: DEFAULT_BARS[t] || 8 })))} style={smallBtn}>{name}</button>
        ))}
      </div>

      {/* Timeline visual */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '6px 0', alignItems: 'stretch', minHeight: 48 }}>
        {sections.map((sec, i) => {
          const color = SECTION_COLORS[sec.type] || '#555'
          const widthPct = Math.max(4, (sec.bars / totalBars) * 100)
          return (
            <div key={sec.id} draggable
              onDragStart={() => setDragSec(i)}
              onDragOver={e => { e.preventDefault(); setDragOver(i) }}
              onDrop={() => {
                if (dragSec === null || dragSec === i) return
                setSections(prev => { const n = [...prev]; const [m] = n.splice(dragSec, 1); n.splice(i, 0, m); return n })
                setDragSec(null); setDragOver(null)
              }}
              style={{ flex: `0 0 ${widthPct}%`, height: 44, background: `${color}22`, border: `2px solid ${dragOver === i ? '#fff' : `${color}77`}`, borderRadius: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'grab', overflow: 'hidden' }}>
              <span style={{ fontSize: 8, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{sec.type}</span>
              <span style={{ fontSize: 7, color: `${color}88` }}>{sec.bars}b</span>
            </div>
          )
        })}
      </div>

      {/* Section list */}
      <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sections.map((sec, i) => {
          const color = SECTION_COLORS[sec.type] || '#555'
          return (
            <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#0d0d0d', border: `1px solid ${color}22`, borderRadius: 5 }}>
              <span style={{ fontSize: 10, color: '#333', minWidth: 18 }}>{i + 1}</span>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              <select value={sec.type} onChange={e => setSections(prev => prev.map((s, j) => j === i ? { ...s, type: e.target.value } : s))}
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#aaa', borderRadius: 4, padding: '2px 4px', fontSize: 11 }}>
                {SONG_SECTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
              <input type="range" min="1" max="64" step="1" value={sec.bars} style={{ flex: 1 }}
                onChange={e => setSections(prev => prev.map((s, j) => j === i ? { ...s, bars: +e.target.value } : s))} />
              <span style={{ fontSize: 10, color: '#555', minWidth: 22 }}>{sec.bars}b</span>
              <span style={{ fontSize: 9, color: '#333', minWidth: 36 }}>{fmt(sec.bars * 4 * 60 / bpm)}</span>
              <button onClick={() => duplicateSection(sec.id)} style={{ ...miniBtn, color: '#3b82f6' }}>⊕</button>
              <button onClick={() => setSections(prev => prev.filter((_, j) => j !== i))} style={{ ...miniBtn, color: '#444' }}>✕</button>
            </div>
          )
        })}
      </div>

      {/* Add section + stats */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#444' }}>+ Add:</span>
        {SONG_SECTIONS.map(type => (
          <button key={type} onClick={() => addSection(type)}
            style={{ padding: '3px 8px', background: `${SECTION_COLORS[type] || '#555'}15`, border: `1px solid ${SECTION_COLORS[type] || '#555'}33`, borderRadius: 4, color: SECTION_COLORS[type] || '#555', cursor: 'pointer', fontSize: 10 }}>
            {type}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, padding: '8px 12px', background: '#0d0d0d', borderRadius: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#666' }}>{sections.length} sections</span>
        <span style={{ fontSize: 11, color: '#666' }}>{totalBars} bars</span>
        <span style={{ fontSize: 11, color: '#888', fontWeight: 700 }}>{fmt(totalSeconds)} @ {bpm} BPM</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#444' }}>BPM:</span>
          <input type="number" min="40" max="200" value={bpm} onChange={e => setBpm(+e.target.value)} style={{ width: 52, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc', borderRadius: 4, padding: '2px 5px', fontSize: 11, outline: 'none' }} />
        </div>
      </div>
    </div>
  )
}

// ── Main Composition view ─────────────────────────────────────────────────────
export default function Composition() {
  const dispatch = useDispatch()
  const projectKey = useSelector(s => s.project.key) || 'C'
  const projectScale = useSelector(s => s.project.scale) || 'major'
  const [activeTab, setActiveTab] = useState('chords')
  const [rootKey, setRootKey] = useState(projectKey)
  const [scaleName, setScaleName] = useState(projectScale)

  const scaleNotes = (SCALES[scaleName] || SCALES.major).map(i => NOTES[(NOTES.indexOf(rootKey) + i) % 12])

  const syncToProject = () => {
    dispatch(projectActions.setKey(rootKey))
    dispatch(projectActions.setScale(scaleName))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#111', borderBottom: '1px solid #1f1f1f', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#666' }}>COMPOSITION TOOLS</span>
        <div style={{ width: 1, height: 18, background: '#333' }} />
        {[['chords','🎹 Chords'],['melody','🎵 Melody'],['structure','📐 Structure']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '4px 10px', background: activeTab === tab ? '#1e3a5f' : 'transparent', border: `1px solid ${activeTab === tab ? '#3b82f6' : '#2a2a2a'}`, borderRadius: 7, color: activeTab === tab ? '#3b82f6' : '#555', cursor: 'pointer', fontSize: 11 }}>
            {label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={rootKey} onChange={e => setRootKey(e.target.value)} style={sel}>
            {NOTES.map(n => <option key={n}>{n}</option>)}
          </select>
          <select value={scaleName} onChange={e => setScaleName(e.target.value)} style={sel}>
            {Object.keys(SCALES).map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={syncToProject} style={{ padding: '4px 10px', background: '#22c55e1a', border: '1px solid #22c55e33', borderRadius: 5, color: '#22c55e', cursor: 'pointer', fontSize: 10 }}>
            ↑ Sync to Project
          </button>
        </div>
      </div>

      {/* Scale indicator */}
      <div style={{ padding: '4px 14px', background: '#0a0a0a', borderBottom: '1px solid #121212', display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: '#333', marginRight: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{rootKey} {scaleName}:</span>
        {scaleNotes.map((note, i) => (
          <span key={i} style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', padding: '1px 6px', background: '#1e3a5f', borderRadius: 3 }}>{note}</span>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        {activeTab === 'chords'    && <ChordProgressionBuilder rootKey={rootKey} scaleName={scaleName} />}
        {activeTab === 'melody'    && <MelodyBuilder rootKey={rootKey} scaleName={scaleName} />}
        {activeTab === 'structure' && <SongStructurePlanner />}
      </div>
    </div>
  )
}

const smallBtn = { padding: '3px 8px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 5, color: '#666', cursor: 'pointer', fontSize: 10 }
const miniBtn  = { width: 20, height: 20, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 3, color: '#666', cursor: 'pointer', fontSize: 10, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const sel      = { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#aaa', borderRadius: 5, padding: '3px 6px', fontSize: 11 }
