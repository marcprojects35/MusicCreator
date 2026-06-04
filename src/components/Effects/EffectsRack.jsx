import React, { useState, useRef, useEffect, useCallback } from 'react'
import * as Tone from 'tone'

// ── Real Tone.js effect factory ───────────────────────────────────────────────
function createToneEffect(type, params) {
  try {
    switch (type) {
      case 'eq':         return new Tone.EQ3({ low: params.low || 0, mid: params.lowMid || 0, high: params.high || 0 })
      case 'compressor': return new Tone.Compressor({ threshold: params.threshold, ratio: params.ratio, attack: params.attack / 1000, release: params.release / 1000, knee: params.knee })
      case 'limiter':    return new Tone.Limiter(params.threshold)
      case 'reverb':     return new Tone.Reverb({ decay: (params.roomSize || 0.5) * 5, wet: params.wet || 0.3 })
      case 'delay':      return new Tone.FeedbackDelay({ delayTime: (params.time || 250) / 1000, feedback: params.feedback || 0.3, wet: params.wet || 0.3 })
      case 'chorus':     return new Tone.Chorus({ frequency: params.rate || 1.5, depth: (params.depth || 0.5) * 100, wet: params.wet || 0.3 })
      case 'phaser':     return new Tone.Phaser({ frequency: params.rate || 0.5, octaves: params.stages || 4, wet: params.wet || 0.5 })
      case 'distortion': return new Tone.Distortion({ distortion: params.amount || 0.4, wet: 1 })
      case 'saturation': return new Tone.Distortion({ distortion: (params.amount || 0.2) * 0.5, wet: 1 })
      case 'bitcrusher': return new Tone.BitCrusher(Math.round(params.bits || 8))
      case 'stereoImager': return new Tone.StereoWidener(params.width || 0.5)
      case 'deesser':    return new Tone.Filter({ frequency: params.frequency || 7500, type: 'bandpass', Q: 2 })
      default:           return new Tone.Gain(1)
    }
  } catch { return new Tone.Gain(1) }
}

function updateToneEffect(node, type, params) {
  if (!node) return
  try {
    switch (type) {
      case 'eq':         node.low.value = params.low || 0; node.mid.value = params.lowMid || 0; node.high.value = params.high || 0; break
      case 'compressor': node.threshold.value = params.threshold; node.ratio.value = params.ratio; node.attack.value = params.attack / 1000; node.release.value = params.release / 1000; break
      case 'limiter':    node.threshold = params.threshold; break
      case 'reverb':     node.wet.value = params.wet || 0.3; break
      case 'delay':      node.delayTime.value = (params.time || 250) / 1000; node.feedback.value = params.feedback || 0.3; node.wet.value = params.wet || 0.3; break
      case 'chorus':     node.frequency.value = params.rate || 1.5; node.wet.value = params.wet || 0.3; break
      case 'distortion': case 'saturation': node.distortion = params.amount || 0.3; break
    }
  } catch {}
}

const EFFECT_DEFS = [
  { type:'eq',           name:'Parametric EQ',  icon:'📊', color:'#3b82f6' },
  { type:'compressor',   name:'Compressor',      icon:'📉', color:'#10b981' },
  { type:'limiter',      name:'Limiter',          icon:'🔒', color:'#ef4444' },
  { type:'reverb',       name:'Reverb',           icon:'🌊', color:'#8b5cf6' },
  { type:'delay',        name:'Delay',            icon:'🔁', color:'#f59e0b' },
  { type:'chorus',       name:'Chorus',           icon:'🎵', color:'#06b6d4' },
  { type:'saturation',   name:'Saturation',       icon:'🔥', color:'#f97316' },
  { type:'bitcrusher',   name:'Bit Crusher',      icon:'💾', color:'#ec4899' },
  { type:'deesser',      name:'De-Esser',         icon:'🔇', color:'#84cc16' },
  { type:'stereoImager', name:'Stereo Imager',    icon:'↔️', color:'#a78bfa' },
  { type:'phaser',       name:'Phaser',           icon:'🌀', color:'#22d3ee' },
  { type:'distortion',   name:'Distortion',       icon:'⚡', color:'#fbbf24' },
]

const DEFAULT_PARAMS = {
  eq:           { low:0, lowMid:0, highMid:0, high:0, lowFreq:100, highFreq:10000 },
  compressor:   { threshold:-24, ratio:4, attack:10, release:100, knee:6 },
  limiter:      { threshold:-0.5, release:50 },
  reverb:       { roomSize:0.5, damping:0.5, wet:0.3, type:'Room' },
  delay:        { time:250, feedback:0.3, wet:0.3, sync:true },
  chorus:       { rate:1.5, depth:0.5, wet:0.3 },
  saturation:   { amount:0.2, type:'Soft Clip' },
  bitcrusher:   { bits:12, reduction:0.3 },
  deesser:      { frequency:7500, threshold:-20 },
  stereoImager: { width:0.5 },
  phaser:       { rate:0.5, depth:0.6, wet:0.5, stages:4 },
  distortion:   { amount:0.4, tone:0.5 },
}

const PRESETS = {
  'Pop Vocal':    [{ type:'eq', params:{low:2,lowMid:-1,highMid:3,high:2,lowFreq:150,highFreq:10000} }, { type:'compressor', params:{threshold:-18,ratio:4,attack:8,release:80,knee:6} }, { type:'deesser', params:{frequency:8000,threshold:-20} }, { type:'reverb', params:{roomSize:0.4,wet:0.2} }],
  'Trap Beat':    [{ type:'eq', params:{low:5,lowMid:0,highMid:-2,high:3,lowFreq:80,highFreq:12000} }, { type:'compressor', params:{threshold:-12,ratio:6,attack:1,release:50,knee:3} }, { type:'limiter', params:{threshold:-1} }],
  'Lo-Fi':        [{ type:'bitcrusher', params:{bits:8} }, { type:'eq', params:{low:3,lowMid:1,highMid:-5,high:-8,lowFreq:200,highFreq:4000} }, { type:'chorus', params:{rate:0.8,depth:0.6,wet:0.4} }, { type:'reverb', params:{roomSize:0.6,wet:0.35} }],
  'Distorted':    [{ type:'distortion', params:{amount:0.7} }, { type:'eq', params:{low:2,lowMid:0,highMid:2,high:0,lowFreq:100,highFreq:6000} }, { type:'limiter', params:{threshold:-3} }],
}

function Knob({ label, value, min, max, step=0.01, onChange, color='#3b82f6', unit='' }) {
  const startY = useRef(null); const startVal = useRef(value)
  const range = max - min
  const angle = -135 + ((value - min) / range) * 270
  const onDown = (e) => {
    e.preventDefault(); startY.current = e.clientY; startVal.current = value
    const move = (ev) => onChange(Math.max(min, Math.min(max, Math.round((startVal.current + (startY.current - ev.clientY) / 100 * range) / step) * step)))
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }
  const fmt = v => Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : (step >= 1 ? Math.round(v) : v.toFixed(2))
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <div onMouseDown={onDown} style={{ width:32, height:32, borderRadius:'50%', background:`${color}15`, border:`2px solid ${color}55`, cursor:'ns-resize', position:'relative' }}>
        <svg width="32" height="32" style={{ position:'absolute', top:0, left:0 }}>
          <circle cx="16" cy="16" r="11" fill="none" stroke="#1a1a1a" strokeWidth="3"
            strokeDasharray={`${270/360*2*Math.PI*11} 100`} strokeDashoffset={`-${45/360*2*Math.PI*11}`} />
          <circle cx="16" cy="16" r="11" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${((value-min)/range)*270/360*2*Math.PI*11} 100`}
            strokeDashoffset={`-${45/360*2*Math.PI*11}`} />
        </svg>
        <div style={{ position:'absolute', top:'50%', left:'50%', width:2.5, height:9, background:color, transformOrigin:'50% 100%', transform:`translate(-50%,-100%) rotate(${angle}deg)`, borderRadius:1.5 }} />
      </div>
      <span style={{ fontSize:8, color:'#888', fontFamily:'monospace' }}>{fmt(value)}{unit}</span>
      <span style={{ fontSize:7, color:'#444' }}>{label}</span>
    </div>
  )
}

function EQVisual({ params }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); ctx.fillStyle='#0d0d0d'; ctx.fillRect(0,0,c.width,c.height)
    ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=0.5
    for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(i*c.width/5,0);ctx.lineTo(i*c.width/5,c.height);ctx.stroke()}
    for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,i*c.height/4);ctx.lineTo(c.width,i*c.height/4);ctx.stroke()}
    ctx.strokeStyle='#3b82f6'; ctx.lineWidth=2; ctx.beginPath()
    for(let px=0;px<c.width;px++){
      const f=20*Math.pow(20000/20,px/c.width); let g=0
      g+=(params.low||0)*Math.exp(-Math.pow(Math.log(f/(params.lowFreq||100))/1.5,2))
      g+=(params.high||0)*Math.exp(-Math.pow(Math.log(f/(params.highFreq||10000))/1.5,2))
      g+=(params.lowMid||0)*Math.exp(-Math.pow(Math.log(f/400)/1,2))
      g+=(params.highMid||0)*Math.exp(-Math.pow(Math.log(f/3000)/1,2))
      const y=c.height/2-(g/15)*(c.height/2-4)
      px===0?ctx.moveTo(0,y):ctx.lineTo(px,y)
    }
    ctx.stroke()
    ctx.strokeStyle='#f59e0b22'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,c.height/2); ctx.lineTo(c.width,c.height/2); ctx.stroke()
  }, [params])
  return <canvas ref={ref} width={280} height={60} style={{ borderRadius:4 }} />
}

function GRMeter({ threshold }) {
  const ref = useRef(null)
  const raf = useRef(null)
  const gr = useRef(0)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')
    const draw = () => {
      const target = -(Math.random() * 8 * Math.max(0, (-threshold) / 40))
      gr.current += (target - gr.current) * 0.12
      const h = Math.min(c.height - 4, Math.abs(gr.current) * 3.5)
      c.width = 32; c.height = 70
      ctx.fillStyle='#0a0a0a'; ctx.fillRect(0,0,32,70)
      const grad = ctx.createLinearGradient(0,70,0,0)
      grad.addColorStop(0,'#22c55e'); grad.addColorStop(0.5,'#f59e0b'); grad.addColorStop(1,'#ef4444')
      ctx.fillStyle=grad; ctx.fillRect(4,70-h,24,h)
      ctx.fillStyle='#444'; ctx.font='7px monospace'
      ctx.fillText(`${gr.current.toFixed(1)}`,2,9); ctx.fillText('GR',8,65)
      raf.current = requestAnimationFrame(draw)
    }
    raf.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf.current)
  }, [threshold])
  return <canvas ref={ref} />
}

function EffectPlugin({ effect, index, total, onUpdate, onToggle, onRemove, isHovered, dragHandlers }) {
  const [expanded, setExpanded] = useState(false)
  const def = EFFECT_DEFS.find(d => d.type === effect.type)
  const p = effect.params

  const renderParams = () => {
    switch (effect.type) {
      case 'eq': return (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <EQVisual params={p} />
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
            {[['Low','low',-15,15,'#10b981',' dB'],['L-Mid','lowMid',-15,15,'#f59e0b',' dB'],['H-Mid','highMid',-15,15,'#ef4444',' dB'],['High','high',-15,15,'#3b82f6',' dB']].map(([label,key,mn,mx,color,unit]) => (
              <Knob key={key} label={label} value={p[key]||0} min={mn} max={mx} step={0.5} color={color} unit={unit}
                onChange={v => onUpdate(index, { params:{...p,[key]:v} })} />
            ))}
          </div>
          {[['Low Freq','lowFreq',20,500,10,'Hz'],['High Freq','highFreq',2000,20000,100,'Hz']].map(([label,key,mn,mx,step,unit]) => (
            <div key={key} style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:9, color:'#444', minWidth:55 }}>{label}</span>
              <input type="range" min={mn} max={mx} step={step} value={p[key]||mn} style={{ flex:1 }}
                onChange={e => onUpdate(index, { params:{...p,[key]:+e.target.value} })} />
              <span style={{ fontSize:9, color:'#666', minWidth:40 }}>{p[key]||mn} {unit}</span>
            </div>
          ))}
        </div>
      )
      case 'compressor': return (
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <GRMeter threshold={p.threshold} />
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Knob label="Thresh" value={p.threshold} min={-60} max={0} step={0.5} unit=" dB" color="#10b981" onChange={v => onUpdate(index, { params:{...p,threshold:v} })} />
            <Knob label="Ratio"  value={p.ratio}     min={1}   max={20} step={0.5} unit=":1"  color="#f59e0b" onChange={v => onUpdate(index, { params:{...p,ratio:v} })} />
            <Knob label="Attack" value={p.attack}    min={0.1} max={200} step={0.1} unit=" ms" color="#3b82f6" onChange={v => onUpdate(index, { params:{...p,attack:v} })} />
            <Knob label="Rel"    value={p.release}   min={10}  max={2000} step={10} unit=" ms" color="#8b5cf6" onChange={v => onUpdate(index, { params:{...p,release:v} })} />
            <Knob label="Knee"   value={p.knee}      min={0}   max={12}  step={0.5} unit=" dB" color="#ec4899" onChange={v => onUpdate(index, { params:{...p,knee:v} })} />
          </div>
        </div>
      )
      case 'reverb': return (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <select value={p.type||'Room'} onChange={e => onUpdate(index, { params:{...p,type:e.target.value} })} style={sel}>
            {['Room','Hall','Plate','Spring','Cave'].map(t => <option key={t}>{t}</option>)}
          </select>
          <Knob label="Size" value={p.roomSize} min={0.1} max={1} color="#8b5cf6" onChange={v => onUpdate(index, { params:{...p,roomSize:v} })} />
          <Knob label="Damp" value={p.damping||0.5} min={0} max={1} color="#a78bfa" onChange={v => onUpdate(index, { params:{...p,damping:v} })} />
          <Knob label="Wet"  value={p.wet} min={0} max={1} color="#06b6d4" onChange={v => onUpdate(index, { params:{...p,wet:v} })} />
        </div>
      )
      case 'delay': return (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <Knob label="Time" value={p.time} min={50} max={2000} step={1} unit=" ms" color="#f59e0b" onChange={v => onUpdate(index, { params:{...p,time:v} })} />
          <Knob label="Fbk"  value={p.feedback} min={0} max={0.95} color="#ef4444" onChange={v => onUpdate(index, { params:{...p,feedback:v} })} />
          <Knob label="Wet"  value={p.wet} min={0} max={1} color="#3b82f6" onChange={v => onUpdate(index, { params:{...p,wet:v} })} />
          <label style={{ fontSize:10, color:'#888', display:'flex', gap:5, alignItems:'center' }}>
            <input type="checkbox" checked={p.sync||false} onChange={e => onUpdate(index, { params:{...p,sync:e.target.checked} })} /> BPM
          </label>
        </div>
      )
      case 'chorus': return (
        <div style={{ display:'flex', gap:8 }}>
          <Knob label="Rate"  value={p.rate} min={0.1} max={8} unit=" Hz" color="#06b6d4" onChange={v => onUpdate(index, { params:{...p,rate:v} })} />
          <Knob label="Depth" value={p.depth} min={0} max={1} color="#3b82f6" onChange={v => onUpdate(index, { params:{...p,depth:v} })} />
          <Knob label="Wet"   value={p.wet} min={0} max={1} color="#8b5cf6" onChange={v => onUpdate(index, { params:{...p,wet:v} })} />
        </div>
      )
      case 'limiter': return (
        <div style={{ display:'flex', gap:8 }}>
          <Knob label="Ceil"  value={p.threshold} min={-12} max={0} step={0.1} unit=" dBFS" color="#ef4444" onChange={v => onUpdate(index, { params:{...p,threshold:v} })} />
          <Knob label="Rel"   value={p.release||50} min={10} max={1000} step={10} unit=" ms" color="#f59e0b" onChange={v => onUpdate(index, { params:{...p,release:v} })} />
        </div>
      )
      case 'saturation': case 'distortion': return (
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={p.type||'Soft Clip'} onChange={e => onUpdate(index, { params:{...p,type:e.target.value} })} style={sel}>
            {['Soft Clip','Hard Clip','Tape','Tube','Fuzz'].map(t => <option key={t}>{t}</option>)}
          </select>
          <Knob label="Amount" value={p.amount} min={0} max={1} color="#f97316" onChange={v => onUpdate(index, { params:{...p,amount:v} })} />
        </div>
      )
      case 'bitcrusher': return (
        <div style={{ display:'flex', gap:8 }}>
          <Knob label="Bits"  value={p.bits} min={1} max={16} step={1} color="#ec4899" onChange={v => onUpdate(index, { params:{...p,bits:v} })} />
          <Knob label="Crush" value={p.reduction||0.3} min={0} max={1} color="#f97316" onChange={v => onUpdate(index, { params:{...p,reduction:v} })} />
        </div>
      )
      case 'stereoImager': return (
        <div style={{ display:'flex', gap:8 }}>
          <Knob label="Width" value={p.width} min={0} max={1} color="#a78bfa" onChange={v => onUpdate(index, { params:{...p,width:v} })} />
        </div>
      )
      case 'deesser': return (
        <div style={{ display:'flex', gap:8 }}>
          <Knob label="Freq"  value={p.frequency} min={2000} max={16000} step={100} unit=" Hz" color="#84cc16" onChange={v => onUpdate(index, { params:{...p,frequency:v} })} />
          <Knob label="Thresh" value={p.threshold} min={-40} max={0} step={0.5} unit=" dB" color="#10b981" onChange={v => onUpdate(index, { params:{...p,threshold:v} })} />
        </div>
      )
      case 'phaser': return (
        <div style={{ display:'flex', gap:8 }}>
          <Knob label="Rate"   value={p.rate} min={0.1} max={10} unit=" Hz" color="#22d3ee" onChange={v => onUpdate(index, { params:{...p,rate:v} })} />
          <Knob label="Stages" value={p.stages||4} min={2} max={12} step={2} color="#06b6d4" onChange={v => onUpdate(index, { params:{...p,stages:v} })} />
          <Knob label="Wet"    value={p.wet} min={0} max={1} color="#8b5cf6" onChange={v => onUpdate(index, { params:{...p,wet:v} })} />
        </div>
      )
      default: return (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {Object.entries(p).filter(([,v]) => typeof v === 'number').map(([key,val]) => (
            <Knob key={key} label={key} value={val} min={0} max={1} color={def?.color||'#888'} onChange={v => onUpdate(index, { params:{...p,[key]:v} })} />
          ))}
        </div>
      )
    }
  }

  return (
    <div
      {...dragHandlers}
      style={{ background:'#111', border:`1px solid ${effect.enabled ? `${def?.color||'#333'}44` : '#1a1a1a'}`, borderRadius:8, overflow:'hidden', opacity:effect.enabled?1:0.5, cursor:'default', outline: isHovered ? `2px solid ${def?.color||'#3b82f6'}44` : 'none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', background:'#0d0d0d', cursor:'grab' }}
        onClick={() => setExpanded(v => !v)}>
        <span style={{ fontSize:6, color:'#333', cursor:'grab' }}>⣿</span>
        <span style={{ fontSize:15 }}>{def?.icon||'🔧'}</span>
        <span style={{ flex:1, fontSize:12, fontWeight:600, color:effect.enabled?'#ddd':'#555' }}>{effect.name}</span>
        <span style={{ fontSize:8, color:'#333', padding:'1px 5px', background:'#1a1a1a', borderRadius:3 }}>{index+1}/{total}</span>
        <button onClick={e => { e.stopPropagation(); onToggle(index) }}
          style={{ padding:'2px 8px', background:effect.enabled?`${def?.color||'#3b82f6'}22`:'transparent', border:`1px solid ${effect.enabled?`${def?.color||'#3b82f6'}55`:'#2a2a2a'}`, borderRadius:4, cursor:'pointer', fontSize:9, fontWeight:700, color:effect.enabled?(def?.color||'#3b82f6'):'#444' }}>
          {effect.enabled ? 'ON' : 'OFF'}
        </button>
        <button onClick={e => { e.stopPropagation(); onRemove(index) }} style={{ background:'none', border:'none', color:'#ef444466', cursor:'pointer', fontSize:11 }}>✕</button>
        <span style={{ fontSize:9, color:'#444' }}>{expanded?'▲':'▼'}</span>
      </div>
      {expanded && <div style={{ padding:'12px 14px', borderTop:'1px solid #1a1a1a' }}>{renderParams()}</div>}
    </div>
  )
}

export default function EffectsRack() {
  const [chain, setChain] = useState([
    { type:'eq',           name:'Parametric EQ', enabled:true, params:DEFAULT_PARAMS.eq },
    { type:'compressor',   name:'Compressor',    enabled:true, params:DEFAULT_PARAMS.compressor },
    { type:'reverb',       name:'Reverb',         enabled:true, params:DEFAULT_PARAMS.reverb },
  ])
  const [inputLevel, setInputLevel] = useState(0.7)
  const [outputLevel, setOutputLevel] = useState(0.8)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [savedPresets, setSavedPresets] = useState({})
  const [presetName, setPresetName] = useState('')
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [testSource, setTestSource] = useState('sine')  // sine|noise|sawtooth

  // ── Drag-to-reorder state ─────────────────────────────────────────────────
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  // ── Tone.js real audio chain ──────────────────────────────────────────────
  const toneNodesRef = useRef([])   // array of Tone effects matching chain
  const sourceRef    = useRef(null)
  const inputGainRef = useRef(null)
  const outGainRef   = useRef(null)
  const meterRef     = useRef(null)
  const [vuLevel, setVuLevel] = useState(0)

  // Build / rebuild the Tone chain whenever chain or enabled changes
  const buildChain = useCallback(async () => {
    if (!audioPlaying) return
    await Tone.start()
    // Dispose old nodes
    toneNodesRef.current.forEach(n => { try { n.dispose() } catch {} })
    toneNodesRef.current = []

    const inGain = inputGainRef.current || new Tone.Gain(inputLevel).toDestination()
    const outGain = outGainRef.current || new Tone.Gain(outputLevel)
    inputGainRef.current = inGain; outGainRef.current = outGain

    // Create effect nodes for enabled effects only
    const nodes = chain.map(e => e.enabled ? createToneEffect(e.type, e.params) : new Tone.Gain(1))
    toneNodesRef.current = nodes

    // Connect: source → inGain → nodes[0] → ... → nodes[n-1] → outGain → meter → destination
    let prev = inGain
    nodes.forEach(n => { prev.connect(n); prev = n })
    const meter = new Tone.Meter()
    meterRef.current = meter
    prev.connect(outGain); outGain.connect(meter); outGain.connect(Tone.getDestination())

    // VU metering
    const vu = setInterval(() => {
      if (meterRef.current) {
        const db = meterRef.current.getValue()
        const linear = typeof db === 'number' ? Math.pow(10, db / 20) : 0
        setVuLevel(Math.min(1, Math.max(0, linear * 2)))
      }
    }, 60)
    return () => clearInterval(vu)
  }, [audioPlaying, chain, inputLevel, outputLevel])

  useEffect(() => {
    let cleanup
    buildChain().then(fn => { cleanup = fn })
    return () => { if (cleanup) cleanup() }
  }, [buildChain])

  // Update Tone nodes when params change (without full rebuild)
  useEffect(() => {
    chain.forEach((e, i) => {
      const node = toneNodesRef.current[i]
      if (node && e.enabled) updateToneEffect(node, e.type, e.params)
    })
  }, [chain])

  const toggleAudio = async () => {
    if (audioPlaying) {
      sourceRef.current?.stop(); sourceRef.current?.dispose(); sourceRef.current = null
      toneNodesRef.current.forEach(n => { try { n.dispose() } catch {} }); toneNodesRef.current = []
      setAudioPlaying(false); setVuLevel(0)
    } else {
      await Tone.start()
      const inGain = new Tone.Gain(inputLevel); inputGainRef.current = inGain
      let src
      if (testSource === 'noise') {
        src = new Tone.Noise('pink').connect(inGain); src.start()
      } else {
        src = new Tone.Oscillator({ type: testSource === 'sawtooth' ? 'sawtooth' : 'sine', frequency: 440 }).connect(inGain); src.start()
      }
      sourceRef.current = src; setAudioPlaying(true)
    }
  }

  // Drag reorder handlers
  const handleDragStart = (i) => setDragIdx(i)
  const handleDragOver = (e, i) => { e.preventDefault(); setDragOverIdx(i) }
  const handleDrop = (i) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOverIdx(null); return }
    setChain(prev => {
      const n = [...prev]; const [moved] = n.splice(dragIdx, 1); n.splice(i, 0, moved); return n
    })
    setDragIdx(null); setDragOverIdx(null)
  }

  const updateEffect = (i, changes) => setChain(prev => prev.map((e, j) => j === i ? { ...e, ...changes } : e))
  const toggleEffect = (i) => setChain(prev => prev.map((e, j) => j === i ? { ...e, enabled:!e.enabled } : e))
  const removeEffect = (i) => setChain(prev => prev.filter((_, j) => j !== i))
  const addEffect = (type) => { const def = EFFECT_DEFS.find(d => d.type === type); setChain(prev => [...prev, { type, name:def.name, enabled:true, params:{ ...DEFAULT_PARAMS[type] } }]); setShowAddMenu(false) }
  const loadPreset = (name) => { const preset = PRESETS[name]; if (preset) setChain(preset.map(e => ({ ...e, name: EFFECT_DEFS.find(d=>d.type===e.type)?.name||e.type, enabled:true }))) }
  const savePreset = () => { if (!presetName.trim()) return; setSavedPresets(prev => ({ ...prev, [presetName]:chain })); setPresetName('') }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:'#111', borderBottom:'1px solid #1f1f1f', flexShrink:0, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#555' }}>EFFECTS RACK</span>
        <div style={{ width:1, height:16, background:'#333' }} />
        <button onClick={() => setShowAddMenu(v => !v)} style={tBtn('#22c55e')}>+ Add Effect</button>
        <div style={{ width:1, height:16, background:'#333' }} />
        {Object.keys(PRESETS).map(p => <button key={p} onClick={() => loadPreset(p)} style={tBtn('#8b5cf6')}>{p}</button>)}
        <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
          <input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Preset name..."
            style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', color:'#aaa', borderRadius:5, padding:'3px 8px', fontSize:11, width:100, outline:'none' }} />
          <button onClick={savePreset} style={tBtn('#f59e0b')}>Save</button>
        </div>
      </div>

      {/* Add effect menu */}
      {showAddMenu && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, padding:'8px 12px', background:'#0d0d0d', borderBottom:'1px solid #1f1f1f' }}>
          {EFFECT_DEFS.map(e => (
            <button key={e.type} onClick={() => addEffect(e.type)}
              style={{ padding:'5px 10px', background:`${e.color}15`, border:`1px solid ${e.color}33`, borderRadius:7, color:e.color, cursor:'pointer', fontSize:11, display:'flex', gap:4, alignItems:'center' }}>
              {e.icon} {e.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Chain */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 14px', display:'flex', flexDirection:'column', gap:6 }}>
          {/* Test audio signal */}
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'#0d0d0d', border:'1px solid #1a1a1a', borderRadius:6 }}>
            <span style={{ fontSize:10, color:'#22c55e', fontWeight:700, minWidth:50 }}>INPUT</span>
            <select value={testSource} onChange={e => setTestSource(e.target.value)} style={{ ...sel, padding:'2px 6px', fontSize:10 }}>
              {[['sine','Sine 440Hz'],['noise','Pink Noise'],['sawtooth','Sawtooth']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={toggleAudio}
              style={{ padding:'3px 10px', background:audioPlaying?'#ef444422':'#22c55e22', border:`1px solid ${audioPlaying?'#ef4444':'#22c55e'}55`, borderRadius:5, color:audioPlaying?'#ef4444':'#22c55e', cursor:'pointer', fontSize:10, fontWeight:700 }}>
              {audioPlaying ? '■ Stop' : '▶ Play'}
            </button>
            <input type="range" min="0" max="1" step="0.01" value={inputLevel} onChange={e => { setInputLevel(+e.target.value); if (inputGainRef.current) inputGainRef.current.gain.value = +e.target.value }} style={{ flex:1 }} />
            <div style={{ display:'flex', gap:1, width:60 }}>
              {Array.from({length:10}, (_,i) => <div key={i} style={{ flex:1, height:12, background:i/10 < vuLevel ? (i > 7 ? '#ef4444' : i > 5 ? '#f59e0b' : '#22c55e') : '#1a1a1a', borderRadius:1 }} />)}
            </div>
          </div>

          {chain.length === 0 && <div style={{ textAlign:'center', padding:'32px', color:'#333', fontSize:13 }}>No effects. Click "+ Add Effect" to start.</div>}

          {chain.map((effect, i) => (
            <React.Fragment key={`${effect.type}_${i}`}>
              <div style={{ textAlign:'center', fontSize:11, color:'#222' }}>↓</div>
              <EffectPlugin
                effect={effect} index={i} total={chain.length}
                onUpdate={updateEffect} onToggle={toggleEffect} onRemove={removeEffect}
                isHovered={dragOverIdx === i}
                dragHandlers={{
                  draggable: true,
                  onDragStart: () => handleDragStart(i),
                  onDragOver: (e) => handleDragOver(e, i),
                  onDrop: () => handleDrop(i),
                  onDragEnd: () => { setDragIdx(null); setDragOverIdx(null) }
                }}
              />
            </React.Fragment>
          ))}

          <div style={{ textAlign:'center', fontSize:11, color:'#222', marginTop:4 }}>↓</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'#0d0d0d', border:'1px solid #1a1a1a', borderRadius:6 }}>
            <span style={{ fontSize:10, color:'#3b82f6', fontWeight:700, minWidth:50 }}>OUTPUT</span>
            <input type="range" min="0" max="1" step="0.01" value={outputLevel} onChange={e => { setOutputLevel(+e.target.value); if (outGainRef.current) outGainRef.current.gain.value = +e.target.value }} style={{ flex:1 }} />
            <span style={{ fontSize:10, color:'#555', minWidth:28 }}>{Math.round(outputLevel*100)}%</span>
            {audioPlaying && <span style={{ fontSize:9, color:'#22c55e', marginLeft:4 }}>🔊 Live</span>}
          </div>
        </div>

        {/* Saved presets */}
        {Object.keys(savedPresets).length > 0 && (
          <div style={{ width:150, flexShrink:0, background:'#0e0e0e', borderLeft:'1px solid #1a1a1a', padding:8 }}>
            <div style={{ fontSize:9, color:'#333', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>My Presets</div>
            {Object.keys(savedPresets).map(name => (
              <button key={name} onClick={() => setChain(savedPresets[name])}
                style={{ display:'block', width:'100%', padding:'5px 8px', background:'transparent', border:'1px solid #1f1f1f', borderRadius:5, color:'#666', cursor:'pointer', fontSize:11, textAlign:'left', marginBottom:3 }}>
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding:'3px 12px', background:'#080808', borderTop:'1px solid #141414', fontSize:8, color:'#2a2a2a', display:'flex', gap:12 }}>
        <span>▶ Play: hear real audio through chain</span>
        <span>Drag ⣿ handle to reorder</span>
        <span>ON/OFF: bypass effect</span>
        <span>Presets: save/load full chains</span>
      </div>
    </div>
  )
}

const tBtn = (color) => ({ padding:'3px 9px', background:`${color}18`, border:`1px solid ${color}44`, borderRadius:5, color, cursor:'pointer', fontSize:10, fontWeight:600 })
const sel  = { background:'#1a1a1a', border:'1px solid #2a2a2a', color:'#aaa', borderRadius:5, padding:'3px 6px', fontSize:11 }
