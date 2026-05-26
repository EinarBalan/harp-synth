import { describe, expect, it } from "vitest";
import { HarpDsp } from "./engine";
import { TONE_PRESET_COUNT } from "./tones";

describe("HarpDsp", () => {
  it("produces finite audio after note on", () => {
    const dsp = new HarpDsp(48000);
    const left = new Float32Array(256);
    const right = new Float32Array(256);
    dsp.handleEvent({ type: "noteOn", noteId: 1, frequency: 440, velocity: 1 });
    dsp.process(left, right);
    expect(left.some((sample) => sample !== 0)).toBe(true);
    expect([...left, ...right].every(Number.isFinite)).toBe(true);
  });

  it("sustains while gated and releases after note off", () => {
    const dsp = new HarpDsp(48000);
    const left = new Float32Array(256);
    const right = new Float32Array(256);
    dsp.handleEvent({ type: "noteOn", noteId: 1, frequency: 440, velocity: 1 });
    for (let i = 0; i < 20; i += 1) {
      dsp.process(left, right);
    }
    expect(dsp.getActiveVoiceCount()).toBe(1);
    dsp.handleEvent({ type: "noteOff", noteId: 1 });
    for (let i = 0; i < 40; i += 1) {
      dsp.process(left, right);
    }
    expect(dsp.getActiveVoiceCount()).toBe(0);
  });

  it("keeps chorus and reverb bounded", () => {
    const dsp = new HarpDsp(48000, { chorus: true, reverb: 0.8 });
    const left = new Float32Array(512);
    const right = new Float32Array(512);
    dsp.handleEvent({ type: "noteOn", noteId: 1, frequency: 220, velocity: 1 });
    for (let i = 0; i < 30; i += 1) {
      dsp.process(left, right);
    }
    expect([...left, ...right].every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1)).toBe(true);
  });

  it("produces finite audio for every tone preset", () => {
    for (let toneIndex = 0; toneIndex < TONE_PRESET_COUNT; toneIndex += 1) {
      const dsp = new HarpDsp(48000, { toneIndex });
      const left = new Float32Array(256);
      const right = new Float32Array(256);

      dsp.handleEvent({ type: "noteOn", noteId: 1, frequency: 440, velocity: 1 });
      dsp.process(left, right);

      expect(left.some((sample) => sample !== 0)).toBe(true);
      expect([...left, ...right].every(Number.isFinite)).toBe(true);
    }
  });

  it("supports 24 simultaneous note ids", () => {
    const dsp = new HarpDsp(48000);
    for (let noteId = 0; noteId < 24; noteId += 1) {
      dsp.handleEvent({ type: "noteOn", noteId, frequency: 220 + noteId * 10, velocity: 1 });
    }

    expect(dsp.getActiveVoiceCount()).toBe(24);
  });

  it("rejects unknown note event types", () => {
    const dsp = new HarpDsp(48000);
    const unknownEvent = { type: "setParams", params: { volume: 0.5 } } as unknown as Parameters<
      HarpDsp["handleEvent"]
    >[0];

    expect(() => dsp.handleEvent(unknownEvent)).toThrow("Unknown note event type: setParams");
  });
});
