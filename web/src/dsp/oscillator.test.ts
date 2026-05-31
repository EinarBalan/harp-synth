import { describe, expect, it } from "vitest";
import { oscillatorPartial } from "./oscillator";

describe("oscillatorPartial", () => {
  it("smooths saw discontinuities", () => {
    const beforeWrap = oscillatorPartial(0.999, 440, { waveform: "saw", gain: 1 }, 0.1);
    const afterWrap = oscillatorPartial(0, 440, { waveform: "saw", gain: 1 }, 0.1);

    expect(Math.abs(beforeWrap - afterWrap)).toBeLessThan(0.1);
  });

  it("smooths square discontinuities", () => {
    const beforeTransition = oscillatorPartial(0.499, 440, { waveform: "square", gain: 1 }, 0.1);
    const afterTransition = oscillatorPartial(0.5, 440, { waveform: "square", gain: 1 }, 0.1);

    expect(Math.abs(beforeTransition - afterTransition)).toBeLessThan(0.1);
  });
});
