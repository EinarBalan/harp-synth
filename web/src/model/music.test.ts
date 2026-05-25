import { describe, expect, it } from "vitest";
import {
  BAR_COUNT,
  createScaleMask,
  frequencyForBar,
  getNextScaleId,
  midiForBar,
  setPitchClassEnabled
} from "./music";

describe("music model", () => {
  it("creates 24-bar masks", () => {
    expect(createScaleMask("majorPentatonic")).toHaveLength(BAR_COUNT);
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

  it("cycles scale presets without selecting custom", () => {
    expect(getNextScaleId("wholeTone", 1)).toBe("chromatic");
    expect(getNextScaleId("custom", 1)).toBe("major");
  });

  it("maps key, octave, and bar to midi/frequency", () => {
    expect(midiForBar(0, "C", 0)).toBe(60);
    expect(midiForBar(0, "G", 1)).toBe(79);
    expect(frequencyForBar(9, "C", 0)).toBeCloseTo(440, 4);
  });

  it("toggles analogous pitch classes across both octaves", () => {
    const mask = createScaleMask("majorPentatonic");
    const next = setPitchClassEnabled(mask, 1, true);
    expect(next[1]).toBe(true);
    expect(next[13]).toBe(true);

    const disabled = setPitchClassEnabled(next, 4, false);
    expect(disabled[4]).toBe(false);
    expect(disabled[16]).toBe(false);
  });
});
