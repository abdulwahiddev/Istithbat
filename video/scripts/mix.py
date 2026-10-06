#!/usr/bin/env python3
"""Sound design + final mix.

Inputs  public/audio/voiceover.wav   narration (scripts/tts.py)
        public/audio/music.wav       score (scripts/music.py, or any licensed replacement)
        public/audio/events.json     cue sheet exported from src/audio/events.ts
Outputs public/audio/sfx.wav         sound-design stem (synthesized here, one sound per cue)
        public/audio/mix.wav         final master the composition plays

Mix targets: narration always dominant; music ~14 dB under the voice while speaking (ducked
~5 dB under speech, breathing back up in gaps, transitions and the final logo); SFX tactile, well
under the voice. Master: -15 LUFS integrated, true peak <= -1.5 dBTP, no heavy compression.
"""
import json
from pathlib import Path
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "public/audio"
EV = json.loads((A / "events.json").read_text())
SR = 48000
DUR = EV["durationSec"]
N = int(DUR * SR)
rng = np.random.default_rng(7)
T = lambda d: np.arange(int(d * SR)) / SR
env = lambda t, a, d: np.clip(t / a, 0, 1) * np.exp(-np.maximum(t - a, 0) / d)
bp = lambda lo, hi: butter(2, [lo, hi], "bandpass", fs=SR, output="sos")

# ---------- sound palette (premium software, not game UI: short, soft, filtered) ----------
def s_click(p=1):
    t = T(0.09)
    tr = sosfilt(bp(1800, 6000), rng.normal(0, 1, len(t))) * env(t, 0.0008, 0.006)
    body = np.sin(2 * np.pi * 2300 * p * t) * env(t, 0.001, 0.018) * 0.35 + np.sin(2 * np.pi * 140 * t) * env(t, 0.002, 0.025) * 0.5
    return tr * 0.6 + body

def s_rise(p=1):
    t = T(0.75)
    f = 260 * p * (1 + 1.6 * (t / t[-1]) ** 1.5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.sin(np.pi * np.clip(t / 0.75, 0, 1)) ** 1.5
    airy = sosfilt(bp(2000, 7000), rng.normal(0, 1, len(t))) * np.sin(np.pi * t / 0.75) ** 2 * 0.15
    return (tone * 0.5 + airy) * 0.8

def s_tick(p=1):
    t = T(0.12)
    f = 1650 * p
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.7 * t) * np.exp(-t * 60)) * env(t, 0.0015, 0.03) * 0.7

def s_texture(p=1):
    t = T(1.3)
    n = sosfilt(bp(900, 3200), rng.normal(0, 1, len(t)))
    gran = (rng.random(len(t)) < 0.0018) * rng.normal(0, 1, len(t))  # sparse analytical grain, not sparkle
    g = sosfilt(bp(2500, 6000), gran) * 3
    return (n * 0.12 + g * 0.25) * np.sin(np.pi * t / 1.3) ** 2

def s_confirm(p=1):
    a = s_tick(0.86 * p); b = s_tick(1.29 * p)
    out = np.zeros(int(0.3 * SR)); out[: len(a)] += a; i = int(0.085 * SR); out[i:i + len(b)] += b
    return out * 0.85

def s_accent(p=1):
    t = T(0.9)
    f = 620 * p
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 9) + 0.2 * np.sin(2 * np.pi * f * 0.5 * t)) * env(t, 0.002, 0.22) * 0.75

def s_land(p=1):
    return s_tick(0.72 * p) * 0.75

def s_lock(p=1):
    t = T(0.35)
    a = sosfilt(bp(1200, 5000), rng.normal(0, 1, len(t))) * env(t, 0.0006, 0.005)
    b = np.zeros_like(t); i = int(0.028 * SR); b[i:] = sosfilt(bp(900, 4000), rng.normal(0, 1, len(t) - i)) * env(t[: len(t) - i], 0.0006, 0.008)
    tone = (np.sin(2 * np.pi * 330 * p * t) + 0.4 * np.sin(2 * np.pi * 660 * p * t)) * env(t, 0.002, 0.08)
    return a * 0.55 + b * 0.5 + tone * 0.45

def s_node(p=1):
    t = T(0.35)
    f = 880 * p
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 20)) * env(t, 0.002, 0.09) * 0.55

def s_pulse(p=1):
    t = T(0.8)
    f = 520 * p
    trem = 0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)
    return np.sin(2 * np.pi * f * t) * trem * np.sin(np.pi * t / 0.8) ** 2 * 0.35

def s_impact(p=1):
    t = T(1.4)
    f = 440 * p
    mallet = (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.5 * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)) * env(t, 0.002, 0.35)
    low = (np.sin(2 * np.pi * 110 * t) + 0.5 * np.sin(2 * np.pi * 220 * t)) * env(t, 0.004, 0.25)
    return mallet * 0.55 + low * 0.5

def s_low(p=1):
    t = T(1.1)
    f = 82 * (1 - 0.15 * np.clip(t / 0.6, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.6 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * env(t, 0.006, 0.3) * 0.7

def s_flow(p=1):
    t = T(2.8)
    tone = np.sin(2 * np.pi * 587.3 * t) + 0.6 * np.sin(2 * np.pi * 880 * t) + 0.25 * np.sin(2 * np.pi * 1174.7 * t)
    shimmer = 0.75 + 0.25 * np.sin(2 * np.pi * 3 * t)
    return tone * shimmer * np.clip(t / 0.5, 0, 1) * np.clip((2.8 - t) / 1.4, 0, 1) * 0.22

def s_arrive(p=1):
    return s_tick(0.95 * p) * 0.7

def s_resolve(p=1):
    t = T(4.0)
    out = np.zeros_like(t)
    for f, g in ((293.7, 1), (440, 0.7), (587.3, 0.6), (659.3, 0.4), (880, 0.25)):
        out += np.sin(2 * np.pi * f * t) * g * np.exp(-t / 1.6)
    return out * np.clip(t / 0.02, 0, 1) * 0.3

PAL = {k[2:]: v for k, v in globals().items() if k.startswith("s_")}
# relative level per sound (dB), so accents read as accents and ticks stay small
LEVEL = {"click": -4, "rise": -8, "tick": -11, "texture": -12, "confirm": -9, "accent": -8, "land": -13, "lock": -5,
         "node": -10, "pulse": -11, "impact": -3, "low": -5, "flow": -9, "arrive": -12, "resolve": -6}

sfxL = np.zeros(N + SR * 5); sfxR = np.zeros(N + SR * 5)
for e in EV["events"]:
    s = PAL[e["sfx"]](e.get("pitch", 1) or 1)
    s = s / (np.max(np.abs(s)) + 1e-9) * 10 ** ((LEVEL[e["sfx"]]) / 20) * (e.get("gain", 1) or 1)
    pan = e.get("pan", 0) or 0
    i = int(e["t"] * SR)
    sfxL[i:i + len(s)] += s * np.sqrt(0.5 * (1 - pan)); sfxR[i:i + len(s)] += s * np.sqrt(0.5 * (1 + pan))
sfx = np.stack([sfxL[:N], sfxR[:N]], axis=1)

# ---------- voice, music, ducking ----------
v, vsr = sf.read(A / "voiceover.wav", always_2d=True); assert vsr == SR
voice = np.zeros((N, 2)); voice[: min(N, len(v))] = v[:N, :1].repeat(2, axis=1)[:N]
m, msr = sf.read(A / "music.wav", always_2d=True); assert msr == SR
music = np.zeros((N, 2)); music[: min(N, len(m))] = m[:N]

t = np.arange(N) / SR
speaking = np.zeros(N, bool)
for a, b in EV["speech"]: speaking[int((a - 0.12) * SR):int((b + 0.05) * SR)] = True
# smooth duck gain: -5 dB while speaking, attack ~120 ms, release ~600 ms
target = np.where(speaking, 10 ** (-5 / 20), 1.0)
duck = np.empty(N); g = 1.0
att, rel = np.exp(-1 / (0.12 * SR)), np.exp(-1 / (0.6 * SR))
for i in range(0, N, 64):
    tg = target[i]; c = att if tg < g else rel
    g = tg + (g - tg) * c ** 64
    duck[i:i + 64] = g
music *= duck[:, None]

meter = pyln.Meter(SR)
Lv = meter.integrated_loudness(voice[speaking])
Lm = meter.integrated_loudness(music[speaking])
music *= 10 ** (((Lv - 14.0) - Lm) / 20)          # music 14 LU under the voice while it speaks
Ls = meter.integrated_loudness(sfx[np.any(np.abs(sfx) > 1e-4, axis=1)])
sfx *= 10 ** (((Lv - 12.0) - Ls) / 20)            # SFX events ~12 LU under the voice (short, so they read)

mix = voice + music + sfx
# master: loudness to -15 LUFS, then a transparent peak limiter to -1.5 dBTP (4x oversampled check)
mix *= 10 ** ((-15.0 - meter.integrated_loudness(mix)) / 20)
ceil = 10 ** (-1.5 / 20)
def true_peak(x): return np.max(np.abs(resample_poly(x, 4, 1, axis=0)))
tp = true_peak(mix)
if tp > ceil:
    # gain-envelope limiter: look-ahead 5 ms, release 80 ms, only acts on rare peaks
    a = np.max(np.abs(mix), axis=1); need = np.minimum(1, ceil * 0.97 / np.maximum(a, 1e-9))
    la = int(0.005 * SR)
    gg = np.empty(N); cur = 1.0; r = np.exp(-1 / (0.08 * SR))
    win = np.array([need[max(0, i - la):i + la].min() for i in range(0, N, 32)]).repeat(32)[:N]
    for i in range(N):
        cur = win[i] if win[i] < cur else win[i] + (cur - win[i]) * r
        gg[i] = cur
    mix *= gg[:, None]
fade = np.clip((DUR - t) / 0.4, 0, 1)
mix *= fade[:, None]

sf.write(A / "sfx.wav", sfx.astype(np.float32), SR, subtype="PCM_16")
sf.write(A / "mix.wav", mix.astype(np.float32), SR, subtype="PCM_16")
print(f"voice {Lv:.1f} LUFS (speech) | music under speech {Lv-14:.1f} | mix {meter.integrated_loudness(mix):.1f} LUFS | true peak {20*np.log10(true_peak(mix)):.1f} dBTP | {len(EV['events'])} SFX")
