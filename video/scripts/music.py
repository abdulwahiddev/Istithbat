#!/usr/bin/env python3
"""Generate the temporary background bed: a slow, quiet, non-cinematic pad (no drums, no risers).

Writes public/audio/music.mp3 (48 kHz stereo, 192 kb/s, peak ~ -12 dBFS). The composition plays it at a
low volume under the narration. Replace public/audio/music.mp3 with a licensed instrumental of
any length >= 114 s to swap it; no code edits needed.
"""
from pathlib import Path
import subprocess, tempfile
import numpy as np

SR, DUR = 48000, 116.0
t = np.arange(int(SR * DUR)) / SR
rng = np.random.default_rng(7)

# A minor-ish modal loop, 9.5 s per chord, voiced low and open.
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
CHORDS = [[45, 52, 59, 64, 67], [41, 48, 55, 60, 64], [48, 55, 59, 64, 67], [43, 50, 57, 62, 66]]
SEG = 9.5

left = np.zeros_like(t); right = np.zeros_like(t)
for idx, start in enumerate(np.arange(-SEG, DUR, SEG)):
    notes = CHORDS[idx % len(CHORDS)]
    s0, s1 = max(start - 2.0, 0), min(start + SEG + 3.0, DUR)
    i0, i1 = int(s0 * SR), int(s1 * SR)
    tt = t[i0:i1] - start
    env = np.clip((tt + 2.0) / 3.5, 0, 1) * np.clip((SEG + 3.0 - tt) / 4.0, 0, 1)
    env = env ** 1.6
    for j, m in enumerate(notes):
        f = hz(m)
        det = 1 + (rng.random() - 0.5) * 0.002
        ph = rng.random() * 2 * np.pi
        tone = (np.sin(2 * np.pi * f * det * tt + ph) + 0.18 * np.sin(2 * np.pi * 2 * f * tt + ph)
                + 0.05 * np.sin(2 * np.pi * 3 * f * tt))
        amp = 0.16 / (1 + 0.35 * j)
        pan = 0.5 + (j - 2) * 0.12
        left[i0:i1] += tone * env * amp * (1 - pan)
        right[i0:i1] += tone * env * amp * pan

# slow tremolo-free breathing + soft noise air, then a one-pole low-pass for warmth
breath = 0.85 + 0.15 * np.sin(2 * np.pi * t / 23.0)
air = rng.normal(0, 0.004, t.shape)
def lp(x, fc=1800):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i in range(0, len(x), 4096):
        seg = x[i:i + 4096]
        out = np.empty_like(seg)
        for k, v in enumerate(seg):
            acc = (1 - a) * v + a * acc; out[k] = acc
        y[i:i + 4096] = out
    return y
L = lp(left * breath + air); R = lp(right * breath + air)
fade = np.clip(t / 3.0, 0, 1) * np.clip((DUR - t) / 5.0, 0, 1)
st = np.stack([L * fade, R * fade], axis=1)
st *= 0.25 / np.max(np.abs(st))  # ~ -12 dBFS peak

out = Path(__file__).resolve().parent.parent / "public/audio/music.mp3"
with tempfile.TemporaryDirectory() as td:
    raw = Path(td) / "m.raw"
    st.astype(np.float32).tofile(raw)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", str(raw),
                    "-c:a", "libmp3lame", "-b:a", "192k", str(out)], check=True)
print("wrote", out)
