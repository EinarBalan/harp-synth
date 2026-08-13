#pragma once

/**
 * @file utils.h
 * Small allocation-free helpers shared by the Teensy DSP modules.
 */

namespace harp {

/**
 * Restricts a value to a closed interval.
 *
 * @param value Input value.
 * @param minValue Minimum returned value.
 * @param maxValue Maximum returned value.
 * @return value clamped to [minValue, maxValue].
 */
inline float clamp(float value, float minValue, float maxValue) {
  if (value < minValue) {
    return minValue;
  }
  if (value > maxValue) {
    return maxValue;
  }
  return value;
}

}  // namespace harp
