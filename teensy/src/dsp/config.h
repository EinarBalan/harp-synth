#pragma once

/**
 * @file config.h
 * Fixed DSP configuration shared by the Teensy C++ implementation.
 *
 * These constants intentionally remain compile-time values so delay buffers can
 * be statically sized for microcontroller use.
 */

#include <cstddef>
#include <cstdint>

/**
 * Maximum sample rate used to size delay buffers.
 *
 * Define this before including the DSP headers if the firmware will run above
 * 48 kHz. Higher values increase the size of each HarpDsp instance.
 */
#ifndef HARP_DSP_MAX_SAMPLE_RATE
#define HARP_DSP_MAX_SAMPLE_RATE 48000
#endif

namespace harp {

/** Default runtime sample rate in Hz. */
static constexpr float DEFAULT_SAMPLE_RATE = 48000.0f;
/** Default master volume, from 0 to 1. */
static constexpr float DEFAULT_VOLUME = 0.5f;
/** Default tone preset index. */
static constexpr std::uint8_t DEFAULT_TONE_INDEX = 0;
/** Default reverb mix, from 0 to 1. */
static constexpr float DEFAULT_REVERB = 0.0f;
/** Whether chorus is enabled by default. */
static constexpr bool DEFAULT_CHORUS = false;
/** Whether note pitch changes slide slowly by default. */
static constexpr bool DEFAULT_SLIDE = false;

/** Maximum simultaneous voices allocated inside HarpDsp. */
static constexpr std::size_t MAX_VOICES = 24;
/** Maximum partials supported by any compiled tone preset. */
static constexpr std::size_t MAX_TONE_PARTIALS = 7;
/** Voice frequency used for inactive/default voice state. */
static constexpr float DEFAULT_VOICE_FREQUENCY = 440.0f;
/** Global gain applied before effects and soft clipping. */
static constexpr float OUTPUT_GAIN = 0.22f;
/** Number of samples in the sine lookup table. */
static constexpr std::size_t SINE_TABLE_SIZE = 2048;
/** Linear attack duration for a newly gated voice. */
static constexpr float ATTACK_SECONDS = 0.006f;
/** Linear release duration after noteOff. */
static constexpr float RELEASE_SECONDS = 0.16f;
/** Per-sample pitch-change amount used when slide is enabled. */
static constexpr float GLIDE_COEFFICIENT = 0.00075f;
/** Per-sample pitch-change amount used when slide is disabled. */
static constexpr float FAST_GLIDE_COEFFICIENT = 0.035f;
/** Strength of the final output limiter. */
static constexpr float SOFT_CLIP_DRIVE = 1.4f;
/** Drive amount used before clamping the clamped-sine waveform. */
static constexpr float CLAMPED_SINE_DRIVE = 1.6f;

/** Parameters for one moving chorus delay. */
struct ChorusVoiceConfig {
  /** Base delay in seconds. */
  float delaySeconds;
  /** How far the delay time moves, in seconds. */
  float depthSeconds;
  /** How fast the delay time moves, in Hz. */
  float rateHz;
  /** Initial position in the movement cycle, from 0 to 1. */
  float phaseOffset;
};

/** Total chorus delay memory in seconds. */
static constexpr float CHORUS_DELAY_SECONDS = 0.06f;
/** Moving chorus delays used to create the effect-only stereo signal. */
static constexpr ChorusVoiceConfig CHORUS_VOICES[] = {
  {0.017f, 0.0018f, 0.37f, 0.0f},
  {0.024f, 0.0024f, 0.53f, 0.37f},
  {0.031f, 0.0015f, 0.79f, 0.71f},
};
/** Number of configured moving chorus delays. */
static constexpr std::size_t CHORUS_VOICE_COUNT = sizeof(CHORUS_VOICES) / sizeof(CHORUS_VOICES[0]);
/** Additional delay for the right chorus tap in seconds. */
static constexpr float CHORUS_RIGHT_DELAY_OFFSET_SECONDS = 0.004f;
/** Movement-cycle offset for the right chorus tap, from 0 to 1. */
static constexpr float CHORUS_RIGHT_PHASE_OFFSET = 0.5f;
/** Feedback amount written back into the chorus delay line. */
static constexpr float CHORUS_FEEDBACK_GAIN = 0.0f;
/** Stereo widening factor applied to the effect-only side signal. */
static constexpr float CHORUS_STEREO_WIDTH = 1.45f;
/** Smoothing amount for chorus effect output. */
static constexpr float CHORUS_WET_FILTER = 0.32f;
/** Dry gain while chorus is enabled. */
static constexpr float CHORUS_DRY_GAIN = 0.75f;
/** Wet gain while chorus is enabled. */
static constexpr float CHORUS_WET_GAIN = 0.4f;

/** Number of parallel delay lines per stereo side in the reverb. */
static constexpr std::size_t REVERB_LINE_COUNT = 4;
/** Left-channel reverb delay lengths in seconds. */
static constexpr float REVERB_LEFT_DELAY_SECONDS[REVERB_LINE_COUNT] = {0.053f, 0.071f, 0.097f, 0.131f};
/** Right-channel reverb delay lengths in seconds. */
static constexpr float REVERB_RIGHT_DELAY_SECONDS[REVERB_LINE_COUNT] = {0.061f, 0.083f, 0.113f, 0.149f};
/** Feedback gain for each parallel reverb delay line. */
static constexpr float REVERB_FEEDBACK[REVERB_LINE_COUNT] = {0.78f, 0.74f, 0.7f, 0.66f};
/** Smoothing amount inside the feedback path. */
static constexpr float REVERB_DAMPING = 0.22f;
/** Crossfeed amount between left and right reverb feedback paths. */
static constexpr float REVERB_STEREO_CROSSFEED = 0.18f;
/** Original-signal gain when the reverb mix is at maximum. */
static constexpr float REVERB_DRY_GAIN_AT_MAX = 0.75f;
/** Overall reverb effect gain. */
static constexpr float REVERB_WET_GAIN = 0.82f;

/**
 * Converts a delay length in seconds to the static buffer capacity needed at
 * HARP_DSP_MAX_SAMPLE_RATE.
 */
constexpr std::size_t delayCapacity(float seconds) {
  return static_cast<std::size_t>(
    seconds * static_cast<float>(HARP_DSP_MAX_SAMPLE_RATE) + 0.9999f
  );
}

/** Static capacity for the shared chorus delay buffer. */
static constexpr std::size_t CHORUS_BUFFER_CAPACITY = delayCapacity(CHORUS_DELAY_SECONDS);
/** Static capacity for left reverb delay line 0. */
static constexpr std::size_t REVERB_LEFT_0_BUFFER_CAPACITY = delayCapacity(REVERB_LEFT_DELAY_SECONDS[0]);
/** Static capacity for left reverb delay line 1. */
static constexpr std::size_t REVERB_LEFT_1_BUFFER_CAPACITY = delayCapacity(REVERB_LEFT_DELAY_SECONDS[1]);
/** Static capacity for left reverb delay line 2. */
static constexpr std::size_t REVERB_LEFT_2_BUFFER_CAPACITY = delayCapacity(REVERB_LEFT_DELAY_SECONDS[2]);
/** Static capacity for left reverb delay line 3. */
static constexpr std::size_t REVERB_LEFT_3_BUFFER_CAPACITY = delayCapacity(REVERB_LEFT_DELAY_SECONDS[3]);
/** Static capacity for right reverb delay line 0. */
static constexpr std::size_t REVERB_RIGHT_0_BUFFER_CAPACITY = delayCapacity(REVERB_RIGHT_DELAY_SECONDS[0]);
/** Static capacity for right reverb delay line 1. */
static constexpr std::size_t REVERB_RIGHT_1_BUFFER_CAPACITY = delayCapacity(REVERB_RIGHT_DELAY_SECONDS[1]);
/** Static capacity for right reverb delay line 2. */
static constexpr std::size_t REVERB_RIGHT_2_BUFFER_CAPACITY = delayCapacity(REVERB_RIGHT_DELAY_SECONDS[2]);
/** Static capacity for right reverb delay line 3. */
static constexpr std::size_t REVERB_RIGHT_3_BUFFER_CAPACITY = delayCapacity(REVERB_RIGHT_DELAY_SECONDS[3]);

}  // namespace harp
