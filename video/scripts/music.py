#!/usr/bin/env python3
"""Generate the score: a restrained technology/documentary bed that follows the story.

Reads public/audio/events.json (scene windows) and writes public/audio/music.wav (48 kHz stereo).
Arc (D minor, 96 BPM, no drums, no risers, no trailer hits):
  s01–s02  problem     dark pad + a quiet half-step pluck motif (slight tension)
  s03      publish     progression enters, soft 8th-note plucks
  s04–s06  run         momentum: 16th arpeggio, soft pulse, very light offbeat air
  s07–s08  trace→gate  the lift: brighter pad, upper bell arpeggio, fuller pulse
  s09      human       rhythm drops; open, resolved, minimal
  s10      close       D(add9) resolution with a long tail
Replace public/audio/music.wav with any licensed instrumental (>= 116 s) to swap it; scripts/mix.py
ducks and levels whatever is there.
"""
import json
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
EV = json.loads((ROOT / "public/audio/events.json").read_text())
SC = {s["id"]: s for s in EV["scenes"]}
SR, DUR = 48000, EV["durationSec"] + 3.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
BEAT = 60 / 96
rng = np.random.default_rng(10618)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def put(sig, t0, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan)); R[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))

def pad_note(m, dur, bright):
    t = np.arange(int((dur + 1.6) * SR)) / SR
    out = np.zeros_like(t)
    for det in (-0.0012, 0.0, 0.0011):
        f = hz(m) * (1 + det)
        for n in range(1, 14):
            if f * n > 9000: break
            out += np.sin(2 * np.pi * f * n * t + rng.random() * 6.28) * (1 / n) * np.exp(-n / (2.0 + 6 * bright))
    env = np.clip(t / 0.9, 0, 1) * np.clip((dur + 1.6 - t) / 1.6, 0, 1)
    return out * env / 3

def pluck(m, dec=0.35, bright=0.5):
    t = np.arange(int((dec * 4) * SR)) / SR
    f = hz(m)
    out = sum(np.sin(2 * np.pi * f * n * t) * np.exp(-t * (1 / dec) * (1 + 0.6 * (n - 1))) / n ** (1.6 - bright) for n in range(1, 7))
    return out * np.clip(t / 0.003, 0, 1)

def bell(m, dec=1.1):
    t = np.arange(int(dec * 3 * SR)) / SR
    f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 3) + 0.2 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 5)) * np.exp(-t / dec) * np.clip(t / 0.004, 0, 1)

def pulse(m):
    t = np.arange(int(0.42 * SR)) / SR
    f = hz(m)  # root an octave low; harmonics keep it audible on laptop speakers
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(4 * np.pi * f * t) + 0.25 * np.sin(6 * np.pi * f * t)) * np.exp(-t / 0.12) * np.clip(t / 0.006, 0, 1)

HP = butter(2, 6000, "highpass", fs=SR, output="sos")
def air():
    t = int(0.05 * SR)
    return sosfilt(HP, rng.normal(0, 1, t)) * np.exp(-np.arange(t) / SR / 0.012)

CH = {  # pad voicing, arpeggio notes, root for the pulse
    "Dm":  ([50, 57, 60, 64, 65], [62, 65, 69, 72, 69, 65], 38),
    "Bb":  ([46, 53, 57, 62], [58, 62, 65, 69, 65, 62], 34),
    "F":   ([41, 48, 55, 57, 60], [60, 65, 67, 69, 67, 65], 41),
    "C":   ([48, 55, 62, 64], [60, 64, 67, 74, 67, 64], 36),
    "Gm":  ([43, 50, 58, 62, 65], [62, 65, 67, 70, 67, 65], 43),
    "Dadd9": ([50, 57, 62, 64, 66], [62, 66, 69, 76, 69, 66], 38),
}

def section(t0, t1, prog, *, bright, plucks=None, arp=0.0, bells=0.0, pulses=0.0, airs=0.0, padg=1.0, motif=False):
    bar = 4 * BEAT; t = t0; i = 0
    while t < t1 - 0.05:
        name = prog[i % len(prog)]; d = min(2 * bar, t1 - t)
        pv, ar, root = CH[name]
        for m in pv: put(pad_note(m, d, bright), t, pan=rng.uniform(-0.35, 0.35), gain=0.06 * padg)
        steps = int(round(d / (BEAT / 4)))
        for k in range(steps):
            tk = t + k * BEAT / 4
            if plucks == 8 and k % 2 == 0: put(pluck(ar[(k // 2) % len(ar)], 0.3, bright), tk, pan=0.25 if (k // 2) % 2 else -0.25, gain=0.07)
            if plucks == 4 and k % 4 == 0: put(pluck(ar[(k // 4) % len(ar)] - 12, 0.5, bright), tk, pan=-0.15, gain=0.08)
            if arp: put(pluck(ar[k % len(ar)], 0.22, bright), tk, pan=np.sin(k * 0.7) * 0.5, gain=0.045 * arp)
            if bells and k % 2 == 1: put(bell(ar[(k // 2) % len(ar)] + 12, 0.9), tk, pan=np.cos(k * 0.5) * 0.6, gain=0.03 * bells)
            if pulses and k % 4 == 0: put(pulse(root), tk, gain=0.10 * pulses)
            if airs and k % 4 == 2: put(air(), tk, pan=0.4, gain=0.05 * airs)
            if motif and k % 8 == 0: put(pluck(69 if (k // 8) % 2 == 0 else 70, 0.6, 0.3), tk, pan=0.1, gain=0.06)  # A–Bb: quiet half-step unease
        t += d; i += 1

S = lambda k: SC[k]["start"]; E = lambda k: SC[k]["end"]
section(0, E("s01-hook"), ["Dm", "Dm"], bright=0.15, motif=True, padg=0.9)
section(S("s02-trust-state"), E("s02-trust-state"), ["Bb", "F"], bright=0.25, plucks=4, padg=0.95)
section(S("s03-publish"), E("s03-publish"), ["Dm", "Bb", "F", "C"], bright=0.35, plucks=8)
section(S("s04-pipeline"), E("s06-regression"), ["Dm", "Bb", "F", "C"], bright=0.45, arp=0.8, pulses=0.7, airs=0.6)
section(S("s07-blast-radius"), E("s08-gateway"), ["Bb", "C", "Dm", "F", "Gm", "C"], bright=0.7, arp=1.0, bells=1.0, pulses=1.0, airs=0.8, padg=1.15)
section(S("s09-human-review"), E("s09-human-review"), ["F", "Dm"], bright=0.3, plucks=4, padg=0.85)
section(S("s10-close"), DUR - 1.6, ["Dadd9"], bright=0.35, padg=0.9)
put(bell(74, 2.4), S("s10-close") + 0.15, gain=0.05); put(bell(78, 2.4), S("s10-close") + 0.4, pan=0.3, gain=0.035)

# section crossfade smoothing + global fades; a gentle low-shelf trim keeps it out of the voice's way
t = np.arange(N) / SR
fade = np.clip(t / 2.5, 0, 1) * np.clip((DUR - t) / 3.5, 0, 1)
hp = butter(2, 70, "highpass", fs=SR, output="sos")
st = np.stack([sosfilt(hp, L) * fade, sosfilt(hp, R) * fade], axis=1)
st *= 0.5 / np.max(np.abs(st))
sf.write(ROOT / "public/audio/music.wav", st.astype(np.float32), SR, subtype="PCM_16")
print("wrote public/audio/music.wav", f"{DUR:.1f}s")
