/** Default runtime sample rate in Hz. */
export const DEFAULT_SAMPLE_RATE = 48000;
/** Default master volume, from 0 to 1. */
export const DEFAULT_VOLUME = 0.5;
/** Default tone preset index. */
export const DEFAULT_TONE_INDEX = 0;
/** Default reverb mix, from 0 to 1. */
export const DEFAULT_REVERB = 0;
/** Whether chorus is enabled by default. */
export const DEFAULT_CHORUS = false;
/** Whether note pitch changes slide slowly by default. */
export const DEFAULT_SLIDE = false;

/** Maximum simultaneous voices allocated inside the synth engine. */
export const MAX_VOICES = 24;
/** Voice frequency used for inactive/default voice state. */
export const DEFAULT_VOICE_FREQUENCY = 440;
/** Global gain applied before effects and soft clipping. */
export const OUTPUT_GAIN = 0.22;
/** Number of samples in the sine lookup table. */
export const SINE_TABLE_SIZE = 2048;
/** Linear attack duration for a newly gated voice. */
export const ATTACK_SECONDS = 0.006;
/** Linear release duration after noteOff. */
export const RELEASE_SECONDS = 0.16;
/** Per-sample pitch-change amount used when slide is enabled. */
export const GLIDE_COEFFICIENT = 0.00075;
/** Per-sample pitch-change amount used when slide is disabled. */
export const FAST_GLIDE_COEFFICIENT = 0.035;
/** Strength of the final output limiter. */
export const SOFT_CLIP_DRIVE = 1.4;
/** Drive amount used before clamping the clamped-sine waveform. */
export const CLAMPED_SINE_DRIVE = 1.6;

/** Total chorus delay memory in seconds. */
export const CHORUS_DELAY_SECONDS = 0.06;
/** Moving chorus delays used to create the effect-only stereo signal. */
export const CHORUS_VOICES = [
  { delaySeconds: 0.017, depthSeconds: 0.0018, rateHz: 0.37, phaseOffset: 0 },
  { delaySeconds: 0.024, depthSeconds: 0.0024, rateHz: 0.53, phaseOffset: 0.37 },
  { delaySeconds: 0.031, depthSeconds: 0.0015, rateHz: 0.79, phaseOffset: 0.71 }
] as const;
/** Additional delay for the right chorus tap in seconds. */
export const CHORUS_RIGHT_DELAY_OFFSET_SECONDS = 0.004;
/** Movement-cycle offset for the right chorus tap, from 0 to 1. */
export const CHORUS_RIGHT_PHASE_OFFSET = 0.5;
/** Feedback amount written back into the chorus delay line. */
export const CHORUS_FEEDBACK_GAIN = 0;
/** Stereo widening factor applied to the effect-only side signal. */
export const CHORUS_STEREO_WIDTH = 1.45;
/** Smoothing amount for chorus effect output. */
export const CHORUS_WET_FILTER = 0.32;
/** Dry gain while chorus is enabled. */
export const CHORUS_DRY_GAIN = 0.75;
/** Wet gain while chorus is enabled. */
export const CHORUS_WET_GAIN = 0.4;

/** Left-channel reverb delay lengths in seconds. */
export const REVERB_DELAY_SECONDS = [0.053, 0.071, 0.097, 0.131] as const;
/** Right-channel reverb delay lengths in seconds. */
export const REVERB_RIGHT_DELAY_SECONDS = [0.061, 0.083, 0.113, 0.149] as const;
/** Feedback gain for each parallel reverb delay line. */
export const REVERB_FEEDBACK = [0.78, 0.74, 0.7, 0.66] as const;
/** Smoothing amount inside the feedback path. */
export const REVERB_DAMPING = 0.22;
/** Crossfeed amount between left and right reverb feedback paths. */
export const REVERB_STEREO_CROSSFEED = 0.18;
/** Original-signal gain when the reverb mix is at maximum. */
export const REVERB_DRY_GAIN_AT_MAX = 0.75;
/** Overall reverb effect gain. */
export const REVERB_WET_GAIN = 0.82;
