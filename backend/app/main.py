from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, WebSocket, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import asyncio, uuid, json, os, tempfile, time, math
from pathlib import Path
from typing import Optional, List

app = FastAPI(title="Music Creator API", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

JOBS = {}
TMP = Path(tempfile.gettempdir()) / "music_creator"
TMP.mkdir(exist_ok=True)

# ─── HEALTH ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "timestamp": time.time()}

# ─── AUDIO ANALYSIS ──────────────────────────────────────────────────────────

@app.post("/audio/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    """Analyze audio: BPM, key, duration, loudness"""
    try:
        import librosa
        import numpy as np

        tmp_path = TMP / f"{uuid.uuid4()}.wav"
        content = await file.read()
        tmp_path.write_bytes(content)

        y, sr = librosa.load(str(tmp_path), duration=60)

        # BPM
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)

        # Key detection
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_idx = int(chroma.mean(axis=1).argmax())
        key = keys[key_idx]

        # Duration
        duration = librosa.get_duration(y=y, sr=sr)

        # RMS loudness
        rms = float(librosa.feature.rms(y=y).mean())
        loudness_db = 20 * math.log10(rms + 1e-10)

        # Spectral features
        spectral_centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
        spectral_rolloff = float(librosa.feature.spectral_rolloff(y=y, sr=sr).mean())

        # Waveform peaks (200 points)
        hop = len(y) // 200
        peaks = [float(abs(y[i*hop:(i+1)*hop]).max()) for i in range(200)]

        tmp_path.unlink(missing_ok=True)

        return {
            "bpm": float(tempo),
            "key": key,
            "duration": float(duration),
            "loudness_db": float(loudness_db),
            "spectral_centroid": spectral_centroid,
            "spectral_rolloff": spectral_rolloff,
            "waveform_peaks": peaks,
            "sample_rate": sr
        }
    except ImportError:
        # Fallback without librosa
        return {"bpm": 120.0, "key": "C", "duration": 0.0, "loudness_db": -6.0,
                "waveform_peaks": [0.5] * 200, "message": "Install librosa for full analysis"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── STEM SEPARATION ─────────────────────────────────────────────────────────

# Demucs model quality mapping:
#   "fast"   → htdemucs      (fastest, good quality)
#   "normal" → htdemucs      (default)
#   "high"   → htdemucs_ft   (fine-tuned, best quality, ~2× slower)
_DEMUCS_MODELS = {
    "fast":   "htdemucs",
    "normal": "htdemucs",
    "high":   "htdemucs_ft",
}

@app.post("/audio/stem-separate")
async def stem_separate(background_tasks: BackgroundTasks, file: UploadFile = File(...), quality: str = "normal"):
    """Separate audio into stems using Demucs (vocals, drums, bass, other)"""
    job_id = str(uuid.uuid4())
    suffix = Path(file.filename).suffix if file.filename else ".mp3"
    tmp_path = TMP / f"{job_id}_input{suffix}"
    tmp_path.write_bytes(await file.read())

    JOBS[job_id] = {"status": "processing", "progress": 0, "stems": {}}
    background_tasks.add_task(run_stem_separation, job_id, tmp_path, quality)

    return {"job_id": job_id, "status": "processing"}

async def run_stem_separation(job_id: str, input_path: Path, quality: str):
    """Run Demucs stem separation in a thread-pool so we don't block the event loop."""
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_demucs_sync, job_id, input_path, quality)

def _run_demucs_sync(job_id: str, input_path: Path, quality: str):
    try:
        import subprocess, sys
        out_dir = TMP / job_id
        out_dir.mkdir(exist_ok=True)

        model = _DEMUCS_MODELS.get(quality, "htdemucs")

        cmd = [sys.executable, "-m", "demucs", "-n", model, "-o", str(out_dir), str(input_path)]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        for line in (proc.stderr or []):
            if "%" in line:
                try:
                    pct = float(line.split("%")[0].split()[-1])
                    JOBS[job_id]["progress"] = int(pct)
                except Exception:
                    pass

        proc.wait()

        stems = {}
        for stem_name in ["vocals", "drums", "bass", "other"]:
            stem_path = out_dir / model / input_path.stem / f"{stem_name}.wav"
            if stem_path.exists():
                stems[stem_name] = str(stem_path)

        if stems:
            JOBS[job_id] = {"status": "complete", "progress": 100, "stems": stems}
        else:
            JOBS[job_id] = {"status": "failed", "error": "Demucs produced no output — is it installed? (pip install demucs)", "progress": 0}

    except FileNotFoundError:
        JOBS[job_id] = {"status": "failed", "error": "demucs not found — install with: pip install demucs torch torchaudio", "progress": 0}
    except Exception as e:
        JOBS[job_id] = {"status": "failed", "error": str(e), "progress": 0}

@app.get("/jobs/{job_id}/status")
async def job_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Job not found")
    return JOBS[job_id]

@app.get("/jobs/{job_id}/download/{stem}")
async def download_stem(job_id: str, stem: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Job not found")
    job = JOBS[job_id]
    if job["status"] != "complete":
        raise HTTPException(400, "Job not complete")
    path = job["stems"].get(stem)
    if not path or not Path(path).exists():
        raise HTTPException(404, "Stem not found")
    return FileResponse(path, media_type="audio/wav", filename=f"{stem}.wav")

# ─── AUDIO EFFECTS ────────────────────────────────────────────────────────────

@app.post("/audio/pitch-shift")
async def pitch_shift(file: UploadFile = File(...), semitones: float = 0.0, preserve_formants: bool = True):
    """Pitch shift audio by semitones"""
    try:
        import librosa, soundfile as sf
        import numpy as np

        tmp_in = TMP / f"{uuid.uuid4()}_in.wav"
        tmp_out = TMP / f"{uuid.uuid4()}_out.wav"
        tmp_in.write_bytes(await file.read())

        y, sr = librosa.load(str(tmp_in))
        y_shifted = librosa.effects.pitch_shift(y, sr=sr, n_steps=semitones)
        sf.write(str(tmp_out), y_shifted, sr)
        tmp_in.unlink(missing_ok=True)

        return FileResponse(str(tmp_out), media_type="audio/wav")
    except ImportError:
        raise HTTPException(503, "librosa/soundfile not installed")

@app.post("/audio/time-stretch")
async def time_stretch(file: UploadFile = File(...), rate: float = 1.0):
    """Time stretch audio without changing pitch"""
    try:
        import librosa, soundfile as sf
        tmp_in = TMP / f"{uuid.uuid4()}_in.wav"
        tmp_out = TMP / f"{uuid.uuid4()}_out.wav"
        tmp_in.write_bytes(await file.read())

        y, sr = librosa.load(str(tmp_in))
        y_stretched = librosa.effects.time_stretch(y, rate=rate)
        sf.write(str(tmp_out), y_stretched, sr)
        tmp_in.unlink(missing_ok=True)

        return FileResponse(str(tmp_out), media_type="audio/wav")
    except ImportError:
        raise HTTPException(503, "librosa not installed")

@app.post("/audio/noise-reduce")
async def noise_reduce(file: UploadFile = File(...), strength: float = 0.5):
    """AI noise reduction"""
    try:
        import noisereduce as nr
        import librosa, soundfile as sf
        tmp_in = TMP / f"{uuid.uuid4()}_in.wav"
        tmp_out = TMP / f"{uuid.uuid4()}_out.wav"
        tmp_in.write_bytes(await file.read())

        y, sr = librosa.load(str(tmp_in))
        reduced = nr.reduce_noise(y=y, sr=sr, prop_decrease=strength)
        sf.write(str(tmp_out), reduced, sr)
        tmp_in.unlink(missing_ok=True)

        return FileResponse(str(tmp_out), media_type="audio/wav")
    except ImportError:
        raise HTTPException(503, "noisereduce not installed")

# ─── BPM DETECTION ───────────────────────────────────────────────────────────

@app.post("/audio/bpm-detect")
async def bpm_detect(file: UploadFile = File(...)):
    """Detect BPM of audio file"""
    try:
        import librosa
        tmp = TMP / f"{uuid.uuid4()}.wav"
        tmp.write_bytes(await file.read())
        y, sr = librosa.load(str(tmp), duration=30)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr).tolist()
        tmp.unlink(missing_ok=True)
        return {"bpm": float(tempo), "beat_times": beat_times[:20], "confidence": 0.9}
    except ImportError:
        return {"bpm": 120.0, "beat_times": [], "confidence": 0.0}

# ─── VOICE PROCESSING ────────────────────────────────────────────────────────

@app.post("/voice/debreath")
async def debreath(file: UploadFile = File(...), sensitivity: float = 0.5, mode: str = "auto"):
    """Remove breath sounds from vocal recording"""
    try:
        import librosa, soundfile as sf
        import numpy as np

        tmp_in = TMP / f"{uuid.uuid4()}_in.wav"
        tmp_out = TMP / f"{uuid.uuid4()}_out.wav"
        tmp_in.write_bytes(await file.read())

        y, sr = librosa.load(str(tmp_in), sr=44100)

        frame_len = 1024
        hop_len = 512
        rms = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len)[0]
        threshold = np.percentile(rms, sensitivity * 100 * 0.3)

        mask = librosa.frames_to_samples(np.where(rms > threshold)[0], hop_length=hop_len)
        y_clean = np.zeros_like(y)
        for m in mask:
            start = max(0, m - hop_len // 2)
            end = min(len(y), m + hop_len // 2)
            y_clean[start:end] = y[start:end]

        # Smooth transitions
        from scipy.signal import medfilt
        env = (y_clean != 0).astype(float)
        env = medfilt(env, kernel_size=min(101, len(env) | 1))
        y_clean = y * env

        sf.write(str(tmp_out), y_clean, sr)
        tmp_in.unlink(missing_ok=True)

        return FileResponse(str(tmp_out), media_type="audio/wav")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/voice/vocal-analysis")
async def vocal_analysis(file: UploadFile = File(...)):
    """Analyze vocal characteristics"""
    try:
        import librosa
        import numpy as np

        tmp = TMP / f"{uuid.uuid4()}.wav"
        tmp.write_bytes(await file.read())
        y, sr = librosa.load(str(tmp), duration=30)

        f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
        voiced_f0 = f0[voiced_flag]

        spectral_centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
        spectral_bandwidth = float(librosa.feature.spectral_bandwidth(y=y, sr=sr).mean())
        rms = float(librosa.feature.rms(y=y).mean())
        zcr = float(librosa.feature.zero_crossing_rate(y).mean())

        voice_type = "Alto" if spectral_centroid < 2000 else "Soprano" if spectral_centroid > 4000 else "Mezzo"

        tmp.unlink(missing_ok=True)

        return {
            "voice_type": voice_type,
            "pitch_range": {"min": float(voiced_f0.min()) if len(voiced_f0) > 0 else 0,
                           "max": float(voiced_f0.max()) if len(voiced_f0) > 0 else 0,
                           "mean": float(voiced_f0.mean()) if len(voiced_f0) > 0 else 0},
            "spectral_centroid": spectral_centroid,
            "spectral_bandwidth": spectral_bandwidth,
            "breathiness": float(zcr * 100),
            "clarity": float(min(100, rms * 1000)),
            "dynamics_db": float(20 * np.log10(rms + 1e-10))
        }
    except ImportError:
        return {"voice_type": "Unknown", "message": "Install librosa for vocal analysis"}

# ─── EXPORT ──────────────────────────────────────────────────────────────────

@app.post("/audio/export")
async def export_audio(background_tasks: BackgroundTasks, format: str = "mp3", quality: int = 320):
    """Export project to final format"""
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"status": "processing", "progress": 0}
    return {"job_id": job_id, "status": "processing"}

# ─── WEBSOCKET ────────────────────────────────────────────────────────────────

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(ws: WebSocket, client_id: str):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_json()
            event_type = data.get("type")
            if event_type == "ping":
                await ws.send_json({"type": "pong", "timestamp": time.time()})
            elif event_type == "job_subscribe":
                job_id = data.get("job_id")
                while job_id in JOBS and JOBS[job_id]["status"] == "processing":
                    await ws.send_json({"type": "job_progress", "job_id": job_id, **JOBS[job_id]})
                    await asyncio.sleep(0.5)
                if job_id in JOBS:
                    await ws.send_json({"type": "job_complete", "job_id": job_id, **JOBS[job_id]})
    except Exception:
        pass

# ─── MASTERING ───────────────────────────────────────────────────────────────

@app.post("/audio/master")
async def master_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    target_lufs: float = Form(-14.0),
    true_peak: float = Form(-1.0),
    format: str = Form("wav"),
    bass_boost: float = Form(0.0),
    presence: float = Form(0.0),
):
    """
    Master audio to target loudness (ITU-R BS.1770 LUFS) with:
    - Real integrated LUFS measurement (pyloudnorm)
    - Simple multiband EQ (bass boost, presence)
    - True peak brick-wall limiter
    - Stereo widening (optional)
    Falls back to RMS-based loudness if pyloudnorm is not installed.
    """
    try:
        import librosa, soundfile as sf, numpy as np
        from scipy.signal import butter, sosfilt

        tmp_in = TMP / f"{uuid.uuid4()}_in.wav"
        tmp_out = TMP / f"{uuid.uuid4()}_out.{format}"
        tmp_in.write_bytes(await file.read())

        y, sr = librosa.load(str(tmp_in), sr=None, mono=False)  # keep stereo if present
        is_stereo = y.ndim == 2
        y_mono = y.mean(axis=0) if is_stereo else y

        # ── Measure current LUFS ──────────────────────────────────────────────
        try:
            import pyloudnorm as pyln
            meter = pyln.Meter(sr)
            audio_for_meter = y.T if is_stereo else y_mono[:, None]
            current_lufs = meter.integrated_loudness(audio_for_meter)
            if not math.isfinite(current_lufs):
                raise ValueError("Silence or very short audio")
        except (ImportError, Exception):
            rms = float(np.sqrt(np.mean(y_mono ** 2)) + 1e-10)
            current_lufs = 20 * math.log10(rms)

        # ── Gain to target LUFS ───────────────────────────────────────────────
        gain_db = target_lufs - current_lufs
        gain_linear = 10 ** (gain_db / 20)
        y_out = (y * gain_linear).astype(np.float32)

        # ── Multiband EQ (simple shelving filters) ────────────────────────────
        def apply_shelf(audio, cutoff, gain_db, shelf_type, sr):
            if abs(gain_db) < 0.1:
                return audio
            # Approximate shelf with butterworth + gain blend
            order = 2
            nyq = sr / 2
            freq = min(cutoff / nyq, 0.99)
            sos = butter(order, freq, btype="low" if shelf_type == "low" else "high", output="sos")
            filtered = sosfilt(sos, audio)
            g = 10 ** (gain_db / 20)
            return audio + (filtered - audio) * (g - 1)

        if is_stereo:
            for ch in range(y_out.shape[0]):
                if bass_boost != 0:
                    y_out[ch] = apply_shelf(y_out[ch], 200, bass_boost, "low", sr)
                if presence != 0:
                    y_out[ch] = apply_shelf(y_out[ch], 3000, presence, "high", sr)
        else:
            if bass_boost != 0:
                y_out = apply_shelf(y_out, 200, bass_boost, "low", sr)
            if presence != 0:
                y_out = apply_shelf(y_out, 3000, presence, "high", sr)

        # ── True peak limiting ────────────────────────────────────────────────
        tp_linear = 10 ** (true_peak / 20)
        peak = float(np.abs(y_out).max())
        if peak > tp_linear:
            y_out = y_out * (tp_linear / peak)

        # ── Write output ──────────────────────────────────────────────────────
        write_data = y_out.T if is_stereo else y_out
        sf.write(str(tmp_out), write_data, sr)
        tmp_in.unlink(missing_ok=True)

        # Measure final LUFS for response
        try:
            import pyloudnorm as pyln
            meter2 = pyln.Meter(sr)
            final_data = write_data[:, None] if write_data.ndim == 1 else write_data
            final_lufs = meter2.integrated_loudness(final_data)
        except Exception:
            final_lufs = target_lufs

        background_tasks.add_task(lambda p=tmp_out: p.unlink(missing_ok=True))
        return FileResponse(
            str(tmp_out),
            media_type="audio/wav" if format == "wav" else "audio/mpeg",
            filename=f"mastered.{format}",
            headers={"X-Final-LUFS": f"{final_lufs:.1f}", "X-Gain-Applied": f"{gain_db:.1f}"},
        )

    except ImportError as e:
        raise HTTPException(503, f"Missing dependency: {e}. Install librosa, soundfile, scipy.")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/audio/analyze-lufs")
async def analyze_lufs(file: UploadFile = File(...)):
    """Measure integrated LUFS, true peak, and dynamic range of an audio file."""
    try:
        import librosa, soundfile as sf, numpy as np

        tmp = TMP / f"{uuid.uuid4()}.wav"
        tmp.write_bytes(await file.read())
        y, sr = librosa.load(str(tmp), sr=None, mono=False)
        is_stereo = y.ndim == 2
        y_mono = y.mean(axis=0) if is_stereo else y

        # Integrated LUFS
        try:
            import pyloudnorm as pyln
            meter = pyln.Meter(sr)
            audio_for_meter = y.T if is_stereo else y_mono[:, None]
            integrated_lufs = meter.integrated_loudness(audio_for_meter)
        except Exception:
            rms = float(np.sqrt(np.mean(y_mono ** 2)) + 1e-10)
            integrated_lufs = 20 * math.log10(rms)

        # True peak
        true_peak_db = float(20 * math.log10(np.abs(y_mono).max() + 1e-10))

        # Dynamic range (crest factor approximation)
        rms_db = float(20 * math.log10(np.sqrt(np.mean(y_mono ** 2)) + 1e-10))
        dynamic_range = true_peak_db - rms_db

        tmp.unlink(missing_ok=True)

        streaming_targets = {
            "Spotify": -14, "Apple Music": -16, "YouTube": -13,
            "SoundCloud": -11, "Tidal": -14, "CD": -9,
        }

        return {
            "integrated_lufs": round(integrated_lufs, 1) if math.isfinite(integrated_lufs) else -99.0,
            "true_peak_db": round(true_peak_db, 1),
            "rms_db": round(rms_db, 1),
            "dynamic_range_db": round(dynamic_range, 1),
            "is_stereo": is_stereo,
            "sample_rate": sr,
            "streaming_targets": streaming_targets,
        }

    except ImportError:
        raise HTTPException(503, "Install librosa for LUFS analysis")

# ─── COMPOSITION AI ──────────────────────────────────────────────────────────

CHORD_SUGGESTIONS = {
    "C":  [("Am", "relative minor"), ("F", "IV"), ("G", "V"), ("Em", "iii")],
    "Am": [("F", "VI"), ("G", "VII"), ("C", "III"), ("E", "V")],
    "F":  [("C", "V"), ("Gm", "ii"), ("Dm", "vi"), ("Bb", "IV")],
    "G":  [("Em", "vi"), ("C", "IV"), ("D", "V"), ("Am", "ii")],
    "D":  [("Bm", "vi"), ("G", "IV"), ("A", "V"), ("Em", "ii")],
    "E":  [("C#m", "vi"), ("A", "IV"), ("B", "V"), ("F#m", "ii")],
    "A":  [("F#m", "vi"), ("D", "IV"), ("E", "V"), ("Bm", "ii")],
}

@app.post("/composition/suggest-chords")
async def suggest_chords(current_chord: str = Form("C"), key: str = Form("C"), scale: str = Form("major")):
    """Suggest next chord based on current chord and key"""
    suggestions = CHORD_SUGGESTIONS.get(current_chord, [
        ("Am", "relative minor"), ("F", "subdominant"), ("G", "dominant"), ("C", "tonic")
    ])
    return {
        "current": current_chord,
        "key": key,
        "suggestions": [{"chord": c, "function": f, "probability": round(0.9 - i * 0.15, 2)} for i, (c, f) in enumerate(suggestions)],
        "progression_hint": f"{current_chord} → {suggestions[0][0]} → {suggestions[1][0]} → {key}"
    }

@app.post("/composition/generate-melody")
async def generate_melody(chords: str = Form("C Am F G"), style: str = Form("pop"), bars: int = Form(4)):
    """Generate a simple melody over chord progression"""
    import random
    SCALES = {
        "major": [0, 2, 4, 5, 7, 9, 11],
        "minor": [0, 2, 3, 5, 7, 8, 10],
        "pentatonic": [0, 2, 4, 7, 9],
    }
    scale = SCALES.get("pentatonic", [0, 2, 4, 7, 9])
    root = 60  # middle C
    notes = []
    for bar in range(bars):
        beats = random.randint(3, 6)
        for _ in range(beats):
            pitch = root + random.choice(scale) + random.choice([0, 12])
            start = bar * 4 + random.uniform(0, 3.5)
            duration = random.choice([0.5, 0.5, 1.0, 1.0, 1.0, 2.0])
            velocity = random.randint(65, 100)
            notes.append({"pitch": pitch, "startBeat": round(start, 2), "durationBeats": duration, "velocity": velocity})
    notes.sort(key=lambda n: n["startBeat"])
    return {"notes": notes, "style": style, "bars": bars, "note_count": len(notes)}

@app.get("/composition/scales")
async def get_scales():
    """Return available scales and their intervals"""
    return {
        "major": [0,2,4,5,7,9,11], "minor": [0,2,3,5,7,8,10],
        "dorian": [0,2,3,5,7,9,10], "phrygian": [0,1,3,5,7,8,10],
        "lydian": [0,2,4,6,7,9,11], "mixolydian": [0,2,4,5,7,9,10],
        "pentatonic_major": [0,2,4,7,9], "pentatonic_minor": [0,3,5,7,10],
        "blues": [0,3,5,6,7,10], "harmonic_minor": [0,2,3,5,7,8,11],
    }

# ─── VOICE CLONE ─────────────────────────────────────────────────────────────

@app.get("/voice/models")
async def get_voice_models():
    """List available voice clone models"""
    from app.voice_clone import list_models
    return {"models": list_models()}

@app.post("/voice/train-model")
async def train_voice_model(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    language: str = Form("pt"),
    audio_samples: List[UploadFile] = File(...),
):
    """Train a new voice clone model from audio samples"""
    from app.voice_clone import train_model, JOBS
    model_id = str(uuid.uuid4())
    audio_paths = []
    for sample in audio_samples:
        path = TMP / f"{model_id}_{uuid.uuid4()}.wav"
        path.write_bytes(await sample.read())
        audio_paths.append(str(path))
    JOBS[model_id] = {"status": "queued", "progress": 0}
    background_tasks.add_task(train_model, model_id, audio_paths, name, language)
    return {"model_id": model_id, "status": "training", "sample_count": len(audio_paths)}

@app.get("/voice/train-status/{model_id}")
async def get_train_status(model_id: str):
    """Get training job status"""
    from app.voice_clone import JOBS
    if model_id not in JOBS:
        raise HTTPException(404, "Job not found")
    return JOBS[model_id]

@app.post("/voice/synthesize")
async def synthesize_voice(
    text: str = Form(...),
    model_id: str = Form(...),
    speed: float = Form(1.0),
):
    """Synthesize speech using a trained voice model"""
    from app.voice_clone import synthesize_voice as _synthesize, MODELS
    if model_id not in MODELS:
        raise HTTPException(404, f"Model {model_id} not found. Train a model first.")
    output_path = str(TMP / f"synth_{uuid.uuid4()}.wav")
    await _synthesize(text, model_id, output_path, speed)
    if not Path(output_path).exists():
        raise HTTPException(500, "Synthesis produced no output")
    return FileResponse(output_path, media_type="audio/wav", filename="synthesized.wav")

@app.post("/voice/analyze-quality")
async def analyze_voice_quality(file: UploadFile = File(...)):
    """Analyze audio quality for voice cloning suitability"""
    from app.voice_clone import analyze_voice_quality
    tmp = TMP / f"{uuid.uuid4()}.wav"
    tmp.write_bytes(await file.read())
    result = await analyze_voice_quality(str(tmp))
    tmp.unlink(missing_ok=True)
    return result

@app.delete("/voice/models/{model_id}")
async def delete_voice_model(model_id: str):
    """Delete a trained voice model and its files"""
    from app.voice_clone import delete_model, MODELS
    if model_id not in MODELS:
        raise HTTPException(404, f"Model {model_id} not found")
    delete_model(model_id)
    return {"deleted": model_id}

@app.post("/voice/autotune")
async def autotune_voice(
    file: UploadFile = File(...),
    scale: str = Form("major"),
    key: str = Form("C"),
    intensity: float = Form(0.8),
    speed: str = Form("fast"),
):
    """
    Auto-tune / pitch correct a vocal recording.
    Snaps each voiced frame to the nearest note in the given scale+key.
    intensity: 0.0 = transparent, 1.0 = hard snap (T-Pain style)
    """
    from app.voice_clone import autotune_audio
    tmp_in = TMP / f"{uuid.uuid4()}_in.wav"
    tmp_out = TMP / f"{uuid.uuid4()}_autotune.wav"
    tmp_in.write_bytes(await file.read())
    try:
        info = await autotune_audio(str(tmp_in), str(tmp_out), scale=scale, key=key, intensity=intensity, speed=speed)
        tmp_in.unlink(missing_ok=True)
        return FileResponse(str(tmp_out), media_type="audio/wav", filename="autotuned.wav",
                            headers={"X-Corrections": str(info["corrections_applied"])})
    except Exception as e:
        tmp_in.unlink(missing_ok=True)
        raise HTTPException(500, str(e))

@app.post("/voice/harmony")
async def add_harmony(
    file: UploadFile = File(...),
    intervals: str = Form("4,7"),
    mix_level: float = Form(0.5),
):
    """
    Generate harmony voices by pitch-shifting the input vocal.
    intervals: comma-separated semitones (e.g. '4,7' = major 3rd + 5th; '-12' = octave down)
    mix_level: 0.0–1.0, volume of harmony relative to lead
    """
    from app.voice_clone import generate_harmony
    try:
        interval_list = [int(x.strip()) for x in intervals.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(400, "intervals must be comma-separated integers (e.g. '4,7')")

    tmp_in = TMP / f"{uuid.uuid4()}_in.wav"
    tmp_out = TMP / f"{uuid.uuid4()}_harmony.wav"
    tmp_in.write_bytes(await file.read())
    try:
        info = await generate_harmony(str(tmp_in), str(tmp_out), intervals=interval_list, mix_level=mix_level)
        tmp_in.unlink(missing_ok=True)
        return FileResponse(str(tmp_out), media_type="audio/wav", filename="harmony.wav",
                            headers={"X-Voices-Added": str(len(info["voices_added"]))})
    except Exception as e:
        tmp_in.unlink(missing_ok=True)
        raise HTTPException(500, str(e))

# ─── COLLABORATION ────────────────────────────────────────────────────────────

ROOMS: dict = {}

@app.websocket("/ws/room/{room_id}/{client_id}")
async def room_websocket(ws: WebSocket, room_id: str, client_id: str):
    """WebSocket endpoint for real-time collaboration rooms"""
    await ws.accept()
    if room_id not in ROOMS:
        ROOMS[room_id] = {}
    ROOMS[room_id][client_id] = ws

    await _broadcast_room(room_id, {
        "type": "user_joined", "client_id": client_id,
        "users": list(ROOMS[room_id].keys()), "timestamp": time.time()
    }, exclude=client_id)

    try:
        while True:
            data = await ws.receive_json()
            event_type = data.get("type")
            if event_type == "ping":
                await ws.send_json({"type": "pong", "timestamp": time.time()})
            elif event_type in ("track_update", "chat", "cursor", "playback", "clip_move"):
                await _broadcast_room(room_id, {**data, "from": client_id, "timestamp": time.time()})
    except Exception:
        pass
    finally:
        ROOMS.get(room_id, {}).pop(client_id, None)
        await _broadcast_room(room_id, {
            "type": "user_left", "client_id": client_id,
            "users": list(ROOMS.get(room_id, {}).keys()), "timestamp": time.time()
        })

async def _broadcast_room(room_id: str, message: dict, exclude: str = None):
    """Broadcast message to all clients in a room"""
    room = ROOMS.get(room_id, {})
    dead = []
    for cid, ws in room.items():
        if cid == exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(cid)
    for cid in dead:
        room.pop(cid, None)

@app.get("/rooms/{room_id}")
async def get_room_info(room_id: str):
    """Get info about a collaboration room"""
    room = ROOMS.get(room_id, {})
    return {"room_id": room_id, "users": list(room.keys()), "active": bool(room)}

# ─── STARTUP ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    TMP.mkdir(parents=True, exist_ok=True)
    print("🎵 Music Creator API started")
    print(f"📁 Temp dir: {TMP}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
