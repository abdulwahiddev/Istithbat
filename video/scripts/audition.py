#!/usr/bin/env python3
"""Voice audition reel: one passage, six Kokoro voices, identical prosody shaping, equal loudness.
KOKORO_DIR=<models> python3 scripts/audition.py  → out/voice-audition/"""
import os, subprocess
from pathlib import Path
import numpy as np, soundfile as sf, pyloudnorm as pyln
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out/voice-audition"; OUT.mkdir(parents=True, exist_ok=True)
KD = Path(os.environ["KOKORO_DIR"])
k = Kokoro(str(KD / "kokoro-v1.0.onnx"), str(KD / "voices-v1.0.bin"))
SR = 24000

VOICES = [("1", "am_fenrir", "male · US"), ("2", "am_puck", "male · US"), ("3", "bm_fable", "male · UK"),
          ("4", "af_heart", "female · US"), ("5", "af_bella", "female · US"), ("6", "af_kore", "female · US")]
# (spoken text, speed, pause after) — same delivery shaping for every voice:
# curious opening → forward-moving → decisive → a slower, weighted result line.
PASSAGE = [
    ("Istithbat watches the knowledge your AI systems already trust.", 0.98, 0.42),
    ("In this run, we publish one controlled change to HadeethEnc record ten six eighteen.", 1.0, 0.40),
    ("Policy zero zero two quarantines the candidate, while version thirteen keeps serving.", 0.97, 0.48),
    ("The result is clear: three material comparisons, out of three.", 0.93, 0.0),
]
FIX = {"ˈɪstɪθbˌæt": "istiθbˈaːt", "ˈɪstɪθbˌat": "istiθbˈaːt",   # استثبات Istithbāt (US / UK phonemizer guesses)
       "hˈædiːθ": "hɐdˈiːθ", "hˈadiːθ": "hɐdˈiːθ"}              # HadeethEnc → ha-DEETH

def say(text, voice, speed):
    lang = "en-gb" if voice.startswith("b") else "en-us"
    ph = k.tokenizer.phonemize(text, lang)
    for a, b in FIX.items(): ph = ph.replace(a, b)
    a, sr = k.create(ph, voice=voice, speed=speed, lang=lang, is_phonemes=True)
    return a

meter = pyln.Meter(SR)
raw = {}
for n, v, desc in VOICES:
    parts = []
    for text, sp, gap in PASSAGE:
        parts += [say(text, v, sp), np.zeros(int(gap * SR))]
    raw[v] = np.concatenate(parts)
# identical processing for every voice: -18 LUFS, then the same transparent peak limiter (-1 dBFS)
target, CEIL = -18.0, 10 ** (-1 / 20)
def limit(x, look=int(0.003 * SR), rel=np.exp(-1 / (0.06 * SR))):
    need = np.minimum(1, CEIL / np.maximum(np.abs(x), 1e-9))
    need = np.array([need[max(0, i - look):i + look + 1].min() for i in range(len(x))])
    g = np.empty_like(x); cur = 1.0
    for i, n in enumerate(need): cur = n if n < cur else n + (cur - n) * rel; g[i] = cur
    return x * g
print(f"all clips: {target:.0f} LUFS, peak-limited at -1 dBFS")
reel = []
for n, v, desc in VOICES:
    clip = limit(pyln.normalize.loudness(raw[v], meter.integrated_loudness(raw[v]), target))
    sf.write(OUT / f"{n}-{v}.wav", clip, SR, subtype="PCM_16")
    print(f"{n}-{v}.wav  {desc:12s} {len(clip)/SR:5.1f}s")
    t = np.arange(int(0.18 * SR)) / SR
    tone = 0.12 * np.sin(2 * np.pi * 660 * t) * np.sin(np.pi * t / 0.18)  # soft separator
    reel += [tone, np.zeros(int(0.7 * SR)), clip, np.zeros(int(1.4 * SR))]
r = np.concatenate(reel)
sf.write(OUT / "reel.wav", r, SR, subtype="PCM_16")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(OUT / "reel.wav"), "-ar", "48000", "-b:a", "192k", str(OUT / "voice-audition-reel.mp3")], check=True)
(OUT / "reel.wav").unlink()
print(f"voice-audition-reel.mp3  {len(r)/SR:.1f}s  (order 1→6, a soft tone before each)")

# record-ID readings, same two voices, so the spoken form can be chosen by ear
ids = []
for v in ("am_fenrir", "af_heart"):
    for text in ("HadeethEnc record ten six eighteen.", "HadeethEnc record one oh six one eight."):
        a = say(text, v, 1.0); ids += [limit(pyln.normalize.loudness(a, meter.integrated_loudness(a), target)), np.zeros(int(0.8 * SR))]
sf.write(OUT / "7-record-id-readings.wav", np.concatenate(ids), SR, subtype="PCM_16")
print("7-record-id-readings.wav  fenrir: 'ten six eighteen' then 'one oh six one eight'; heart: same pair")
