export const BAR_COUNT = 24;

export const KEYS = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "Db",
  "Ab",
  "Eb",
  "Bb",
  "F"
] as const;

export const TONES = ["HARP", "BRIGHT", "BELL", "MUTED"] as const;

export type KeyName = (typeof KEYS)[number];
export type ToneName = (typeof TONES)[number];

export type ScaleId =
  | "chromatic"
  | "major"
  | "naturalMinor"
  | "majorPentatonic"
  | "majorBlues"
  | "minorPentatonic"
  | "blues"
  | "dorian"
  | "hirajoshi"
  | "harmonicMinor"
  | "wholeTone"
  | "custom";

export interface ScaleDefinition {
  id: ScaleId;
  label: string;
  intervals: readonly number[] | null;
}

export const SCALE_DEFINITIONS: ScaleDefinition[] = [
  { id: "chromatic", label: "CHROM", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: "major", label: "MAJOR", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: "naturalMinor", label: "N MINOR", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: "majorPentatonic", label: "PENT MAJ", intervals: [0, 2, 4, 7, 9] },
  { id: "minorPentatonic", label: "PENT MIN", intervals: [0, 3, 5, 7, 10] },
  { id: "majorBlues", label: "MAJ BLUES", intervals: [0, 2, 3, 4, 7, 9] },
  { id: "blues", label: "BLUES", intervals: [0, 3, 5, 6, 7, 10] },
  { id: "dorian", label: "DORIAN", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: "hirajoshi", label: "HIRAJOSHI", intervals: [0, 2, 3, 7, 8] },
  { id: "harmonicMinor", label: "H MIN", intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: "wholeTone", label: "WHOLE", intervals: [0, 2, 4, 6, 8, 10] },
  { id: "custom", label: "CUSTOM", intervals: null }
];

export const ROOT_SEMITONES: Record<KeyName, number> = {
  C: 0,
  "Db": 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  Ab: 8,
  A: 9,
  Bb: 10,
  B: 11
};

export function getScaleDefinition(scaleId: ScaleId): ScaleDefinition {
  return SCALE_DEFINITIONS.find((scale) => scale.id === scaleId) ?? SCALE_DEFINITIONS[0];
}

export function createScaleMask(scaleId: ScaleId): boolean[] {
  const definition = getScaleDefinition(scaleId);
  if (!definition.intervals) {
    return Array.from({ length: BAR_COUNT }, () => true);
  }

  const intervalSet = new Set(definition.intervals.map((interval) => interval % 12));
  return Array.from({ length: BAR_COUNT }, (_, index) => intervalSet.has(index % 12));
}

export function setPitchClassEnabled(mask: readonly boolean[], barIndex: number, enabled: boolean): boolean[] {
  const pitchClass = barIndex % 12;
  return Array.from({ length: BAR_COUNT }, (_, index) => (index % 12 === pitchClass ? enabled : Boolean(mask[index])));
}

export function getNextScaleId(scaleId: ScaleId, direction: 1 | -1): ScaleId {
  const selectable = SCALE_DEFINITIONS.filter((scale) => scale.id !== "custom");
  const currentIndex = Math.max(
    0,
    selectable.findIndex((scale) => scale.id === scaleId)
  );
  const nextIndex = (currentIndex + direction + selectable.length) % selectable.length;
  return selectable[nextIndex].id;
}

export function midiForBar(barIndex: number, key: KeyName, octaveOffset: number): number {
  return 60 + ROOT_SEMITONES[key] + octaveOffset * 12 + barIndex;
}

export function frequencyForMidi(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function frequencyForBar(barIndex: number, key: KeyName, octaveOffset: number): number {
  return frequencyForMidi(midiForBar(barIndex, key, octaveOffset));
}
