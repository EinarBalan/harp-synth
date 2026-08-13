/**
 * Restricts a value to a closed interval.
 *
 * @param value Input value.
 * @param min Minimum returned value.
 * @param max Maximum returned value.
 * @returns value clamped to [min, max].
 */
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
