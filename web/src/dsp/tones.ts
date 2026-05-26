import tonePresets from "./tonePresets.json";
import { clamp } from "./utils";

export type ToneWaveform = "sine" | "triangle" | "saw" | "square" | "clampedSine";

export interface TonePartial {
  waveform: ToneWaveform;
  gain: number;
  ratio?: number;
  phaseOffset?: number;
  highFrequencyThreshold?: number;
  highFrequencyGain?: number;
}

export interface TonePreset {
  label?: string;
  filterCutoff: number;
  partials: readonly TonePartial[];
}

export const TONE_PRESETS = tonePresets as readonly TonePreset[];

export const TONE_PRESET_COUNT = TONE_PRESETS.length;

export function clampToneIndex(index: number) {
  return Math.round(clamp(index, 0, TONE_PRESETS.length - 1));
}

export function getTonePreset(index: number) {
  return TONE_PRESETS[clampToneIndex(index)] ?? TONE_PRESETS[0];
}
