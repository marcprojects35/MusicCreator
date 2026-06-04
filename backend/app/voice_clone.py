"""
Voice Cloning Module — Music Creator
Uses Coqui TTS (VITS/YourTTS) for high-quality voice synthesis.

Install:
    pip install TTS resemblyzer pyloudnorm

Supported models:
  - tts_models/multilingual/multi-dataset/your_tts  (multilingual, includes PT-BR)
  - tts_models/en/ljspeech/vits                     (English, high quality)
"""

import os, uuid, json, asyncio, time
from pathlib import Path
from typing import Optional, List
import tempfile

TMP = Path(tempfile.gettempdir()) / "music_creator" / "voice_clone"
TMP.mkdir(parents=True, exist_ok=True)

MODELS_FILE = TMP / "models_registry.json"

MODELS: dict = {}   # model_id -> {name, path, speaker_embedding, language, ...}
JOBS: dict = {}     # job_id -> {status, progress, error}

_tts_instance = None  # cached TTS instance


# ─── PERSISTENCE ──────────────────────────────────────────────────────────────

def _save_models():
    """Persist MODELS registry to disk."""
    serializable = {}
    for mid, info in MODELS.items():
        serializable[mid] = {k: v for k, v in info.items()}
    with open(MODELS_FILE, "w") as f:
        json.dump(serializable, f, indent=2)


def _load_models():
    """Load persisted MODELS registry from disk on startup."""
    global MODELS
    if not MODELS_FILE.exists():
        return
    try:
        with open(MODELS_FILE) as f:
            data = json.load(f)
        # Only restore models whose embedding files still exist on disk
        for mid, info in data.items():
            ep = info.get("embedding_path")
            if ep is None or Path(ep).exists():
                MODELS[mid] = info
    except Exception as e:
        print(f"Warning: Could not load voice models registry: {e}")


# Load persisted models when module is imported
_load_models()


# ─── MODEL MANAGEMENT ─────────────────────────────────────────────────────────

def list_models():
    """List all trained voice models."""
    return [{"id": mid, **info} for mid, info in MODELS.items()]


async def train_model(model_id: str, audio_paths: List[str], name: str, language: str = "pt"):
    """
    Train a voice model from audio samples.
    Extracts speaker embeddings using Resemblyzer.
    """
    JOBS[model_id] = {"status": "processing", "progress": 0, "stage": "Loading audio..."}
    try:
        from resemblyzer import VoiceEncoder, preprocess_wav
        import numpy as np

        encoder = VoiceEncoder()
        JOBS[model_id].update({"progress": 20, "stage": "Extracting speaker embeddings..."})

        embeddings = []
        total = len(audio_paths)
        for i, path in enumerate(audio_paths):
            try:
                wav = preprocess_wav(path)
                embedding = encoder.embed_utterance(wav)
                embeddings.append(embedding)
                JOBS[model_id]["progress"] = 20 + int(50 * (i + 1) / total)
                JOBS[model_id]["stage"] = f"Processing sample {i+1}/{total}..."
            except Exception as e:
                print(f"Warning: Could not process {path}: {e}")

        if not embeddings:
            raise ValueError("No valid audio samples provided")

        mean_embedding = np.mean(embeddings, axis=0)
        embedding_path = TMP / f"{model_id}_embedding.npy"
        np.save(str(embedding_path), mean_embedding)

        JOBS[model_id].update({"progress": 90, "stage": "Saving model..."})

        MODELS[model_id] = {
            "name": name,
            "language": language,
            "embedding_path": str(embedding_path),
            "sample_count": len(embeddings),
            "created_at": time.time(),
            "quality": min(99, 70 + len(embeddings) * 3),
        }
        _save_models()

        JOBS[model_id] = {"status": "complete", "progress": 100, "stage": "Ready"}

    except ImportError:
        # Stub model without real embeddings (resemblyzer not installed)
        MODELS[model_id] = {
            "name": name,
            "language": language,
            "embedding_path": None,
            "sample_count": len(audio_paths),
            "created_at": time.time(),
            "quality": 60,
            "note": "Stub — install resemblyzer for real voice cloning",
        }
        _save_models()
        JOBS[model_id] = {"status": "complete", "progress": 100, "stage": "Ready (stub — install resemblyzer)"}

    except Exception as e:
        JOBS[model_id] = {"status": "failed", "progress": 0, "error": str(e)}


def delete_model(model_id: str):
    """Delete a voice model and its files."""
    info = MODELS.pop(model_id, None)
    if info and info.get("embedding_path"):
        Path(info["embedding_path"]).unlink(missing_ok=True)
    _save_models()


# ─── SYNTHESIS ────────────────────────────────────────────────────────────────

async def synthesize_voice(text: str, model_id: str, output_path: str, speed: float = 1.0):
    """
    Synthesize text using a trained voice model.
    Uses Coqui TTS YourTTS for multilingual synthesis.
    """
    global _tts_instance
    model_info = MODELS.get(model_id)
    if not model_info:
        raise ValueError(f"Model {model_id} not found")

    try:
        from TTS.api import TTS
        import numpy as np

        if _tts_instance is None:
            _tts_instance = TTS(
                model_name="tts_models/multilingual/multi-dataset/your_tts",
                progress_bar=False,
                gpu=False,
            )

        if model_info.get("embedding_path") and Path(model_info["embedding_path"]).exists():
            speaker_embedding = np.load(model_info["embedding_path"])
            _tts_instance.tts_to_file(
                text=text,
                speaker_embedding=speaker_embedding,
                language=model_info.get("language", "pt"),
                file_path=output_path,
                speed=speed,
            )
        else:
            _tts_instance.tts_to_file(
                text=text,
                speaker=_tts_instance.speakers[0] if _tts_instance.speakers else None,
                language=model_info.get("language", "pt"),
                file_path=output_path,
                speed=speed,
            )

    except ImportError:
        _synthesize_stub(text, output_path)

    except Exception as e:
        raise RuntimeError(f"Synthesis failed: {e}")


def _synthesize_stub(text: str, output_path: str):
    """Fallback: generate a simple sine-wave audio when TTS is not installed."""
    try:
        import numpy as np
        import soundfile as sf

        sr = 22050
        duration = max(1.0, len(text) * 0.07)
        t = np.linspace(0, duration, int(sr * duration))
        base_freq = 180
        freq = base_freq + 40 * np.sin(2 * np.pi * 1.5 * t)
        audio = 0.25 * np.sin(2 * np.pi * freq * t) * np.exp(-t * 0.3)
        sf.write(output_path, audio, sr)
    except Exception as e:
        raise RuntimeError(f"TTS not installed and stub fallback also failed: {e}")


# ─── PITCH CORRECTION (AUTOTUNE) ──────────────────────────────────────────────

async def autotune_audio(
    audio_path: str,
    output_path: str,
    scale: str = "major",
    key: str = "C",
    intensity: float = 0.8,
    speed: str = "fast",
) -> dict:
    """
    Pitch-correct audio to nearest scale note.
    - Detects F0 frame by frame with pyin
    - Shifts each frame to the nearest in-scale pitch
    - intensity: 0.0 = no correction, 1.0 = hard snap
    """
    try:
        import librosa
        import soundfile as sf
        import numpy as np

        SCALES = {
            "major":      [0, 2, 4, 5, 7, 9, 11],
            "minor":      [0, 2, 3, 5, 7, 8, 10],
            "pentatonic": [0, 2, 4, 7, 9],
            "blues":      [0, 3, 5, 6, 7, 10],
            "chromatic":  list(range(12)),
        }

        NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        key_offset = NOTE_NAMES.index(key) if key in NOTE_NAMES else 0
        scale_semitones = set((s + key_offset) % 12 for s in SCALES.get(scale, SCALES["major"]))

        y, sr = librosa.load(audio_path, sr=44100)

        hop = 512
        f0, voiced_flag, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
            hop_length=hop,
        )

        corrections_applied = 0
        y_out = y.copy()

        for i, (pitch, voiced) in enumerate(zip(f0, voiced_flag)):
            if not voiced or pitch is None or np.isnan(pitch):
                continue

            midi_float = librosa.hz_to_midi(pitch)
            semitone_class = int(round(midi_float)) % 12

            if semitone_class in scale_semitones:
                continue

            nearest = min(scale_semitones, key=lambda s: min(abs(s - semitone_class), 12 - abs(s - semitone_class)))
            diff = nearest - semitone_class
            if diff > 6:
                diff -= 12
            elif diff < -6:
                diff += 12

            shift = diff * intensity

            start = i * hop
            end = min(len(y), start + hop * 2)
            segment = y[start:end]
            if len(segment) < 256:
                continue

            try:
                corrected = librosa.effects.pitch_shift(segment, sr=sr, n_steps=float(shift))
                blend_len = min(len(corrected), end - start)
                y_out[start:start + blend_len] = corrected[:blend_len]
                corrections_applied += 1
            except Exception:
                pass

        sf.write(output_path, y_out, sr)

        return {
            "corrections_applied": corrections_applied,
            "total_voiced_frames": int(voiced_flag.sum()),
            "scale": scale,
            "key": key,
            "intensity": intensity,
        }

    except ImportError:
        raise RuntimeError("librosa and soundfile required for autotune")


# ─── HARMONY GENERATION ───────────────────────────────────────────────────────

async def generate_harmony(
    audio_path: str,
    output_path: str,
    intervals: List[int] = None,
    mix_level: float = 0.5,
) -> dict:
    """
    Generate harmony voices by pitch-shifting the input and mixing.
    intervals: list of semitones to add (default: [4, 7] = major third + fifth)
    mix_level: volume of harmony voices relative to lead (0.0–1.0)
    """
    try:
        import librosa
        import soundfile as sf
        import numpy as np

        if intervals is None:
            intervals = [4, 7]  # major third + perfect fifth

        y, sr = librosa.load(audio_path, sr=44100)
        mix = y.copy()

        voices_added = []
        for semitones in intervals:
            try:
                voice = librosa.effects.pitch_shift(y, sr=sr, n_steps=float(semitones))
                mix = mix + voice * mix_level
                voices_added.append(semitones)
            except Exception as e:
                print(f"Warning: Could not generate harmony at {semitones} semitones: {e}")

        # Normalize to prevent clipping
        peak = np.abs(mix).max()
        if peak > 0.98:
            mix = mix * (0.98 / peak)

        sf.write(output_path, mix, sr)

        return {
            "voices_added": voices_added,
            "intervals_semitones": voices_added,
            "mix_level": mix_level,
            "duration": float(len(y) / sr),
        }

    except ImportError:
        raise RuntimeError("librosa and soundfile required for harmony generation")


# ─── QUALITY ANALYSIS ─────────────────────────────────────────────────────────

async def analyze_voice_quality(audio_path: str) -> dict:
    """Analyze audio quality for voice cloning suitability."""
    try:
        import librosa
        import numpy as np

        y, sr = librosa.load(audio_path, duration=60)
        duration = librosa.get_duration(y=y, sr=sr)
        rms = float(librosa.feature.rms(y=y).mean())
        snr_estimate = float(rms / (np.std(y) + 1e-10))
        zcr = float(librosa.feature.zero_crossing_rate(y).mean())
        spectral_flatness = float(librosa.feature.spectral_flatness(y=y).mean())

        issues = []
        score = 100

        if duration < 30:
            issues.append(f"Audio too short ({duration:.0f}s — 3+ minutes recommended)")
            score -= 30
        elif duration < 60:
            issues.append(f"Audio is somewhat short ({duration:.0f}s — aim for 3-10 minutes)")
            score -= 10

        if rms < 0.01:
            issues.append("Recording level too low — increase microphone gain")
            score -= 20
        elif rms > 0.8:
            issues.append("Recording may be clipping — reduce input level")
            score -= 15

        if snr_estimate < 0.5:
            issues.append("High background noise detected — record in a quieter space")
            score -= 25

        if spectral_flatness > 0.1:
            issues.append("Audio may contain significant noise or music (use clean speech only)")
            score -= 15

        return {
            "duration": float(duration),
            "rms_level": float(rms),
            "snr_estimate": float(snr_estimate),
            "quality_score": max(0, score),
            "suitable_for_cloning": score >= 50,
            "issues": issues,
            "recommendations": issues and [
                "Record in a quiet room with no background music",
                "Use a directional microphone (USB or XLR condenser)",
                "Aim for 3–10 minutes of continuous clean speech",
                "Speak at a natural pace — vary pitch and expression",
                "Run noise reduction before uploading if needed",
            ] or ["Audio quality looks great for voice cloning!"],
        }

    except ImportError:
        return {
            "duration": 0,
            "quality_score": 80,
            "suitable_for_cloning": True,
            "issues": [],
            "recommendations": ["Install librosa for accurate quality analysis"],
        }
