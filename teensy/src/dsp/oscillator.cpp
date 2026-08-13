#include "oscillator.h"

/**
 * @file oscillator.cpp
 * Waveform rendering implementation for the Teensy DSP.
 */

#include "config.h"
#include "utils.h"

#include <cmath>

namespace harp {

namespace {

constexpr float TWO_PI = 6.28318530717958647692f;

// Lazily initialized to avoid depending on static initialization order.
float sineTable[SINE_TABLE_SIZE] = {};
bool sineTableInitialized = false;

float triangleWave(float phase) {
  return 1.0f - 4.0f * std::fabs(std::round(phase - 0.25f) - (phase - 0.25f));
}

// Smooths the hard edge of saw and square waves so they sound less brittle.
// This is the PolyBLEP method, kept local because callers only need the result.
float polyBlep(float phase, float phaseIncrement) {
  const float dt = clamp(phaseIncrement, 0.0f, 0.5f);
  if (dt == 0.0f) {
    return 0.0f;
  }

  if (phase < dt) {
    const float t = phase / dt;
    return t + t - t * t - 1.0f;
  }

  if (phase > 1.0f - dt) {
    const float t = (phase - 1.0f) / dt;
    return t * t + t + t + 1.0f;
  }

  return 0.0f;
}

float sawWave(float phase, float phaseIncrement) {
  return phase * 2.0f - 1.0f - polyBlep(phase, phaseIncrement);
}

float squareWave(float phase, float phaseIncrement) {
  return (phase < 0.5f ? 1.0f : -1.0f) +
    polyBlep(phase, phaseIncrement) -
    polyBlep(wrapPhase(phase + 0.5f), phaseIncrement);
}

float clampedSineWave(float phase) {
  return clamp(sineWave(phase) * CLAMPED_SINE_DRIVE, -1.0f, 1.0f);
}

}  // namespace

void initializeOscillator() {
  if (sineTableInitialized) {
    return;
  }

  for (std::size_t index = 0; index < SINE_TABLE_SIZE; ++index) {
    sineTable[index] = std::sin((static_cast<float>(index) / static_cast<float>(SINE_TABLE_SIZE)) * TWO_PI);
  }
  sineTableInitialized = true;
}

float oscillatorPartial(float phase, float frequency, const TonePartial& partial, float phaseIncrement) {
  // phaseOffset is stored in radians while phase is tracked from 0 to 1.
  const float partialPhase = wrapPhase(phase + partial.phaseOffset / TWO_PI);
  const float gain =
    partial.hasHighFrequencyThreshold && frequency >= partial.highFrequencyThreshold
      ? partial.gain * partial.highFrequencyGain
      : partial.gain;

  switch (partial.waveform) {
    case ToneWaveform::Triangle:
      return triangleWave(partialPhase) * gain;
    case ToneWaveform::Saw:
      return sawWave(partialPhase, phaseIncrement) * gain;
    case ToneWaveform::Square:
      return squareWave(partialPhase, phaseIncrement) * gain;
    case ToneWaveform::ClampedSine:
      return clampedSineWave(partialPhase) * gain;
    case ToneWaveform::Sine:
    default:
      return sineWave(partialPhase) * gain;
  }
}

float sineWave(float phase, float phaseOffset) {
  // Linear interpolation keeps the lookup table small while avoiding stepping.
  const float tablePhase = wrapPhase(phase + phaseOffset / TWO_PI);
  const float readIndex = tablePhase * static_cast<float>(SINE_TABLE_SIZE);
  const std::size_t indexA = static_cast<std::size_t>(std::floor(readIndex));
  const std::size_t indexB = (indexA + 1) % SINE_TABLE_SIZE;
  const float fraction = readIndex - static_cast<float>(indexA);
  return lerp(sineTable[indexA], sineTable[indexB], fraction);
}

float lerp(float a, float b, float t) {
  return a + (b - a) * t;
}

float wrapPhase(float phase) {
  return phase - std::floor(phase);
}

float softClip(float sample) {
  return std::tanh(sample * SOFT_CLIP_DRIVE);
}

}  // namespace harp
