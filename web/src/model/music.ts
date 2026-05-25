export const BAR_COUNT = 24;
export const PIANO_BAR_COUNT = 88;
export type InstrumentRange = 1 | 2 | 3 | 4 | 5 | 6 | 7 | "piano";
export const INSTRUMENT_RANGES: readonly InstrumentRange[] = [1, 2, 3, 4, 5, 6, 7, "piano"];

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
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "locrian"
  | "melodicMinor"
  | "dorianFlat2"
  | "lydianAugmented"
  | "lydianDominant"
  | "mixolydianFlat6"
  | "locrianSharp2"
  | "altered"
  | "quartal"
  | "quintal"
  | "sextal"
  | "hirajoshi"
  | "harmonicMinor"
  | "wholeTone"
  | "tizita"
  | "ambassel"
  | "anchihoye"
  | "japaneseYo"
  | "insen"
  | "iwato"
  | "kumoi"
  | "hungarianMinor"
  | "hungarianMajor"
  | "doubleHarmonicMajor"
  | "persian"
  | "egyptian"
  | "custom";

export interface ScaleDefinition {
  id: ScaleId;
  label: string;
  intervals: readonly number[] | null;
  stepSemitones?: number;
}

export const SCALE_DEFINITIONS: ScaleDefinition[] = [
  { id: "chromatic", label: "CHROM", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: "major", label: "MAJOR", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: "naturalMinor", label: "NAT MINOR", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: "majorPentatonic", label: "MAJ PENT", intervals: [0, 2, 4, 7, 9] },
  { id: "minorPentatonic", label: "MIN PENT", intervals: [0, 3, 5, 7, 10] },
  { id: "majorBlues", label: "MAJ BLUES", intervals: [0, 2, 3, 4, 7, 9] },
  { id: "blues", label: "BLUES", intervals: [0, 3, 5, 6, 7, 10] },
  { id: "harmonicMinor", label: "HARM MIN", intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: "wholeTone", label: "WHOLE", intervals: [0, 2, 4, 6, 8, 10] },
  { id: "tizita", label: "TIZITA", intervals: [0, 2, 4, 7, 9] },
  { id: "ambassel", label: "AMBASSL", intervals: [0, 1, 5, 7, 8] },
  { id: "anchihoye", label: "ANCHI", intervals: [0, 3, 6, 7, 11] },
  { id: "japaneseYo", label: "YO", intervals: [0, 2, 5, 7, 9] },
  { id: "hirajoshi", label: "HIRAJOSHI", intervals: [0, 2, 3, 7, 8] },
  { id: "insen", label: "INSEN", intervals: [0, 1, 5, 7, 10] },
  { id: "iwato", label: "IWATO", intervals: [0, 1, 5, 6, 10] },
  { id: "kumoi", label: "KUMOI", intervals: [0, 2, 3, 7, 9] },
  { id: "hungarianMinor", label: "HUNG MIN", intervals: [0, 2, 3, 6, 7, 8, 11] },
  { id: "hungarianMajor", label: "HUNG MAJ", intervals: [0, 3, 4, 6, 7, 9, 10] },
  { id: "doubleHarmonicMajor", label: "DBL HARM", intervals: [0, 1, 4, 5, 7, 8, 11] },
  { id: "persian", label: "PERSIAN", intervals: [0, 1, 4, 5, 6, 8, 11] },
  { id: "egyptian", label: "EGYPT", intervals: [0, 2, 5, 7, 10] },
  { id: "dorian", label: "DORIAN", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: "phrygian", label: "PHRYGIAN", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: "lydian", label: "LYDIAN", intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: "mixolydian", label: "MIXOLYD", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: "locrian", label: "LOCRIAN", intervals: [0, 1, 3, 5, 6, 8, 10] },
  { id: "melodicMinor", label: "MEL MIN", intervals: [0, 2, 3, 5, 7, 9, 11] },
  { id: "dorianFlat2", label: "DOR b2", intervals: [0, 1, 3, 5, 7, 9, 10] },
  { id: "lydianAugmented", label: "LYD AUG", intervals: [0, 2, 4, 6, 8, 9, 11] },
  { id: "lydianDominant", label: "LYD DOM", intervals: [0, 2, 4, 6, 7, 9, 10] },
  { id: "mixolydianFlat6", label: "MIX b6", intervals: [0, 2, 4, 5, 7, 8, 10] },
  { id: "locrianSharp2", label: "LOC #2", intervals: [0, 2, 3, 5, 6, 8, 10] },
  { id: "altered", label: "ALTERED", intervals: [0, 1, 3, 4, 6, 8, 10] },
  { id: "quartal", label: "QUARTAL", intervals: [], stepSemitones: 5 },
  { id: "quintal", label: "QUINTAL", intervals: [], stepSemitones: 7 },
  { id: "sextal", label: "SEXTAL", intervals: [], stepSemitones: 9 },
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

const SHARP_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const FLAT_KEYS = new Set<KeyName>(["Db", "Ab", "Eb", "Bb", "F"]);

export function getScaleDefinition(scaleId: ScaleId): ScaleDefinition {
  return SCALE_DEFINITIONS.find((scale) => scale.id === scaleId) ?? SCALE_DEFINITIONS[0];
}

export function barCountForRange(range: InstrumentRange): number {
  return range === "piano" ? PIANO_BAR_COUNT : range * 12;
}

export function labelForInstrumentRange(range: InstrumentRange): string {
  return range === "piano" ? "PIANO" : `${range} OCT`;
}

export function createScaleMask(scaleId: ScaleId, barCount = BAR_COUNT): boolean[] {
  const definition = getScaleDefinition(scaleId);
  if (definition.stepSemitones) {
    return createSteppedMask(definition.stepSemitones, barCount);
  }

  if (!definition.intervals) {
    return Array.from({ length: barCount }, () => true);
  }

  const intervalSet = new Set(definition.intervals.map((interval) => interval % 12));
  return Array.from({ length: barCount }, (_, index) => intervalSet.has(index % 12));
}

function createSteppedMask(stepSemitones: number, barCount: number): boolean[] {
  const enabled = new Set<number>();
  for (let index = 0; index < barCount; index += stepSemitones) {
    enabled.add(index);
  }

  return Array.from({ length: barCount }, (_, index) => enabled.has(index));
}

export function setPitchClassEnabled(mask: readonly boolean[], barIndex: number, enabled: boolean, barCount = mask.length): boolean[] {
  const pitchClass = barIndex % 12;
  return Array.from({ length: barCount }, (_, index) => (index % 12 === pitchClass ? enabled : Boolean(mask[index])));
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

export function noteNameForBar(barIndex: number, key: KeyName): string {
  const names = FLAT_KEYS.has(key) ? FLAT_NOTE_NAMES : SHARP_NOTE_NAMES;
  return names[(ROOT_SEMITONES[key] + barIndex) % 12];
}
