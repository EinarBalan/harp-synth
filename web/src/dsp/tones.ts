import tonePresets from "./tonePresets.json";
import { clamp } from "./utils";

/** Wave shapes supported by a tone layer. */
export type ToneWaveform = "sine" | "triangle" | "saw" | "square" | "clampedSine";

/** One sound layer inside a tone preset. */
export interface TonePartial {
  /** Wave shape to render for this layer. */
  waveform: ToneWaveform;
  /** Volume for this layer. */
  gain: number;
  /** Frequency multiplier relative to the note frequency. Defaults to 1. */
  ratio?: number;
  /** Phase offset in radians. Defaults to 0. */
  phaseOffset?: number;
  /** Note-frequency threshold where highFrequencyGain applies. */
  highFrequencyThreshold?: number;
  /** Gain multiplier used at and above highFrequencyThreshold. */
  highFrequencyGain?: number;
}

/** A named sound made from layers and a simple smoothing filter. */
export interface TonePreset {
  /** Display label for UI/debug use. */
  label?: string;
  /** Strength of the per-voice smoothing filter. */
  filterCutoff: number;
  /** Sound layers rendered for each active voice. */
  partials: readonly TonePartial[];
}

/** Compiled tone preset table loaded by the bundler from JSON. */
export const TONE_PRESETS = tonePresets as readonly TonePreset[];

/** Number of available tone presets. */
export const TONE_PRESET_COUNT = TONE_PRESETS.length;

/** Clamps and rounds a requested preset index to the valid range. */
export function clampToneIndex(index: number) {
  return Math.round(clamp(index, 0, TONE_PRESETS.length - 1));
}

/** Returns a valid tone preset, falling back to the first preset when needed. */
export function getTonePreset(index: number) {
  return TONE_PRESETS[clampToneIndex(index)] ?? TONE_PRESETS[0];
}
