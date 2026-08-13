#include "engine.h"

/**
 * @file engine.cpp
 * Runtime voice, note-volume, chorus, and reverb implementation for HarpDsp.
 */

#include "oscillator.h"
#include "utils.h"

#include <cmath>

namespace harp {

DspParams defaultParams(float sampleRate) {
  DspParams params;
  params.sampleRate = sampleRate;
  return params;
}

HarpDsp::HarpDsp(float sampleRate) {
  configureDelayStorage();
  reset(sampleRate);
}

HarpDsp::HarpDsp(float sampleRate, const DspParams& params) {
  configureDelayStorage();
  reset(sampleRate, params);
}

void HarpDsp::reset(float sampleRate) {
  reset(sampleRate, defaultParams(sampleRate));
}

void HarpDsp::reset(float sampleRate, const DspParams& params) {
  initializeOscillator();

  // Sanitizing parameters at reset keeps the audio path free of repeated range
  // checks except where controls can change at runtime.
  params_ = params;
  params_.sampleRate = sampleRate > 0.0f ? sampleRate : DEFAULT_SAMPLE_RATE;
  params_.volume = clamp(params_.volume, 0.0f, 1.0f);
  params_.toneIndex = clampToneIndex(params_.toneIndex);
  params_.reverb = clamp(params_.reverb, 0.0f, 1.0f);
  tone_ = &tonePreset(params_.toneIndex);

  for (std::size_t index = 0; index < MAX_VOICES; ++index) {
    voices_[index] = Voice{};
  }

  for (std::size_t index = 0; index < CHORUS_VOICE_COUNT; ++index) {
    chorusPhases_[index] = CHORUS_VOICES[index].phaseOffset;
  }
  chorusLeftWet_ = 0.0f;
  chorusRightWet_ = 0.0f;

  configureDelayLengths();
  clearDelayLine(chorusLine_);
  for (std::size_t index = 0; index < REVERB_LINE_COUNT; ++index) {
    clearDelayLine(reverbLeftLines_[index]);
    clearDelayLine(reverbRightLines_[index]);
  }
}

void HarpDsp::setParams(const DspParams& params) {
  const float previousSampleRate = params_.sampleRate;

  params_ = params;
  if (params_.sampleRate <= 0.0f) {
    params_.sampleRate = previousSampleRate > 0.0f ? previousSampleRate : DEFAULT_SAMPLE_RATE;
  }

  params_.volume = clamp(params_.volume, 0.0f, 1.0f);
  params_.toneIndex = clampToneIndex(params_.toneIndex);
  params_.reverb = clamp(params_.reverb, 0.0f, 1.0f);
  tone_ = &tonePreset(params_.toneIndex);

  // Delay buffers are fixed-size, but their active circular lengths depend on
  // sample rate. Clearing them avoids stale data at old delay timings.
  if (params_.sampleRate != previousSampleRate) {
    configureDelayLengths();
    clearDelayLine(chorusLine_);
    for (std::size_t index = 0; index < REVERB_LINE_COUNT; ++index) {
      clearDelayLine(reverbLeftLines_[index]);
      clearDelayLine(reverbRightLines_[index]);
    }
  }
}

void HarpDsp::setVolume(float volume) {
  params_.volume = clamp(volume, 0.0f, 1.0f);
}

void HarpDsp::setToneIndex(int toneIndex) {
  params_.toneIndex = clampToneIndex(toneIndex);
  tone_ = &tonePreset(params_.toneIndex);
}

void HarpDsp::setReverb(float reverb) {
  params_.reverb = clamp(reverb, 0.0f, 1.0f);
}

void HarpDsp::setChorus(bool enabled) {
  params_.chorus = enabled;
}

void HarpDsp::setSlide(bool enabled) {
  params_.slide = enabled;
}

void HarpDsp::noteOn(std::int32_t noteId, float frequency, float velocity) {
  Voice* voice = findVoice(noteId);
  if (voice == nullptr) {
    voice = claimVoice();
  }

  voice->active = true;
  voice->noteId = noteId;
  voice->phase = 0.0f;
  voice->frequency = frequency;
  voice->targetFrequency = frequency;
  voice->velocity = clamp(velocity, 0.0f, 1.0f);
  voice->filterState = 0.0f;
  voice->partialPhaseCount = tone_->partialCount;
  // A new trigger starts every partial in phase for a consistent attack.
  for (std::size_t index = 0; index < MAX_TONE_PARTIALS; ++index) {
    voice->partialPhases[index] = 0.0f;
  }
  voice->state = EnvelopeState::Attack;
}

void HarpDsp::noteOff(std::int32_t noteId) {
  Voice* voice = findVoice(noteId);
  if (voice != nullptr && voice->state != EnvelopeState::Idle) {
    voice->state = EnvelopeState::Release;
  }
}

void HarpDsp::glide(std::int32_t noteId, float frequency) {
  Voice* voice = findVoice(noteId);
  if (voice != nullptr) {
    voice->targetFrequency = frequency;
  }
}

void HarpDsp::process(float* left, float* right, std::size_t frameCount) {
  if (left == nullptr) {
    return;
  }

  for (std::size_t index = 0; index < frameCount; ++index) {
    float leftSample = 0.0f;
    float rightSample = 0.0f;
    processSample(leftSample, rightSample);
    left[index] = leftSample;
    if (right != nullptr) {
      right[index] = rightSample;
    }
  }
}

void HarpDsp::processInt16(std::int16_t* left, std::int16_t* right, std::size_t frameCount) {
  if (left == nullptr) {
    return;
  }

  for (std::size_t index = 0; index < frameCount; ++index) {
    float leftSample = 0.0f;
    float rightSample = 0.0f;
    processSample(leftSample, rightSample);
    left[index] = floatToInt16(leftSample);
    if (right != nullptr) {
      right[index] = floatToInt16(rightSample);
    }
  }
}

void HarpDsp::processSample(float& left, float& right) {
  float sample = 0.0f;
  for (std::size_t index = 0; index < MAX_VOICES; ++index) {
    if (voices_[index].active) {
      sample += processVoice(voices_[index]);
    }
  }

  sample *= params_.volume * OUTPUT_GAIN;

  // Effects keep running even when mixed out, so turning them on later does not
  // expose stale delay data.
  float chorusLeft = 0.0f;
  float chorusRight = 0.0f;
  processChorus(sample, chorusLeft, chorusRight);

  float reverbLeft = 0.0f;
  float reverbRight = 0.0f;
  processReverb(chorusLeft, chorusRight, reverbLeft, reverbRight);

  const float dryGain = lerp(1.0f, REVERB_DRY_GAIN_AT_MAX, params_.reverb);
  const float wetGain = params_.reverb * REVERB_WET_GAIN;

  left = softClip(chorusLeft * dryGain + reverbLeft * wetGain);
  right = softClip(chorusRight * dryGain + reverbRight * wetGain);
}

std::size_t HarpDsp::activeVoiceCount() const {
  std::size_t count = 0;
  for (std::size_t index = 0; index < MAX_VOICES; ++index) {
    if (voices_[index].active) {
      ++count;
    }
  }
  return count;
}

void HarpDsp::configureDelayStorage() {
  // DelayLine objects point at buffers owned by HarpDsp. This keeps the effect
  // loops compact without allocating memory elsewhere.
  chorusLine_.buffer = chorusBuffer_;
  chorusLine_.capacity = CHORUS_BUFFER_CAPACITY;

  reverbLeftLines_[0].buffer = reverbLeft0_;
  reverbLeftLines_[0].capacity = REVERB_LEFT_0_BUFFER_CAPACITY;
  reverbLeftLines_[1].buffer = reverbLeft1_;
  reverbLeftLines_[1].capacity = REVERB_LEFT_1_BUFFER_CAPACITY;
  reverbLeftLines_[2].buffer = reverbLeft2_;
  reverbLeftLines_[2].capacity = REVERB_LEFT_2_BUFFER_CAPACITY;
  reverbLeftLines_[3].buffer = reverbLeft3_;
  reverbLeftLines_[3].capacity = REVERB_LEFT_3_BUFFER_CAPACITY;

  reverbRightLines_[0].buffer = reverbRight0_;
  reverbRightLines_[0].capacity = REVERB_RIGHT_0_BUFFER_CAPACITY;
  reverbRightLines_[1].buffer = reverbRight1_;
  reverbRightLines_[1].capacity = REVERB_RIGHT_1_BUFFER_CAPACITY;
  reverbRightLines_[2].buffer = reverbRight2_;
  reverbRightLines_[2].capacity = REVERB_RIGHT_2_BUFFER_CAPACITY;
  reverbRightLines_[3].buffer = reverbRight3_;
  reverbRightLines_[3].capacity = REVERB_RIGHT_3_BUFFER_CAPACITY;
}

void HarpDsp::configureDelayLengths() {
  chorusLine_.length = samplesForDelay(params_.sampleRate, CHORUS_DELAY_SECONDS, chorusLine_.capacity);

  for (std::size_t index = 0; index < REVERB_LINE_COUNT; ++index) {
    reverbLeftLines_[index].length =
      samplesForDelay(params_.sampleRate, REVERB_LEFT_DELAY_SECONDS[index], reverbLeftLines_[index].capacity);
    reverbRightLines_[index].length =
      samplesForDelay(params_.sampleRate, REVERB_RIGHT_DELAY_SECONDS[index], reverbRightLines_[index].capacity);
  }
}

void HarpDsp::clearDelayLine(DelayLine& line) {
  if (line.buffer == nullptr) {
    return;
  }

  for (std::size_t index = 0; index < line.capacity; ++index) {
    line.buffer[index] = 0.0f;
  }
  line.index = 0;
  line.filterState = 0.0f;
}

HarpDsp::Voice* HarpDsp::findVoice(std::int32_t noteId) {
  for (std::size_t index = 0; index < MAX_VOICES; ++index) {
    if (voices_[index].active && voices_[index].noteId == noteId) {
      return &voices_[index];
    }
  }
  return nullptr;
}

HarpDsp::Voice* HarpDsp::claimVoice() {
  for (std::size_t index = 0; index < MAX_VOICES; ++index) {
    if (!voices_[index].active) {
      return &voices_[index];
    }
  }

  // If all voices are busy, replace the one with the lowest current volume.
  // This is cheap and avoids memory allocation or extra tracking data in the audio engine.
  Voice* quietest = &voices_[0];
  for (std::size_t index = 1; index < MAX_VOICES; ++index) {
    if (voices_[index].envelope < quietest->envelope) {
      quietest = &voices_[index];
    }
  }
  return quietest;
}

float HarpDsp::processVoice(Voice& voice) {
  const float glideCoefficient = params_.slide ? GLIDE_COEFFICIENT : FAST_GLIDE_COEFFICIENT;
  voice.frequency = lerp(voice.frequency, voice.targetFrequency, glideCoefficient);
  voice.phase = wrapPhase(voice.phase + voice.frequency / params_.sampleRate);

  const float raw = oscillator(voice);
  const float envelope = advanceEnvelope(voice);
  const float filtered = applyToneFilter(voice, raw);
  return filtered * envelope * voice.velocity;
}

float HarpDsp::oscillator(Voice& voice) {
  syncPartialPhases(voice);

  float sample = 0.0f;
  const std::size_t partialCount =
    tone_->partialCount < MAX_TONE_PARTIALS ? tone_->partialCount : MAX_TONE_PARTIALS;
  for (std::size_t index = 0; index < partialCount; ++index) {
    const TonePartial& partial = tone_->partials[index];
    const float partialFrequency = voice.frequency * partial.ratio;
    // Skip layers too high to represent cleanly at the current sample rate.
    if (partialFrequency >= params_.sampleRate * 0.5f) {
      continue;
    }

    const float phaseIncrement = partialFrequency / params_.sampleRate;
    voice.partialPhases[index] = wrapPhase(voice.partialPhases[index] + phaseIncrement);
    sample += oscillatorPartial(voice.partialPhases[index], voice.frequency, partial, phaseIncrement);
  }
  return sample;
}

void HarpDsp::syncPartialPhases(Voice& voice) {
  if (voice.partialPhaseCount == tone_->partialCount) {
    return;
  }

  // Existing layer positions are preserved when possible; newly introduced
  // layers are derived from the main wave position to avoid a hard reset.
  const std::size_t oldCount = voice.partialPhaseCount;
  const std::size_t partialCount =
    tone_->partialCount < MAX_TONE_PARTIALS ? tone_->partialCount : MAX_TONE_PARTIALS;
  for (std::size_t index = 0; index < partialCount; ++index) {
    if (index >= oldCount) {
      voice.partialPhases[index] = wrapPhase(voice.phase * tone_->partials[index].ratio);
    }
  }
  for (std::size_t index = partialCount; index < MAX_TONE_PARTIALS; ++index) {
    voice.partialPhases[index] = 0.0f;
  }
  voice.partialPhaseCount = tone_->partialCount;
}

float HarpDsp::advanceEnvelope(Voice& voice) {
  // The note volume uses simple linear attack/release ramps. Clamp the
  // durations to at least one sample so unusual sample rates stay finite.
  float attackSamples = params_.sampleRate * ATTACK_SECONDS;
  if (attackSamples < 1.0f) {
    attackSamples = 1.0f;
  }

  float releaseSamples = params_.sampleRate * RELEASE_SECONDS;
  if (releaseSamples < 1.0f) {
    releaseSamples = 1.0f;
  }

  const float attackStep = 1.0f / attackSamples;
  const float releaseStep = 1.0f / releaseSamples;

  if (voice.state == EnvelopeState::Attack) {
    voice.envelope += attackStep;
    if (voice.envelope >= 1.0f) {
      voice.envelope = 1.0f;
      voice.state = EnvelopeState::Sustain;
    }
  } else if (voice.state == EnvelopeState::Release) {
    voice.envelope -= releaseStep;
    if (voice.envelope <= 0.0f) {
      voice.envelope = 0.0f;
      voice.state = EnvelopeState::Idle;
      voice.active = false;
      voice.noteId = -1;
    }
  }

  return voice.envelope;
}

float HarpDsp::applyToneFilter(Voice& voice, float sample) {
  voice.filterState += tone_->filterCutoff * (sample - voice.filterState);
  return voice.filterState;
}

void HarpDsp::processChorus(float sample, float& left, float& right) {
  DelayLine& line = chorusLine_;
  line.buffer[line.index] = sample;

  if (!params_.chorus) {
    chorusLeftWet_ = 0.0f;
    chorusRightWet_ = 0.0f;
    line.index = (line.index + 1) % line.length;
    left = sample;
    right = sample;
    return;
  }

  float leftWet = 0.0f;
  float rightWet = 0.0f;

  // Several slowly moving delays create a wider chorus than one moving delay.
  for (std::size_t index = 0; index < CHORUS_VOICE_COUNT; ++index) {
    const ChorusVoiceConfig& voice = CHORUS_VOICES[index];
    const float phase = wrapPhase(chorusPhases_[index] + voice.rateHz / params_.sampleRate);
    chorusPhases_[index] = phase;

    const float leftDelay = voice.delaySeconds + sineWave(phase) * voice.depthSeconds;
    const float rightDelay = voice.delaySeconds +
      CHORUS_RIGHT_DELAY_OFFSET_SECONDS +
      sineWave(wrapPhase(phase + CHORUS_RIGHT_PHASE_OFFSET)) * voice.depthSeconds;

    leftWet += readDelay(line, leftDelay);
    rightWet += readDelay(line, rightDelay);
  }

  leftWet /= static_cast<float>(CHORUS_VOICE_COUNT);
  rightWet /= static_cast<float>(CHORUS_VOICE_COUNT);

  chorusLeftWet_ += CHORUS_WET_FILTER * (leftWet - chorusLeftWet_);
  chorusRightWet_ += CHORUS_WET_FILTER * (rightWet - chorusRightWet_);
  line.buffer[line.index] = sample + (chorusLeftWet_ + chorusRightWet_) * 0.5f * CHORUS_FEEDBACK_GAIN;
  line.index = (line.index + 1) % line.length;

  const float wetMid = (chorusLeftWet_ + chorusRightWet_) * 0.5f;
  // Split the chorus into center and side parts, then widen the side part.
  const float wetSide = (chorusLeftWet_ - chorusRightWet_) * 0.5f * CHORUS_STEREO_WIDTH;
  const float wideLeftWet = wetMid + wetSide;
  const float wideRightWet = wetMid - wetSide;

  left = sample * CHORUS_DRY_GAIN + wideLeftWet * CHORUS_WET_GAIN;
  right = sample * CHORUS_DRY_GAIN + wideRightWet * CHORUS_WET_GAIN;
}

void HarpDsp::processReverb(float leftSample, float rightSample, float& left, float& right) {
  float leftSum = 0.0f;
  float rightSum = 0.0f;

  for (std::size_t index = 0; index < REVERB_LINE_COUNT; ++index) {
    DelayLine& leftLine = reverbLeftLines_[index];
    DelayLine& rightLine = reverbRightLines_[index];

    const float leftDelayed = leftLine.buffer[leftLine.index];
    const float rightDelayed = rightLine.buffer[rightLine.index];

    leftLine.filterState += REVERB_DAMPING * (leftDelayed - leftLine.filterState);
    rightLine.filterState += REVERB_DAMPING * (rightDelayed - rightLine.filterState);

    // Feed a little of each side into the other side to make the reverb wider
    // without adding more delay buffers.
    leftLine.buffer[leftLine.index] =
      leftSample + (leftLine.filterState + rightLine.filterState * REVERB_STEREO_CROSSFEED) * REVERB_FEEDBACK[index];
    rightLine.buffer[rightLine.index] =
      rightSample + (rightLine.filterState + leftLine.filterState * REVERB_STEREO_CROSSFEED) * REVERB_FEEDBACK[index];

    leftLine.index = (leftLine.index + 1) % leftLine.length;
    rightLine.index = (rightLine.index + 1) % rightLine.length;

    leftSum += leftDelayed;
    rightSum += rightDelayed;
  }

  left = leftSum / static_cast<float>(REVERB_LINE_COUNT);
  right = rightSum / static_cast<float>(REVERB_LINE_COUNT);
}

float HarpDsp::readDelay(const DelayLine& line, float seconds) const {
  const float delaySamples = seconds * params_.sampleRate;
  float readIndex = static_cast<float>(line.index) - delaySamples;
  const float length = static_cast<float>(line.length);
  while (readIndex < 0.0f) {
    readIndex += length;
  }
  while (readIndex >= length) {
    readIndex -= length;
  }

  // Interpolate between stored samples so moving delay times stay smooth.
  const std::size_t indexA = static_cast<std::size_t>(std::floor(readIndex));
  const std::size_t indexB = (indexA + 1) % line.length;
  const float fraction = readIndex - static_cast<float>(indexA);
  return lerp(line.buffer[indexA], line.buffer[indexB], fraction);
}

std::size_t HarpDsp::samplesForDelay(float sampleRate, float seconds, std::size_t capacity) {
  const float exactSamples = sampleRate * seconds;
  std::size_t samples = static_cast<std::size_t>(exactSamples);
  if (static_cast<float>(samples) < exactSamples) {
    ++samples;
  }
  if (samples < 1) {
    samples = 1;
  }
  if (samples > capacity) {
    samples = capacity;
  }
  return samples;
}

std::int16_t HarpDsp::floatToInt16(float sample) {
  const float clipped = clamp(sample, -1.0f, 1.0f);
  return static_cast<std::int16_t>(std::round(clipped * 32767.0f));
}

}  // namespace harp
