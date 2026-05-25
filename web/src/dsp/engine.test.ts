import { describe, expect, it } from "vitest";
import { HarpDsp } from "./engine";

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
});
