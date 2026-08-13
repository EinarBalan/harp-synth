# Harp DSP

This directory contains the browser audio engine for the harp synth. The engine renders stereo audio samples, tracks note state by caller-provided note IDs, and owns the effect state needed by the audio worklet.

## Files

- `config.ts`: sample-rate defaults, voice limits, volume-shape settings, chorus settings, and reverb settings.
- `tonePresets.json`: editable tone preset data.
- `tones.ts`: tone preset types, preset lookup, and index clamping.
- `oscillator.ts`: sine lookup table, smoothed saw/square waves, clamped sine, wave-cycle wrapping, interpolation, and output limiting.
- `engine.ts`: `HarpDsp`, voice allocation, note start/release handling, volume shaping, chorus, reverb, and block rendering.
- `utils.ts`: small shared helpers.

## Basic Usage

```ts
import { HarpDsp } from "./engine";

const dsp = new HarpDsp(sampleRate);
const left = new Float32Array(128);
const right = new Float32Array(128);

dsp.handleEvent({ type: "noteOn", noteId: 1, frequency: 440, velocity: 1 });
dsp.process(left, right);
```

`process()` writes directly into the provided buffers. Both buffers should have the same length for stereo output.
