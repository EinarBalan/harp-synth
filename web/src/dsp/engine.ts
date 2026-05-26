import {
  ATTACK_SECONDS,
  CHORUS_DRY_GAIN,
  CHORUS_DELAY_SECONDS,
  CHORUS_FEEDBACK_GAIN,
  CHORUS_LEFT_DELAY_SECONDS,
  CHORUS_LEFT_DEPTH_SECONDS,
  CHORUS_RATE_HZ,
  CHORUS_RIGHT_DELAY_SECONDS,
  CHORUS_RIGHT_DEPTH_SECONDS,
  CHORUS_WET_GAIN,
  DEFAULT_CHORUS,
  DEFAULT_REVERB,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_SLIDE,
  DEFAULT_TONE_INDEX,
  DEFAULT_VOICE_FREQUENCY,
  DEFAULT_VOLUME,
  FAST_GLIDE_COEFFICIENT,
  GLIDE_COEFFICIENT,
  MAX_VOICES,
  OUTPUT_GAIN,
  RELEASE_SECONDS,
  REVERB_DELAY_SECONDS,
  REVERB_FEEDBACK
} from "./config";
import { lerp, oscillatorPartial, sineWave, softClip, wrapPhase } from "./oscillator";
import { clampToneIndex, getTonePreset, type TonePreset } from "./tones";
import { clamp } from "./utils";

// Public audio engine data
export interface DspParams {
  sampleRate: number;
  volume: number;
  toneIndex: number;
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

// Defaults
export function createDefaultParams(sampleRate = DEFAULT_SAMPLE_RATE): DspParams {
  return {
    sampleRate,
    volume: DEFAULT_VOLUME,
    toneIndex: DEFAULT_TONE_INDEX,
    reverb: DEFAULT_REVERB,
    chorus: DEFAULT_CHORUS,
    slide: DEFAULT_SLIDE
  };
}

export class HarpDsp {
  private params: DspParams;
  private tone: TonePreset;
  private voices: Voice[];
  private chorusLine: DelayLine;
  private chorusPhase = 0;
  private reverbLines: DelayLine[];
  private reverbFeedback: readonly number[];

  constructor(sampleRate = DEFAULT_SAMPLE_RATE, params: Partial<DspParams> = {}) {
    const defaultParams = createDefaultParams(sampleRate);
    this.params = {
      ...defaultParams,
      ...params,
      sampleRate,
      toneIndex: clampToneIndex(params.toneIndex ?? defaultParams.toneIndex)
    };
    this.tone = getTonePreset(this.params.toneIndex);
    this.voices = Array.from({ length: MAX_VOICES }, () => ({
      active: false,
      noteId: -1,
      phase: 0,
      frequency: DEFAULT_VOICE_FREQUENCY,
      targetFrequency: DEFAULT_VOICE_FREQUENCY,
      velocity: 0,
      envelope: 0,
      state: "idle",
      filterState: 0
    }));
    this.chorusLine = this.createDelayLine(CHORUS_DELAY_SECONDS);
    this.reverbLines = REVERB_DELAY_SECONDS.map((seconds) => this.createDelayLine(seconds));
    this.reverbFeedback = REVERB_FEEDBACK;
  }

  // Public controls
  setParams(params: Partial<DspParams>) {
    this.params = {
      ...this.params,
      ...params,
      volume: clamp(params.volume ?? this.params.volume, 0, 1),
      toneIndex: clampToneIndex(params.toneIndex ?? this.params.toneIndex),
      reverb: clamp(params.reverb ?? this.params.reverb, 0, 1)
    };
    this.tone = getTonePreset(this.params.toneIndex);
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

      sample *= this.params.volume * OUTPUT_GAIN;
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

  // Note lifecycle
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

  private findVoice(noteId: number) {
    return this.voices.find((voice) => voice.active && voice.noteId === noteId);
  }

  private claimVoice() {
    return (
      this.voices.find((voice) => !voice.active) ??
      this.voices.reduce((quietest, voice) => (voice.envelope < quietest.envelope ? voice : quietest), this.voices[0])
    );
  }

  // Voice rendering
  private processVoice(voice: Voice) {
    const sampleRate = this.params.sampleRate;
    const glideCoefficient = this.params.slide ? GLIDE_COEFFICIENT : FAST_GLIDE_COEFFICIENT;
    voice.frequency = lerp(voice.frequency, voice.targetFrequency, glideCoefficient);

    // Frequency is cycles per second; sampleRate is samples per second, so this increments phase by cycles per sample.
    voice.phase = wrapPhase(voice.phase + voice.frequency / sampleRate);

    const raw = this.oscillator(voice.phase, voice.frequency);
    const envelope = this.advanceEnvelope(voice);
    const filtered = this.applyToneFilter(voice, raw);
    return filtered * envelope * voice.velocity;
  }

  private oscillator(phase: number, frequency: number) {
    return this.tone.partials.reduce((sample, partial) => sample + oscillatorPartial(phase, frequency, partial), 0);
  }

  private advanceEnvelope(voice: Voice) {
    const attackStep = 1 / Math.max(1, this.params.sampleRate * ATTACK_SECONDS);
    const releaseStep = 1 / Math.max(1, this.params.sampleRate * RELEASE_SECONDS);

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
    voice.filterState += this.tone.filterCutoff * (sample - voice.filterState);
    return voice.filterState;
  }

  // Effects
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

  private processChorus(sample: number): [number, number] {
    const line = this.chorusLine;
    line.buffer[line.index] = sample;

    if (!this.params.chorus) {
      line.index = (line.index + 1) % line.buffer.length;
      return [sample, sample];
    }

    const rateHz = CHORUS_RATE_HZ;
    this.chorusPhase = wrapPhase(this.chorusPhase + rateHz / this.params.sampleRate);
    const leftDelay = CHORUS_LEFT_DELAY_SECONDS + sineWave(this.chorusPhase) * CHORUS_LEFT_DEPTH_SECONDS;
    const rightDelay = CHORUS_RIGHT_DELAY_SECONDS + sineWave(this.chorusPhase, Math.PI * 0.5) * CHORUS_RIGHT_DEPTH_SECONDS;
    const leftWet = this.readDelay(line, leftDelay);
    const rightWet = this.readDelay(line, rightDelay);
    line.buffer[line.index] = sample + (leftWet + rightWet) * CHORUS_FEEDBACK_GAIN;
    line.index = (line.index + 1) % line.buffer.length;

    return [
      sample * CHORUS_DRY_GAIN + leftWet * CHORUS_WET_GAIN,
      sample * CHORUS_DRY_GAIN + rightWet * CHORUS_WET_GAIN
    ];
  }

  // Delay buffers
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
