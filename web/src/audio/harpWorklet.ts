import { createDefaultParams, HarpDsp, type DspParams, type NoteEvent } from "../dsp/engine";

declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}
declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void;

type WorkletMessage =
  | { type: "params"; params: Partial<DspParams> }
  | { type: "event"; event: NoteEvent };

class HarpSynthProcessor extends AudioWorkletProcessor {
  private dsp = new HarpDsp(sampleRate, createDefaultParams(sampleRate));

  constructor() {
    super();
    this.port.onmessage = (message: MessageEvent<WorkletMessage>) => {
      if (message.data.type === "params") {
        this.dsp.setParams(message.data.params);
      } else {
        this.dsp.handleEvent(message.data.event);
      }
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    const output = outputs[0];
    if (!output?.[0]) {
      return true;
    }

    const left = output[0];
    const right = output[1] ?? output[0];
    this.dsp.process(left, right);
    return true;
  }
}

registerProcessor("harp-synth", HarpSynthProcessor);
