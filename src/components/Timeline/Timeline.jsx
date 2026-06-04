import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { projectActions, uiActions, playbackActions } from '../../store'

const HEADER_W = 180
const RULER_H = 32
const TRACK_H = 78
const TOTAL_BARS = 64
const TRACK_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16']

const initTracks = () => [
  { id:'t1', name:'Lead Vocal', color:'#3b82f6', volume:0.9, pan:0, mute:false, solo:false, armed:false,
    clips:[{id:'c1',name:'Verse 1',startBeat:0,durationBeats:16,type:'audio',fadeIn:0,fadeOut:0,waveform:Array.from({length:40},()=>Math.random()*0.8+0.1)},
           {id:'c2',name:'Chorus',startBeat:16,durationBeats:16,type:'audio',fadeIn:2,fadeOut:2,waveform:Array.from({length:40},()=>Math.random()*0.9+0.1)},
           {id:'c3',name:'Verse 2',startBeat:32,durationBeats:16,type:'audio',fadeIn:0,fadeOut:0,waveform:Array.from({length:40},()=>Math.random()*0.7+0.1)}]},
  { id:'t2', name:'Drums', color:'#ec4899', volume:1, pan:0, mute:false, solo:false, armed:false,
    clips:[{id:'d1',name:'Beat',startBeat:0,durationBeats:8,type:'pattern',fadeIn:0,fadeOut:0,waveform:Array.from({length:40},()=>Math.random()>0.6?0.9:0.1)},
           {id:'d2',name:'Beat',startBeat:8,durationBeats:8,type:'pattern',fadeIn:0,fadeOut:0,waveform:Array.from({length:40},()=>Math.random()>0.6?0.9:0.1)},
           {id:'d3',name:'Beat',startBeat:16,durationBeats:16,type:'pattern',fadeIn:0,fadeOut:0,waveform:Array.from({length:40},()=>Math.random()>0.6?0.9:0.1)},
           {id:'d4',name:'Fill',startBeat:32,durationBeats:32,type:'pattern',fadeIn:0,fadeOut:0,waveform:Array.from({length:40},()=>Math.random()>0.6?0.9:0.1)}]},
  { id:'t3', name:'Bass', color:'#10b981', volume:0.85, pan:0, mute:false, solo:false, armed:false,
    clips:[{id:'b1',name:'Bass Line',startBeat:0,durationBeats:32,type:'midi',fadeIn:0,fadeOut:1,waveform:Array.from({length:40},(_,i)=>Math.abs(Math.sin(i/3))*0.7)},
           {id:'b2',name:'Bass 2',startBeat:32,durationBeats:24,type:'midi',fadeIn:0,fadeOut:1,waveform:Array.from({length:40},(_,i)=>Math.abs(Math.sin(i/3))*0.7)}]},
  { id:'t4', name:'Synth Pad', color:'#8b5cf6', volume:0.7, pan:-0.2, mute:false, solo:false, armed:false,
    clips:[{id:'p1',name:'Pad',startBeat:16,durationBeats:48,type:'midi',fadeIn:4,fadeOut:4,waveform:Array.from({length:40},()=>0.2+Math.random()*0.3)}]},
  { id:'t5', name:'Guitar', color:'#f59e0b', volume:0.75, pan:0.3, mute:false, solo:false, armed:false,
    clips:[{id:'g1',name:'Riff',startBeat:8,durationBeats:12,type:'audio',fadeIn:1,fadeOut:1,waveform:Array.from({length:40},()=>Math.random()*0.7+0.15)},
           {id:'g2',name:'Solo',startBeat:40,durationBeats:8,type:'audio',fadeIn:2,fadeOut:0,waveform:Array.from({length:40},()=>Math.random()*0.8+0.1)}]},
  { id:'t6', name:'FX', color:'#ef4444', volume:0.5, pan:0, mute:false, solo:false, armed:false,
    clips:[{id:'f1',name:'Riser',startBeat:15,durationBeats:1,type:'audio',fadeIn:1,fadeOut:0,waveform:Array.from({length:40},(_,i)=>i/40)},
           {id:'f2',name:'Impact',startBeat:16,durationBeats:2,type:'audio',fadeIn:0,fadeOut:1,waveform:Array.from({length:40},(_,i)=>(40-i)/40*0.9)}]},
]

export default function Timeline() {
  const dispatch = useDispatch()
  const bpm = useSelector(s => s.project.bpm)
  const playing = useSelector(s => s.playback.playing)
  const zoom = useSelector(s => s.ui.zoom)
  const selectedTrackId = useSelector(s => s.ui.selectedTrackId)

  const [tracks, setTracks] = useState(initTracks)
  const [scrollLeft, setScrollLeft] = useState(0)

  // ── Multi-selection state ──────────────────────────────────────────────────
  const [selectedClips, setSelectedClips] = useState(new Set())  // Set<clipId>
  const [clipboard, setClipboard] = useState([])

  // ── Drag/resize/fade state ─────────────────────────────────────────────────
  const [dragging, setDragging] = useState(null)
  const [resizing, setResizing] = useState(null)
  const [fadeDrag, setFadeDrag] = useState(null)

  // ── Rubber-band selection ──────────────────────────────────────────────────
  const [rubberBand, setRubberBand] = useState(null)  // {startX,startY,endX,endY}

  // ── Punch in/out ──────────────────────────────────────────────────────────
  const [punchEnabled, setPunchEnabled] = useState(false)
  const [punchIn, setPunchIn] = useState(8)    // beats
  const [punchOut, setPunchOut] = useState(24) // beats
  const [punchDragging, setPunchDragging] = useState(null) // 'in'|'out'

  // ── Other state ───────────────────────────────────────────────────────────
  const [rippleMode, setRippleMode] = useState(false)
  const [showLoopRegion, setShowLoopRegion] = useState(false)
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(16)
  const [playheadTime, setPlayheadTime] = useState(0)
  const [dropOver, setDropOver] = useState(null)
  const [toast, setToast] = useState('')

  const scrollRef = useRef(null)
  const rulerRef = useRef(null)
  const clipAreaRef = useRef(null)
  const rafRef = useRef(null)

  const PPB = Math.max(20, Math.min(400, 80 * zoom))
  const totalWidth = TOTAL_BARS * 4 * PPB

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200) }

  // ── Ruler rendering ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = rulerRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = totalWidth; canvas.height = RULER_H
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, totalWidth, RULER_H)
    for (let b = 0; b <= TOTAL_BARS * 4; b++) {
      const x = b * PPB
      const isBar = b % 4 === 0; const isSec = b % 16 === 0
      ctx.strokeStyle = isSec ? '#555' : isBar ? '#333' : '#1e1e1e'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, RULER_H); ctx.stroke()
      if (isBar) { ctx.fillStyle = isSec ? '#aaa' : '#555'; ctx.font = `${isSec ? 'bold ' : ''}10px monospace`; ctx.fillText(`${b / 4 + 1}`, x + 3, RULER_H - 5) }
    }
    // Punch in/out markers
    if (punchEnabled) {
      ctx.fillStyle = '#ef444466'; ctx.fillRect(punchIn * PPB, 0, (punchOut - punchIn) * PPB, RULER_H)
      ctx.fillStyle = '#ef4444'; ctx.fillRect(punchIn * PPB - 1, 0, 2, RULER_H); ctx.fillRect(punchOut * PPB - 1, 0, 2, RULER_H)
      ctx.fillStyle = '#ef4444'; ctx.font = '8px monospace'
      ctx.fillText('P-IN', punchIn * PPB + 3, 10); ctx.fillText('P-OUT', punchOut * PPB + 3, 10)
    }
  }, [PPB, totalWidth, punchEnabled, punchIn, punchOut])

  // ── Playhead ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return
    const start = Date.now(); const startTime = playheadTime
    const tick = () => { setPlayheadTime(startTime + (Date.now() - start) / 1000); rafRef.current = requestAnimationFrame(tick) }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  const playheadX = (playheadTime * bpm / 60) * PPB

  // ── Find clip helper ───────────────────────────────────────────────────────
  const findClip = useCallback((clipId) => {
    for (const t of tracks) { const c = t.clips.find(c => c.id === clipId); if (c) return { clip: c, trackId: t.id } }
    return null
  }, [tracks])

  // ── Mouse move (drag / resize / fade / rubber band) ────────────────────────
  const handleMouseMove = useCallback((e) => {
    if (dragging) {
      const dx = e.clientX - dragging.startX
      const beatsDelta = Math.round((dx / PPB) * 4) / 4
      setTracks(prev => prev.map(t => t.id === dragging.trackId
        ? { ...t, clips: t.clips.map(c => {
            // Move all selected clips, or just the dragged one
            const inSel = selectedClips.has(c.id)
            const isDragged = c.id === dragging.clipId
            if (!isDragged && !inSel) return c
            const origBeat = dragging.origBeats[c.id] ?? c.startBeat
            return { ...c, startBeat: Math.max(0, origBeat + beatsDelta) }
          }) }
        : { ...t, clips: t.clips.map(c => {
            // Also move selected clips from other tracks
            if (!selectedClips.has(c.id)) return c
            const origBeat = dragging.origBeats[c.id] ?? c.startBeat
            return { ...c, startBeat: Math.max(0, origBeat + beatsDelta) }
          }) }
      ))
    }
    if (resizing) {
      const dx = e.clientX - resizing.startX; const bd = dx / PPB
      setTracks(prev => prev.map(t => t.id === resizing.trackId
        ? { ...t, clips: t.clips.map(c => c.id === resizing.clipId
            ? resizing.edge === 'right'
              ? { ...c, durationBeats: Math.max(0.25, Math.round((resizing.origDuration + bd) * 4) / 4) }
              : { ...c, startBeat: Math.max(0, Math.round((resizing.origStart + bd) * 4) / 4), durationBeats: Math.max(0.25, Math.round((resizing.origDuration - bd) * 4) / 4) }
            : c) }
        : t))
    }
    if (fadeDrag) {
      const dx = e.clientX - fadeDrag.startX; const bd = Math.abs(dx / PPB)
      setTracks(prev => prev.map(t => t.id === fadeDrag.trackId
        ? { ...t, clips: t.clips.map(c => c.id === fadeDrag.clipId
            ? { ...c, [fadeDrag.which]: Math.max(0, Math.min(c.durationBeats * 0.45, fadeDrag.origFade + (fadeDrag.which === 'fadeIn' ? 1 : -1) * (e.clientX > fadeDrag.startX ? bd : -bd))) }
            : c) }
        : t))
    }
    if (rubberBand) {
      setRubberBand(prev => prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null)
    }
    if (punchDragging) {
      const rect = clipAreaRef.current?.getBoundingClientRect()
      if (!rect) return
      const beat = Math.max(0, Math.round(((e.clientX - rect.left + scrollLeft) / PPB) * 4) / 4)
      if (punchDragging === 'in') setPunchIn(Math.min(beat, punchOut - 1))
      else setPunchOut(Math.max(beat, punchIn + 1))
    }
  }, [dragging, resizing, fadeDrag, rubberBand, punchDragging, PPB, selectedClips, scrollLeft, punchIn, punchOut])

  const handleMouseUp = useCallback((e) => {
    // Finish rubber band → select clips in rect
    if (rubberBand) {
      const rb = rubberBand
      const rect = clipAreaRef.current?.getBoundingClientRect()
      if (rect) {
        const x1 = Math.min(rb.startX, rb.endX) - rect.left + scrollLeft
        const x2 = Math.max(rb.startX, rb.endX) - rect.left + scrollLeft
        const y1 = Math.min(rb.startY, rb.endY) - rect.top
        const y2 = Math.max(rb.startY, rb.endY) - rect.top
        const newSel = new Set()
        tracks.forEach((track, ti) => {
          const trackY1 = ti * TRACK_H, trackY2 = (ti + 1) * TRACK_H
          if (trackY2 < y1 || trackY1 > y2) return
          track.clips.forEach(clip => {
            const cx1 = clip.startBeat * PPB, cx2 = (clip.startBeat + clip.durationBeats) * PPB
            if (cx2 >= x1 && cx1 <= x2) newSel.add(clip.id)
          })
        })
        if (newSel.size > 0) setSelectedClips(prev => e.shiftKey ? new Set([...prev, ...newSel]) : newSel)
      }
    }
    setDragging(null); setResizing(null); setFadeDrag(null); setRubberBand(null); setPunchDragging(null)
  }, [rubberBand, tracks, PPB, scrollLeft])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [handleMouseMove, handleMouseUp])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const selArr = [...selectedClips]

      // Ctrl+A → select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        const all = new Set(); tracks.forEach(t => t.clips.forEach(c => all.add(c.id)))
        setSelectedClips(all); showToast(`Selected ${all.size} clips`)
      }
      // Escape → deselect
      if (e.key === 'Escape') setSelectedClips(new Set())

      // Delete/Backspace → delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selArr.length > 0) {
        selArr.forEach(id => deleteClip(id))
        setSelectedClips(new Set())
        showToast(`Deleted ${selArr.length} clip${selArr.length > 1 ? 's' : ''}`)
      }

      // Ctrl+C → copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selArr.length > 0) {
        const copied = []
        tracks.forEach(t => t.clips.forEach(c => { if (selectedClips.has(c.id)) copied.push({ ...c, trackId: t.id }) }))
        setClipboard(copied)
        showToast(`Copied ${copied.length} clip${copied.length > 1 ? 's' : ''}`)
      }

      // Ctrl+V → paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard.length > 0) {
        const minBeat = Math.min(...clipboard.map(c => c.startBeat))
        const newIds = new Set()
        const newClips = clipboard.map(c => ({ ...c, id: `c_${Date.now()}_${Math.random().toString(36).slice(2)}`, startBeat: c.startBeat - minBeat + (Math.max(...clipboard.map(x => x.startBeat + x.durationBeats))) }))
        setTracks(prev => prev.map(t => {
          const toAdd = newClips.filter(c => c.trackId === t.id)
          if (!toAdd.length) return t
          const clean = toAdd.map(({ trackId, ...rest }) => { newIds.add(rest.id); return rest })
          return { ...t, clips: [...t.clips, ...clean] }
        }))
        setSelectedClips(newIds)
        showToast(`Pasted ${newClips.length} clip${newClips.length > 1 ? 's' : ''}`)
      }

      // Ctrl+D → duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selArr.length > 0) {
        e.preventDefault()
        const maxEnd = Math.max(...selArr.map(id => { const i = findClip(id); return i ? i.clip.startBeat + i.clip.durationBeats : 0 }))
        const minStart = Math.min(...selArr.map(id => { const i = findClip(id); return i?.clip.startBeat ?? Infinity }))
        const offset = maxEnd - minStart
        const newIds = new Set()
        setTracks(prev => prev.map(t => {
          const toAdd = t.clips.filter(c => selectedClips.has(c.id)).map(c => { const nc = { ...c, id: `c_${Date.now()}_${Math.random().toString(36).slice(2)}`, startBeat: c.startBeat + offset }; newIds.add(nc.id); return nc })
          return toAdd.length ? { ...t, clips: [...t.clips, ...toAdd] } : t
        }))
        setSelectedClips(newIds)
        showToast(`Duplicated ${selArr.length} clip${selArr.length > 1 ? 's' : ''}`)
      }

      // Arrow keys → nudge selected clips
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selArr.length > 0 && !e.ctrlKey) {
        const delta = e.key === 'ArrowLeft' ? -1 : 1
        setTracks(prev => prev.map(t => ({ ...t, clips: t.clips.map(c => selectedClips.has(c.id) ? { ...c, startBeat: Math.max(0, c.startBeat + delta) } : c) })))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedClips, clipboard, tracks, findClip])

  const deleteClip = useCallback((clipId) => {
    if (rippleMode) {
      const info = findClip(clipId); if (!info) return
      setTracks(prev => prev.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== clipId).map(c => t.id === info.trackId && c.startBeat > info.clip.startBeat ? { ...c, startBeat: c.startBeat - info.clip.durationBeats } : c) })))
    } else {
      setTracks(prev => prev.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== clipId) })))
    }
  }, [rippleMode, findClip])

  // ── Zoom + scroll ──────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) dispatch(uiActions.setZoom(zoom * (e.deltaY > 0 ? 0.85 : 1.18)))
    else { const nl = Math.max(0, scrollLeft + (e.deltaX || e.deltaY) * 2); setScrollLeft(nl); if (scrollRef.current) scrollRef.current.scrollLeft = nl }
  }, [dispatch, zoom, scrollLeft])

  const handleRulerClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const beat = (e.clientX - rect.left + scrollLeft) / PPB
    setPlayheadTime(Math.max(0, beat / bpm * 60))
    dispatch(playbackActions.setCurrentTime(Math.max(0, beat / bpm * 60)))
  }

  const handleRulerMouseDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const beat = (e.clientX - rect.left + scrollLeft) / PPB
    // Punch in/out dragging
    if (punchEnabled) {
      const distIn = Math.abs(beat - punchIn) * PPB, distOut = Math.abs(beat - punchOut) * PPB
      if (distIn < 10) { setPunchDragging('in'); return }
      if (distOut < 10) { setPunchDragging('out'); return }
    }
  }

  const startRubberBand = (e, trackAreaRect) => {
    setRubberBand({ startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY })
    if (!e.shiftKey) setSelectedClips(new Set())
  }

  const handleClipMouseDown = (e, clipId, trackId, action) => {
    e.stopPropagation()
    const info = findClip(clipId)
    if (!info) return

    if (e.shiftKey) {
      setSelectedClips(prev => { const n = new Set(prev); n.has(clipId) ? n.delete(clipId) : n.add(clipId); return n })
    } else if (!selectedClips.has(clipId)) {
      setSelectedClips(new Set([clipId]))
    }

    if (action === 'move') {
      // Collect original beats for all selected clips
      const origBeats = {}
      tracks.forEach(t => t.clips.forEach(c => { if (selectedClips.has(c.id) || c.id === clipId) origBeats[c.id] = c.startBeat }))
      if (!origBeats[clipId]) origBeats[clipId] = info.clip.startBeat
      setDragging({ clipId, trackId, startX: e.clientX, origBeats })
    } else if (action === 'right') {
      setResizing({ clipId, trackId, startX: e.clientX, origDuration: info.clip.durationBeats, origStart: info.clip.startBeat, edge: 'right' })
    } else if (action === 'left') {
      setResizing({ clipId, trackId, startX: e.clientX, origDuration: info.clip.durationBeats, origStart: info.clip.startBeat, edge: 'left' })
    } else if (action === 'fadeIn') {
      setFadeDrag({ clipId, trackId, startX: e.clientX, origFade: info.clip.fadeIn || 0, which: 'fadeIn' })
    } else if (action === 'fadeOut') {
      setFadeDrag({ clipId, trackId, startX: e.clientX, origFade: info.clip.fadeOut || 0, which: 'fadeOut' })
    }
  }

  const handleTrackAreaMouseDown = (e, trackId) => {
    if (e.target !== e.currentTarget) return  // only if clicking empty area
    startRubberBand(e, e.currentTarget.getBoundingClientRect())
  }

  const handleTrackAreaDblClick = (e, trackId) => {
    if (dragging || resizing) return
    const rect = e.currentTarget.getBoundingClientRect()
    const beat = Math.round(((e.clientX - rect.left + scrollLeft) / PPB) * 4) / 4
    const nc = { id:`c_${Date.now()}`, name:'New Clip', startBeat:beat, durationBeats:4, type:'audio', fadeIn:0, fadeOut:0, waveform:Array.from({length:40},()=>Math.random()*0.7+0.15) }
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, clips:[...t.clips, nc] } : t))
    setSelectedClips(new Set([nc.id]))
    showToast('Clip added')
  }

  const handleDropFromLibrary = (e, trackId) => {
    e.preventDefault(); setDropOver(null)
    try {
      const raw = e.dataTransfer.getData('application/music-sample')
      if (!raw) return
      const sample = JSON.parse(raw)
      const rect = e.currentTarget.getBoundingClientRect()
      const beat = Math.round(((e.clientX - rect.left + scrollLeft) / PPB) * 4) / 4
      const durBeats = sample.bpm && bpm ? Math.round(sample.duration * (bpm / sample.bpm) * 4) / 4 : Math.ceil((sample.duration || 4) * bpm / 60)
      const nc = { id:`c_${Date.now()}`, name:sample.name, startBeat:beat, durationBeats:Math.max(1, durBeats), type:'audio', fadeIn:0, fadeOut:0, sampleId:sample.id, waveform:sample.waveform || Array.from({length:40},()=>Math.random()*0.7+0.15) }
      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, clips:[...t.clips, nc] } : t))
      setSelectedClips(new Set([nc.id]))
      showToast(`✓ "${sample.name}" added`)
    } catch {}
  }

  const addTrack = () => {
    const idx = tracks.length
    setTracks(prev => [...prev, { id:`t_${Date.now()}`, name:`Track ${idx+1}`, color:TRACK_COLORS[idx%TRACK_COLORS.length], volume:0.8, pan:0, mute:false, solo:false, armed:false, clips:[] }])
  }

  // ── Rubber band rect in screen coords (relative to clip area) ─────────────
  const rubberBandRect = rubberBand ? {
    left: Math.min(rubberBand.startX, rubberBand.endX),
    top: Math.min(rubberBand.startY, rubberBand.endY),
    width: Math.abs(rubberBand.endX - rubberBand.startX),
    height: Math.abs(rubberBand.endY - rubberBand.startY),
  } : null

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', userSelect:'none' }} onWheel={handleWheel}>

      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', background:'#111', borderBottom:'1px solid #1f1f1f', flexShrink:0, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#555' }}>TIMELINE</span>
        <div style={{ width:1, height:16, background:'#333' }} />
        <button onClick={addTrack} style={tBtn('#22c55e')}>+ Track</button>
        <button onClick={() => setShowLoopRegion(v => !v)} style={tBtn(showLoopRegion ? '#f59e0b' : '#444')}>⟳ Loop</button>
        <button onClick={() => setRippleMode(v => !v)} style={tBtn(rippleMode ? '#ec4899' : '#444')} title="Ripple: shifts clips right when deleting">
          {rippleMode ? '🔗 Ripple ON' : '🔗 Ripple'}
        </button>
        <button onClick={() => setPunchEnabled(v => !v)} style={tBtn(punchEnabled ? '#ef4444' : '#444')} title="Punch in/out: only records between markers">
          {punchEnabled ? '⏺ Punch ON' : '⏺ Punch'}
        </button>
        {punchEnabled && (
          <div style={{ display:'flex', gap:6, alignItems:'center', padding:'2px 8px', background:'#1a0808', border:'1px solid #ef444433', borderRadius:5 }}>
            <span style={{ fontSize:9, color:'#ef4444' }}>IN</span>
            <input type="number" min="0" max={punchOut - 1} value={punchIn} onChange={e => setPunchIn(+e.target.value)} style={{ width:42, background:'#111', border:'1px solid #ef444433', color:'#ef4444', borderRadius:3, padding:'1px 4px', fontSize:10, outline:'none' }} />
            <span style={{ fontSize:9, color:'#ef4444' }}>OUT</span>
            <input type="number" min={punchIn + 1} max={TOTAL_BARS * 4} value={punchOut} onChange={e => setPunchOut(+e.target.value)} style={{ width:42, background:'#111', border:'1px solid #ef444433', color:'#ef4444', borderRadius:3, padding:'1px 4px', fontSize:10, outline:'none' }} />
          </div>
        )}
        <div style={{ display:'flex', gap:3, alignItems:'center' }}>
          <span style={{ fontSize:9, color:'#333' }}>ZOOM</span>
          <input type="range" min="0.2" max="4" step="0.05" value={zoom} onChange={e => dispatch(uiActions.setZoom(+e.target.value))} style={{ width:70 }} />
          <span style={{ fontSize:9, color:'#444', minWidth:28 }}>{Math.round(zoom*100)}%</span>
        </div>
        <div style={{ marginLeft:'auto', fontSize:9, color:'#333', display:'flex', gap:10 }}>
          {selectedClips.size > 0 && <span style={{ color:'#3b82f6' }}>■ {selectedClips.size} selected (Del/Ctrl+C/D)</span>}
          <span>Dbl-click: add</span><span>Shift+click: multi-select</span><span>Drag empty: rubber band</span>
        </div>
      </div>

      {toast && <div style={{ position:'fixed', bottom:40, right:20, background:'#1e3a5f', border:'1px solid #3b82f6', borderRadius:8, padding:'7px 14px', fontSize:11, color:'#93c5fd', zIndex:999, pointerEvents:'none' }}>{toast}</div>}

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Track headers */}
        <div style={{ width:HEADER_W, flexShrink:0, background:'#0f0f0f', borderRight:'1px solid #1f1f1f', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ height:RULER_H, background:'#0d0d0d', borderBottom:'1px solid #1f1f1f', display:'flex', alignItems:'center', padding:'0 10px', fontSize:8, color:'#2a2a2a', letterSpacing:1 }}>TRACKS</div>
          <div style={{ overflowY:'auto', flex:1 }}>
            {tracks.map(track => (
              <div key={track.id} onClick={() => dispatch(uiActions.selectTrack(track.id))}
                style={{ height:TRACK_H, borderBottom:'1px solid #161616', padding:'0 8px', display:'flex', flexDirection:'column', justifyContent:'center', gap:4, cursor:'pointer', background:selectedTrackId === track.id ? '#1a2a3f' : 'transparent' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:track.color, flexShrink:0 }} />
                  <span style={{ fontSize:11, fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#bbb' }}>{track.name}</span>
                  <button onClick={e => { e.stopPropagation(); setTracks(prev => prev.filter(t => t.id !== track.id)) }} style={{ ...ib, color:'#2a2a2a', fontSize:8 }}>✕</button>
                </div>
                <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                  {[['M', track.mute, '#f59e0b', () => setTracks(prev => prev.map(t => t.id === track.id ? {...t, mute:!t.mute} : t))],
                    ['S', track.solo, '#22c55e', () => setTracks(prev => prev.map(t => t.id === track.id ? {...t, solo:!t.solo} : t))],
                    ['R', track.armed, '#ef4444', () => setTracks(prev => prev.map(t => t.id === track.id ? {...t, armed:!t.armed} : t))]
                  ].map(([label, active, color, fn]) => (
                    <button key={label} onClick={e => { e.stopPropagation(); fn() }}
                      style={{ ...ib, background:active ? `${color}22` : 'transparent', color:active ? color : '#333', border:`1px solid ${active ? `${color}44` : '#1a1a1a'}` }}>
                      {label}
                    </button>
                  ))}
                  <input type="range" min="0" max="1" step="0.01" value={track.volume} onClick={e => e.stopPropagation()}
                    onChange={e => setTracks(prev => prev.map(t => t.id === track.id ? {...t, volume:+e.target.value} : t))}
                    style={{ flex:1, height:3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clip area */}
        <div ref={clipAreaRef} style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', position:'relative' }}>
          {/* Ruler */}
          <div style={{ height:RULER_H, overflow:'hidden', flexShrink:0, position:'relative', cursor:'crosshair', borderBottom:'1px solid #1f1f1f' }}
            onClick={handleRulerClick} onMouseDown={handleRulerMouseDown}>
            <canvas ref={rulerRef} style={{ position:'absolute', left:-scrollLeft, top:0 }} />
            {showLoopRegion && (
              <div style={{ position:'absolute', left:loopStart*PPB-scrollLeft, width:(loopEnd-loopStart)*PPB, height:'100%', background:'#3b82f622', borderLeft:'2px solid #3b82f6', borderRight:'2px solid #3b82f6', pointerEvents:'none' }} />
            )}
            <div style={{ position:'absolute', left:playheadX-scrollLeft, top:0, width:1, height:'100%', background:'#22c55e', pointerEvents:'none' }}>
              <div style={{ position:'absolute', top:0, left:-5, width:12, height:9, background:'#22c55e', clipPath:'polygon(50% 100%, 0 0, 100% 0)' }} />
            </div>
          </div>

          {/* Tracks scroll */}
          <div ref={scrollRef} style={{ flex:1, overflow:'scroll' }}
            onScroll={e => setScrollLeft(e.currentTarget.scrollLeft)}>
            <div style={{ width:totalWidth, minHeight:tracks.length*TRACK_H, position:'relative' }}
              onMouseDown={e => { if (e.target === e.currentTarget) startRubberBand(e, e.currentTarget.getBoundingClientRect()) }}>

              {tracks.map((track, ti) => (
                <div key={track.id}
                  style={{ height:TRACK_H, borderBottom:'1px solid #141414', position:'relative', background:dropOver===track.id ? '#1a2a1a' : ti%2===0 ? '#0e0e0e' : '#0c0c0c' }}
                  onDoubleClick={e => handleTrackAreaDblClick(e, track.id)}
                  onMouseDown={e => handleTrackAreaMouseDown(e, track.id)}
                  onDragOver={e => { e.preventDefault(); setDropOver(track.id) }}
                  onDragLeave={() => setDropOver(null)}
                  onDrop={e => handleDropFromLibrary(e, track.id)}>

                  {/* Grid lines */}
                  {Array.from({length:TOTAL_BARS*4+1},(_,b) => (
                    <div key={b} style={{ position:'absolute', left:b*PPB, top:0, width:b%4===0?1:0.5, height:'100%', background:b%4===0?'#1e1e1e':'#141414', pointerEvents:'none' }} />
                  ))}

                  {showLoopRegion && <div style={{ position:'absolute', left:loopStart*PPB, width:(loopEnd-loopStart)*PPB, height:'100%', background:'#3b82f608', pointerEvents:'none' }} />}
                  {punchEnabled && <div style={{ position:'absolute', left:punchIn*PPB, width:(punchOut-punchIn)*PPB, height:'100%', background:'#ef44440a', borderLeft:'1px solid #ef444433', borderRight:'1px solid #ef444433', pointerEvents:'none' }} />}
                  {dropOver===track.id && <div style={{ position:'absolute', inset:0, border:'2px dashed #22c55e', pointerEvents:'none', zIndex:10 }} />}

                  {/* Clips */}
                  {track.clips.map(clip => {
                    const x = clip.startBeat * PPB, w = Math.max(12, clip.durationBeats * PPB)
                    const isSel = selectedClips.has(clip.id)
                    const muted = track.mute
                    const fadeInW = Math.max(0, (clip.fadeIn || 0) * PPB)
                    const fadeOutW = Math.max(0, (clip.fadeOut || 0) * PPB)
                    const borderColor = isSel ? track.color : muted ? '#2a2a2a' : `${track.color}55`

                    return (
                      <div key={clip.id}
                        style={{ position:'absolute', left:x, top:5, width:w, height:TRACK_H-10, background:muted?'#1a1a1a':isSel?`${track.color}33`:`${track.color}1a`, border:`${isSel?2:1}px solid ${borderColor}`, borderRadius:4, overflow:'hidden', cursor:dragging?.clipId===clip.id?'grabbing':'grab' }}
                        onMouseDown={e => handleClipMouseDown(e, clip.id, track.id, 'move')}
                        onContextMenu={e => { e.preventDefault(); deleteClip(clip.id); setSelectedClips(prev => { const n=new Set(prev); n.delete(clip.id); return n }) }}>

                        {/* Fade-in */}
                        {fadeInW > 2 && <div style={{ position:'absolute', left:0, top:0, width:fadeInW, height:'100%', background:`linear-gradient(90deg, transparent, ${track.color}33)`, pointerEvents:'none', zIndex:2 }} />}
                        {w > 30 && (
                          <div style={{ position:'absolute', left:Math.max(0,fadeInW-5), top:'15%', width:10, height:'70%', cursor:'ew-resize', zIndex:5, display:'flex', alignItems:'center', justifyContent:'center' }}
                            onMouseDown={e => { e.stopPropagation(); handleClipMouseDown(e, clip.id, track.id, 'fadeIn') }}>
                            <div style={{ width:2, height:'100%', background:isSel?'#22c55e':`${track.color}77`, borderRadius:1 }} />
                          </div>
                        )}

                        {/* Name + type */}
                        <div style={{ padding:'2px 4px', fontSize:8, fontWeight:700, color:muted?'#333':track.color, textTransform:'uppercase', letterSpacing:0.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', position:'relative', zIndex:3 }}>
                          {clip.name} <span style={{ opacity:0.5, fontWeight:400 }}>{clip.type}</span>
                        </div>

                        {/* Waveform */}
                        <div style={{ display:'flex', alignItems:'center', height:TRACK_H-24, padding:'0 3px', gap:0.5, zIndex:3, position:'relative' }}>
                          {clip.waveform.map((v,i) => <div key={i} style={{ flex:1, height:`${v*100}%`, background:muted?'#222':`${track.color}${isSel?'99':'55'}`, borderRadius:0.5 }} />)}
                        </div>

                        {/* Fade-out */}
                        {fadeOutW > 2 && <div style={{ position:'absolute', right:0, top:0, width:fadeOutW, height:'100%', background:`linear-gradient(270deg, transparent, ${track.color}33)`, pointerEvents:'none', zIndex:2 }} />}
                        {w > 30 && (
                          <div style={{ position:'absolute', right:Math.max(0,fadeOutW-5), top:'15%', width:10, height:'70%', cursor:'ew-resize', zIndex:5, display:'flex', alignItems:'center', justifyContent:'center' }}
                            onMouseDown={e => { e.stopPropagation(); handleClipMouseDown(e, clip.id, track.id, 'fadeOut') }}>
                            <div style={{ width:2, height:'100%', background:isSel?'#22c55e':`${track.color}77`, borderRadius:1 }} />
                          </div>
                        )}

                        {/* Resize handles */}
                        <div style={{ position:'absolute', right:0, top:0, width:7, height:'100%', cursor:'ew-resize', background:isSel?`${track.color}22`:'transparent', zIndex:6 }}
                          onMouseDown={e => { e.stopPropagation(); handleClipMouseDown(e, clip.id, track.id, 'right') }} />
                        <div style={{ position:'absolute', left:0, top:0, width:7, height:'100%', cursor:'ew-resize', background:isSel?`${track.color}22`:'transparent', zIndex:6 }}
                          onMouseDown={e => { e.stopPropagation(); handleClipMouseDown(e, clip.id, track.id, 'left') }} />
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Rubber band selection rect */}
              {rubberBandRect && rubberBandRect.width > 4 && rubberBandRect.height > 4 && (
                <div style={{ position:'fixed', left:rubberBandRect.left, top:rubberBandRect.top, width:rubberBandRect.width, height:rubberBandRect.height, border:'1px solid #3b82f6', background:'#3b82f611', pointerEvents:'none', zIndex:50 }} />
              )}
            </div>
          </div>

          {/* Playhead */}
          <div style={{ position:'absolute', left:playheadX-scrollLeft, top:RULER_H, width:1, height:`calc(100% - ${RULER_H}px)`, background:'#22c55e55', pointerEvents:'none', zIndex:20 }} />
        </div>
      </div>

      <div style={{ padding:'2px 12px', background:'#080808', borderTop:'1px solid #121212', fontSize:8, color:'#2a2a2a', display:'flex', gap:12 }}>
        <span>Dbl-click: add</span><span>Shift+click: multi-select</span><span>Drag empty area: rubber band select</span>
        <span>Ctrl+A: all</span><span>Ctrl+C/V: copy/paste</span><span>Ctrl+D: duplicate</span><span>↑↓←→: nudge</span>
        <span>Del: delete selected</span><span>Right-click: delete clip</span>
        {punchEnabled && <span style={{ color:'#ef444466' }}>⏺ Punch {punchIn}–{punchOut}</span>}
      </div>
    </div>
  )
}

const tBtn = (color) => ({ padding:'3px 9px', background:`${color}18`, border:`1px solid ${color}44`, borderRadius:5, color, cursor:'pointer', fontSize:10, fontWeight:600 })
const ib = { width:17, height:17, background:'transparent', border:'1px solid #1a1a1a', borderRadius:3, cursor:'pointer', fontSize:8, fontWeight:700, padding:0, display:'flex', alignItems:'center', justifyContent:'center' }
