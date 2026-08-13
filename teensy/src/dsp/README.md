# Harp DSP

This directory contains the embedded audio engine for the harp synth. The code is written so memory use is predictable: delay buffers are fixed-size, the voice pool is fixed, and audio rendering does not allocate memory.

## Files

- `config.h`: sample-rate defaults, voice limits, volume-shape settings, chorus settings, reverb settings, and fixed delay-buffer sizes.
- `tones.h` / `tones.cpp`: tone preset types and compiled preset data.
- `oscillator.h` / `oscillator.cpp`: sine lookup table, smoothed saw/square waves, clamped sine, wave-cycle wrapping, interpolation, and output limiting.
- `engine.h` / `engine.cpp`: `harp::HarpDsp`, voice allocation, note start/release handling, volume shaping, chorus, reverb, and block rendering.
- `HarpDsp.h`: compatibility include for firmware that wants the main class header by name.
- `utils.h`: small shared helpers.

## Basic Usage

```cpp
#include "dsp/HarpDsp.h"

static harp::HarpDsp dsp(48000.0f);

void noteOn(int id, float hz, float velocity) {
  dsp.noteOn(id, hz, velocity);
}

void renderAudioBlock(float* left, float* right, std::size_t frames) {
  dsp.process(left, right, frames);
}
```

Store `harp::HarpDsp` globally or statically. With the default maximum sample rate, one instance is too large for stack allocation.

## Sample Rate

Delay buffers are sized from `HARP_DSP_MAX_SAMPLE_RATE`, which defaults to 48000. Define it before including DSP headers if firmware renders above 48 kHz:

```cpp
#define HARP_DSP_MAX_SAMPLE_RATE 96000
#include "dsp/HarpDsp.h"
```

Increasing the maximum sample rate increases the memory used by each `harp::HarpDsp` instance.
