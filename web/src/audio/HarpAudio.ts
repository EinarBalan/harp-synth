import type { DspParams, NoteEvent } from "../dsp/engine";
import { HARP_WORKLET_NAME } from "./constants";
import workletUrl from "./harpWorklet.ts?worker&url";

interface AudioSession {
  type: "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";
}

type NavigatorWithAudioSession = Navigator & { audioSession?: AudioSession };

/** Silent unlock clip length; only needs to be long enough to loop cleanly. */
const SILENT_WAV_SAMPLE_RATE = 8000;
const SILENT_WAV_FRAMES = 800;
/** How long to wait for the render thread to prove it is actually producing audio. */
const OUTPUT_CHECK_MS = 300;

export class HarpAudio {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private pendingEvents: NoteEvent[] = [];
  private loading: Promise<void> | null = null;
  private params: Partial<DspParams> = {};
  private unlockElement: HTMLAudioElement | null = null;
  private recoveryAttached = false;
  private rebuilding = false;
  private outputConfirmed = false;
  private outputCheck: Promise<void> | null = null;

  /**
   * Creates the context and loads the worklet ahead of the first gesture. Safe to
   * call on mount: the context starts suspended until start() runs inside a gesture.
   */
  prepare() {
    return this.load();
  }

  /**
   * Must be called synchronously from a user-gesture handler. Everything iOS gates
   * behind the gesture (session category, silent-media unlock, resume) happens
   * before the first await, otherwise Safari sees the promise continuation as a
   * separate task and silently leaves the context suspended.
   */
  start() {
    this.claimAudioSession();
    void this.ensureContext()?.resume().catch(() => undefined);
    const loading = this.load();
    void loading.then(() => this.confirmOutput()).catch(() => undefined);
    return loading;
  }

  setParams(params: Partial<DspParams>) {
    // No queueing: initialize() sends the merged snapshot once the node exists.
    this.params = { ...this.params, ...params };
    this.node?.port.postMessage({ type: "params", params });
  }

  sendEvent(event: NoteEvent) {
    if (!this.node) {
      this.pendingEvents.push(event);
      return;
    }

    this.node.port.postMessage({ type: "event", event });
  }

  private load() {
    if (!this.loading) {
      this.loading = this.initialize().catch((error) => {
        // Let the next gesture retry: a rejected promise cached here would kill audio for good.
        this.loading = null;
        throw error;
      });
    }

    return this.loading;
  }

  private ensureContext() {
    if (this.context) {
      return this.context;
    }

    if (typeof AudioContext === "undefined") {
      return null;
    }

    const context = new AudioContext();
    context.addEventListener("statechange", this.handleStateChange);
    this.context = context;
    return context;
  }

  private async initialize() {
    this.claimAudioSession();
    this.attachRecovery();

    const context = this.ensureContext();
    if (!context) {
      throw new Error("Web Audio is unavailable in this browser.");
    }

    if (!context.audioWorklet) {
      throw new Error(
        "AudioWorklet is unavailable. This usually means the page is not in a secure context - serve it over https:// or localhost."
      );
    }

    await context.audioWorklet.addModule(workletUrl);
    const node = new AudioWorkletNode(context, HARP_WORKLET_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    node.connect(context.destination);
    this.node = node;
    void context.resume().catch(() => undefined);

    node.port.postMessage({ type: "params", params: this.params });
    for (const event of this.pendingEvents) {
      node.port.postMessage({ type: "event", event });
    }
    this.pendingEvents = [];
  }

  /**
   * iOS runs Web Audio in the "ambient" session category, which the hardware ringer
   * switch mutes. Declaring "playback" opts into a category that ignores it; older
   * iOS versions have no such API, so a looping silent media element is used to
   * push the page into the same category.
   */
  private claimAudioSession() {
    const session = (navigator as NavigatorWithAudioSession).audioSession;
    if (session) {
      if (session.type !== "playback") {
        session.type = "playback";
      }
      return;
    }

    try {
      if (!this.unlockElement) {
        const element = new Audio(createSilentWavUrl());
        element.loop = true;
        element.preload = "auto";
        element.setAttribute("playsinline", "");
        this.unlockElement = element;
      }

      if (this.unlockElement.paused) {
        void this.unlockElement.play()?.catch(() => undefined);
      }
    } catch {
      // Without the silent element the ringer switch may mute us, but audio still works.
    }
  }

  /**
   * Safari suspends (or "interrupts") the context when the page is backgrounded, the
   * screen locks, or another app takes the audio route, and never resumes on its own.
   */
  private attachRecovery() {
    if (this.recoveryAttached || typeof window === "undefined") {
      return;
    }

    this.recoveryAttached = true;
    const recover = () => void this.resumeIfNeeded();

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        recover();
      }
    });
    window.addEventListener("pageshow", recover);
    window.addEventListener("focus", recover);
    // Resume only succeeds inside a gesture on iOS, so retry on every interaction.
    window.addEventListener("pointerdown", recover, true);
    window.addEventListener("touchend", recover, true);
  }

  private handleStateChange = () => {
    if (this.context && this.context.state !== "running") {
      this.outputConfirmed = false;
      void this.resumeIfNeeded();
    }
  };

  private async resumeIfNeeded() {
    const context = this.context;
    if (!context || context.state === "running" || this.rebuilding) {
      return;
    }

    this.claimAudioSession();
    try {
      await context.resume();
    } catch {
      // Resume outside a gesture is rejected; the next interaction retries.
      return;
    }

    await this.confirmOutput();
  }

  /**
   * After an interruption iOS can report a running context whose render thread is
   * dead: currentTime stops advancing and nothing is heard. Rebuild when that happens.
   * Checked once per running stretch, not once per note.
   */
  private confirmOutput() {
    if (this.outputConfirmed) {
      return Promise.resolve();
    }

    if (!this.outputCheck) {
      this.outputCheck = this.runOutputCheck().finally(() => {
        this.outputCheck = null;
      });
    }

    return this.outputCheck;
  }

  private async runOutputCheck() {
    const context = this.context;
    if (!context || context.state !== "running" || this.rebuilding) {
      return;
    }

    const startedAt = context.currentTime;
    await new Promise((resolve) => setTimeout(resolve, OUTPUT_CHECK_MS));

    if (this.context !== context || context.state !== "running") {
      return;
    }

    if (context.currentTime === startedAt) {
      await this.rebuild();
      return;
    }

    this.outputConfirmed = true;
  }

  private async rebuild() {
    const stale = this.context;
    if (!stale || this.rebuilding) {
      return;
    }

    this.rebuilding = true;
    this.outputConfirmed = false;
    stale.removeEventListener("statechange", this.handleStateChange);
    this.node?.disconnect();
    this.node = null;
    this.context = null;
    this.loading = null;
    this.pendingEvents = [];

    try {
      await stale.close();
    } catch {
      // A context killed by the OS can refuse to close; the fresh one still works.
    }

    this.rebuilding = false;
    this.claimAudioSession();
    await this.load().catch(() => undefined);
    await this.ensureContext()?.resume().catch(() => undefined);
  }
}

/** Minimal 8-bit mono WAV of pure silence, used to claim the playback session category. */
function createSilentWavUrl() {
  const bytes = new Uint8Array(44 + SILENT_WAV_FRAMES);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + SILENT_WAV_FRAMES, true);
  writeAscii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SILENT_WAV_SAMPLE_RATE, true);
  view.setUint32(28, SILENT_WAV_SAMPLE_RATE, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeAscii(36, "data");
  view.setUint32(40, SILENT_WAV_FRAMES, true);
  bytes.fill(128, 44);

  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}
