#include "tones.h"

/**
 * @file tones.cpp
 * Compiled tone preset table.
 *
 * Presets are static C++ data. Keeping them compiled avoids JSON parsing,
 * runtime memory allocation, and filesystem dependencies on Teensy.
 */

namespace harp {

namespace {

// Each partial array belongs to one TonePreset entry below.
constexpr TonePartial HARP_PARTIALS[] = {
  {ToneWaveform::Sine, 0.65f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Triangle, 0.2f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.24f, 2.0f, 0.3f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.14f, 3.0f, 0.7f, 500.0f, 0.6f, true},
};

constexpr TonePartial RICH_HARP_PARTIALS[] = {
  {ToneWaveform::Sine, 0.3f, 0.667f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.3f, 1.5f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::ClampedSine, 0.48f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.2f, 2.0f, 0.2f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.09f, 5.0f, 0.55f, 0.0f, 1.0f, false},
};

constexpr TonePartial CLAV_PARTIALS[] = {
  {ToneWaveform::Sine, 0.65f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.45f, 2.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.25f, 3.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.45f, 4.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.15f, 5.0f, 0.0f, 0.0f, 1.0f, false},
};

constexpr TonePartial WURLI_ORGAN_PARTIALS[] = {
  {ToneWaveform::Sine, 0.45f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Square, 0.18f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.2f, 2.01f, 0.15f, 0.0f, 1.0f, false},
  {ToneWaveform::Triangle, 0.12f, 3.0f, 0.4f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.06f, 6.02f, 0.7f, 850.0f, 0.55f, true},
};

constexpr TonePartial ORGAN_VIBRATO_PARTIALS[] = {
  {ToneWaveform::Sine, 0.45f, 1.005f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.45f, 0.995f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.18f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.2f, 2.01f, 0.15f, 0.0f, 1.0f, false},
  {ToneWaveform::Triangle, 0.12f, 3.0f, 0.4f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.06f, 6.02f, 0.7f, 850.0f, 0.55f, true},
};

constexpr TonePartial SUPERSAW_PARTIALS[] = {
  {ToneWaveform::Saw, 0.34f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.18f, 0.997f, 0.18f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.18f, 1.003f, 0.43f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.12f, 1.01f, 0.71f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.08f, 2.0f, 0.25f, 0.0f, 1.0f, false},
};

constexpr TonePartial RICH_SUPERSAW_PARTIALS[] = {
  {ToneWaveform::Saw, 0.48f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.35f, 0.667f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.35f, 1.5f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.18f, 0.997f, 0.18f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.18f, 1.003f, 0.43f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.12f, 1.01f, 0.71f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.08f, 2.0f, 0.25f, 0.0f, 1.0f, false},
};

constexpr TonePartial RICH_RETRO_PARTIALS[] = {
  {ToneWaveform::Square, 0.35f, 0.667f, 0.0f, 1000.0f, 0.3f, true},
  {ToneWaveform::Saw, 0.35f, 1.5f, 0.0f, 1000.0f, 0.3f, true},
  {ToneWaveform::ClampedSine, 0.48f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.26f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.2f, 2.0f, 0.2f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.09f, 5.0f, 0.55f, 0.0f, 1.0f, false},
};

constexpr TonePartial THICK_PUNCH_PARTIALS[] = {
  {ToneWaveform::Square, 0.35f, 0.75f, 0.0f, 500.0f, 0.3f, true},
  {ToneWaveform::ClampedSine, 0.48f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Saw, 0.26f, 1.0f, 0.0f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.2f, 2.0f, 0.2f, 0.0f, 1.0f, false},
  {ToneWaveform::Sine, 0.09f, 5.0f, 0.55f, 0.0f, 1.0f, false},
};

// The order of this table is the public toneIndex order used by UI/firmware.
constexpr TonePreset TONE_PRESETS[] = {
  {"Harp", 0.35f, HARP_PARTIALS, sizeof(HARP_PARTIALS) / sizeof(HARP_PARTIALS[0])},
  {"Rich Harp", 0.58f, RICH_HARP_PARTIALS, sizeof(RICH_HARP_PARTIALS) / sizeof(RICH_HARP_PARTIALS[0])},
  {"Clav", 0.1f, CLAV_PARTIALS, sizeof(CLAV_PARTIALS) / sizeof(CLAV_PARTIALS[0])},
  {"Wurli Organ", 0.24f, WURLI_ORGAN_PARTIALS, sizeof(WURLI_ORGAN_PARTIALS) / sizeof(WURLI_ORGAN_PARTIALS[0])},
  {
    "Organ Vibrato",
    0.24f,
    ORGAN_VIBRATO_PARTIALS,
    sizeof(ORGAN_VIBRATO_PARTIALS) / sizeof(ORGAN_VIBRATO_PARTIALS[0]),
  },
  {"Supersaw", 0.42f, SUPERSAW_PARTIALS, sizeof(SUPERSAW_PARTIALS) / sizeof(SUPERSAW_PARTIALS[0])},
  {
    "RichSupersaw",
    0.42f,
    RICH_SUPERSAW_PARTIALS,
    sizeof(RICH_SUPERSAW_PARTIALS) / sizeof(RICH_SUPERSAW_PARTIALS[0]),
  },
  {"Rich Retro", 0.58f, RICH_RETRO_PARTIALS, sizeof(RICH_RETRO_PARTIALS) / sizeof(RICH_RETRO_PARTIALS[0])},
  {"THICK Punch", 0.58f, THICK_PUNCH_PARTIALS, sizeof(THICK_PUNCH_PARTIALS) / sizeof(THICK_PUNCH_PARTIALS[0])},
};

}  // namespace

std::size_t tonePresetCount() {
  return sizeof(TONE_PRESETS) / sizeof(TONE_PRESETS[0]);
}

std::uint8_t clampToneIndex(int index) {
  if (index < 0) {
    return 0;
  }

  const int lastIndex = static_cast<int>(tonePresetCount()) - 1;
  if (index > lastIndex) {
    return static_cast<std::uint8_t>(lastIndex);
  }

  return static_cast<std::uint8_t>(index);
}

const TonePreset& tonePreset(std::uint8_t index) {
  return TONE_PRESETS[clampToneIndex(index)];
}

}  // namespace harp
