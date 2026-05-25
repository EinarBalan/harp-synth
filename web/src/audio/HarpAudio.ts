import type { DspParams, NoteEvent } from "../dsp/engine";
import workletUrl from "./harpWorklet.ts?worker&url";

type PendingMessage =
  | { type: "params"; params: Partial<DspParams> }
  | { type: "event"; event: NoteEvent };

export class HarpAudio {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private pending: PendingMessage[] = [];
  private starting: Promise<void> | null = null;

  async start() {
    if (this.node) {
      await this.context?.resume();
      return;
    }

    if (!this.starting) {
      this.starting = this.initialize();
    }

    await this.starting;
  }

  setParams(params: Partial<DspParams>) {
    this.post({ type: "params", params });
  }

  sendEvent(event: NoteEvent) {
    this.post({ type: "event", event });
  }

  private async initialize() {
    const context = new AudioContext();
    await context.audioWorklet.addModule(workletUrl);
    const node = new AudioWorkletNode(context, "harp-synth", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    node.connect(context.destination);
    this.context = context;
    this.node = node;
    await context.resume();

    for (const message of this.pending) {
      node.port.postMessage(message);
    }
    this.pending = [];
  }

  private post(message: PendingMessage) {
    if (!this.node) {
      this.pending.push(message);
      return;
    }

    this.node.port.postMessage(message);
  }
}
