import { KEYS } from "../model/music";

export const KEY_SLOT_DEGREES = 360 / KEYS.length;

export interface Point {
  x: number;
  y: number;
}

export function keyKnobAngleDegrees(keyIndex: number) {
  return positiveModulo(keyIndex, KEYS.length) * KEY_SLOT_DEGREES;
}

export function keyIndexFromPoint(point: Point, center: Point) {
  return Math.round(clockwiseDegreesFromUp(point, center) / KEY_SLOT_DEGREES) % KEYS.length;
}

export function clockwiseDegreesFromUp(point: Point, center: Point) {
  const degrees = (Math.atan2(point.x - center.x, center.y - point.y) * 180) / Math.PI;
  return positiveModulo(degrees, 360);
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
