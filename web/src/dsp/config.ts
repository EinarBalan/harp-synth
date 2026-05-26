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

export const CHORUS_DELAY_SECONDS = 0.055;
export const CHORUS_RATE_HZ = 0.65;
export const CHORUS_LEFT_DELAY_SECONDS = 0.018;
export const CHORUS_LEFT_DEPTH_SECONDS = 0.005;
export const CHORUS_RIGHT_DELAY_SECONDS = 0.022;
export const CHORUS_RIGHT_DEPTH_SECONDS = 0.006;
export const CHORUS_FEEDBACK_GAIN = 0.055;
export const CHORUS_DRY_GAIN = 0.72;
export const CHORUS_WET_GAIN = 0.28;

export const REVERB_DELAY_SECONDS = [0.043, 0.061, 0.079, 0.101] as const;
export const REVERB_FEEDBACK = [0.42, 0.39, 0.36, 0.33] as const;
