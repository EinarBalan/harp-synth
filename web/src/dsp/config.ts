export const DEFAULT_SAMPLE_RATE = 48000;
export const DEFAULT_VOLUME = 0.5;
export const DEFAULT_TONE_INDEX = 0;
export const DEFAULT_REVERB = 0;
export const DEFAULT_CHORUS = false;
export const DEFAULT_SLIDE = false;

export const MAX_VOICES = 24;
export const DEFAULT_VOICE_FREQUENCY = 440;
export const OUTPUT_GAIN = 0.22;
export const SINE_TABLE_SIZE = 2048;
export const ATTACK_SECONDS = 0.006;
export const RELEASE_SECONDS = 0.16;
export const GLIDE_COEFFICIENT = 0.00075;
export const FAST_GLIDE_COEFFICIENT = 0.035;
export const SOFT_CLIP_DRIVE = 1.4;
export const CLAMPED_SINE_DRIVE = 1.6;

export const CHORUS_DELAY_SECONDS = 0.06;
export const CHORUS_VOICES = [
  { delaySeconds: 0.017, depthSeconds: 0.0018, rateHz: 0.37, phaseOffset: 0 },
  { delaySeconds: 0.024, depthSeconds: 0.0024, rateHz: 0.53, phaseOffset: 0.37 },
  { delaySeconds: 0.031, depthSeconds: 0.0015, rateHz: 0.79, phaseOffset: 0.71 }
] as const;
export const CHORUS_RIGHT_DELAY_OFFSET_SECONDS = 0.004;
export const CHORUS_RIGHT_PHASE_OFFSET = 0.5;
export const CHORUS_FEEDBACK_GAIN = 0;
export const CHORUS_STEREO_WIDTH = 1.45;
export const CHORUS_WET_FILTER = 0.32;
export const CHORUS_DRY_GAIN = 0.75;
export const CHORUS_WET_GAIN = 0.4;

export const REVERB_DELAY_SECONDS = [0.053, 0.071, 0.097, 0.131] as const;
export const REVERB_RIGHT_DELAY_SECONDS = [0.061, 0.083, 0.113, 0.149] as const;
export const REVERB_FEEDBACK = [0.78, 0.74, 0.7, 0.66] as const;
export const REVERB_DAMPING = 0.22;
export const REVERB_STEREO_CROSSFEED = 0.18;
export const REVERB_DRY_GAIN_AT_MAX = 0.75;
export const REVERB_WET_GAIN = 0.82;
