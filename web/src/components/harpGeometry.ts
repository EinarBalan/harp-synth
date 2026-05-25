import { KEYS } from "../model/music";

export const KEY_LABEL_SLOT_OFFSET = 2;

export function keyKnobNorm(keyIndex: number) {
  return ((keyIndex + KEY_LABEL_SLOT_OFFSET) % KEYS.length) / (KEYS.length - 1);
}
