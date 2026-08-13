import { CLAMPED_SINE_DRIVE, DEFAULT_SAMPLE_RATE, SINE_TABLE_SIZE, SOFT_CLIP_DRIVE } from "./config";
import { type TonePartial } from "./tones";
import { clamp } from "./utils";

const TWO_PI = Math.PI * 2;
const SINE_TABLE = createSineTable(SINE_TABLE_SIZE);

/**
 * Renders one tone layer at the supplied point in its wave cycle.
 *
 * @param phase Position in the wave cycle, from 0 up to but not including 1.
 * @param frequency Note frequency in Hz. Used for high-frequency gain rules.
 * @param partial Tone layer configuration.
 * @param phaseIncrement Layer phase step per sample, used to smooth saw/square edges.
 */
export function oscillatorPartial(phase: number, frequency: number, partial: TonePartial, phaseIncrement?: number) {
  // phaseOffset is stored in radians while phase is tracked from 0 to 1.
  const partialPhase = wrapPhase(phase + (partial.phaseOffset ?? 0) / TWO_PI);
  const dt = phaseIncrement ?? Math.abs((frequency * (partial.ratio ?? 1)) / DEFAULT_SAMPLE_RATE);

  // Allows individual layers to become quieter at higher note frequencies.
  const gain =
    partial.highFrequencyThreshold !== undefined && frequency >= partial.highFrequencyThreshold
      ? partial.gain * (partial.highFrequencyGain ?? 1)
      : partial.gain;

  // Generate the selected wave shape and apply this layer's volume.
  switch (partial.waveform) {
    case "triangle":
      return triangleWave(partialPhase) * gain;
    case "saw":
      return sawWave(partialPhase, dt) * gain;
    case "square":
      return squareWave(partialPhase, dt) * gain;
    case "clampedSine":
      return clampedSineWave(partialPhase) * gain;
    case "sine":
    default:
      return sineWave(partialPhase) * gain;
  }
}

/** Builds a sine lookup table. */
function createSineTable(size: number) {
  const table = new Float32Array(size);
  for (let index = 0; index < size; index += 1) {
    table[index] = Math.sin((index / size) * TWO_PI);
  }
  return table;
}

/** Reads a sine value from the lookup table. phase is 0 to 1; phaseOffset is radians. */
export function sineWave(phase: number, phaseOffset = 0) {
  const tablePhase = wrapPhase(phase + phaseOffset / TWO_PI);
  const readIndex = tablePhase * SINE_TABLE.length;
  const indexA = Math.floor(readIndex);
  const indexB = (indexA + 1) % SINE_TABLE.length;
  const fraction = readIndex - indexA;
  return lerp(SINE_TABLE[indexA], SINE_TABLE[indexB], fraction);
}

/** Generates a triangle wave in the [-1, 1] audio range. */
function triangleWave(phase: number) {
  return 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
}

/** Generates a saw wave with smoothed edges. */
function sawWave(phase: number, phaseIncrement: number) {
  return phase * 2 - 1 - polyBlep(phase, phaseIncrement);
}

/** Generates a square wave with smoothed edges. */
function squareWave(phase: number, phaseIncrement: number) {
  return (phase < 0.5 ? 1 : -1) + polyBlep(phase, phaseIncrement) - polyBlep(wrapPhase(phase + 0.5), phaseIncrement);
}

/** Generates a louder sine wave clamped to the audio range. */
function clampedSineWave(phase: number) {
  return clamp(sineWave(phase) * CLAMPED_SINE_DRIVE, -1, 1);
}

/**
 * Smooths a hard wave edge.
 *
 * This is the PolyBLEP method. It reduces harsh digital artifacts without
 * rendering extra samples.
 */
function polyBlep(phase: number, phaseIncrement: number) {
  const dt = clamp(phaseIncrement, 0, 0.5);
  if (dt === 0) {
    return 0;
  }

  if (phase < dt) {
    const t = phase / dt;
    return t + t - t * t - 1;
  }

  if (phase > 1 - dt) {
    const t = (phase - 1) / dt;
    return t * t + t + t + 1;
  }

  return 0;
}

/** Linear interpolation helper. */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Wraps a wave-cycle position to the range [0, 1). */
export function wrapPhase(phase: number) {
  return phase - Math.floor(phase);
}

/** Softly limits the final output so it stays bounded. */
export function softClip(sample: number) {
  return Math.tanh(sample * SOFT_CLIP_DRIVE);
}
