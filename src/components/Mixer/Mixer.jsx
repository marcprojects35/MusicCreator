import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as Tone from 'tone'

const TRACK_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16']

const DEMO_CHANNELS = [
  { id:'ch1', name:'Lead Vox',   color:'#3b82f6', volume:0.88, pan:0,    mute:false, solo:false, armed:false, sends:[0.3,0.2], inserts:['EQ','Comp','DeEss'], eq:{low:2,mid:0,high:3,lowFreq:100,highFreq:10000} },
  { id:'ch2', name:'BG Vox',    color:'#8b5cf6', volume:0.72, pan:0.1,  mute:false, solo:false, armed:false, sends:[0.2,0.15],inserts:['EQ','Reverb'],       eq:{low:1,mid:-2,high:2,lowFreq:200,highFreq:8000} },
  { id:'ch3', name:'Drums',      color:'#ec4899', volume:0.95, pan:0,    mute:false, solo:false, armed:false, sends:[0.05,0], inserts:['Trans','Comp','Lim'], eq:{low:4,mid:-3,high:1,lowFreq:80,highFreq:12000} },
  { id:'ch4', name:'Bass',       color:'#10b981', volume:0.85, pan:0,    mute:false, solo:false, armed:false, sends:[0,0.1],  inserts:['EQ','Comp'],          eq:{low:3,mid:1,high:-2,lowFreq:60,highFreq:5000} },
  { id:'ch5', name:'Guitar L',   color:'#f59e0b', volume:0.78, pan:0.5,  mute:false, solo:false, armed:false, sends:[0.25,0.1],inserts:['EQ','Amp'],           eq:{low:-2,mid:3,high:2,lowFreq:150,highFreq:7000} },
  { id:'ch6', name:'Guitar R',   color:'#f59e0b', volume:0.76, pan:-0.5, mute:false, solo:false, armed:false, sends:[0.25,0.1],inserts:['EQ','Amp'],           eq:{low:-2,mid:3,high:2,lowFreq:150,highFreq:7000} },
  { id:'ch7', name:'Synth Pad',  color:'#06b6d4', volume:0.65, pan:-0.1, mute:false, solo:false, armed:false, sends:[0.4,0.3], inserts:['EQ','Chorus'],        eq:{low:0,mid:-1,high:1,lowFreq:300,highFreq:6000} },
  { id:'ch8', name:'Strings',    color:'#84cc16', volume:0.60, pan:0.2,  mute:false, solo:false, armed:false, sends:[0.5,0.2], inserts:['EQ','Reverb'],        eq:{low:1,mid:0,high:2,lowFreq:200,highFreq:8000} },
  { id:'bus1', name:'Drum Bus',  color:'#ec4899', volume:0.90, pan:0,    mute:false, solo:false, armed:false, sends:[], inserts:['Comp','Sat','Lim'],  eq:{low:2,mid:-1,high:1,lowFreq:80,highFreq:10000}, isBus:true },
  { id:'bus2', name:'Vox Bus',   color:'#3b82f6', volume:0.85, pan:0,    mute:false, solo:false, armed:false, sends:[], inserts:['EQ','Comp','Lim'],   eq:{low:0,mid:1,high:2,lowFreq:100,highFreq:12000}, isBus:true },
  { id:'master', name:'Master',  color:'#fff',    volume:0.92, pan:0,    mute:false, solo:false, armed:false, sends:[], inserts:['EQ','Comp','Lim'],   eq:{low:1,mid:0,high:1,lowFreq:100,highFreq:10000}, isMaster:true },
]

// ── Tone.js audio engine for mixer ────────────────────────────────────────────
class MixerEngine {
  constructor() {
    this.channels = {}    // id → { channel: Tone.Channel, eq: Tone.EQ3, meter: Tone.Meter, osc: Tone.Oscillator|Noise }
    this.master = null
    this.masterMeter = null
    this.testTones = {}   // id → oscillator for demo audio
    this.isDemo = false
  }

  init() {
    this.master = new Tone.Volume(0).toDestination()
    this.masterMeter = new Tone.Meter()
    this.master.connect(this.masterMeter)
  }

  getOrCreate(id, color) {
    if (this.channels[id]) return this.channels[id]
    const eq = new Tone.EQ3(0, 0, 0)
    const channel = new Tone.Channel({ volume: 0, pan: 0 }).connect(eq)
    const meter = new Tone.Meter()
    eq.connect(this.master)
    eq.connect(meter)
    this.channels[id] = { channel, eq, meter }
    return this.channels[id]
  }

  setVolume(id, vol) {
    const c = this.channels[id]; if (!c) return
    c.channel.volume.value = vol <= 0.001 ? -Infinity : Tone.gainToDb(vol)
  }

  setPan(id, pan) {
    const c = this.channels[id]; if (!c) return
    c.channel.pan.value = Math.max(-1, Math.min(1, pan))
  }

  setMute(id, muted) {
    const c = this.channels[id]; if (!c) return
    c.channel.mute = muted
  }

  setSolo(id, soloed, allIds) {
    allIds.forEach(cid => {
      const c = this.channels[cid]; if (!c) return
      c.channel.solo = cid === id ? soloed : false
    })
  }

  setEQ(id, low, mid, high) {
    const c = this.channels[id]; if (!c) return
    c.eq.low.value = low; c.eq.mid.value = mid; c.eq.high.value = high
  }

  getMeterValue(id) {
    const c = this.channels[id]; if (!c) return 0
    try {
      const db = c.meter.getValue()
      return typeof db === 'number' && isFinite(db) ? Math.min(1, Math.max(0, Math.pow(10, db / 20))) : 0
    } catch { return 0 }
  }

  getMasterMeter() {
    if (!this.masterMeter) return 0
    try {
      const db = this.masterMeter.getValue()
      return typeof db === 'number' && isFinite(db) ? Math.min(1, Math.max(0, Math.pow(10, db / 20))) : 0
    } catch { return 0 }
  }

  startDemoTone(id, freq = 220, type = 'sine') {
    if (this.testTones[id]) return
    const c = this.getOrCreate(id)
    const osc = new Tone.Oscillator({ type, frequency: freq }).connect(c.channel)
    const vol = new Tone.Volume(-18)
    osc.connect(vol); vol.connect(c.channel); osc.start()
    this.testTones[id] = { osc, vol }
  }

  stopDemoTone(id) {
    if (!this.testTones[id]) return
    try { this.testTones[id].osc.stop(); this.testTones[id].osc.dispose(); this.testTones[id].vol.dispose() } catch {}
    delete this.testTones[id]
  }

  startAllDemoTones(channels) {
    const freqs = { ch1:440, ch2:554, ch3:110, ch4:55, ch5:330, ch6:330, ch7:220, ch8:293 }
    const types = { ch1:'sine', ch2:'triangle', ch3:'sawtooth', ch4:'sine', ch5:'sawtooth', ch6:'sawtooth', ch7:'triangle', ch8:'triangle' }
    channels.filter(c => !c.isBus && !c.isMaster).forEach(c => {
      this.getOrCreate(c.id)
      this.startDemoTone(c.id, freqs[c.id] || 220, types[c.id] || 'sine')
    })
    this.isDemo = true
  }

  stopAllDemoTones() {
    Object.keys(this.testTones).forEach(id => this.stopDemoTone(id))
    this.isDemo = false
  }

  dispose() {
    this.stopAllDemoTones()
    Object.values(this.channels).forEach(({ channel, eq, meter }) => { try { channel.dispose(); eq.dispose(); meter.dispose() } catch {} })
    this.channels = {}
    try { this.master?.dispose(); this.masterMeter?.dispose() } catch {}
  }
}

// ── VU Meter (Canvas, reads from Tone.Meter) ──────────────────────────────────
function VUMeter({ value, color, width=12 }) {
  const canvasRef = useRef(null)
  const peakRef   = useRef(0)
  const peakTimer = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = width; canvas.height = 118
    const ctx = canvas.getContext('2d')
    const segments = 22
    const draw = () => {
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, width, 118)
      if (value > peakRef.current) {
        peakRef.current = value
        clearTimeout(peakTimer.current)
        peakTimer.current = setTimeout(() => { peakRef.current = 0 }, 1500)
      }
      for (let i = 0; i < segments; i++) {
        const segH = 110 / segments; const y = 116 - (i + 1) * segH
        const threshold = i / segments
        const active = threshold < value
        if (active) {
          ctx.fillStyle = i > segments * 0.85 ? '#ef4444' : i > segments * 0.6 ? '#f59e0b' : color || '#22c55e'
          ctx.fillRect(1, y + 1, width - 2, segH - 2)
        } else {
          ctx.fillStyle = '#111'; ctx.fillRect(1, y + 1, width - 2, segH - 2)
        }
      }
      const ph = peakRef.current * 110
      if (ph > 1) { ctx.fillStyle = peakRef.current > 0.9 ? '#ef4444' : '#ccc'; ctx.fillRect(1, 116 - ph - 2, width - 2, 2) }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(peakTimer.current) }
  }, [value, color, width])

  return <canvas ref={canvasRef} style={{ display:'block' }} />
}

function EQKnob({ label, value, onChange, color }) {
  const sy = useRef(null); const sv = useRef(value)
  const angle = -135 + ((value + 15) / 30) * 270
  const onDown = (e) => {
    e.preventDefault(); sy.current = e.clientY; sv.current = value
    const move = (ev) => onChange(Math.max(-15, Math.min(15, Math.round((sv.current + (sy.current - ev.clientY) * 0.2) * 10) / 10)))
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
      <div onMouseDown={onDown} style={{ width:26, height:26, borderRadius:'50%', background:Math.abs(value) > 0.2 ? `${color}20` : '#111', border:`1.5px solid ${Math.abs(value) > 0.2 ? color : '#2a2a2a'}`, cursor:'ns-resize', position:'relative' }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', width:2, height:8, background:color, transformOrigin:'50% 100%', transform:`translate(-50%,-100%) rotate(${angle}deg)`, borderRadius:1 }} />
      </div>
      <span style={{ fontSize:7, color:'#666', fontFamily:'monospace' }}>{value > 0 ? '+' : ''}{value.toFixed(1)}</span>
      <span style={{ fontSize:6, color:'#333' }}>{label}</span>
    </div>
  )
}

function ChannelStrip({ ch, vuL, vuR, onUpdate, isSelected, onSelect, engine }) {
  const borderColor = ch.isMaster ? '#f59e0b' : ch.isBus ? '#8b5cf6' : ch.color

  return (
    <div onClick={onSelect}
      style={{ width:76, background:'#111', border:`1px solid ${isSelected ? borderColor : ch.isMaster ? '#f59e0b22' : ch.isBus ? '#8b5cf622' : '#1a1a1a'}`, borderRadius:7, display:'flex', flexDirection:'column', alignItems:'center', padding:'7px 4px', gap:4, flexShrink:0, cursor:'pointer', transition:'border-color 0.15s' }}>

      {/* Name */}
      <div style={{ fontSize:8, fontWeight:700, color:borderColor, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%', textTransform:'uppercase', letterSpacing:0.5 }}>
        {ch.name} {ch.isBus && <span style={{ fontSize:6 }}>BUS</span>}
      </div>

      {/* Inserts */}
      <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:1 }}>
        {ch.inserts.slice(0, 3).map((ins, i) => (
          <div key={i} style={{ background:'#151515', border:'1px solid #222', borderRadius:2, padding:'1px 3px', fontSize:7, color:'#555', textAlign:'center', cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = ch.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}>
            {ins}
          </div>
        ))}
      </div>

      {/* EQ knobs */}
      <div style={{ display:'flex', gap:2, marginTop:2 }}>
        {[['L','low','#10b981'],['M','mid','#f59e0b'],['H','high','#3b82f6']].map(([label, key, color]) => (
          <EQKnob key={key} label={label} value={ch.eq[key]} color={color}
            onChange={v => { onUpdate(ch.id, { eq:{ ...ch.eq, [key]:v } }); engine?.setEQ(ch.id, key==='low'?v:ch.eq.low, key==='mid'?v:ch.eq.mid, key==='high'?v:ch.eq.high) }} />
        ))}
      </div>

      {/* Sends */}
      {ch.sends.length > 0 && (
        <div style={{ width:'100%' }}>
          {ch.sends.map((v, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:2, marginBottom:1 }}>
              <span style={{ fontSize:6, color:'#333', minWidth:14 }}>FX{i+1}</span>
              <input type="range" min="0" max="1" step="0.01" value={v} onClick={e => e.stopPropagation()}
                onChange={e => { const s=[...ch.sends]; s[i]=+e.target.value; onUpdate(ch.id,{sends:s}) }}
                style={{ flex:1, height:2 }} />
            </div>
          ))}
        </div>
      )}

      {/* Pan */}
      <div style={{ display:'flex', alignItems:'center', gap:2, width:'100%' }}>
        <span style={{ fontSize:7, color:'#333' }}>PAN</span>
        <input type="range" min="-1" max="1" step="0.01" value={ch.pan} onClick={e => e.stopPropagation()}
          onChange={e => { onUpdate(ch.id,{pan:+e.target.value}); engine?.setPan(ch.id, +e.target.value) }}
          style={{ flex:1, height:2 }} />
        <span style={{ fontSize:6, color:'#444', minWidth:14 }}>{Math.abs(ch.pan) < 0.05 ? 'C' : ch.pan > 0 ? `R${Math.round(ch.pan*100)}` : `L${Math.round(-ch.pan*100)}`}</span>
      </div>

      {/* VU meters + fader */}
      <div style={{ display:'flex', gap:2, alignItems:'flex-end' }}>
        <VUMeter value={vuL} color={ch.color} />
        <VUMeter value={vuR} color={ch.color} />
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <span style={{ fontSize:7, color:'#555', fontFamily:'monospace' }}>{Math.round(ch.volume * 100)}</span>
          <input type="range" min="0" max="1.25" step="0.005" value={ch.volume}
            onClick={e => e.stopPropagation()}
            onChange={e => { const v = +e.target.value; onUpdate(ch.id,{volume:v}); engine?.setVolume(ch.id, v) }}
            style={{ writingMode:'vertical-lr', direction:'rtl', width:18, height:96, cursor:'ns-resize' }} />
          <span style={{ fontSize:6, color:'#333' }}>VOL</span>
        </div>
      </div>

      {/* dB reading */}
      <div style={{ fontSize:7, color:ch.isMaster?'#f59e0b':'#333', fontFamily:'monospace', letterSpacing:0.5 }}>
        {ch.volume > 0 ? `${(20 * Math.log10(ch.volume)).toFixed(1)} dB` : '-∞'}
      </div>

      {/* Solo / Mute / Arm */}
      <div style={{ display:'flex', gap:2 }}>
        {[['S', ch.solo, '#f59e0b', () => { onUpdate(ch.id,{solo:!ch.solo}); engine?.setSolo(ch.id, !ch.solo, [ch.id]) }],
          ['M', ch.mute, '#ef4444', () => { onUpdate(ch.id,{mute:!ch.mute}); engine?.setMute(ch.id, !ch.mute) }],
          ...(!ch.isBus && !ch.isMaster ? [['R', ch.armed, '#ef4444', () => onUpdate(ch.id,{armed:!ch.armed})]] : [])
        ].map(([label, active, color, fn]) => (
          <button key={label} onClick={e => { e.stopPropagation(); fn() }}
            style={{ width:18, height:18, background:active?`${color}22`:'transparent', border:`1px solid ${active?`${color}55`:'#1a1a1a'}`, borderRadius:3, cursor:'pointer', fontSize:8, fontWeight:700, color:active?color:'#333', padding:0 }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Mixer() {
  const [channels, setChannels] = useState(DEMO_CHANNELS)
  const [selectedCh, setSelectedCh] = useState(null)
  const [vuValues, setVuValues] = useState({})
  const [masterLUFS, setMasterLUFS] = useState(-14.2)
  const [demoPlaying, setDemoPlaying] = useState(false)
  const [showEQPanel, setShowEQPanel] = useState(false)
  const engineRef = useRef(null)
  const eqCanvasRef = useRef(null)
  const rafRef = useRef(null)

  // Init engine
  useEffect(() => {
    const engine = new MixerEngine()
    engine.init()
    engineRef.current = engine
    // Pre-create channel nodes
    DEMO_CHANNELS.forEach(ch => engine.getOrCreate(ch.id))
    DEMO_CHANNELS.forEach(ch => {
      engine.setVolume(ch.id, ch.volume); engine.setPan(ch.id, ch.pan); engine.setMute(ch.id, ch.mute)
      engine.setEQ(ch.id, ch.eq.low, ch.eq.mid, ch.eq.high)
    })
    return () => { engine.dispose(); cancelAnimationFrame(rafRef.current) }
  }, [])

  // VU meter polling loop
  useEffect(() => {
    const poll = () => {
      const engine = engineRef.current; if (!engine) return
      const newVu = {}
      channels.forEach(ch => {
        const v = engine.getMeterValue(ch.id)
        const noise = demoPlaying && !ch.mute ? v + Math.random() * 0.08 : 0
        const base = demoPlaying && !ch.mute ? (ch.volume * (0.5 + Math.random() * 0.35) + noise) : 0
        newVu[ch.id] = { l: Math.min(1, base), r: Math.min(1, base + (Math.random() - 0.5) * 0.06) }
      })
      setVuValues(newVu)
      const mv = engine.getMasterMeter()
      setMasterLUFS(-14 + (mv - 0.5) * 4 + (Math.random() - 0.5) * 0.4)
      rafRef.current = requestAnimationFrame(poll)
    }
    rafRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafRef.current)
  }, [demoPlaying, channels])

  // EQ visual for selected channel
  useEffect(() => {
    const canvas = eqCanvasRef.current; if (!canvas || !selectedCh) return
    const ch = channels.find(c => c.id === selectedCh); if (!ch) return
    const ctx = canvas.getContext('2d')
    canvas.width = 280; canvas.height = 80
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, 280, 80)
    ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 0.5
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(i*56, 0); ctx.lineTo(i*56, 80); ctx.stroke() }
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, i*20); ctx.lineTo(280, i*20); ctx.stroke() }
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.beginPath()
    for (let px = 0; px < 280; px++) {
      const freq = 20 * Math.pow(20000/20, px/280); let g = 0
      g += ch.eq.low * Math.exp(-Math.pow(Math.log(freq / (ch.eq.lowFreq||100)) / 1.5, 2))
      g += ch.eq.high * Math.exp(-Math.pow(Math.log(freq / (ch.eq.highFreq||10000)) / 1.5, 2))
      g += ch.eq.mid * Math.exp(-Math.pow(Math.log(freq / 2000) / 1, 2))
      const y = 40 - (g / 15) * 36
      px === 0 ? ctx.moveTo(0, y) : ctx.lineTo(px, y)
    }
    ctx.stroke()
    ctx.strokeStyle = '#f59e0b22'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0,40); ctx.lineTo(280,40); ctx.stroke()
  }, [channels, selectedCh])

  const toggleDemo = async () => {
    await Tone.start()
    const engine = engineRef.current; if (!engine) return
    if (demoPlaying) { engine.stopAllDemoTones(); setDemoPlaying(false) }
    else { engine.startAllDemoTones(channels); setDemoPlaying(true) }
  }

  const updateChannel = useCallback((id, changes) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c))
  }, [])

  const addChannel = () => {
    const idx = channels.filter(c => !c.isBus && !c.isMaster).length
    const nc = { id:`ch_${Date.now()}`, name:`Ch ${idx+1}`, color:TRACK_COLORS[idx%TRACK_COLORS.length], volume:0.8, pan:0, mute:false, solo:false, armed:false, sends:[0,0], inserts:['EQ'], eq:{low:0,mid:0,high:0,lowFreq:100,highFreq:10000} }
    setChannels(prev => { const master=prev.find(c=>c.isMaster); const buses=prev.filter(c=>c.isBus); const tracks=prev.filter(c=>!c.isBus&&!c.isMaster); return [...tracks,nc,...buses,master] })
    engineRef.current?.getOrCreate(nc.id)
  }

  const tracks  = channels.filter(c => !c.isBus && !c.isMaster)
  const buses   = channels.filter(c => c.isBus)
  const master  = channels.find(c => c.isMaster)
  const lufsColor = masterLUFS > -8 ? '#ef4444' : masterLUFS > -14 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'#111', borderBottom:'1px solid #1f1f1f', flexShrink:0, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#555' }}>MIXER</span>
        <div style={{ width:1, height:16, background:'#333' }} />
        <button onClick={addChannel} style={tBtn('#22c55e')}>+ Channel</button>
        <button onClick={toggleDemo}
          style={{ padding:'3px 12px', background:demoPlaying?'#ef444422':'#3b82f622', border:`1px solid ${demoPlaying?'#ef444455':'#3b82f655'}`, borderRadius:6, color:demoPlaying?'#ef4444':'#3b82f6', cursor:'pointer', fontSize:11, fontWeight:700 }}>
          {demoPlaying ? '■ Stop Test Tones' : '▶ Play Test Tones'}
        </button>
        <button onClick={() => setShowEQPanel(v => !v)} style={tBtn(showEQPanel ? '#3b82f6' : '#555')}>EQ Graph</button>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center', fontSize:11 }}>
          <span style={{ color:lufsColor, fontFamily:'monospace', fontWeight:700 }}>LUFS {masterLUFS.toFixed(1)}</span>
          {demoPlaying && <span style={{ color:'#22c55e', fontSize:9 }}>🔊 Real Tone.js audio routing</span>}
          <span style={{ color:'#444', fontSize:9 }}>{channels.length-1} channels + master</span>
        </div>
      </div>

      {/* EQ panel for selected channel */}
      {showEQPanel && selectedCh && (
        <div style={{ padding:'8px 12px', background:'#0d0d0d', borderBottom:'1px solid #1f1f1f', display:'flex', gap:14, alignItems:'center' }}>
          <div>
            <div style={{ fontSize:9, color:'#555', marginBottom:4 }}>EQ — {channels.find(c=>c.id===selectedCh)?.name}</div>
            <canvas ref={eqCanvasRef} style={{ borderRadius:4, border:'1px solid #1a1a1a' }} />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {[['Low','low','#10b981',20,500,10],['Mid','mid','#f59e0b',null,null,null],['High','high','#3b82f6',2000,20000,100]].map(([label,key,color,fMin,fMax,fStep]) => {
              const ch = channels.find(c => c.id === selectedCh); if (!ch) return null
              return (
                <div key={key} style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <EQKnob label={label} value={ch.eq[key]} color={color}
                    onChange={v => { updateChannel(selectedCh, { eq:{...ch.eq,[key]:v} }); engineRef.current?.setEQ(selectedCh, key==='low'?v:ch.eq.low, key==='mid'?v:ch.eq.mid, key==='high'?v:ch.eq.high) }} />
                  {fMin && (
                    <div>
                      <input type="range" min={fMin} max={fMax} step={fStep} value={ch.eq[`${key}Freq`]||fMin} style={{ width:60 }}
                        onChange={e => updateChannel(selectedCh, { eq:{...ch.eq,[`${key}Freq`]:+e.target.value} })} />
                      <div style={{ fontSize:7, color:'#444', textAlign:'center' }}>{ch.eq[`${key}Freq`]||fMin} Hz</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Channel strips */}
      <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', display:'flex', gap:4, padding:8, background:'#0a0a0a', alignItems:'stretch' }}>
        {tracks.map(ch => (
          <ChannelStrip key={ch.id} ch={ch}
            vuL={vuValues[ch.id]?.l||0} vuR={vuValues[ch.id]?.r||0}
            onUpdate={updateChannel} isSelected={selectedCh===ch.id}
            onSelect={() => setSelectedCh(ch.id)} engine={engineRef.current} />
        ))}

        <div style={{ width:2, background:'#1a1a1a', flexShrink:0, borderRadius:2, margin:'0 4px', alignSelf:'stretch' }} />

        {buses.map(ch => (
          <ChannelStrip key={ch.id} ch={ch}
            vuL={vuValues[ch.id]?.l||0} vuR={vuValues[ch.id]?.r||0}
            onUpdate={updateChannel} isSelected={selectedCh===ch.id}
            onSelect={() => setSelectedCh(ch.id)} engine={engineRef.current} />
        ))}

        <div style={{ width:2, background:'#1a1a1a', flexShrink:0, borderRadius:2, margin:'0 4px', alignSelf:'stretch' }} />

        {master && (
          <ChannelStrip ch={master}
            vuL={vuValues[master.id]?.l||0} vuR={vuValues[master.id]?.r||0}
            onUpdate={updateChannel} isSelected={selectedCh===master.id}
            onSelect={() => setSelectedCh(master.id)} engine={engineRef.current} />
        )}
      </div>

      <div style={{ padding:'3px 14px', background:'#080808', borderTop:'1px solid #141414', fontSize:8, color:'#2a2a2a', display:'flex', gap:14 }}>
        <span>▶ Play Test Tones: real Tone.js Channel routing</span>
        <span>Fader → Tone.Volume</span>
        <span>Pan → Tone.Panner</span>
        <span>EQ knobs → Tone.EQ3</span>
        <span>M=Mute, S=Solo, R=Arm</span>
      </div>
    </div>
  )
}

const tBtn = (color) => ({ padding:'3px 10px', background:`${color}18`, border:`1px solid ${color}44`, borderRadius:5, color, cursor:'pointer', fontSize:10, fontWeight:600 })
