import { describe, expect, it } from "vitest";
import {
  BAR_COUNT,
  barCountForRange,
  createScaleMask,
  frequencyForBar,
  labelForInstrumentRange,
  midiForBar,
  noteNameForBar,
  setPitchClassEnabled
} from "./music";

describe("music model", () => {
  it("creates 24-bar masks", () => {
    expect(createScaleMask("majorPentatonic")).toHaveLength(BAR_COUNT);
  });

  it("describes octave and piano-sized instrument ranges", () => {
    expect(barCountForRange(1)).toBe(12);
    expect(barCountForRange(7)).toBe(84);
    expect(barCountForRange("piano")).toBe(88);
    expect(labelForInstrumentRange(1)).toBe("1 OCT");
    expect(labelForInstrumentRange("piano")).toBe("PIANO");
  });

  it("creates masks for extended layouts", () => {
    const mask = createScaleMask("majorPentatonic", 36);
    expect(mask).toHaveLength(36);
    expect(mask.slice(24, 36)).toEqual(mask.slice(0, 12));

    const pianoMask = createScaleMask("majorPentatonic", 88);
    expect(pianoMask).toHaveLength(88);
    expect(pianoMask.slice(72, 84)).toEqual(pianoMask.slice(0, 12));
  });

  it("maps major scale intervals across both octaves", () => {
    const mask = createScaleMask("major");
    expect(mask.slice(0, 12)).toEqual([
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      true,
      false,
      true,
      false,
      true
    ]);
    expect(mask.slice(12, 24)).toEqual(mask.slice(0, 12));
  });

  it("maps the blues preset across both octaves", () => {
    const mask = createScaleMask("blues");
    expect(mask.slice(0, 12)).toEqual([
      true,
      false,
      false,
      true,
      false,
      true,
      true,
      true,
      false,
      false,
      true,
      false
    ]);
    expect(mask.slice(12, 24)).toEqual(mask.slice(0, 12));
  });

  it("maps the major blues preset across both octaves", () => {
    const mask = createScaleMask("majorBlues");
    expect(mask.slice(0, 12)).toEqual([
      true,
      false,
      true,
      true,
      true,
      false,
      false,
      true,
      false,
      true,
      false,
      false
    ]);
    expect(mask.slice(12, 24)).toEqual(mask.slice(0, 12));
  });

  it("maps the hirajoshi preset across both octaves", () => {
    const mask = createScaleMask("hirajoshi");
    expect(mask.slice(0, 12)).toEqual([
      true,
      false,
      true,
      true,
      false,
      false,
      false,
      true,
      true,
      false,
      false,
      false
    ]);
    expect(mask.slice(12, 24)).toEqual(mask.slice(0, 12));
  });

  it("maps the phrygian preset across both octaves", () => {
    const mask = createScaleMask("phrygian");
    expect(mask.slice(0, 12)).toEqual([
      true,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      true,
      false
    ]);
    expect(mask.slice(12, 24)).toEqual(mask.slice(0, 12));
  });

  it("maps the remaining mode presets across both octaves", () => {
    const cases = [
      {
        scaleId: "lydian" as const,
        firstOctave: [true, false, true, false, true, false, true, true, false, true, false, true]
      },
      {
        scaleId: "mixolydian" as const,
        firstOctave: [true, false, true, false, true, true, false, true, false, true, true, false]
      },
      {
        scaleId: "locrian" as const,
        firstOctave: [true, true, false, true, false, true, true, false, true, false, true, false]
      }
    ];

    for (const { scaleId, firstOctave } of cases) {
      const mask = createScaleMask(scaleId);
      expect(mask.slice(0, 12)).toEqual(firstOctave);
      expect(mask.slice(12, 24)).toEqual(firstOctave);
    }
  });

  it("maps melodic minor and its modes across both octaves", () => {
    const cases = [
      {
        scaleId: "melodicMinor" as const,
        firstOctave: [true, false, true, true, false, true, false, true, false, true, false, true]
      },
      {
        scaleId: "dorianFlat2" as const,
        firstOctave: [true, true, false, true, false, true, false, true, false, true, true, false]
      },
      {
        scaleId: "lydianAugmented" as const,
        firstOctave: [true, false, true, false, true, false, true, false, true, true, false, true]
      },
      {
        scaleId: "lydianDominant" as const,
        firstOctave: [true, false, true, false, true, false, true, true, false, true, true, false]
      },
      {
        scaleId: "mixolydianFlat6" as const,
        firstOctave: [true, false, true, false, true, true, false, true, true, false, true, false]
      },
      {
        scaleId: "locrianSharp2" as const,
        firstOctave: [true, false, true, true, false, true, true, false, true, false, true, false]
      },
      {
        scaleId: "altered" as const,
        firstOctave: [true, true, false, true, true, false, true, false, true, false, true, false]
      }
    ];

    for (const { scaleId, firstOctave } of cases) {
      const mask = createScaleMask(scaleId);
      expect(mask.slice(0, 12)).toEqual(firstOctave);
      expect(mask.slice(12, 24)).toEqual(firstOctave);
    }
  });

  it("maps the exotic scale presets across both octaves", () => {
    const cases = [
      {
        scaleId: "ambassel" as const,
        firstOctave: [true, true, false, false, false, true, false, true, true, false, false, false]
      },
      {
        scaleId: "anchihoye" as const,
        firstOctave: [true, false, false, true, false, false, true, true, false, false, false, true]
      },
      {
        scaleId: "japaneseYo" as const,
        firstOctave: [true, false, true, false, false, true, false, true, false, true, false, false]
      },
      {
        scaleId: "insen" as const,
        firstOctave: [true, true, false, false, false, true, false, true, false, false, true, false]
      },
      {
        scaleId: "iwato" as const,
        firstOctave: [true, true, false, false, false, true, true, false, false, false, true, false]
      },
      {
        scaleId: "kumoi" as const,
        firstOctave: [true, false, true, true, false, false, false, true, false, true, false, false]
      },
      {
        scaleId: "hungarianMinor" as const,
        firstOctave: [true, false, true, true, false, false, true, true, true, false, false, true]
      },
      {
        scaleId: "hungarianMajor" as const,
        firstOctave: [true, false, false, true, true, false, true, true, false, true, true, false]
      },
      {
        scaleId: "doubleHarmonicMajor" as const,
        firstOctave: [true, true, false, false, true, true, false, true, true, false, false, true]
      },
      {
        scaleId: "persian" as const,
        firstOctave: [true, true, false, false, true, true, true, false, true, false, false, true]
      },
      {
        scaleId: "egyptian" as const,
        firstOctave: [true, false, true, false, false, true, false, true, false, false, true, false]
      }
    ];

    for (const { scaleId, firstOctave } of cases) {
      const mask = createScaleMask(scaleId);
      expect(mask.slice(0, 12)).toEqual(firstOctave);
      expect(mask.slice(12, 24)).toEqual(firstOctave);
    }
  });

  it("maps quartal, quintal, and sextal presets as continuous stepped masks", () => {
    expect(enabledIndices(createScaleMask("quartal", 24))).toEqual([0, 5, 10, 15, 20]);
    expect(enabledIndices(createScaleMask("quintal", 24))).toEqual([0, 7, 14, 21]);
    expect(enabledIndices(createScaleMask("sextal", 24))).toEqual([0, 9, 18]);
  });

  it("maps key, octave, and bar to midi/frequency", () => {
    expect(midiForBar(0, "A", 0)).toBe(69);
    expect(midiForBar(0, "C", 0)).toBe(60);
    expect(midiForBar(0, "G", 1)).toBe(79);
    expect(frequencyForBar(0, "C", 0)).toBeCloseTo(261.6256, 4);
    expect(frequencyForBar(0, "A", 0)).toBeCloseTo(440, 4);
    expect(frequencyForBar(9, "C", 0)).toBeCloseTo(440, 4);
  });

  it("labels bars using the current key spelling", () => {
    expect(noteNameForBar(0, "C")).toBe("C");
    expect(noteNameForBar(2, "C")).toBe("D");
    expect(noteNameForBar(4, "C")).toBe("E");
    expect(noteNameForBar(1, "F")).toBe("Gb");
    expect(noteNameForBar(1, "G")).toBe("G#");
  });

  it("toggles analogous pitch classes across both octaves", () => {
    const mask = createScaleMask("majorPentatonic");
    const next = setPitchClassEnabled(mask, 1, true);
    expect(next[1]).toBe(true);
    expect(next[13]).toBe(true);

    const disabled = setPitchClassEnabled(next, 4, false);
    expect(disabled[4]).toBe(false);
    expect(disabled[16]).toBe(false);

    const threeOctave = setPitchClassEnabled(createScaleMask("majorPentatonic", 36), 1, true, 36);
    expect(threeOctave[1]).toBe(true);
    expect(threeOctave[13]).toBe(true);
    expect(threeOctave[25]).toBe(true);

    const piano = setPitchClassEnabled(createScaleMask("majorPentatonic", 88), 1, true, 88);
    expect(piano[1]).toBe(true);
    expect(piano[13]).toBe(true);
    expect(piano[85]).toBe(true);
  });
});

function enabledIndices(mask: readonly boolean[]) {
  return mask.flatMap((enabled, index) => (enabled ? [index] : []));
}
