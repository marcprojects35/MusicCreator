import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { midiActions } from '../../store'
import * as Tone from 'tone'

const PIANO_W = 64
const CELL_H = 14
const TOTAL_KEYS = 88
const FIRST_MIDI = 21
const QUANT_OPTIONS = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32']
const VELOCITY_H = 72
const HEADER_H = 28
const NOTES_12 = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const BLACK_KEYS = new Set([1,3,6,8,10])
const SCALES = {
  major: [0,2,4,5,7,9,11], minor: [0,2,3,5,7,8,10],
  dorian: [0,2,3,5,7,9,10], pentatonic: [0,2,4,7,9], blues: [0,3,5,6,7,10],
}
const CHORD_PATTERNS = {
  '': [0,4,7], 'm': [0,3,7], '7': [0,4,7,10], 'maj7': [0,4,7,11],
  'm7': [0,3,7,10], 'dim': [0,3,6], 'sus4': [0,5,7]
}

function midiToName(n) { return `${NOTES_12[(n - 12) % 12]}${Math.floor((n - 12) / 12)}` }
function isBlack(n) { return BLACK_KEYS.has((n - 12) % 12) }
function noteColor(n) {
  const palette = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#06b6d4','#84cc16','#f97316']
  return palette[Math.floor(n / 12) % palette.length]
}

const DEMO_NOTES = [
  {id:'n1',pitch:60,startBeat:0,durationBeats:1,velocity:90},
  {id:'n2',pitch:64,startBeat:0,durationBeats:1,velocity:80},
  {id:'n3',pitch:67,startBeat:0,durationBeats:2,velocity:85},
  {id:'n4',pitch:60,startBeat:2,durationBeats:0.5,velocity:95},
  {id:'n5',pitch:62,startBeat:2.5,durationBeats:0.5,velocity:75},
  {id:'n6',pitch:64,startBeat:3,durationBeats:1,velocity:88},
  {id:'n7',pitch:67,startBeat:4,durationBeats:2,velocity:92},
  {id:'n8',pitch:65,startBeat:4,durationBeats:1,velocity:70},
  {id:'n9',pitch:69,startBeat:6,durationBeats:2,velocity:85},
  {id:'n10',pitch:71,startBeat:8,durationBeats:4,velocity:88},
  {id:'n11',pitch:67,startBeat:8,durationBeats:2,velocity:78},
  {id:'n12',pitch:64,startBeat:10,durationBeats:2,velocity:82},
  {id:'n13',pitch:60,startBeat:12,durationBeats:4,velocity:95},
]

export default function PianoRoll() {
  const dispatch = useDispatch()
  const bpm = useSelector(s => s.project.bpm)
  const rootKey = useSelector(s => s.project.key) || 'C'
  const scaleName = useSelector(s => s.project.scale) || 'major'
  const quantization = useSelector(s => s.midi.quantization)
  const midiDevices = useSelector(s => s.midi.devices)

  const [notes, setNotes] = useState(DEMO_NOTES)
  const [selectedNotes, setSelectedNotes] = useState(new Set())
  const [dragging, setDragging] = useState(null)
  const [resizing, setResizing] = useState(null)
  const [tool, setTool] = useState('pencil')
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollTop, setScrollTop] = useState((TOTAL_KEYS / 2 - 10) * CELL_H)
  const [zoom, setZoom] = useState(1)
  const [activeKeys, setActiveKeys] = useState(new Set())
  const [showScaleAssist, setShowScaleAssist] = useState(true)
  const [showChordNames, setShowChordNames] = useState(true)
  const [detectedChords, setDetectedChords] = useState([])
  const [midiInputActive, setMidiInputActive] = useState(false)
  const [midiRecording, setMidiRecording] = useState(false)
  const [recordStartBeat, setRecordStartBeat] = useState(0)
  const [velocityEditing, setVelocityEditing] = useState(false)
  const [velDragging, setVelDragging] = useState(null)
  const [toast, setToast] = useState('')

  // ── MIDI CC Editor state ────────────────────────────────────────────────────
  const [showCCEditor, setShowCCEditor] = useState(false)
  const [activeCCLane, setActiveCCLane] = useState(1)   // CC number (1=ModWheel, 7=Volume, 10=Pan, 11=Expr, 64=Sustain)
  const [ccEvents, setCcEvents] = useState({
    1:  [{ id:'cc1a', beat:0, value:0 }, { id:'cc1b', beat:4, value:80 }, { id:'cc1c', beat:8, value:127 }, { id:'cc1d', beat:14, value:60 }, { id:'cc1e', beat:16, value:0 }],
    11: [{ id:'ce1', beat:0, value:100 }, { id:'ce2', beat:6, value:80 }, { id:'ce3', beat:12, value:110 }, { id:'ce4', beat:16, value:90 }],
    10: [{ id:'cp1', beat:0, value:64 }, { id:'cp2', beat:4, value:80 }, { id:'cp3', beat:8, value:48 }, { id:'cp4', beat:12, value:64 }],
    64: [{ id:'cs1', beat:0, value:0 }, { id:'cs2', beat:2, value:127 }, { id:'cs3', beat:6, value:0 }, { id:'cs4', beat:8, value:127 }, { id:'cs5', beat:12, value:0 }],
  })
  const [ccDragging, setCcDragging] = useState(null) // { id, startX, startY, origValue, origBeat }
  const ccCanvasRef = useRef(null)
  const CC_LANE_H = 70

  const CC_NAMES = { 1:'Mod Wheel', 2:'Breath', 7:'Volume', 10:'Pan', 11:'Expression', 64:'Sustain', 71:'Resonance', 74:'Cutoff', 91:'Reverb Send', 93:'Chorus Send' }

  // ── Arpeggiator state ──────────────────────────────────────────────────────
  const [arpEnabled, setArpEnabled] = useState(false)
  const [arpPattern, setArpPattern] = useState('up')        // up|down|up-down|random|as-played
  const [arpSpeed, setArpSpeed] = useState('1/16')          // 1/4|1/8|1/16|1/32
  const [arpOctaves, setArpOctaves] = useState(2)           // 1-4
  const [arpGate, setArpGate] = useState(80)                // 25-100%
  const [arpHeldNotes, setArpHeldNotes] = useState([])      // pitches held
  const [arpPlaying, setArpPlaying] = useState(false)
  const [arpRecordOutput, setArpRecordOutput] = useState(false)
  const arpSeqRef = useRef(null)
  const arpSynthRef = useRef(null)
  const arpStepRef = useRef(0)

  const synthRef = useRef(null)
  const gridRef = useRef(null)
  const gridCanvasRef = useRef(null)
  const velCanvasRef = useRef(null)
  const midiAccessRef = useRef(null)

  const PPB = 100 * zoom
  const TOTAL_BARS = 32
  const gridW = TOTAL_BARS * 4 * PPB
  const quantBeats = { '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125 }[quantization] || 0.25
  const snapBeat = (b) => Math.round(b / quantBeats) * quantBeats

  const getSynth = useCallback(() => {
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.6 }
      }).toDestination()
    }
    return synthRef.current
  }, [])

  // Scale helper
  const rootMidi = NOTES_12.indexOf(rootKey)
  const scaleIntervals = SCALES[scaleName] || SCALES.major
  const isInScale = (midiNote) => {
    const noteClass = ((midiNote - rootMidi) % 12 + 12) % 12
    return scaleIntervals.includes(noteClass)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2000) }

  // ── Chord detection ─────────────────────────────────────────────────────────
  useEffect(() => {
    const chords = []
    const beats = new Map()
    notes.forEach(n => {
      const snapBeatKey = Math.round(n.startBeat * 4) / 4
      if (!beats.has(snapBeatKey)) beats.set(snapBeatKey, [])
      beats.get(snapBeatKey).push(n.pitch)
    })
    beats.forEach((pitches, beat) => {
      if (pitches.length >= 3) {
        const sorted = [...new Set(pitches.map(p => ((p - 12) % 12 + 12) % 12))].sort((a, b) => a - b)
        let name = NOTES_12[sorted[0]]
        for (const [type, intervals] of Object.entries(CHORD_PATTERNS)) {
          const match = intervals.every((iv, i) => i === 0 || sorted.includes((sorted[0] + iv) % 12))
          if (match && intervals.length === sorted.length) { name = NOTES_12[sorted[0]] + type; break }
        }
        chords.push({ beat, name, x: beat * PPB })
      }
    })
    setDetectedChords(chords)
  }, [notes, PPB])

  // ── MIDI hardware input ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return
    navigator.requestMIDIAccess().then(access => {
      midiAccessRef.current = access
      dispatch(midiActions.setDevices([...access.inputs.values()].map(i => ({ id: i.id, name: i.name }))))
      access.inputs.forEach(input => {
        input.onmidimessage = (msg) => {
          const [status, note, velocity] = msg.data
          const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0
          const isNoteOff = (status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && velocity === 0)
          if (isNoteOn) {
            setActiveKeys(prev => new Set([...prev, note]))
            Tone.start().then(() => getSynth().triggerAttack(Tone.Frequency(note, 'midi').toNote()))
            if (midiRecording) {
              const newNote = { id: `midi_${Date.now()}_${note}`, pitch: note, startBeat: snapBeat(recordStartBeat), durationBeats: quantBeats, velocity }
              setNotes(prev => [...prev, newNote])
            }
          }
          if (isNoteOff) {
            setActiveKeys(prev => { const n = new Set(prev); n.delete(note); return n })
            getSynth().triggerRelease(Tone.Frequency(note, 'midi').toNote())
          }
        }
      })
      setMidiInputActive(access.inputs.size > 0)
    }).catch(() => {})
    return () => {
      if (midiAccessRef.current) {
        midiAccessRef.current.inputs.forEach(i => { i.onmidimessage = null })
      }
    }
  }, [dispatch, midiRecording, recordStartBeat, quantBeats, snapBeat, getSynth])

  // ── Grid canvas ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = gridCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = gridW; canvas.height = TOTAL_KEYS * CELL_H
    ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (let key = 0; key < TOTAL_KEYS; key++) {
      const midiNote = FIRST_MIDI + (TOTAL_KEYS - 1 - key)
      const y = key * CELL_H
      const black = isBlack(midiNote)
      const inScale = showScaleAssist && isInScale(midiNote)
      const isC = (midiNote % 12) === 0

      if (showScaleAssist) {
        ctx.fillStyle = black
          ? (inScale ? '#131320' : '#0a0a0a')
          : (inScale ? '#1a1a2e' : '#111')
      } else {
        ctx.fillStyle = black ? '#0a0a0a' : '#111'
      }
      ctx.fillRect(0, y, gridW, CELL_H)

      ctx.strokeStyle = isC ? '#2a2a4a' : black ? '#181818' : '#191919'
      ctx.lineWidth = isC ? 1 : 0.5
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(gridW, y); ctx.stroke()
    }

    for (let b = 0; b <= TOTAL_BARS * 4; b++) {
      const x = b * PPB
      ctx.strokeStyle = b % 4 === 0 ? '#2a2a2a' : b % 2 === 0 ? '#1a1a1a' : '#141414'
      ctx.lineWidth = b % 4 === 0 ? 1 : 0.5
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
      if (b % 4 === 0) {
        ctx.fillStyle = '#333'; ctx.font = '8px monospace'
        ctx.fillText(`${b / 4 + 1}`, x + 2, 9)
      }
    }

    // Scale highlight overlay
    if (showScaleAssist) {
      for (let key = 0; key < TOTAL_KEYS; key++) {
        const midiNote = FIRST_MIDI + (TOTAL_KEYS - 1 - key)
        if (!isInScale(midiNote) && !isBlack(midiNote)) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)'
          ctx.fillRect(0, key * CELL_H, gridW, CELL_H)
        }
      }
    }
  }, [gridW, PPB, showScaleAssist, rootKey, scaleName])

  // ── Velocity canvas ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = velCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = gridW; canvas.height = VELOCITY_H
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, gridW, VELOCITY_H)

    notes.forEach(note => {
      const x = note.startBeat * PPB
      const h = (note.velocity / 127) * (VELOCITY_H - 4)
      const color = selectedNotes.has(note.id) ? '#f59e0b' : noteColor(note.pitch)
      ctx.fillStyle = color
      ctx.fillRect(x, VELOCITY_H - h - 2, Math.max(3, note.durationBeats * PPB * 0.2), h)
      ctx.fillStyle = `${color}44`
      ctx.fillRect(x, VELOCITY_H - h - 2, Math.max(3, note.durationBeats * PPB * 0.2), h)
    })

    ctx.strokeStyle = '#222'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(0, VELOCITY_H / 2); ctx.lineTo(gridW, VELOCITY_H / 2); ctx.stroke()
    ctx.fillStyle = '#333'; ctx.font = '8px monospace'
    ctx.fillText('127', 2, 9); ctx.fillText('64', 2, VELOCITY_H / 2 + 8); ctx.fillText('VEL', gridW - 22, VELOCITY_H - 3)
  }, [notes, selectedNotes, gridW, PPB])

  // ── Grid mouse interactions ─────────────────────────────────────────────────
  const handleGridMouseDown = useCallback((e) => {
    const rect = gridRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollLeft
    const y = e.clientY - rect.top + scrollTop
    const beat = snapBeat(x / PPB)
    const keyIdx = Math.floor(y / CELL_H)
    const midiNote = FIRST_MIDI + (TOTAL_KEYS - 1 - keyIdx)

    const clickedNote = notes.find(n => {
      const nx = n.startBeat * PPB, nw = n.durationBeats * PPB
      const ny = (TOTAL_KEYS - 1 - (n.pitch - FIRST_MIDI)) * CELL_H
      return x >= nx && x <= nx + nw && y >= ny && y <= ny + CELL_H
    })

    if (tool === 'pencil') {
      if (clickedNote) {
        setSelectedNotes(new Set([clickedNote.id]))
        setDragging({ id: clickedNote.id, startX: e.clientX, origBeat: clickedNote.startBeat, startY: e.clientY, origPitch: clickedNote.pitch })
      } else {
        const newNote = { id: `n_${Date.now()}`, pitch: midiNote, startBeat: beat, durationBeats: quantBeats, velocity: 90 }
        setNotes(prev => [...prev, newNote])
        setSelectedNotes(new Set([newNote.id]))
        Tone.start().then(() => getSynth().triggerAttackRelease(Tone.Frequency(midiNote, 'midi').toNote(), '8n'))
      }
    } else if (tool === 'erase') {
      if (clickedNote) setNotes(prev => prev.filter(n => n.id !== clickedNote.id))
    } else if (tool === 'select') {
      if (clickedNote) {
        if (e.shiftKey) {
          setSelectedNotes(prev => { const n = new Set(prev); n.has(clickedNote.id) ? n.delete(clickedNote.id) : n.add(clickedNote.id); return n })
        } else {
          setSelectedNotes(new Set([clickedNote.id]))
          setDragging({ id: clickedNote.id, startX: e.clientX, origBeat: clickedNote.startBeat, startY: e.clientY, origPitch: clickedNote.pitch })
        }
      } else if (!e.shiftKey) {
        setSelectedNotes(new Set())
      }
    }
  }, [notes, tool, PPB, scrollLeft, scrollTop, quantBeats, getSynth, snapBeat])

  // Velocity lane mouse
  const handleVelMouseDown = useCallback((e) => {
    const canvas = velCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const clickedNote = notes.reduce((best, n) => {
      const nx = n.startBeat * PPB
      const dist = Math.abs(x - nx)
      return (!best || dist < best.dist) ? { note: n, dist } : best
    }, null)
    if (clickedNote && clickedNote.dist < 10) {
      setVelDragging({ id: clickedNote.note.id, startY: e.clientY, origVel: clickedNote.note.velocity })
    }
  }, [notes, PPB])

  const handleMouseMove = useCallback((e) => {
    if (dragging) {
      const dx = e.clientX - dragging.startX
      const dy = e.clientY - dragging.startY
      const beatDelta = snapBeat(dx / PPB)
      const pitchDelta = -Math.round(dy / CELL_H)
      setNotes(prev => prev.map(n => n.id === dragging.id
        ? { ...n, startBeat: Math.max(0, dragging.origBeat + beatDelta), pitch: Math.max(21, Math.min(108, dragging.origPitch + pitchDelta)) }
        : n))
    }
    if (resizing) {
      const dx = e.clientX - resizing.startX
      const beatDelta = dx / PPB
      setNotes(prev => prev.map(n => n.id === resizing.id
        ? { ...n, durationBeats: Math.max(quantBeats, Math.round((resizing.origDur + beatDelta) / quantBeats) * quantBeats) }
        : n))
    }
    if (velDragging) {
      const dy = velDragging.startY - e.clientY
      setNotes(prev => prev.map(n => n.id === velDragging.id
        ? { ...n, velocity: Math.max(1, Math.min(127, velDragging.origVel + dy)) }
        : n))
    }
  }, [dragging, resizing, velDragging, PPB, quantBeats, snapBeat])

  const handleMouseUp = useCallback(() => { setDragging(null); setResizing(null); setVelDragging(null) }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [handleMouseMove, handleMouseUp])

  // ── CC lane rendering ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = ccCanvasRef.current
    if (!canvas || !showCCEditor) return
    const ctx = canvas.getContext('2d')
    canvas.width = gridW; canvas.height = CC_LANE_H
    ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, gridW, CC_LANE_H)

    // Grid lines
    ctx.strokeStyle = '#111'; ctx.lineWidth = 0.5
    for (let v = 0; v <= 127; v += 32) {
      const y = CC_LANE_H - (v / 127) * (CC_LANE_H - 4) - 2
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(gridW, y); ctx.stroke()
      ctx.fillStyle = '#2a2a2a'; ctx.font = '7px monospace'; ctx.fillText(v.toString(), 2, y - 1)
    }
    for (let b = 0; b <= TOTAL_BARS * 4; b++) {
      const x = b * PPB; ctx.strokeStyle = b % 4 === 0 ? '#1a1a1a' : '#111'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CC_LANE_H); ctx.stroke()
    }

    const events = ccEvents[activeCCLane] || []
    if (events.length === 0) return
    const sorted = [...events].sort((a, b) => a.beat - b.beat)

    // Draw line connecting events
    ctx.strokeStyle = '#3b82f666'; ctx.lineWidth = 1.5; ctx.beginPath()
    sorted.forEach((ev, i) => {
      const x = ev.beat * PPB; const y = CC_LANE_H - (ev.value / 127) * (CC_LANE_H - 4) - 2
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }); ctx.stroke()

    // Draw vertical bars
    sorted.forEach(ev => {
      const x = ev.beat * PPB; const h = (ev.value / 127) * (CC_LANE_H - 4)
      ctx.fillStyle = '#3b82f633'
      ctx.fillRect(x - 1, CC_LANE_H - h - 2, 2, h)
    })

    // Draw dots
    sorted.forEach(ev => {
      const x = ev.beat * PPB; const y = CC_LANE_H - (ev.value / 127) * (CC_LANE_H - 4) - 2
      ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill()
    })

    // Label
    ctx.fillStyle = '#3b82f688'; ctx.font = 'bold 9px monospace'
    ctx.fillText(`CC${activeCCLane}: ${CC_NAMES[activeCCLane] || 'Unknown'}`, 4, CC_LANE_H - 4)
  }, [ccEvents, activeCCLane, gridW, PPB, showCCEditor])

  const handleCCMouseDown = useCallback((e) => {
    const canvas = ccCanvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollLeft
    const y = e.clientY - rect.top
    const beat = Math.max(0, x / PPB)
    const value = Math.round(Math.max(0, Math.min(127, (1 - (y / CC_LANE_H)) * 127)))

    const events = ccEvents[activeCCLane] || []
    // Find nearby event (within 8px)
    const nearby = events.find(ev => Math.abs(ev.beat * PPB - x) < 8 && Math.abs((1 - ev.value / 127) * CC_LANE_H - y) < 8)

    if (e.button === 2) {
      // Right-click: delete
      if (nearby) setCcEvents(prev => ({ ...prev, [activeCCLane]: (prev[activeCCLane] || []).filter(ev => ev.id !== nearby.id) }))
      return
    }

    if (nearby) {
      setCcDragging({ id: nearby.id, startX: e.clientX, startY: e.clientY, origValue: nearby.value, origBeat: nearby.beat })
    } else {
      const newEv = { id: `cc_${Date.now()}`, beat: Math.round(beat * 4) / 4, value }
      setCcEvents(prev => ({ ...prev, [activeCCLane]: [...(prev[activeCCLane] || []), newEv] }))
    }
  }, [ccEvents, activeCCLane, PPB, scrollLeft])

  const handleCCMouseMove = useCallback((e) => {
    if (!ccDragging) return
    const dx = e.clientX - ccDragging.startX
    const dy = ccDragging.startY - e.clientY
    const beatDelta = dx / PPB
    const valueDelta = Math.round((dy / CC_LANE_H) * 127)
    setCcEvents(prev => ({
      ...prev,
      [activeCCLane]: (prev[activeCCLane] || []).map(ev => ev.id === ccDragging.id
        ? { ...ev, beat: Math.max(0, Math.round((ccDragging.origBeat + beatDelta) * 4) / 4), value: Math.max(0, Math.min(127, ccDragging.origValue + valueDelta)) }
        : ev)
    }))
  }, [ccDragging, PPB, activeCCLane])

  const handleCCMouseUp = useCallback(() => setCcDragging(null), [])

  useEffect(() => {
    window.addEventListener('mousemove', handleCCMouseMove)
    window.addEventListener('mouseup', handleCCMouseUp)
    return () => { window.removeEventListener('mousemove', handleCCMouseMove); window.removeEventListener('mouseup', handleCCMouseUp) }
  }, [handleCCMouseMove, handleCCMouseUp])

  // ── Arpeggiator engine ──────────────────────────────────────────────────────
  const buildArpSequence = useCallback((pitches) => {
    if (!pitches.length) return []
    const base = [...pitches].sort((a, b) => a - b)
    const expanded = []
    for (let oct = 0; oct < arpOctaves; oct++) expanded.push(...base.map(p => p + oct * 12))
    switch (arpPattern) {
      case 'down':     return [...expanded].reverse()
      case 'up-down':  return [...expanded, ...[...expanded].reverse().slice(1, -1)]
      case 'random':   return [...expanded].sort(() => Math.random() - 0.5)
      case 'as-played': return pitches.flatMap(p => Array.from({length:arpOctaves},(_,o) => p + o * 12))
      default:         return expanded  // up
    }
  }, [arpPattern, arpOctaves])

  const startArp = useCallback(async () => {
    await Tone.start()
    const arpSynth = new Tone.Synth({ oscillator:{type:'triangle'}, envelope:{attack:0.005,decay:0.1,sustain:0.4,release:0.15} }).toDestination()
    arpSynthRef.current = arpSynth
    const speedMap = { '1/4':'4n', '1/8':'8n', '1/16':'16n', '1/32':'32n' }
    const interval = speedMap[arpSpeed] || '16n'
    const gateFrac = arpGate / 100
    let seqNotes = buildArpSequence(arpHeldNotes)
    if (!seqNotes.length) seqNotes = [60]
    arpStepRef.current = 0
    const recordedNotes = []
    let beat = 0
    const beatDur = Tone.Time(interval).toSeconds() * (Tone.Transport.bpm.value / 60)

    arpSeqRef.current = new Tone.Sequence((time) => {
      const idx = arpStepRef.current % seqNotes.length
      const pitch = seqNotes[idx]
      const noteName = Tone.Frequency(Math.max(21, Math.min(108, pitch)), 'midi').toNote()
      const durSec = Tone.Time(interval).toSeconds() * gateFrac
      arpSynth.triggerAttackRelease(noteName, durSec, time)
      if (arpRecordOutput) {
        recordedNotes.push({ id:`arp_${Date.now()}_${idx}`, pitch:Math.max(21,Math.min(108,pitch)), startBeat:beat, durationBeats:beatDur*gateFrac, velocity:90 })
        beat += beatDur
      }
      arpStepRef.current++
    }, null, interval).start(0)

    Tone.Transport.start()
    setArpPlaying(true)
    showToast(`Arpeggiator running: ${arpPattern} ${arpSpeed} ${arpOctaves}oct`)

    // stop after 4 bars
    const stopAfter = 4 * 4 * Tone.Time('4n').toSeconds()
    setTimeout(() => {
      stopArp()
      if (arpRecordOutput && recordedNotes.length > 0) {
        setNotes(prev => [...prev, ...recordedNotes])
        showToast(`Recorded ${recordedNotes.length} arp notes`)
      }
    }, stopAfter * 1000 + 200)
  }, [arpHeldNotes, arpPattern, arpOctaves, arpSpeed, arpGate, arpRecordOutput, buildArpSequence])

  const stopArp = useCallback(() => {
    arpSeqRef.current?.stop(); arpSeqRef.current?.dispose(); arpSeqRef.current = null
    arpSynthRef.current?.dispose(); arpSynthRef.current = null
    Tone.Transport.stop()
    setArpPlaying(false)
    arpStepRef.current = 0
  }, [])

  useEffect(() => () => stopArp(), [])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setNotes(prev => prev.filter(n => !selectedNotes.has(n.id))); setSelectedNotes(new Set())
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); setSelectedNotes(new Set(notes.map(n => n.id))) }
      // Transpose: Shift+Up/Down = semitone, Ctrl+Shift+Up/Down = octave
      if (e.key === 'ArrowUp' && selectedNotes.size > 0) {
        e.preventDefault()
        const step = e.ctrlKey ? 12 : 1
        setNotes(prev => prev.map(n => selectedNotes.has(n.id) ? { ...n, pitch: Math.min(108, n.pitch + step) } : n))
        showToast(`Transposed +${e.ctrlKey ? '12 (octave)' : '1'} semitone`)
      }
      if (e.key === 'ArrowDown' && selectedNotes.size > 0) {
        e.preventDefault()
        const step = e.ctrlKey ? 12 : 1
        setNotes(prev => prev.map(n => selectedNotes.has(n.id) ? { ...n, pitch: Math.max(21, n.pitch - step) } : n))
        showToast(`Transposed -${e.ctrlKey ? '12 (octave)' : '1'} semitone`)
      }
      // Move in time: Shift+Left/Right
      if (e.key === 'ArrowLeft' && selectedNotes.size > 0 && e.shiftKey) {
        e.preventDefault()
        setNotes(prev => prev.map(n => selectedNotes.has(n.id) ? { ...n, startBeat: Math.max(0, n.startBeat - quantBeats) } : n))
      }
      if (e.key === 'ArrowRight' && selectedNotes.size > 0 && e.shiftKey) {
        e.preventDefault()
        setNotes(prev => prev.map(n => selectedNotes.has(n.id) ? { ...n, startBeat: n.startBeat + quantBeats } : n))
      }
      // Ctrl+D duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedNotes.size > 0) {
        e.preventDefault()
        const maxEnd = Math.max(...[...selectedNotes].map(id => { const n = notes.find(x => x.id === id); return n ? n.startBeat + n.durationBeats : 0 }))
        const minStart = Math.min(...[...selectedNotes].map(id => { const n = notes.find(x => x.id === id); return n?.startBeat ?? Infinity }))
        const offset = maxEnd - minStart
        const newNotes = [...selectedNotes].map(id => {
          const n = notes.find(x => x.id === id)
          return n ? { ...n, id: `n_${Date.now()}_${Math.random()}`, startBeat: n.startBeat + offset } : null
        }).filter(Boolean)
        setNotes(prev => [...prev, ...newNotes])
        setSelectedNotes(new Set(newNotes.map(n => n.id)))
        showToast('Duplicated')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNotes, notes, quantBeats])

  const playAllNotes = async () => {
    await Tone.start()
    Tone.Transport.stop(); Tone.Transport.cancel()
    const synth = getSynth()
    const part = new Tone.Part((time, note) => {
      synth.triggerAttackRelease(Tone.Frequency(note.pitch, 'midi').toNote(), `${note.durationBeats * 60 / bpm}s`, time)
    }, notes.map(n => [{ '4n': n.startBeat }, n])).start(0)
    Tone.Transport.bpm.value = bpm
    Tone.Transport.start()
    const maxBeat = Math.max(...notes.map(n => n.startBeat + n.durationBeats), 8)
    setTimeout(() => { Tone.Transport.stop(); part.dispose() }, (maxBeat + 2) * 60 / bpm * 1000)
  }

  const handlePianoKeyPlay = (midiNote) => {
    setActiveKeys(prev => new Set([...prev, midiNote]))
    // Feed arpeggiator held notes
    if (arpEnabled) {
      setArpHeldNotes(prev => prev.includes(midiNote) ? prev.filter(p => p !== midiNote) : [...prev, midiNote])
    }
    Tone.start().then(() => {
      if (!arpEnabled) getSynth().triggerAttackRelease(Tone.Frequency(midiNote, 'midi').toNote(), '8n')
      setTimeout(() => setActiveKeys(prev => { const n = new Set(prev); n.delete(midiNote); return n }), 500)
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Arpeggiator Panel */}
      {arpEnabled && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'#0d1a0d', borderBottom:'1px solid #22c55e33', flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#22c55e' }}>🎹 ARPEGGIATOR</span>
          {/* Pattern */}
          <div style={{ display:'flex', gap:3 }}>
            {['up','down','up-down','random','as-played'].map(p => (
              <button key={p} onClick={() => setArpPattern(p)}
                style={{ padding:'3px 7px', background:arpPattern===p?'#22c55e22':'transparent', border:`1px solid ${arpPattern===p?'#22c55e44':'#2a2a2a'}`, borderRadius:4, color:arpPattern===p?'#22c55e':'#555', cursor:'pointer', fontSize:9, textTransform:'capitalize' }}>
                {p}
              </button>
            ))}
          </div>
          {/* Speed */}
          <div style={{ display:'flex', gap:3 }}>
            {['1/4','1/8','1/16','1/32'].map(s => (
              <button key={s} onClick={() => setArpSpeed(s)}
                style={{ padding:'3px 7px', background:arpSpeed===s?'#22c55e22':'transparent', border:`1px solid ${arpSpeed===s?'#22c55e44':'#2a2a2a'}`, borderRadius:4, color:arpSpeed===s?'#22c55e':'#555', cursor:'pointer', fontSize:9 }}>
                {s}
              </button>
            ))}
          </div>
          {/* Octaves */}
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:9, color:'#444' }}>Oct:</span>
            {[1,2,3,4].map(o => (
              <button key={o} onClick={() => setArpOctaves(o)}
                style={{ width:20, height:20, background:arpOctaves===o?'#22c55e22':'transparent', border:`1px solid ${arpOctaves===o?'#22c55e44':'#2a2a2a'}`, borderRadius:3, color:arpOctaves===o?'#22c55e':'#555', cursor:'pointer', fontSize:9 }}>
                {o}
              </button>
            ))}
          </div>
          {/* Gate */}
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:9, color:'#444' }}>Gate</span>
            <input type="range" min="25" max="100" step="5" value={arpGate} onChange={e => setArpGate(+e.target.value)} style={{ width:60 }} />
            <span style={{ fontSize:9, color:'#666', minWidth:26 }}>{arpGate}%</span>
          </div>
          {/* Held notes display */}
          <div style={{ display:'flex', gap:3, alignItems:'center' }}>
            <span style={{ fontSize:9, color:'#444' }}>Hold:</span>
            {arpHeldNotes.length === 0
              ? <span style={{ fontSize:9, color:'#333' }}>click keys below</span>
              : arpHeldNotes.map(p => <span key={p} style={{ fontSize:9, color:'#22c55e', background:'#0a2a0a', padding:'1px 5px', borderRadius:3 }}>{NOTES_12[(p-12)%12]}</span>)
            }
            {arpHeldNotes.length > 0 && <button onClick={() => setArpHeldNotes([])} style={{ background:'none', border:'none', color:'#333', cursor:'pointer', fontSize:9 }}>✕</button>}
          </div>
          <label style={{ display:'flex', gap:4, alignItems:'center', fontSize:9, color:'#555', cursor:'pointer' }}>
            <input type="checkbox" checked={arpRecordOutput} onChange={e => setArpRecordOutput(e.target.checked)} />Record
          </label>
          <button onClick={arpPlaying ? stopArp : startArp}
            style={{ padding:'4px 12px', background:arpPlaying?'#ef444422':'#22c55e22', border:`1px solid ${arpPlaying?'#ef4444':'#22c55e'}55`, borderRadius:6, color:arpPlaying?'#ef4444':'#22c55e', cursor:'pointer', fontSize:10, fontWeight:700 }}>
            {arpPlaying ? '■ Stop' : '▶ Start'}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#111', borderBottom: '1px solid #1f1f1f', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#666' }}>PIANO ROLL</span>
        <div style={{ width: 1, height: 18, background: '#333' }} />
        {[['pencil','✏️','Pencil'],['select','⬜','Select'],['erase','🧹','Erase']].map(([t,icon,label]) => (
          <button key={t} onClick={() => setTool(t)} title={label}
            style={{ padding: '4px 8px', background: tool===t ? '#1e3a5f' : 'transparent', border: `1px solid ${tool===t ? '#3b82f6' : '#333'}`, borderRadius: 6, color: tool===t ? '#3b82f6' : '#666', cursor: 'pointer', fontSize: 11 }}>
            {icon} {label}
          </button>
        ))}
        <div style={{ width: 1, height: 18, background: '#333' }} />
        <select value={quantization} onChange={e => dispatch(midiActions.setQuantization(e.target.value))}
          style={{ background: '#1a1a1a', border: '1px solid #333', color: '#aaa', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}>
          {QUANT_OPTIONS.map(q => <option key={q}>{q}</option>)}
        </select>
        <button onClick={() => setShowScaleAssist(v => !v)}
          style={{ padding: '4px 8px', background: showScaleAssist ? '#1e3a5f' : 'transparent', border: `1px solid ${showScaleAssist ? '#3b82f6' : '#333'}`, borderRadius: 6, color: showScaleAssist ? '#3b82f6' : '#555', cursor: 'pointer', fontSize: 11 }}>
          🎼 Scale
        </button>
        <button onClick={() => setShowChordNames(v => !v)}
          style={{ padding: '4px 8px', background: showChordNames ? '#8b5cf622' : 'transparent', border: `1px solid ${showChordNames ? '#8b5cf6' : '#333'}`, borderRadius: 6, color: showChordNames ? '#8b5cf6' : '#555', cursor: 'pointer', fontSize: 11 }}>
          🎵 Chords
        </button>
        <button onClick={() => setArpEnabled(v => !v)}
          style={{ padding: '4px 8px', background: arpEnabled ? '#22c55e22' : 'transparent', border: `1px solid ${arpEnabled ? '#22c55e' : '#333'}`, borderRadius: 6, color: arpEnabled ? '#22c55e' : '#555', cursor: 'pointer', fontSize: 11 }}>
          🎹 Arp
        </button>
        <div style={{ width: 1, height: 18, background: '#333' }} />
        <button onClick={playAllNotes}
          style={{ padding: '4px 10px', background: '#22c55e22', border: '1px solid #22c55e55', borderRadius: 6, color: '#22c55e', cursor: 'pointer', fontSize: 11 }}>
          ▶ Play
        </button>
        <button onClick={() => { setNotes([]); setSelectedNotes(new Set()) }}
          style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #333', borderRadius: 6, color: '#555', cursor: 'pointer', fontSize: 11 }}>
          🗑 Clear
        </button>
        {midiInputActive && (
          <button onClick={() => setMidiRecording(v => !v)}
            style={{ padding: '4px 10px', background: midiRecording ? '#ef444422' : '#1a1a1a', border: `1px solid ${midiRecording ? '#ef4444' : '#333'}`, borderRadius: 6, color: midiRecording ? '#ef4444' : '#888', cursor: 'pointer', fontSize: 11 }}>
            {midiRecording ? '⏺ Recording...' : '⏺ Record MIDI'}
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, color: '#555' }}>
          <span>{notes.length} notes</span>
          {selectedNotes.size > 0 && <span style={{ color: '#3b82f6' }}>{selectedNotes.size} selected</span>}
          {midiInputActive && <span style={{ color: '#22c55e' }}>🎹 MIDI connected</span>}
          <span>Key: {rootKey} {scaleName}</span>
          <input type="range" min="0.3" max="3" step="0.1" value={zoom} onChange={e => setZoom(+e.target.value)} style={{ width: 70 }} />
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 40, right: 20, background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: 8, padding: '6px 14px', fontSize: 11, color: '#93c5fd', zIndex: 999, pointerEvents: 'none' }}>{toast}</div>}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Piano keyboard */}
        <div style={{ width: PIANO_W, flexShrink: 0, background: '#0f0f0f', borderRight: '1px solid #1f1f1f', overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: HEADER_H, background: '#0d0d0d', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 8, color: '#333', textTransform: 'uppercase', letterSpacing: 1 }}>KEYS</span>
          </div>
          <div style={{ overflowY: 'hidden', height: `calc(100% - ${HEADER_H}px)`, transform: `translateY(-${scrollTop}px)` }}>
            {Array.from({ length: TOTAL_KEYS }, (_, i) => {
              const midiNote = FIRST_MIDI + (TOTAL_KEYS - 1 - i)
              const black = isBlack(midiNote)
              const isC = midiNote % 12 === 0
              const inScale = isInScale(midiNote)
              const isActive = activeKeys.has(midiNote)
              return (
                <div key={midiNote}
                  style={{ height: CELL_H, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 3,
                    background: isActive ? '#3b82f6' : black ? '#1a1a1a' : (showScaleAssist && inScale) ? '#1e1e30' : isC ? '#222' : '#1a1a1a',
                    borderBottom: '1px solid #111', cursor: 'pointer', overflow: 'hidden' }}
                  onClick={() => handlePianoKeyPlay(midiNote)}>
                  {(isC || (isActive && !black)) && (
                    <span style={{ fontSize: 7, color: isActive ? '#fff' : inScale ? '#6688ff' : '#444', userSelect: 'none', fontWeight: isC ? 700 : 400 }}>
                      {midiToName(midiNote)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Main grid */}
        <div style={{ flex: 1, overflow: 'scroll', position: 'relative' }} ref={gridRef}
          onScroll={e => { setScrollLeft(e.currentTarget.scrollLeft); setScrollTop(e.currentTarget.scrollTop) }}>
          <div style={{ width: gridW, height: TOTAL_KEYS * CELL_H + VELOCITY_H + HEADER_H, position: 'relative' }}>
            {/* Header with beat numbers + chord names */}
            <div style={{ height: HEADER_H, position: 'sticky', top: 0, zIndex: 10, background: '#0d0d0d', borderBottom: '1px solid #1f1f1f', overflow: 'hidden' }}>
              {Array.from({ length: TOTAL_BARS * 4 + 1 }, (_, b) => b % 4 === 0 && (
                <div key={b} style={{ position: 'absolute', left: b * PPB, fontSize: 9, color: '#555', paddingLeft: 2, top: 3 }}>{b / 4 + 1}</div>
              ))}
              {showChordNames && detectedChords.map(chord => (
                <div key={chord.beat} style={{ position: 'absolute', left: chord.x, top: 12, fontSize: 9, fontWeight: 700, color: '#8b5cf6', background: '#1a0a2e', padding: '0 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                  {chord.name}
                </div>
              ))}
            </div>

            {/* Grid canvas */}
            <canvas ref={gridCanvasRef} style={{ position: 'absolute', top: HEADER_H, left: 0 }}
              onMouseDown={handleGridMouseDown} />

            {/* Notes */}
            <div style={{ position: 'absolute', top: HEADER_H, left: 0, width: gridW, height: TOTAL_KEYS * CELL_H, pointerEvents: 'none' }}>
              {notes.map(note => {
                const x = note.startBeat * PPB
                const y = (TOTAL_KEYS - 1 - (note.pitch - FIRST_MIDI)) * CELL_H
                const w = Math.max(4, note.durationBeats * PPB - 1)
                const color = noteColor(note.pitch)
                const selected = selectedNotes.has(note.id)
                const inScale = isInScale(note.pitch)
                return (
                  <div key={note.id} style={{ position: 'absolute', left: x, top: y + 1, width: w, height: CELL_H - 2, background: selected ? '#f59e0b' : inScale ? color : `${color}88`, borderRadius: 3, opacity: 0.92, pointerEvents: 'auto', cursor: 'grab', boxShadow: selected ? `0 0 8px ${color}` : inScale ? `inset 0 0 0 1px ${color}66` : 'none' }}
                    onMouseDown={e => {
                      e.stopPropagation()
                      setSelectedNotes(prev => e.shiftKey ? new Set([...prev, note.id]) : new Set([note.id]))
                      setDragging({ id: note.id, startX: e.clientX, origBeat: note.startBeat, startY: e.clientY, origPitch: note.pitch })
                    }}>
                    {!inScale && showScaleAssist && (
                      <div style={{ position: 'absolute', right: 1, top: 1, width: 3, height: 3, borderRadius: '50%', background: '#ef4444', opacity: 0.8 }} title="Out of scale" />
                    )}
                    {/* Resize handle */}
                    <div style={{ position: 'absolute', right: 0, top: 0, width: 5, height: '100%', cursor: 'ew-resize', pointerEvents: 'auto' }}
                      onMouseDown={e => { e.stopPropagation(); setResizing({ id: note.id, startX: e.clientX, origDur: note.durationBeats }) }} />
                  </div>
                )
              })}
            </div>

            {/* Velocity lane */}
            <div style={{ position: 'absolute', top: HEADER_H + TOTAL_KEYS * CELL_H, left: 0, width: gridW, borderTop: '2px solid #1a1a1a' }}>
              <div style={{ fontSize: 8, color: '#333', padding: '1px 4px', background: '#0a0a0a', textTransform: 'uppercase', letterSpacing: 1 }}>Velocity</div>
              <canvas ref={velCanvasRef} style={{ display: 'block', cursor: 'ns-resize' }} onMouseDown={handleVelMouseDown} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '3px 12px', background: '#080808', borderTop: '1px solid #141414', fontSize: 9, color: '#2a2a2a', display: 'flex', gap: 14 }}>
        <span>Click: add note</span>
        <span>Drag note: move</span>
        <span>Drag right edge: resize</span>
        <span>↑↓: transpose semitone</span>
        <span>Ctrl+↑↓: transpose octave</span>
        <span>Shift+←→: move in time</span>
        <span>Ctrl+A: select all</span>
        <span>Del: delete selected</span>
        {showScaleAssist && <span style={{ color: '#3b82f688' }}>🔴 = out of {rootKey} {scaleName}</span>}
      </div>
    </div>
  )
}
