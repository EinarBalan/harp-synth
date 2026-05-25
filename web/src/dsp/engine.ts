import type { ToneName } from "../model/music";

const TWO_PI = Math.PI * 2;
const MAX_VOICES = 24;

export interface DspParams {
  sampleRate: number;
  volume: number;
  tone: ToneName;
  reverb: number;
  chorus: boolean;
  slide: boolean;
}

export type NoteEvent =
  | { type: "noteOn"; noteId: number; frequency: number; velocity: number }
  | { type: "noteOff"; noteId: number }
  | { type: "glide"; noteId: number; frequency: number };

type EnvelopeState = "idle" | "attack" | "sustain" | "release";

interface Voice {
  active: boolean;
  noteId: number;
  phase: number;
  frequency: number;
  targetFrequency: number;
  velocity: number;
  envelope: number;
  state: EnvelopeState;
  filterState: number;
}

interface DelayLine {
  buffer: Float32Array;
  index: number;
}

export function createDefaultParams(sampleRate = 48000): DspParams {
  return {
    sampleRate,
    volume: 0.72,
    tone: "HARP",
    reverb: 0.18,
    chorus: false,
    slide: false
  };
}

export class HarpDsp {
  private params: DspParams;
  private voices: Voice[];
  private chorusLine: DelayLine;
  private chorusPhase = 0;
  private reverbLines: DelayLine[];
  private reverbFeedback: number[];

  constructor(sampleRate = 48000, params: Partial<DspParams> = {}) {
    this.params = { ...createDefaultParams(sampleRate), ...params, sampleRate };
    this.voices = Array.from({ length: MAX_VOICES }, () => ({
      active: false,
      noteId: -1,
      phase: 0,
      frequency: 440,
      targetFrequency: 440,
      velocity: 0,
      envelope: 0,
      state: "idle",
      filterState: 0
    }));
    this.chorusLine = this.createDelayLine(0.055);
    this.reverbLines = [0.043, 0.061, 0.079, 0.101].map((seconds) => this.createDelayLine(seconds));
    this.reverbFeedback = [0.42, 0.39, 0.36, 0.33];
  }

  setParams(params: Partial<DspParams>) {
    this.params = {
      ...this.params,
      ...params,
      volume: clamp(params.volume ?? this.params.volume, 0, 1),
      reverb: clamp(params.reverb ?? this.params.reverb, 0, 1)
    };
  }

  handleEvent(event: NoteEvent) {
    switch (event.type) {
      case "noteOn":
        this.noteOn(event.noteId, event.frequency, event.velocity);
        return;
      case "noteOff":
        this.noteOff(event.noteId);
        return;
      case "glide":
        this.glide(event.noteId, event.frequency);
        return;
      default: {
        const eventType = (event as { type?: unknown }).type;
        throw new Error(`Unknown note event type: ${String(eventType)}`);
      }
    }
  }

  process(left: Float32Array, right: Float32Array) {
    for (let i = 0; i < left.length; i += 1) {
      let sample = 0;
      for (const voice of this.voices) {
        if (voice.active) {
          sample += this.processVoice(voice);
        }
      }

      sample *= this.params.volume * 0.32;
      const reverbed = this.processReverb(sample);
      const withReverb = lerp(sample, reverbed, this.params.reverb);
      const [chorusLeft, chorusRight] = this.processChorus(withReverb);

      left[i] = softClip(chorusLeft);
      right[i] = softClip(chorusRight);
    }
  }

  getActiveVoiceCount() {
    return this.voices.filter((voice) => voice.active).length;
  }

  private noteOn(noteId: number, frequency: number, velocity: number) {
    const existing = this.findVoice(noteId);
    const voice = existing ?? this.claimVoice();
    voice.active = true;
    voice.noteId = noteId;
    voice.frequency = frequency;
    voice.targetFrequency = frequency;
    voice.velocity = clamp(velocity, 0, 1);
    voice.state = "attack";
  }

  private noteOff(noteId: number) {
    const voice = this.findVoice(noteId);
    if (voice && voice.state !== "idle") {
      voice.state = "release";
    }
  }

  private glide(noteId: number, frequency: number) {
    const voice = this.findVoice(noteId);
    if (voice) {
      voice.targetFrequency = frequency;
    }
  }

  private processVoice(voice: Voice) {
    const sampleRate = this.params.sampleRate;
    const glideCoefficient = this.params.slide ? 0.00075 : 0.035;
    voice.frequency = lerp(voice.frequency, voice.targetFrequency, glideCoefficient);
    voice.phase = wrapPhase(voice.phase + voice.frequency / sampleRate);

    const raw = this.oscillator(voice.phase, voice.frequency);
    const envelope = this.advanceEnvelope(voice);
    const filtered = this.applyToneFilter(voice, raw);
    return filtered * envelope * voice.velocity;
  }

  private oscillator(phase: number, frequency: number) {
    const sine = Math.sin(phase * TWO_PI);
    const second = Math.sin(phase * TWO_PI * 2 + 0.3) * 0.24;
    const third = Math.sin(phase * TWO_PI * 3 + 0.7) * 0.14;
    const triangle = 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
    const saw = phase * 2 - 1;

    switch (this.params.tone) {
      case "BRIGHT":
        return sine * 0.55 + saw * 0.25 + second;
      case "BELL":
        return sine * 0.65 + Math.sin(phase * TWO_PI * 2.01) * 0.22 + Math.sin(phase * TWO_PI * 3.92) * 0.13;
      case "MUTED":
        return sine * 0.48 + triangle * 0.42;
      case "HARP":
      default:
        return sine * 0.65 + triangle * 0.2 + second + third * (frequency < 500 ? 1 : 0.6);
    }
  }

  private advanceEnvelope(voice: Voice) {
    const attackStep = 1 / Math.max(1, this.params.sampleRate * 0.006);
    const releaseStep = 1 / Math.max(1, this.params.sampleRate * 0.16);

    if (voice.state === "attack") {
      voice.envelope += attackStep;
      if (voice.envelope >= 1) {
        voice.envelope = 1;
        voice.state = "sustain";
      }
    } else if (voice.state === "release") {
      voice.envelope -= releaseStep;
      if (voice.envelope <= 0) {
        voice.envelope = 0;
        voice.state = "idle";
        voice.active = false;
        voice.noteId = -1;
      }
    }

    return voice.envelope;
  }

  private applyToneFilter(voice: Voice, sample: number) {
    const cutoff = {
      HARP: 0.18,
      BRIGHT: 0.36,
      BELL: 0.27,
      MUTED: 0.08
    }[this.params.tone];
    voice.filterState += cutoff * (sample - voice.filterState);
    return voice.filterState;
  }

  private processChorus(sample: number): [number, number] {
    const line = this.chorusLine;
    line.buffer[line.index] = sample;

    if (!this.params.chorus) {
      line.index = (line.index + 1) % line.buffer.length;
      return [sample, sample];
    }

    const rateHz = 0.65;
    this.chorusPhase = wrapPhase(this.chorusPhase + rateHz / this.params.sampleRate);
    const leftDelay = 0.018 + Math.sin(this.chorusPhase * TWO_PI) * 0.005;
    const rightDelay = 0.022 + Math.sin(this.chorusPhase * TWO_PI + Math.PI * 0.5) * 0.006;
    const leftWet = this.readDelay(line, leftDelay);
    const rightWet = this.readDelay(line, rightDelay);
    line.buffer[line.index] = sample + (leftWet + rightWet) * 0.055;
    line.index = (line.index + 1) % line.buffer.length;

    return [sample * 0.72 + leftWet * 0.28, sample * 0.72 + rightWet * 0.28];
  }

  private processReverb(sample: number) {
    let sum = 0;
    for (let i = 0; i < this.reverbLines.length; i += 1) {
      const line = this.reverbLines[i];
      const delayed = line.buffer[line.index];
      line.buffer[line.index] = sample + delayed * this.reverbFeedback[i];
      line.index = (line.index + 1) % line.buffer.length;
      sum += delayed;
    }
    return sum / this.reverbLines.length;
  }

  private findVoice(noteId: number) {
    return this.voices.find((voice) => voice.active && voice.noteId === noteId);
  }

  private claimVoice() {
    return (
      this.voices.find((voice) => !voice.active) ??
      this.voices.reduce((quietest, voice) => (voice.envelope < quietest.envelope ? voice : quietest), this.voices[0])
    );
  }

  private createDelayLine(seconds: number): DelayLine {
    return {
      buffer: new Float32Array(Math.ceil(this.params.sampleRate * seconds)),
      index: 0
    };
  }

  private readDelay(line: DelayLine, seconds: number) {
    const delaySamples = seconds * this.params.sampleRate;
    const readIndex = (line.index - delaySamples + line.buffer.length) % line.buffer.length;
    const indexA = Math.floor(readIndex);
    const indexB = (indexA + 1) % line.buffer.length;
    const fraction = readIndex - indexA;
    return lerp(line.buffer[indexA], line.buffer[indexB], fraction);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function wrapPhase(phase: number) {
  return phase - Math.floor(phase);
}

function softClip(sample: number) {
  return Math.tanh(sample * 1.4);
}
