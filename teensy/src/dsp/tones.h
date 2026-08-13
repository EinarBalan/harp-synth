#pragma once

/**
 * @file tones.h
 * Tone preset data model for the Teensy DSP.
 *
 * Presets are compiled into tones.cpp rather than parsed at runtime, keeping
 * startup predictable and avoiding memory allocation on the microcontroller.
 */

#include "config.h"

#include <cstddef>
#include <cstdint>

namespace harp {

/** Wave shapes supported by a tone layer. */
enum class ToneWaveform : std::uint8_t {
  /** Sine wave read from a small lookup table. */
  Sine,
  /** Mathematically generated triangle wave. */
  Triangle,
  /** Saw wave with smoothed edges to reduce harsh digital artifacts. */
  Saw,
  /** Square wave with smoothed edges to reduce harsh digital artifacts. */
  Square,
  /** Sine wave driven and clamped to add harmonics. */
  ClampedSine,
};

/** One sound layer inside a tone preset. */
struct TonePartial {
  /** Wave shape to render for this layer. */
  ToneWaveform waveform;
  /** Volume for this layer. */
  float gain;
  /** Frequency multiplier relative to the note frequency. */
  float ratio;
  /** Phase offset in radians. */
  float phaseOffset;
  /** Note-frequency threshold where highFrequencyGain applies. */
  float highFrequencyThreshold;
  /** Gain multiplier used at and above highFrequencyThreshold. */
  float highFrequencyGain;
  /** Whether highFrequencyThreshold/highFrequencyGain are active. */
  bool hasHighFrequencyThreshold;
};

/** A named sound made from layers and a simple smoothing filter. */
struct TonePreset {
  /** Display label for UI/debug use. */
  const char* label;
  /** Strength of the per-voice smoothing filter. */
  float filterCutoff;
  /** Pointer to the preset's static layer array. */
  const TonePartial* partials;
  /** Number of entries in partials. */
  std::size_t partialCount;
};

/** @return Number of compiled tone presets. */
std::size_t tonePresetCount();
/** Clamps a requested preset index to the valid compiled range. */
std::uint8_t clampToneIndex(int index);
/** Returns a valid tone preset, clamping out-of-range indexes. */
const TonePreset& tonePreset(std::uint8_t index);

}  // namespace harp
