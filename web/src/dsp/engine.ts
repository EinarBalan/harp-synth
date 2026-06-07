import {
  ATTACK_SECONDS,
  CHORUS_DRY_GAIN,
  CHORUS_DELAY_SECONDS,
  CHORUS_FEEDBACK_GAIN,
  CHORUS_RIGHT_DELAY_OFFSET_SECONDS,
  CHORUS_RIGHT_PHASE_OFFSET,
  CHORUS_STEREO_WIDTH,
  CHORUS_VOICES,
  CHORUS_WET_FILTER,
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
  REVERB_DAMPING,
  REVERB_DELAY_SECONDS,
  REVERB_DRY_GAIN_AT_MAX,
  REVERB_FEEDBACK,
  REVERB_RIGHT_DELAY_SECONDS,
  REVERB_STEREO_CROSSFEED,
  REVERB_WET_GAIN
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
  partialPhases: number[];
}

interface DelayLine {
  buffer: Float32Array;
  index: number;
  filterState: number;
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
  private chorusPhases: number[];
  private chorusLeftWet = 0;
  private chorusRightWet = 0;
  private reverbLeftLines: DelayLine[];
  private reverbRightLines: DelayLine[];
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
      filterState: 0,
      partialPhases: []
    }));
    this.chorusLine = this.createDelayLine(CHORUS_DELAY_SECONDS);
    this.chorusPhases = CHORUS_VOICES.map((voice) => voice.phaseOffset);
    this.reverbLeftLines = REVERB_DELAY_SECONDS.map((seconds) => this.createDelayLine(seconds));
    this.reverbRightLines = REVERB_RIGHT_DELAY_SECONDS.map((seconds) => this.createDelayLine(seconds));
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

  // Main audio processing loop
  // 
  process(left: Float32Array, right: Float32Array) {
    for (let i = 0; i < left.length; i += 1) {
      let sample = 0;
      for (const voice of this.voices) {
        if (voice.active) {
          sample += this.processVoice(voice);
        }
      }

      sample *= this.params.volume * OUTPUT_GAIN;
      const [chorusLeft, chorusRight] = this.processChorus(sample);
      const [reverbLeft, reverbRight] = this.processReverb(chorusLeft, chorusRight);
      const dryGain = lerp(1, REVERB_DRY_GAIN_AT_MAX, this.params.reverb);
      const wetGain = this.params.reverb * REVERB_WET_GAIN;

      left[i] = softClip(chorusLeft * dryGain + reverbLeft * wetGain);
      right[i] = softClip(chorusRight * dryGain + reverbRight * wetGain);
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
    voice.phase = 0;
    voice.filterState = 0;
    voice.partialPhases = this.tone.partials.map(() => 0);
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

    const raw = this.oscillator(voice);
    const envelope = this.advanceEnvelope(voice);
    const filtered = this.applyToneFilter(voice, raw);
    return filtered * envelope * voice.velocity;
  }

  private oscillator(voice: Voice) {
    this.syncPartialPhases(voice);

    return this.tone.partials.reduce((sample, partial, index) => {
      const partialFrequency = voice.frequency * (partial.ratio ?? 1);
      if (partialFrequency >= this.params.sampleRate * 0.5) {
        return sample;
      }

      const phaseIncrement = partialFrequency / this.params.sampleRate;
      voice.partialPhases[index] = wrapPhase(voice.partialPhases[index] + phaseIncrement);
      return sample + oscillatorPartial(voice.partialPhases[index], voice.frequency, partial, phaseIncrement);
    }, 0);
  }

  private syncPartialPhases(voice: Voice) {
    if (voice.partialPhases.length === this.tone.partials.length) {
      return;
    }

    voice.partialPhases = this.tone.partials.map((partial, index) => {
      return voice.partialPhases[index] ?? wrapPhase(voice.phase * (partial.ratio ?? 1));
    });
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
  private processReverb(leftSample: number, rightSample: number): [number, number] {
    let leftSum = 0;
    let rightSum = 0;

    for (let i = 0; i < this.reverbLeftLines.length; i += 1) {
      const leftLine = this.reverbLeftLines[i];
      const rightLine = this.reverbRightLines[i];
      const leftDelayed = leftLine.buffer[leftLine.index];
      const rightDelayed = rightLine.buffer[rightLine.index];

      leftLine.filterState += REVERB_DAMPING * (leftDelayed - leftLine.filterState);
      rightLine.filterState += REVERB_DAMPING * (rightDelayed - rightLine.filterState);

      leftLine.buffer[leftLine.index] =
        leftSample + (leftLine.filterState + rightLine.filterState * REVERB_STEREO_CROSSFEED) * this.reverbFeedback[i];
      rightLine.buffer[rightLine.index] =
        rightSample + (rightLine.filterState + leftLine.filterState * REVERB_STEREO_CROSSFEED) * this.reverbFeedback[i];

      leftLine.index = (leftLine.index + 1) % leftLine.buffer.length;
      rightLine.index = (rightLine.index + 1) % rightLine.buffer.length;
      leftSum += leftDelayed;
      rightSum += rightDelayed;
    }

    return [leftSum / this.reverbLeftLines.length, rightSum / this.reverbRightLines.length];
  }

  private processChorus(sample: number): [number, number] {
    const line = this.chorusLine;
    line.buffer[line.index] = sample;

    if (!this.params.chorus) {
      this.chorusLeftWet = 0;
      this.chorusRightWet = 0;
      line.index = (line.index + 1) % line.buffer.length;
      return [sample, sample];
    }

    let leftWet = 0;
    let rightWet = 0;

    for (let i = 0; i < CHORUS_VOICES.length; i += 1) {
      const voice = CHORUS_VOICES[i];
      const phase = wrapPhase(this.chorusPhases[i] + voice.rateHz / this.params.sampleRate);
      this.chorusPhases[i] = phase;

      const leftDelay = voice.delaySeconds + sineWave(phase) * voice.depthSeconds;
      const rightDelay =
        voice.delaySeconds +
        CHORUS_RIGHT_DELAY_OFFSET_SECONDS +
        sineWave(wrapPhase(phase + CHORUS_RIGHT_PHASE_OFFSET)) * voice.depthSeconds;
      leftWet += this.readDelay(line, leftDelay);
      rightWet += this.readDelay(line, rightDelay);
    }

    leftWet /= CHORUS_VOICES.length;
    rightWet /= CHORUS_VOICES.length;
    this.chorusLeftWet += CHORUS_WET_FILTER * (leftWet - this.chorusLeftWet);
    this.chorusRightWet += CHORUS_WET_FILTER * (rightWet - this.chorusRightWet);
    line.buffer[line.index] = sample + (this.chorusLeftWet + this.chorusRightWet) * 0.5 * CHORUS_FEEDBACK_GAIN;
    line.index = (line.index + 1) % line.buffer.length;

    const wetMid = (this.chorusLeftWet + this.chorusRightWet) * 0.5;
    const wetSide = (this.chorusLeftWet - this.chorusRightWet) * 0.5 * CHORUS_STEREO_WIDTH;
    const wideLeftWet = wetMid + wetSide;
    const wideRightWet = wetMid - wetSide;

    return [
      sample * CHORUS_DRY_GAIN + wideLeftWet * CHORUS_WET_GAIN,
      sample * CHORUS_DRY_GAIN + wideRightWet * CHORUS_WET_GAIN
    ];
  }

  // Delay buffers
  private createDelayLine(seconds: number): DelayLine {
    return {
      buffer: new Float32Array(Math.ceil(this.params.sampleRate * seconds)),
      index: 0,
      filterState: 0
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
