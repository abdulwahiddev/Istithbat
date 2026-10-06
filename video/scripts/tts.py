#!/usr/bin/env python3
"""Synthesize the temporary narration track and its caption timings.

Reads  src/script.json   (scene windows + narration sentences + caption phrases)
Writes public/audio/voiceover.wav  (48 kHz mono, placed on the absolute video timeline)
       src/narration.json          (per-sentence and per-caption start/end in seconds)

Engine: Kokoro-82M via kokoro-onnx (Apache-2.0), fully offline once the model files exist.
  pip install kokoro-onnx soundfile
  KOKORO_DIR=<dir containing kokoro-v1.0.onnx and voices-v1.0.bin> python3 scripts/tts.py
Model files: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0

Each sentence is synthesized whole (natural prosody), then laid onto the timeline inside its
scene window. Caption phrases inside a sentence are timed proportionally to their length.
If a scene's narration would overrun its window, that scene is re-synthesized slightly faster.

To use a recorded/human voiceover instead: replace public/audio/voiceover.wav with a file of the
same total length whose sentences start at the times in src/narration.json (no code edits needed).
"""
import json, os, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = json.loads((ROOT / "src/script.json").read_text())
KDIR = Path(os.environ.get("KOKORO_DIR", ROOT / ".kokoro"))
VOICE = os.environ.get("KOKORO_VOICE", "am_fenrir")
BASE_SPEED = float(os.environ.get("KOKORO_SPEED", "1.0"))
LEAD_IN, GAP, TAIL = 0.35, 0.32, 0.25  # seconds

# Pronunciation fixes, applied on the phoneme string (espeak/misaki output -> intended).
PHONEME_FIXES = {
    # استثبات Istithbāt: i-s-t-i-θ-b-aː-t, stress on the long final syllable, real "th" (ث).
    # Chosen by ASR audition (Whisper-small hears "Istith Bhat"); the default English guess was "Istithbat"/"Istif bot".
    "ˈɪstɪθbˌæt": "istiθbˈaːt",
    "hˈædiːθ": "hɐdˈiːθ",             # HadeethEnc → ha-DEETH-enk (حديث), not HAD-eeth
    "hˈædɪθ": "hɐdˈiːθ",              # hadith → ha-DEETH, not HAD-ith
}

k = Kokoro(str(KDIR / "kokoro-v1.0.onnx"), str(KDIR / "voices-v1.0.bin"))
SR = 24000


def speak(text: str, speed: float) -> np.ndarray:
    ph = k.tokenizer.phonemize(text, "en-us")
    for a, b in PHONEME_FIXES.items():
        ph = ph.replace(a, b)
    audio, sr = k.create(ph, voice=VOICE, speed=speed, lang="en-us", is_phonemes=True)
    assert sr == SR
    return audio


total = SCRIPT["durationSec"]
track = np.zeros(int(total * SR) + SR, dtype=np.float32)
out_scenes = []

for sc in SCRIPT["scenes"]:
    window = sc["end"] - sc["start"]
    # per-scene delivery (mood arc): base pace and the pause between sentences, from script.json
    speed = sc.get("speed", BASE_SPEED)
    GAP = sc.get("gap", 0.32)
    while True:
        clips = [speak(s.get("tts", s["text"]), speed) for s in sc["sentences"]]
        need = LEAD_IN + sum(len(c) / SR for c in clips) + GAP * (len(clips) - 1) + TAIL
        if need <= window or speed >= sc.get("speed", BASE_SPEED) + 0.1:
            break
        speed = round(speed + 0.04, 2)
    if need > window:
        print(f"WARNING {sc['id']}: narration {need:.2f}s exceeds window {window}s", file=sys.stderr)

    t = sc["start"] + LEAD_IN
    sentences = []
    for s, clip in zip(sc["sentences"], clips):
        dur = len(clip) / SR
        i = int(t * SR)
        track[i:i + len(clip)] += clip
        caps, lens = [], [max(len(c), 1) for c in s["captions"]]
        ct = t
        for c, n in zip(s["captions"], lens):
            cd = dur * n / sum(lens)
            caps.append({"text": c, "start": round(ct, 3), "end": round(ct + cd, 3)})
            ct += cd
        sentences.append({"text": s["text"], "start": round(t, 3), "end": round(t + dur, 3), "captions": caps})
        t += dur + GAP
    out_scenes.append({"id": sc["id"], "speed": speed, "sentences": sentences})
    print(f"{sc['id']:<20} window {window:>4}s  speech ends +{t - GAP - sc['start']:.2f}s  speed {speed}")

track = track[: int(total * SR)]
peak = float(np.max(np.abs(track))) or 1.0
track = track * (0.89 / peak)  # ~ -1 dBFS peak

out_wav = ROOT / "public/audio/voiceover.wav"
with tempfile.TemporaryDirectory() as td:
    raw = Path(td) / "vo24.wav"
    sf.write(raw, track, SR)
    # 48 kHz, gentle high-pass + loudness normalisation for speech (~ -16 LUFS)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af",
                    "highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "1", str(out_wav)], check=True)

(ROOT / "src/narration.json").write_text(json.dumps(
    {"voice": f"kokoro-v1.0/{VOICE}", "durationSec": total, "scenes": out_scenes}, indent=2, ensure_ascii=False) + "\n")
print("wrote", out_wav, "and src/narration.json")
