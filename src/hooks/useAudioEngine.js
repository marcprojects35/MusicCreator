import { useEffect, useRef, useCallback } from 'react'
import * as Tone from 'tone'
import { useDispatch, useSelector } from 'react-redux'
import { playbackActions, beatMakerActions } from '../store'

export const useAudioEngine = () => {
  const dispatch = useDispatch()
  const { playing, bpm, metronome } = useSelector(s => ({ ...s.playback, bpm: s.project.bpm }))
  const beatRows = useSelector(s => s.beatMaker.rows)
  const steps = useSelector(s => s.beatMaker.steps)
  const swing = useSelector(s => s.beatMaker.swing)

  const sequencerRef = useRef(null)
  const metronomeRef = useRef(null)
  const samplesRef = useRef({})
  const currentStepRef = useRef(0)
  const masterVolRef = useRef(null)
  const limiterRef = useRef(null)

  useEffect(() => {
    masterVolRef.current = new Tone.Volume(-6).toDestination()
    limiterRef.current = new Tone.Limiter(-3).connect(masterVolRef.current)
    Tone.getDestination().chain(limiterRef.current)
    return () => { Tone.Transport.stop(); Tone.Transport.cancel() }
  }, [])

  useEffect(() => { Tone.Transport.bpm.value = bpm }, [bpm])

  const loadSample = useCallback(async (id, url) => {
    if (samplesRef.current[id]) return
    try {
      const player = new Tone.Player(url).connect(masterVolRef.current || Tone.getDestination())
      await Tone.loaded()
      samplesRef.current[id] = player
    } catch (e) { console.warn('Sample load failed:', url) }
  }, [])

  const startSequencer = useCallback(() => {
    if (sequencerRef.current) { sequencerRef.current.dispose() }

    const stepTime = '16n'
    let step = 0

    sequencerRef.current = new Tone.Sequence((time) => {
      const currentStep = step % steps
      beatRows.forEach(row => {
        if (row.steps[currentStep]) {
          const player = samplesRef.current[row.id]
          if (player) {
            player.volume.value = Tone.gainToDb(row.volume)
            player.start(time)
          }
        }
      })
      dispatch({ type: 'beatMaker/setCurrentStep', payload: currentStep })
      step++
    }, null, stepTime)

    if (swing > 0) { Tone.Transport.swingSubdivision = '16n'; Tone.Transport.swing = swing }
    sequencerRef.current.start(0)
  }, [beatRows, steps, swing, dispatch])

  const startMetronome = useCallback(() => {
    if (metronomeRef.current) { metronomeRef.current.dispose() }
    const click = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 } }).toDestination()
    metronomeRef.current = new Tone.Sequence((time, beat) => {
      click.triggerAttackRelease(beat === 0 ? 'C5' : 'G4', '16n', time, beat === 0 ? 0.8 : 0.4)
    }, [0, 1, 2, 3], '4n')
    metronomeRef.current.start(0)
  }, [])

  useEffect(() => {
    if (playing) {
      Tone.start()
      startSequencer()
      if (metronome) startMetronome()
      Tone.Transport.start()
    } else {
      Tone.Transport.stop()
      sequencerRef.current?.stop()
      metronomeRef.current?.stop()
    }
  }, [playing, startSequencer, startMetronome, metronome])

  return { loadSample, samplesRef }
}

// ─── VOICE RECORDING ENGINE ────────────────────────────────────────────────────
export const useVoiceRecorder = () => {
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)

  const startRecording = useCallback(async (onLevel) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false, sampleRate: 44100 }
    })
    streamRef.current = stream
    chunksRef.current = []

    audioContextRef.current = new AudioContext({ sampleRate: 44100 })
    const source = audioContextRef.current.createMediaStreamSource(stream)
    analyserRef.current = audioContextRef.current.createAnalyser()
    analyserRef.current.fftSize = 256
    source.connect(analyserRef.current)

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mediaRecorderRef.current.start(100)

    const updateLevel = () => {
      if (!analyserRef.current) return
      const data = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteTimeDomainData(data)
      const rms = Math.sqrt(data.reduce((s, v) => s + ((v - 128) / 128) ** 2, 0) / data.length)
      onLevel?.(Math.min(1, rms * 3))
      rafRef.current = requestAnimationFrame(updateLevel)
    }
    updateLevel()
  }, [])

  const stopRecording = useCallback(() => new Promise((resolve) => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (!mediaRecorderRef.current) return resolve(null)
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const url = URL.createObjectURL(blob)
      resolve({ blob, url, duration: audioContextRef.current?.currentTime || 0 })
    }
    mediaRecorderRef.current.stop()
    audioContextRef.current?.close()
  }), [])

  return { startRecording, stopRecording }
}

// ─── AUDIO EFFECTS ENGINE ─────────────────────────────────────────────────────
export const createEffectChain = (effects) => {
  const nodes = []
  const chain = []

  if (effects.eq?.enabled) {
    const eq = new Tone.EQ3({ low: effects.eq.low, mid: effects.eq.mid, high: effects.eq.high })
    nodes.push(eq); chain.push(eq)
  }
  if (effects.compressor?.enabled) {
    const comp = new Tone.Compressor({ threshold: effects.compressor.threshold, ratio: effects.compressor.ratio, attack: effects.compressor.attack / 1000, release: effects.compressor.release / 1000 })
    nodes.push(comp); chain.push(comp)
  }
  if (effects.reverb?.enabled) {
    const reverb = new Tone.Reverb({ decay: effects.reverb.size * 5, wet: effects.reverb.wetDry })
    nodes.push(reverb); chain.push(reverb)
  }
  if (effects.delay?.enabled) {
    const delay = new Tone.FeedbackDelay({ delayTime: effects.delay.time / 1000, feedback: effects.delay.feedback, wet: effects.delay.wetDry })
    nodes.push(delay); chain.push(delay)
  }
  if (effects.chorus?.enabled) {
    const chorus = new Tone.Chorus({ frequency: effects.chorus.rate, depth: effects.chorus.depth, wet: effects.chorus.wetDry })
    nodes.push(chorus); chain.push(chorus)
  }
  if (effects.distortion?.enabled) {
    const dist = new Tone.Distortion({ distortion: effects.distortion.amount })
    nodes.push(dist); chain.push(dist)
  }
  if (effects.pitchShift?.enabled) {
    const pitch = new Tone.PitchShift({ pitch: effects.pitchShift.semitones })
    nodes.push(pitch); chain.push(pitch)
  }

  return { nodes, chain }
}

// ─── MIDI ENGINE ──────────────────────────────────────────────────────────────
export const useMidiInput = (onNote) => {
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return
    let midiAccess = null

    navigator.requestMIDIAccess({ sysex: false }).then(access => {
      midiAccess = access
      const setupInputs = () => {
        access.inputs.forEach(input => {
          input.onmidimessage = (msg) => {
            const [status, note, velocity] = msg.data
            const type = status & 0xf0
            const channel = status & 0x0f
            if (type === 0x90 && velocity > 0) onNote?.({ type: 'noteOn', note, velocity, channel })
            else if (type === 0x80 || (type === 0x90 && velocity === 0)) onNote?.({ type: 'noteOff', note, channel })
            else if (type === 0xb0) onNote?.({ type: 'cc', controller: note, value: velocity, channel })
            else if (type === 0xe0) onNote?.({ type: 'pitchBend', value: (velocity << 7 | note) - 8192, channel })
          }
        })
      }
      setupInputs()
      access.onstatechange = setupInputs
    }).catch(() => console.warn('MIDI not available'))

    return () => { if (midiAccess) midiAccess.inputs.forEach(i => { i.onmidimessage = null }) }
  }, [onNote])
}
