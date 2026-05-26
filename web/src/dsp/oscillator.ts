import { CLAMPED_SINE_DRIVE, SINE_TABLE_SIZE, SOFT_CLIP_DRIVE } from "./config";
import { type TonePartial } from "./tones";
import { clamp } from "./utils";

const TWO_PI = Math.PI * 2;
const SINE_TABLE = createSineTable(SINE_TABLE_SIZE);

export function oscillatorPartial(phase: number, frequency: number, partial: TonePartial) {
  // Create overtone based on partial ratio.
  const partialPhase = wrapPhase(phase * (partial.ratio ?? 1));

  // Allows for dynamic filtering based on frequency.
  const gain =
    partial.highFrequencyThreshold !== undefined && frequency >= partial.highFrequencyThreshold
      ? partial.gain * (partial.highFrequencyGain ?? 1)
      : partial.gain;

  // Generate the appropriate waveform sample and apply gain.
  switch (partial.waveform) {
    case "triangle":
      return triangleWave(partialPhase) * gain;
    case "saw":
      return sawWave(partialPhase) * gain;
    case "square":
      return squareWave(partialPhase) * gain;
    case "clampedSine":
      return clampedSineWave(partialPhase, partial.phaseOffset ?? 0) * gain;
    case "sine":
    default:
      return sineWave(partialPhase, partial.phaseOffset ?? 0) * gain;
  }
}

function createSineTable(size: number) {
  const table = new Float32Array(size);
  for (let index = 0; index < size; index += 1) {
    table[index] = Math.sin((index / size) * TWO_PI);
  }
  return table;
}

export function sineWave(phase: number, phaseOffset = 0) {
  const tablePhase = wrapPhase(phase + phaseOffset / TWO_PI);
  const readIndex = tablePhase * SINE_TABLE.length;
  const indexA = Math.floor(readIndex);
  const indexB = (indexA + 1) % SINE_TABLE.length;
  const fraction = readIndex - indexA;
  return lerp(SINE_TABLE[indexA], SINE_TABLE[indexB], fraction);
}

function triangleWave(phase: number) {
  return 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
}

function sawWave(phase: number) {
  return phase * 2 - 1;
}

function squareWave(phase: number) {
  return phase < 0.5 ? 1 : -1;
}

function clampedSineWave(phase: number, phaseOffset: number) {
  return clamp(sineWave(phase, phaseOffset) * CLAMPED_SINE_DRIVE, -1, 1);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Wraps a phase value to the range [0, 1).
export function wrapPhase(phase: number) {
  return phase - Math.floor(phase);
}

export function softClip(sample: number) {
  return Math.tanh(sample * SOFT_CLIP_DRIVE);
}
