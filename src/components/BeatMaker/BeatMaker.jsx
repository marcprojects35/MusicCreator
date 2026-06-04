import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { beatMakerActions, playbackActions } from '../../store'
import * as Tone from 'tone'

const COLORS = { kick:'#ef4444', snare:'#f97316', hihat:'#eab308', clap:'#22c55e', openhat:'#3b82f6', perc:'#a855f7' }
const PRESET_PATTERNS = {
  'Trap Basic':  { kick: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
  'Boom Bap':    { kick: [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
  'House Basic': { kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0] },
  'Drill':       { kick: [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0], snare:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0], hihat:[1,1,0,1,1,0,1,0,1,1,0,1,1,0,1,0] }
}

export default function BeatMaker() {
  const dispatch = useDispatch()
  const rows = useSelector(s => s.beatMaker.rows)
  const steps = useSelector(s => s.beatMaker.steps)
  const swing = useSelector(s => s.beatMaker.swing)
  const playing = useSelector(s => s.playback.playing)
  const bpm = useSelector(s => s.project.bpm)

  const [currentStep, setCurrentStep] = useState(-1)
  const [selectedRow, setSelectedRow] = useState(null)
  const [showPresets, setShowPresets] = useState(false)
  const sequencerRef = useRef(null)
  const playersRef = useRef({})

  useEffect(() => {
    rows.forEach(row => {
      if (!playersRef.current[row.id] && row.sample) {
        const synth = createSynthForRow(row.id)
        playersRef.current[row.id] = synth
      }
    })
  }, [rows])

  const createSynthForRow = (id) => {
    const map = {
      kick: new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 } }).toDestination(),
      snare: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 } }).toDestination(),
      hihat: new Tone.MetalSynth({ frequency: 400, envelope: { attack: 0.001, decay: 0.08, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination(),
      clap: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 } }).toDestination(),
      openhat: new Tone.MetalSynth({ frequency: 400, envelope: { attack: 0.001, decay: 0.4, release: 0.1 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination(),
      perc: new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 4, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 } }).toDestination()
    }
    return map[id] || map.perc
  }

  useEffect(() => {
    if (playing) {
      Tone.Transport.bpm.value = bpm
      let step = 0
      sequencerRef.current = new Tone.Sequence((time) => {
        const s = step % steps
        setCurrentStep(s)
        rows.forEach(row => {
          if (row.steps[s]) {
            const player = playersRef.current[row.id]
            if (!player) return
            try {
              if (player instanceof Tone.MembraneSynth) player.triggerAttackRelease(row.id === 'perc' ? 'C2' : 'C1', '8n', time, row.volume)
              else if (player instanceof Tone.NoiseSynth) player.triggerAttackRelease('8n', time, row.volume)
              else if (player instanceof Tone.MetalSynth) player.triggerAttackRelease('8n', time, row.volume)
            } catch (e) {}
          }
        })
        step++
      }, null, '16n')
      sequencerRef.current.start(0)
      Tone.Transport.start()
    } else {
      sequencerRef.current?.dispose()
      setCurrentStep(-1)
    }
  }, [playing, rows, steps, bpm])

  const applyPreset = (name) => {
    const preset = PRESET_PATTERNS[name]
    if (!preset) return
    rows.forEach(row => {
      if (preset[row.id]) {
        preset[row.id].forEach((val, i) => {
          if (val !== (row.steps[i] ? 1 : 0)) dispatch(beatMakerActions.toggleStep({ rowId: row.id, step: i }))
        })
      }
    })
    setShowPresets(false)
  }

  return (
    <div style={{ background: '#111', borderRadius: 12, padding: 20, color: '#fff', userSelect: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>🥁 Beat Maker</h2>

        <button onClick={() => dispatch(playbackActions.play())} disabled={playing}
          style={{ padding: '8px 16px', background: playing ? '#333' : '#22c55e', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          {playing ? '⏸ Playing' : '▶ Play'}
        </button>
        <button onClick={() => dispatch(playbackActions.stop())}
          style={{ padding: '8px 16px', background: '#333', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
          ⏹ Stop
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#888' }}>BPM</span>
          <input type="number" min="20" max="999" value={bpm}
            onChange={e => dispatch({ type: 'project/setBpm', payload: +e.target.value })}
            style={{ width: 60, background: '#222', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 14 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#888' }}>Steps</span>
          {[8, 16, 32].map(s => (
            <button key={s} onClick={() => dispatch(beatMakerActions.setSteps(s))}
              style={{ padding: '4px 10px', background: steps === s ? '#3b82f6' : '#222', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 }}>
              {s}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#888' }}>Swing</span>
          <input type="range" min="0" max="0.5" step="0.01" value={swing}
            onChange={e => dispatch(beatMakerActions.setSwing(+e.target.value))}
            style={{ width: 80 }} />
          <span style={{ fontSize: 12, color: '#aaa', minWidth: 30 }}>{Math.round(swing * 100)}%</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowPresets(!showPresets)}
              style={{ padding: '6px 12px', background: '#222', border: '1px solid #333', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13 }}>
              📋 Presets
            </button>
            {showPresets && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: 8, zIndex: 100, minWidth: 140 }}>
                {Object.keys(PRESET_PATTERNS).map(name => (
                  <div key={name} onClick={() => applyPreset(name)}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 6, fontSize: 13 }}
                    onMouseEnter={e => e.target.style.background = '#333'}
                    onMouseLeave={e => e.target.style.background = 'transparent'}>
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => dispatch(beatMakerActions.randomizePattern())}
            style={{ padding: '6px 12px', background: '#222', border: '1px solid #333', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13 }}>
            🎲 Random
          </button>
          <button onClick={() => dispatch(beatMakerActions.clearPattern())}
            style={{ padding: '6px 12px', background: '#222', border: '1px solid #444', borderRadius: 8, color: '#f87171', cursor: 'pointer', fontSize: 13 }}>
            🗑 Clear
          </button>
        </div>
      </div>

      {/* Step Grid */}
      <div style={{ overflowX: 'auto' }}>
        {rows.map(row => (
          <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {/* Row header */}
            <div style={{ width: 90, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: COLORS[row.id] || '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.name}
              </span>
              <input type="range" min="0" max="1" step="0.01" value={row.volume}
                onChange={e => dispatch(beatMakerActions.setRowVolume({ rowId: row.id, volume: +e.target.value }))}
                style={{ width: '100%', height: 4 }} />
            </div>

            {/* Steps */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps}, 1fr)`, gap: 3, flex: 1 }}>
              {row.steps.map((active, i) => {
                const isBar = i % 4 === 0
                const isCurrent = i === currentStep && playing
                return (
                  <div key={i}
                    onClick={() => dispatch(beatMakerActions.toggleStep({ rowId: row.id, step: i }))}
                    style={{
                      height: 36, borderRadius: 4, cursor: 'pointer', transition: 'all 0.05s',
                      background: isCurrent ? '#fff' : active ? (COLORS[row.id] || '#3b82f6') : isBar ? '#2a2a2a' : '#1a1a1a',
                      border: `1px solid ${active ? 'transparent' : isBar ? '#444' : '#333'}`,
                      transform: isCurrent ? 'scaleY(0.9)' : 'scaleY(1)',
                      opacity: active ? 1 : 0.7
                    }}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Add Row */}
      <button onClick={() => dispatch(beatMakerActions.addRow({ name: `Track ${rows.length + 1}` }))}
        style={{ marginTop: 12, padding: '8px 16px', background: '#1a1a1a', border: '1px dashed #444', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>
        + Add Track
      </button>
    </div>
  )
}
