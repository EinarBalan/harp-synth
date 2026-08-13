#pragma once

/**
 * @file engine.h
 * Embedded C++ audio engine for the harp synth.
 *
 * HarpDsp owns all voice, chorus, and reverb memory. It performs no dynamic
 * allocation after construction and can be used from a Teensy audio callback as
 * long as the instance is stored globally/static rather than on the stack.
 */

#include "config.h"
#include "tones.h"

#include <cstddef>
#include <cstdint>

namespace harp {

/** Runtime parameters that can be changed by UI, MIDI, or firmware controls. */
struct DspParams {
  /** Processing sample rate in Hz. Delay line lengths are recalculated when this changes. */
  float sampleRate = DEFAULT_SAMPLE_RATE;
  /** Master volume, from 0 to 1. */
  float volume = DEFAULT_VOLUME;
  /** Index into the compiled tone preset table. */
  std::uint8_t toneIndex = DEFAULT_TONE_INDEX;
  /** Reverb mix, from 0 to 1. */
  float reverb = DEFAULT_REVERB;
  /** Enables stereo chorus when true. */
  bool chorus = DEFAULT_CHORUS;
  /** Uses slower pitch changes when true. */
  bool slide = DEFAULT_SLIDE;
};

/** Creates the default parameter set for a sample rate. */
DspParams defaultParams(float sampleRate = DEFAULT_SAMPLE_RATE);

/**
 * Polyphonic harp synth DSP engine.
 *
 * Public methods are intentionally small and avoid memory allocation during
 * audio rendering. noteOn/noteOff/glide update voice state; process() and
 * processInt16() render stereo output blocks.
 */
class HarpDsp {
 public:
  /** Constructs and resets the engine with default parameters. */
  explicit HarpDsp(float sampleRate = DEFAULT_SAMPLE_RATE);
  /** Constructs and resets the engine with caller-supplied parameters. */
  HarpDsp(float sampleRate, const DspParams& params);

  /** Disabled because internal delay-line pointers refer to owned buffers. */
  HarpDsp(const HarpDsp&) = delete;
  /** Disabled because internal delay-line pointers refer to owned buffers. */
  HarpDsp& operator=(const HarpDsp&) = delete;

  /** Clears voices/effects and applies default parameters for sampleRate. */
  void reset(float sampleRate = DEFAULT_SAMPLE_RATE);
  /** Clears voices/effects and applies caller-supplied parameters. */
  void reset(float sampleRate, const DspParams& params);

  /** Replaces runtime parameters, clamping 0-to-1 controls to valid ranges. */
  void setParams(const DspParams& params);
  /** Sets master volume, from 0 to 1. */
  void setVolume(float volume);
  /** Selects a compiled tone preset by index, clamped to the valid range. */
  void setToneIndex(int toneIndex);
  /** Sets reverb mix, from 0 to 1. */
  void setReverb(float reverb);
  /** Enables or disables the chorus effect. */
  void setChorus(bool enabled);
  /** Enables or disables slower pitch changes. */
  void setSlide(bool enabled);

  /** Starts or retriggers a voice for noteId. frequency is Hz and velocity is 0 to 1. */
  void noteOn(std::int32_t noteId, float frequency, float velocity);
  /** Releases the active voice with noteId, if one exists. */
  void noteOff(std::int32_t noteId);
  /** Changes the target frequency for an active voice. */
  void glide(std::int32_t noteId, float frequency);

  /** Renders frameCount stereo float samples in the [-1, 1] audio range. */
  void process(float* left, float* right, std::size_t frameCount);
  /** Renders frameCount stereo samples converted to signed 16-bit integers. */
  void processInt16(std::int16_t* left, std::int16_t* right, std::size_t frameCount);
  /** Renders one stereo float sample. Useful for custom audio block adapters. */
  void processSample(float& left, float& right);

  /** @return Number of currently active voices. */
  std::size_t activeVoiceCount() const;
  /** @return Current runtime parameters. */
  const DspParams& params() const { return params_; }
  /** @return Currently selected tone preset. */
  const TonePreset& currentTone() const { return *tone_; }

 private:
  /** Note volume stage for each voice. */
  enum class EnvelopeState : std::uint8_t {
    Idle,
    Attack,
    Sustain,
    Release,
  };

  /** State for one playing note. */
  struct Voice {
    /** Whether this slot is currently producing audio. */
    bool active = false;
    /** Caller-provided note identifier used for noteOff/glide lookup. */
    std::int32_t noteId = -1;
    /** Position in the main wave cycle, from 0 to 1. */
    float phase = 0.0f;
    /** Current smoothed frequency in Hz. */
    float frequency = DEFAULT_VOICE_FREQUENCY;
    /** Requested frequency in Hz. */
    float targetFrequency = DEFAULT_VOICE_FREQUENCY;
    /** Note velocity, from 0 to 1. */
    float velocity = 0.0f;
    /** Current note-volume level. */
    float envelope = 0.0f;
    /** Current attack/sustain/release state. */
    EnvelopeState state = EnvelopeState::Idle;
    /** State for the per-voice smoothing filter. */
    float filterState = 0.0f;
    /** Separate wave-cycle positions for each sound layer. */
    float partialPhases[MAX_TONE_PARTIALS] = {};
    /** Layer count used to detect tone-preset changes. */
    std::size_t partialPhaseCount = 0;
  };

  /** Delay buffer state for chorus and reverb. */
  struct DelayLine {
    /** Pointer to fixed storage owned by HarpDsp. */
    float* buffer = nullptr;
    /** Static buffer size at HARP_DSP_MAX_SAMPLE_RATE. */
    std::size_t capacity = 0;
    /** Active delay-line length at params_.sampleRate. */
    std::size_t length = 0;
    /** Current write/read position in the wrapping buffer. */
    std::size_t index = 0;
    /** Smoothing state used by reverb lines. */
    float filterState = 0.0f;
  };

  /** Binds DelayLine pointers to owned fixed arrays. */
  void configureDelayStorage();
  /** Computes active wrapping-buffer lengths for the current sample rate. */
  void configureDelayLengths();
  /** Clears all samples and state in one delay line. */
  void clearDelayLine(DelayLine& line);

  /** Finds the active voice matching noteId, or nullptr. */
  Voice* findVoice(std::int32_t noteId);
  /** Returns a free voice, or steals the quietest active voice. */
  Voice* claimVoice();
  /** Renders one mono sample for a voice and advances its state. */
  float processVoice(Voice& voice);
  /** Renders the selected tone preset for a voice. */
  float oscillator(Voice& voice);
  /** Reinitializes per-layer wave positions after tone-preset changes. */
  void syncPartialPhases(Voice& voice);
  /** Updates the note-volume ramp and returns current level. */
  float advanceEnvelope(Voice& voice);
  /** Applies the selected tone preset's simple smoothing filter. */
  float applyToneFilter(Voice& voice, float sample);

  /** Applies stereo chorus to a mono input sample. */
  void processChorus(float sample, float& left, float& right);
  /** Applies the stereo multi-delay reverb. */
  void processReverb(float leftSample, float rightSample, float& left, float& right);
  /** Reads a delay time that falls between stored samples. */
  float readDelay(const DelayLine& line, float seconds) const;

  /** Converts a seconds delay to sample count, clamped to static capacity. */
  static std::size_t samplesForDelay(float sampleRate, float seconds, std::size_t capacity);
  /** Converts float audio in [-1, 1] to signed 16-bit samples. */
  static std::int16_t floatToInt16(float sample);

  /** Current runtime parameters. */
  DspParams params_{};
  /** Current compiled tone preset. */
  const TonePreset* tone_ = nullptr;
  /** Fixed voice pool. */
  Voice voices_[MAX_VOICES]{};

  /** Shared chorus delay line and movement state. */
  DelayLine chorusLine_{};
  float chorusPhases_[CHORUS_VOICE_COUNT]{};
  float chorusLeftWet_ = 0.0f;
  float chorusRightWet_ = 0.0f;

  /** Parallel stereo reverb delay lines. */
  DelayLine reverbLeftLines_[REVERB_LINE_COUNT]{};
  DelayLine reverbRightLines_[REVERB_LINE_COUNT]{};

  /** Owned delay storage; sizes are fixed for HARP_DSP_MAX_SAMPLE_RATE. */
  float chorusBuffer_[CHORUS_BUFFER_CAPACITY]{};
  float reverbLeft0_[REVERB_LEFT_0_BUFFER_CAPACITY]{};
  float reverbLeft1_[REVERB_LEFT_1_BUFFER_CAPACITY]{};
  float reverbLeft2_[REVERB_LEFT_2_BUFFER_CAPACITY]{};
  float reverbLeft3_[REVERB_LEFT_3_BUFFER_CAPACITY]{};
  float reverbRight0_[REVERB_RIGHT_0_BUFFER_CAPACITY]{};
  float reverbRight1_[REVERB_RIGHT_1_BUFFER_CAPACITY]{};
  float reverbRight2_[REVERB_RIGHT_2_BUFFER_CAPACITY]{};
  float reverbRight3_[REVERB_RIGHT_3_BUFFER_CAPACITY]{};
};

}  // namespace harp
