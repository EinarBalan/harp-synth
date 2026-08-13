#pragma once

/**
 * @file oscillator.h
 * Wave generation helpers used by HarpDsp voices and effects.
 */

#include "tones.h"

namespace harp {

/**
 * Builds the sine lookup table on first use.
 *
 * Callers may invoke this explicitly during setup(), but HarpDsp::reset() also
 * calls it before audio processing starts.
 */
void initializeOscillator();

/**
 * Renders one tone layer at the supplied point in its wave cycle.
 *
 * @param phase Position in the wave cycle, from 0 up to but not including 1.
 * @param frequency Note frequency in Hz. Used for high-frequency gain rules.
 * @param partial Tone layer configuration.
 * @param phaseIncrement Layer phase step per sample, used to smooth saw/square edges.
 */
float oscillatorPartial(float phase, float frequency, const TonePartial& partial, float phaseIncrement);

/** Reads a sine value from the lookup table. phase is 0 to 1; phaseOffset is radians. */
float sineWave(float phase, float phaseOffset = 0.0f);
/** Linear interpolation helper. */
float lerp(float a, float b, float t);
/** Wraps a wave-cycle position into [0, 1). */
float wrapPhase(float phase);
/** Softly limits the final output so it stays bounded. */
float softClip(float sample);

}  // namespace harp
