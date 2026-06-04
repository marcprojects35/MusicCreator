import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { libraryActions } from '../../store'
import * as Tone from 'tone'

const CATEGORIES = ['All', 'Drums', 'Bass', 'Synth', 'Guitar', 'Vocals', 'FX', 'Piano', 'Strings', 'Percussion', 'Ambient', 'Loop']
const GENRES = ['All', 'Hip-Hop', 'Trap', 'R&B', 'EDM', 'House', 'Techno', 'Pop', 'Rock', 'Jazz', 'Latin', 'Cinematic']

const SAMPLE_DB = [
  { id:'s1',  name:'Trap Kick 808',        category:'Drums',      genre:'Trap',     bpm:null, key:null, duration:0.8, size:'42KB',  tags:['kick','808','trap'],         waveform:Array.from({length:30},(_,i)=>i<5?0.9-i*0.12:Math.random()*0.15),  synth:{type:'membrane',freq:60,decay:0.8} },
  { id:'s2',  name:'Snare Crack',           category:'Drums',      genre:'Hip-Hop',  bpm:null, key:null, duration:0.4, size:'28KB',  tags:['snare','crack'],             waveform:Array.from({length:30},(_,i)=>i===0?1:Math.exp(-i*0.4)*Math.random()), synth:{type:'noise',decay:0.3,color:'white'} },
  { id:'s3',  name:'Hi-Hat Closed',         category:'Drums',      genre:'Trap',     bpm:null, key:null, duration:0.15,size:'12KB',  tags:['hihat','closed'],            waveform:Array.from({length:30},()=>Math.random()*0.35),                     synth:{type:'metal',freq:800,decay:0.1} },
  { id:'s4',  name:'Hi-Hat Open Roll',      category:'Drums',      genre:'Trap',     bpm:null, key:null, duration:0.6, size:'38KB',  tags:['hihat','open','roll'],       waveform:Array.from({length:30},(_,i)=>Math.sin(i/3)*0.3+0.2),              synth:{type:'metal',freq:600,decay:0.5} },
  { id:'s5',  name:'Bass Loop 140bpm',      category:'Bass',       genre:'Trap',     bpm:140,  key:'Cm', duration:2,   size:'180KB', tags:['bass','loop','808'],         waveform:Array.from({length:30},(_,i)=>Math.abs(Math.sin(i/2))*0.8),        synth:{type:'synth',freq:60,waveform:'sawtooth',duration:2} },
  { id:'s6',  name:'Deep Sub Bass',         category:'Bass',       genre:'Hip-Hop',  bpm:null, key:'A',  duration:1.2, size:'95KB',  tags:['bass','sub','deep'],         waveform:Array.from({length:30},(_,i)=>Math.abs(Math.sin(i/4))*0.9),        synth:{type:'synth',freq:45,waveform:'sine',duration:1.2} },
  { id:'s7',  name:'Lead Synth Arp',        category:'Synth',      genre:'EDM',      bpm:128,  key:'Am', duration:4,   size:'320KB', tags:['synth','arp','lead'],        waveform:Array.from({length:30},(_,i)=>0.3+Math.random()*0.5*(i%4===0?1:0.3)),synth:{type:'poly',notes:['A4','C5','E5','A5'],duration:0.3} },
  { id:'s8',  name:'Pad Atmosphere',        category:'Synth',      genre:'Ambient',  bpm:null, key:'Dm', duration:8,   size:'640KB', tags:['pad','atmosphere'],          waveform:Array.from({length:30},(_,i)=>0.15+Math.sin(i/8)*0.2),             synth:{type:'poly',notes:['D4','F4','A4'],duration:3,waveform:'triangle'} },
  { id:'s9',  name:'Electric Guitar Riff',  category:'Guitar',     genre:'Rock',     bpm:120,  key:'Em', duration:4,   size:'380KB', tags:['guitar','electric','riff'],  waveform:Array.from({length:30},()=>Math.random()*0.7+0.1),                  synth:{type:'poly',notes:['E4','B3','G3'],duration:0.2,waveform:'sawtooth'} },
  { id:'s10', name:'Acoustic Strum',        category:'Guitar',     genre:'Pop',      bpm:100,  key:'G',  duration:2,   size:'195KB', tags:['guitar','acoustic','strum'], waveform:Array.from({length:30},(_,i)=>i%8<3?0.7:0.25),                     synth:{type:'poly',notes:['G4','B4','D5'],duration:1,waveform:'triangle'} },
  { id:'s11', name:'Female Vocal Hook',     category:'Vocals',     genre:'Pop',      bpm:120,  key:'C',  duration:4,   size:'420KB', tags:['vocal','female','hook'],     waveform:Array.from({length:30},(_,i)=>Math.abs(Math.sin(i/2))*0.5+0.15),   synth:{type:'synth',freq:523,waveform:'sine',duration:4,vibrato:true} },
  { id:'s12', name:'Rap Ad-lib',            category:'Vocals',     genre:'Hip-Hop',  bpm:null, key:null, duration:0.5, size:'45KB',  tags:['vocal','adlib','rap'],       waveform:Array.from({length:30},()=>Math.random()*0.8),                      synth:{type:'noise',decay:0.5,color:'pink'} },
  { id:'s13', name:'Riser FX',              category:'FX',         genre:'EDM',      bpm:null, key:null, duration:4,   size:'310KB', tags:['fx','riser','transition'],   waveform:Array.from({length:30},(_,i)=>i/30),                                synth:{type:'riser',startFreq:100,endFreq:2000,duration:4} },
  { id:'s14', name:'Impact Hit',            category:'FX',         genre:'Cinematic',bpm:null, key:null, duration:2,   size:'175KB', tags:['fx','impact','cinematic'],   waveform:Array.from({length:30},(_,i)=>(30-i)/30*0.95),                     synth:{type:'membrane',freq:40,decay:2} },
  { id:'s15', name:'Piano Chord Prog',      category:'Piano',      genre:'R&B',      bpm:90,   key:'Fm', duration:8,   size:'720KB', tags:['piano','chords','prog'],     waveform:Array.from({length:30},(_,i)=>i%8<2?0.8:0.15+Math.random()*0.25), synth:{type:'poly',notes:['F4','Ab4','C5','Eb5'],duration:1,waveform:'triangle'} },
  { id:'s16', name:'Grand Piano One-shot',  category:'Piano',      genre:'Jazz',     bpm:null, key:'C',  duration:3,   size:'280KB', tags:['piano','grand','oneshot'],   waveform:Array.from({length:30},(_,i)=>Math.exp(-i*0.1)*0.9),               synth:{type:'synth',freq:261,waveform:'triangle',duration:3} },
  { id:'s17', name:'String Ensemble',       category:'Strings',    genre:'Cinematic',bpm:80,   key:'Dm', duration:8,   size:'850KB', tags:['strings','ensemble'],        waveform:Array.from({length:30},(_,i)=>0.4+Math.sin(i/5)*0.3),              synth:{type:'poly',notes:['D4','A4','D5'],duration:2,waveform:'sawtooth'} },
  { id:'s18', name:'Cello Stab',            category:'Strings',    genre:'Cinematic',bpm:null, key:'Gm', duration:2,   size:'190KB', tags:['cello','stab'],              waveform:Array.from({length:30},(_,i)=>i===0?0.95:Math.random()*0.4+0.1),   synth:{type:'synth',freq:98,waveform:'sawtooth',duration:2} },
  { id:'s19', name:'Conga Pattern',         category:'Percussion', genre:'Latin',    bpm:110,  key:null, duration:2,   size:'165KB', tags:['conga','latin'],             waveform:Array.from({length:30},(_,i)=>i%5===0?0.7:0.15),                   synth:{type:'membrane',freq:200,decay:0.4} },
  { id:'s20', name:'Shaker Groove',         category:'Percussion', genre:'Pop',      bpm:120,  key:null, duration:2,   size:'148KB', tags:['shaker','groove'],           waveform:Array.from({length:30},()=>Math.random()*0.3+0.05),                 synth:{type:'noise',decay:0.15,color:'white'} },
  { id:'s21', name:'Dark Ambient Texture',  category:'Ambient',    genre:'Ambient',  bpm:null, key:'Dm', duration:16,  size:'1.2MB', tags:['ambient','dark','texture'],  waveform:Array.from({length:30},(_,i)=>0.1+Math.sin(i/6)*0.1),              synth:{type:'poly',notes:['D3','A3'],duration:6,waveform:'sine'} },
  { id:'s22', name:'Forest Soundscape',     category:'Ambient',    genre:'Ambient',  bpm:null, key:null, duration:30,  size:'2.8MB', tags:['ambient','nature'],          waveform:Array.from({length:30},()=>Math.random()*0.2+0.03),                 synth:{type:'noise',decay:3,color:'pink'} },
  { id:'s23', name:'Full Beat Loop 93bpm',  category:'Loop',       genre:'Hip-Hop',  bpm:93,   key:null, duration:4,   size:'420KB', tags:['loop','beat','hiphop'],      waveform:Array.from({length:30},(_,i)=>i%8===0?0.9:i%4===2?0.5:0.2+Math.random()*0.2), synth:{type:'membrane',freq:80,decay:0.6} },
  { id:'s24', name:'House Loop 124bpm',     category:'Loop',       genre:'House',    bpm:124,  key:null, duration:4,   size:'395KB', tags:['loop','house','beat'],       waveform:Array.from({length:30},(_,i)=>i%4===0?0.95:Math.random()*0.3),     synth:{type:'membrane',freq:60,decay:0.5} },
  { id:'s25', name:'Trap HiHat Pattern',    category:'Loop',       genre:'Trap',     bpm:140,  key:null, duration:2,   size:'195KB', tags:['loop','hihat','trap'],       waveform:Array.from({length:30},()=>Math.random()*0.4+0.05),                 synth:{type:'metal',freq:1000,decay:0.08} },
  { id:'s26', name:'Clap Snare Combo',      category:'Drums',      genre:'Trap',     bpm:null, key:null, duration:0.5, size:'35KB',  tags:['clap','snare','trap'],       waveform:Array.from({length:30},(_,i)=>i<3?0.85-i*0.2:Math.random()*0.08), synth:{type:'noise',decay:0.25,color:'white'} },
  { id:'s27', name:'Wobble Bass',           category:'Bass',       genre:'EDM',      bpm:128,  key:'E',  duration:4,   size:'340KB', tags:['bass','wobble','edm'],       waveform:Array.from({length:30},(_,i)=>Math.abs(Math.sin(i/1.5))*0.85),     synth:{type:'synth',freq:82,waveform:'sawtooth',duration:2} },
  { id:'s28', name:'Marimba Loop',          category:'Percussion', genre:'Latin',    bpm:105,  key:'C',  duration:4,   size:'285KB', tags:['marimba','latin','melody'],  waveform:Array.from({length:30},(_,i)=>i%3===0?0.65:0.08),                  synth:{type:'poly',notes:['C5','E5','G5'],duration:0.3,waveform:'triangle'} },
  { id:'s29', name:'Drum Fill',             category:'Drums',      genre:'Rock',     bpm:120,  key:null, duration:1,   size:'88KB',  tags:['drums','fill','rock'],       waveform:Array.from({length:30},()=>Math.random()*0.6+0.2),                  synth:{type:'noise',decay:0.8,color:'white'} },
  { id:'s30', name:'Reverse Cymbal',        category:'FX',         genre:'Hip-Hop',  bpm:null, key:null, duration:2,   size:'155KB', tags:['fx','reverse','cymbal'],     waveform:Array.from({length:30},(_,i)=>i/30*0.9),                            synth:{type:'metal',freq:400,decay:2} },
]

const CAT_COLORS = {
  Drums:'#ec4899', Bass:'#10b981', Synth:'#8b5cf6', Guitar:'#f59e0b',
  Vocals:'#3b82f6', FX:'#ef4444', Piano:'#f97316', Strings:'#06b6d4',
  Percussion:'#84cc16', Ambient:'#a78bfa', Loop:'#22c55e'
}

// Tone.js synth-based preview
async function playPreview(sample) {
  await Tone.start()
  const { synth } = sample
  if (!synth) return
  try {
    switch (synth.type) {
      case 'membrane': {
        const s = new Tone.MembraneSynth({ pitchDecay: synth.decay || 0.5 }).toDestination()
        s.triggerAttackRelease(synth.freq || 80, synth.decay || 0.5)
        setTimeout(() => s.dispose(), (synth.decay + 1) * 1000)
        break
      }
      case 'noise': {
        const s = new Tone.NoiseSynth({ noise: { type: synth.color || 'white' }, envelope: { attack: 0.005, decay: synth.decay || 0.3, sustain: 0, release: 0 } }).toDestination()
        s.triggerAttackRelease(synth.decay || 0.3)
        setTimeout(() => s.dispose(), (synth.decay + 1) * 1000)
        break
      }
      case 'metal': {
        const s = new Tone.MetalSynth({ frequency: synth.freq || 400, envelope: { attack: 0.001, decay: synth.decay || 0.1, sustain: 0 }, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination()
        s.triggerAttackRelease(synth.decay || 0.1)
        setTimeout(() => s.dispose(), (synth.decay + 1) * 1000)
        break
      }
      case 'poly': {
        const ps = new Tone.PolySynth(Tone.Synth, { oscillator: { type: synth.waveform || 'triangle' }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 } }).toDestination()
        const notes = synth.notes || ['C4']
        notes.forEach((note, i) => { ps.triggerAttackRelease(note, synth.duration || 1, Tone.now() + i * 0.1) })
        setTimeout(() => { ps.releaseAll(); ps.dispose() }, (synth.duration + 2) * 1000)
        break
      }
      case 'riser': {
        const osc = new Tone.Oscillator(synth.startFreq || 100, 'sawtooth').toDestination()
        osc.volume.value = -10
        osc.start()
        osc.frequency.linearRampTo(synth.endFreq || 2000, synth.duration || 4)
        setTimeout(() => { osc.stop(); osc.dispose() }, (synth.duration + 0.5) * 1000)
        break
      }
      default: {
        const s = new Tone.Synth({ oscillator: { type: synth.waveform || 'triangle' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.6 } }).toDestination()
        s.triggerAttackRelease(synth.freq || 440, Math.min(synth.duration || 1, 3))
        setTimeout(() => s.dispose(), (Math.min(synth.duration, 3) + 1) * 1000)
      }
    }
  } catch (err) { console.warn('Preview error:', err) }
}

function SampleRow({ sample, isPlaying, isFavorite, onPreview, onToggleFav }) {
  const color = CAT_COLORS[sample.category] || '#666'

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/music-sample', JSON.stringify(sample))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div draggable onDragStart={handleDragStart}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderBottom: '1px solid #121212', cursor: 'grab', background: isPlaying ? '#1a2a1a' : 'transparent', transition: 'background 0.1s' }}
      onMouseEnter={e => { if (!isPlaying) e.currentTarget.style.background = '#151515' }}
      onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.background = 'transparent' }}>

      <button onClick={() => onPreview(sample)}
        style={{ width: 22, height: 22, background: isPlaying ? '#22c55e22' : 'transparent', border: `1px solid ${isPlaying ? '#22c55e' : '#2a2a2a'}`, borderRadius: '50%', cursor: 'pointer', color: isPlaying ? '#22c55e' : '#555', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isPlaying ? '■' : '▶'}
      </button>

      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />

      <div style={{ width: 44, height: 18, display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        {sample.waveform.slice(0, 22).map((v, i) => (
          <div key={i} style={{ flex: 1, height: `${v * 100}%`, background: isPlaying ? color : '#2a2a2a', borderRadius: 0.5, transition: 'background 0.2s' }} />
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sample.name}</div>
        <div style={{ display: 'flex', gap: 3, marginTop: 1 }}>
          {sample.tags.slice(0, 2).map(t => <span key={t} style={{ fontSize: 7, color: '#444', background: '#1a1a1a', padding: '0 3px', borderRadius: 2 }}>#{t}</span>)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        {sample.bpm && <span style={{ fontSize: 8, color: '#555', minWidth: 26 }}>{sample.bpm}</span>}
        {sample.key && <span style={{ fontSize: 8, color: '#555', minWidth: 14 }}>{sample.key}</span>}
        <span style={{ fontSize: 8, color: '#3a3a3a', minWidth: 30 }}>{sample.duration < 1 ? `${Math.round(sample.duration * 1000)}ms` : `${sample.duration.toFixed(1)}s`}</span>
        <span style={{ fontSize: 8, color: '#2a2a2a', minWidth: 34 }}>{sample.size}</span>
      </div>

      <button onClick={() => onToggleFav(sample.id)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: isFavorite ? '#f59e0b' : '#2a2a2a', padding: 0, flexShrink: 0, lineHeight: 1 }}>
        {isFavorite ? '★' : '☆'}
      </button>
    </div>
  )
}

export default function Library() {
  const dispatch = useDispatch()
  const favorites = useSelector(s => s.library.favorites)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [genre, setGenre] = useState('All')
  const [bpmFilter, setBpmFilter] = useState(null)
  const [playingId, setPlayingId] = useState(null)
  const [showFavOnly, setShowFavOnly] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [uploadedSamples, setUploadedSamples] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const playTimerRef = useRef(null)

  const allSamples = [...SAMPLE_DB, ...uploadedSamples]

  const filtered = allSamples.filter(s => {
    if (showFavOnly && !favorites.includes(s.id)) return false
    if (category !== 'All' && s.category !== category) return false
    if (genre !== 'All' && s.genre !== genre) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.tags.some(t => t.includes(q))) return false
    }
    if (bpmFilter && s.bpm && Math.abs(s.bpm - bpmFilter) > 10) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'bpm') return (a.bpm || 0) - (b.bpm || 0)
    if (sortBy === 'duration') return a.duration - b.duration
    return a.name.localeCompare(b.name)
  })

  const handlePreview = useCallback(async (sample) => {
    clearTimeout(playTimerRef.current)
    if (playingId === sample.id) { setPlayingId(null); return }
    setPlayingId(sample.id)
    dispatch(libraryActions.addRecent(sample.id))
    await playPreview(sample)
    playTimerRef.current = setTimeout(() => setPlayingId(null), Math.min(sample.duration, 4) * 1000)
  }, [playingId, dispatch])

  const handleToggleFav = useCallback((id) => dispatch(libraryActions.toggleFavorite(id)), [dispatch])

  const handleFileDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|flac|ogg)$/i))
    files.forEach(file => {
      const id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const url = URL.createObjectURL(file)
      setUploadedSamples(prev => [...prev, {
        id, name: file.name.replace(/\.[^.]+$/, ''), category: 'Loop', genre: 'All',
        bpm: null, key: null, duration: 0, size: `${(file.size / 1024).toFixed(0)}KB`, tags: ['user', 'uploaded'],
        waveform: Array.from({ length: 30 }, () => Math.random() * 0.6 + 0.1),
        synth: { type: 'synth', freq: 440, waveform: 'triangle', duration: 2 },
        audioUrl: url
      }])
    })
  }, [])

  const handleFileUpload = (e) => {
    Array.from(e.target.files).forEach(file => {
      const id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`
      setUploadedSamples(prev => [...prev, {
        id, name: file.name.replace(/\.[^.]+$/, ''), category: 'Loop', genre: 'All',
        bpm: null, key: null, duration: 0, size: `${(file.size / 1024).toFixed(0)}KB`, tags: ['user', 'uploaded'],
        waveform: Array.from({ length: 30 }, () => Math.random() * 0.6 + 0.1),
        synth: { type: 'synth', freq: 440, waveform: 'triangle', duration: 2 }
      }])
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#111', borderBottom: '1px solid #1f1f1f', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#666' }}>LIBRARY</span>
        <div style={{ width: 1, height: 18, background: '#333' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search samples..."
          style={{ flex: 1, minWidth: 140, background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, outline: 'none' }} />
        <button onClick={() => setShowFavOnly(v => !v)}
          style={{ padding: '4px 8px', background: showFavOnly ? '#92400e22' : 'transparent', border: `1px solid ${showFavOnly ? '#f59e0b55' : '#333'}`, borderRadius: 5, color: showFavOnly ? '#f59e0b' : '#555', cursor: 'pointer', fontSize: 12 }}>★</button>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
          <option value="name">Name</option><option value="bpm">BPM</option><option value="duration">Duration</option>
        </select>
        <button onClick={() => fileInputRef.current?.click()}
          style={{ padding: '4px 10px', background: '#22c55e1a', border: '1px solid #22c55e44', borderRadius: 5, color: '#22c55e', cursor: 'pointer', fontSize: 11 }}>+ Upload</button>
        <input ref={fileInputRef} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
        <span style={{ fontSize: 10, color: '#444', marginLeft: 'auto' }}>{filtered.length}/{allSamples.length}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 138, flexShrink: 0, background: '#0e0e0e', borderRight: '1px solid #1a1a1a', overflowY: 'auto' }}>
          <div style={{ padding: '6px 8px', fontSize: 9, color: '#333', textTransform: 'uppercase', letterSpacing: 1 }}>Category</div>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              style={{ width: '100%', padding: '5px 10px', background: category === cat ? `${CAT_COLORS[cat] || '#3b82f6'}1a` : 'transparent', border: 'none', borderLeft: `2px solid ${category === cat ? (CAT_COLORS[cat] || '#3b82f6') : 'transparent'}`, color: category === cat ? (CAT_COLORS[cat] || '#3b82f6') : '#555', cursor: 'pointer', fontSize: 11, textAlign: 'left' }}>
              {cat} {cat !== 'All' && <span style={{ fontSize: 8, color: '#333' }}>({allSamples.filter(s => s.category === cat).length})</span>}
            </button>
          ))}
          <div style={{ padding: '6px 8px', fontSize: 9, color: '#333', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6, borderTop: '1px solid #181818' }}>Genre</div>
          {GENRES.map(g => (
            <button key={g} onClick={() => setGenre(g)}
              style={{ width: '100%', padding: '4px 10px', background: genre === g ? '#1e3a5f' : 'transparent', border: 'none', borderLeft: `2px solid ${genre === g ? '#3b82f6' : 'transparent'}`, color: genre === g ? '#3b82f6' : '#444', cursor: 'pointer', fontSize: 10, textAlign: 'left' }}>
              {g}
            </button>
          ))}
          <div style={{ padding: '6px 8px', fontSize: 9, color: '#333', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6, borderTop: '1px solid #181818' }}>BPM Filter</div>
          <div style={{ padding: '0 8px 8px' }}>
            <input type="range" min="60" max="200" value={bpmFilter || 120} onChange={e => setBpmFilter(+e.target.value)} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#444' }}>
              <span>{bpmFilter ? `${bpmFilter}±10` : 'Off'}</span>
              <button onClick={() => setBpmFilter(null)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 8, padding: 0 }}>Off</button>
            </div>
          </div>
        </div>

        {/* Main list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleFileDrop}
            style={{ padding: '4px 12px', background: dragOver ? '#1a2f1a' : 'transparent', border: dragOver ? '1px dashed #22c55e' : '1px dashed transparent', borderRadius: 4, margin: 4, fontSize: 10, color: dragOver ? '#22c55e' : '#222', textAlign: 'center', transition: 'all 0.2s' }}>
            {dragOver ? 'Drop audio files to add to library' : 'Drag audio files here to upload • Drag samples to Timeline'}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0
              ? <div style={{ textAlign: 'center', padding: '40px', color: '#333', fontSize: 13 }}>No samples match your filters</div>
              : filtered.map(sample => (
                <SampleRow key={sample.id} sample={sample}
                  isPlaying={playingId === sample.id}
                  isFavorite={favorites.includes(sample.id)}
                  onPreview={handlePreview}
                  onToggleFav={handleToggleFav} />
              ))
            }
          </div>
        </div>
      </div>

      <div style={{ padding: '3px 12px', background: '#080808', borderTop: '1px solid #141414', fontSize: 9, color: '#2a2a2a', display: 'flex', gap: 14 }}>
        <span>▶ Click to preview (real Tone.js audio)</span>
        <span>★ to favorite</span>
        <span style={{ color: '#3b82f655' }}>Drag sample → drop on Timeline track to add</span>
      </div>
    </div>
  )
}

const sel = { background: '#1a1a1a', border: '1px solid #333', color: '#888', borderRadius: 5, padding: '4px 6px', fontSize: 11 }
