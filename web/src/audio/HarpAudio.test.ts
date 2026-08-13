import { afterEach, describe, expect, it, vi } from "vitest";
import { HarpAudio } from "./HarpAudio";

class FakeAudioWorkletNode {
  port = { postMessage: vi.fn() };
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static moduleFailure: Error | null = null;

  destination = {};
  state = "suspended";
  close = vi.fn().mockResolvedValue(undefined);
  addEventListener = vi.fn((_type: string, listener: () => void) => {
    this.listeners.add(listener);
  });
  removeEventListener = vi.fn((_type: string, listener: () => void) => {
    this.listeners.delete(listener);
  });
  resume = vi.fn().mockImplementation(() => {
    this.state = "running";
    return Promise.resolve();
  });
  audioWorklet = {
    addModule: vi.fn().mockImplementation(() => {
      const failure = FakeAudioContext.moduleFailure;
      FakeAudioContext.moduleFailure = null;
      return failure ? Promise.reject(failure) : Promise.resolve();
    })
  };

  private frozenTime: number | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  /** Mimics an iOS interruption that leaves the render thread dead after resuming. */
  interruptAndStall() {
    this.state = "suspended";
    this.frozenTime = Date.now() / 1000;
    for (const listener of this.listeners) {
      listener();
    }
  }

  get currentTime() {
    return this.frozenTime ?? Date.now() / 1000;
  }
}

function installFakes() {
  FakeAudioContext.instances = [];
  FakeAudioContext.moduleFailure = null;
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("AudioWorkletNode", FakeAudioWorkletNode);
  return FakeAudioContext.instances;
}

function workletNodeOf(audio: HarpAudio) {
  return (audio as unknown as { node: FakeAudioWorkletNode }).node;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "audioSession");
});

describe("HarpAudio", () => {
  it("creates and resumes the context synchronously so the iOS gesture still counts", () => {
    const contexts = installFakes();

    void new HarpAudio().start();

    expect(contexts).toHaveLength(1);
    expect(contexts[0].resume).toHaveBeenCalled();
  });

  it("claims the playback audio session so the ringer switch does not mute output", () => {
    installFakes();
    const session = { type: "auto" };
    Object.defineProperty(navigator, "audioSession", { configurable: true, value: session });

    void new HarpAudio().start();

    expect(session.type).toBe("playback");
  });

  it("flushes queued events in order once the worklet is ready", async () => {
    installFakes();
    const audio = new HarpAudio();

    audio.setParams({ volume: 0.4 });
    const started = audio.start();
    audio.sendEvent({ type: "noteOn", noteId: 1, frequency: 440, velocity: 0.9 });
    audio.sendEvent({ type: "noteOff", noteId: 1 });
    await started;

    expect(workletNodeOf(audio).port.postMessage.mock.calls.map(([message]) => message)).toEqual([
      { type: "params", params: { volume: 0.4 } },
      { type: "event", event: { type: "noteOn", noteId: 1, frequency: 440, velocity: 0.9 } },
      { type: "event", event: { type: "noteOff", noteId: 1 } }
    ]);
  });

  it("retries initialization after a failed module load", async () => {
    const contexts = installFakes();
    const audio = new HarpAudio();
    FakeAudioContext.moduleFailure = new Error("module blocked");

    await expect(audio.start()).rejects.toThrow("module blocked");
    await expect(audio.start()).resolves.toBeUndefined();
    expect(contexts[0].audioWorklet.addModule).toHaveBeenCalledTimes(2);
  });

  it("rebuilds the graph when an interrupted context comes back dead", async () => {
    vi.useFakeTimers();
    const contexts = installFakes();
    const audio = new HarpAudio();

    await audio.start();
    await vi.advanceTimersByTimeAsync(400);
    contexts[0].interruptAndStall();
    await vi.advanceTimersByTimeAsync(2000);

    expect(contexts[0].close).toHaveBeenCalled();
    expect(contexts).toHaveLength(2);
    expect(workletNodeOf(audio)).toBeTruthy();
  });

  it("leaves a slow-starting context alone instead of rebuilding it", async () => {
    vi.useFakeTimers();
    const contexts = installFakes();
    const audio = new HarpAudio();

    await audio.start();
    contexts[0].interruptAndStall();
    await vi.advanceTimersByTimeAsync(2000);

    expect(contexts[0].close).not.toHaveBeenCalled();
    expect(contexts).toHaveLength(1);
  });
});
