"""Generates the rest-timer sounds in assets/sounds (run: python3 scripts/make-sounds.py)."""
import math
import struct
import wave

RATE = 44100


def write(name, seconds, sample):
    frames = bytearray()
    for i in range(int(RATE * seconds)):
        v = max(-1.0, min(1.0, sample(i / RATE)))
        frames += struct.pack('<h', int(v * 32767))
    with wave.open(f'assets/sounds/{name}.wav', 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(bytes(frames))


def tick(t):
    # A short, dry woodblock-like click.
    attack = min(1.0, t / 0.002)
    return 0.9 * attack * math.exp(-t * 55) * (math.sin(2 * math.pi * 1500 * t) + 0.4 * math.sin(2 * math.pi * 3100 * t)) / 1.4


def ding(t):
    # A bell: a fundamental with inharmonic partials that die away faster.
    attack = min(1.0, t / 0.004)
    partials = [(1046.5, 1.0, 3.0), (2093.0, 0.45, 4.5), (2890.0, 0.3, 6.0), (5650.0, 0.15, 9.0)]
    total = sum(a for _, a, _ in partials)
    return 0.9 * attack * sum(a * math.exp(-t * d) * math.sin(2 * math.pi * f * t) for f, a, d in partials) / total


write('tick', 0.09, tick)
write('ding', 1.5, ding)
