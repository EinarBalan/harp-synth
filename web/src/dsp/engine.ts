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

/** Runtime parameters that can be changed by UI, MIDI, or control messages. */
export interface DspParams {
  /** Processing sample rate in Hz. */
  sampleRate: number;
  /** Master volume, from 0 to 1. */
  volume: number;
  /** Index into the tone preset table. */
  toneIndex: number;
  /** Reverb mix, from 0 to 1. */
  reverb: number;
  /** Enables stereo chorus when true. */
  chorus: boolean;
  /** Uses slower pitch changes when true. */
  slide: boolean;
}

/** Note and pitch events accepted by the audio engine. */
export type NoteEvent =
  | { type: "noteOn"; noteId: number; frequency: number; velocity: number }
  | { type: "noteOff"; noteId: number }
  | { type: "glide"; noteId: number; frequency: number };

/** Note volume stage for each voice. */
type EnvelopeState = "idle" | "attack" | "sustain" | "release";

/** State for one playing note. */
interface Voice {
  /** Whether this slot is currently producing audio. */
  active: boolean;
  /** Caller-provided note identifier used for noteOff/glide lookup. */
  noteId: number;
  /** Position in the main wave cycle, from 0 to 1. */
  phase: number;
  /** Current smoothed frequency in Hz. */
  frequency: number;
  /** Requested frequency in Hz. */
  targetFrequency: number;
  /** Note velocity, from 0 to 1. */
  velocity: number;
  /** Current note-volume level. */
  envelope: number;
  /** Current attack/sustain/release state. */
  state: EnvelopeState;
  /** State for the per-voice smoothing filter. */
  filterState: number;
  /** Separate wave-cycle positions for each sound layer. */
  partialPhases: number[];
}

/** Delay buffer state for chorus and reverb. */
interface DelayLine {
  /** Delay samples. */
  buffer: Float32Array;
  /** Current write/read position in the wrapping buffer. */
  index: number;
  /** Smoothing state used by reverb lines. */
  filterState: number;
}

/** Creates the default parameter set for a sample rate. */
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

/**
 * Polyphonic harp synth DSP engine.
 *
 * The engine renders stereo float samples in the usual [-1, 1] audio range and
 * owns all voice/effect state needed by an audio worklet.
 */
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

  /** Merges new runtime parameters and clamps 0-to-1 controls. */
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

  /** Dispatches one note or glide event into the engine. */
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

  /** Renders one stereo block into caller-provided output buffers. */
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

  /** Returns the number of active voices. */
  getActiveVoiceCount() {
    return this.voices.filter((voice) => voice.active).length;
  }

  /** Starts or retriggers a voice for noteId. */
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

  /** Moves an active voice into release state. */
  private noteOff(noteId: number) {
    const voice = this.findVoice(noteId);
    if (voice && voice.state !== "idle") {
      voice.state = "release";
    }
  }

  /** Updates the target frequency for an active voice. */
  private glide(noteId: number, frequency: number) {
    const voice = this.findVoice(noteId);
    if (voice) {
      voice.targetFrequency = frequency;
    }
  }

  /** Finds the active voice matching noteId. */
  private findVoice(noteId: number) {
    return this.voices.find((voice) => voice.active && voice.noteId === noteId);
  }

  /** Returns a free voice, or steals the quietest active voice. */
  private claimVoice() {
    return (
      this.voices.find((voice) => !voice.active) ??
      this.voices.reduce((quietest, voice) => (voice.envelope < quietest.envelope ? voice : quietest), this.voices[0])
    );
  }

  /** Renders one mono sample for a voice and advances its state. */
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

  /** Renders the selected tone preset for a voice. */
  private oscillator(voice: Voice) {
    this.syncPartialPhases(voice);

    return this.tone.partials.reduce((sample, partial, index) => {
      const partialFrequency = voice.frequency * (partial.ratio ?? 1);
      // Skip layers too high to represent cleanly at the current sample rate.
      if (partialFrequency >= this.params.sampleRate * 0.5) {
        return sample;
      }

      const phaseIncrement = partialFrequency / this.params.sampleRate;
      voice.partialPhases[index] = wrapPhase(voice.partialPhases[index] + phaseIncrement);
      return sample + oscillatorPartial(voice.partialPhases[index], voice.frequency, partial, phaseIncrement);
    }, 0);
  }

  /** Reinitializes per-layer wave positions after tone-preset changes. */
  private syncPartialPhases(voice: Voice) {
    if (voice.partialPhases.length === this.tone.partials.length) {
      return;
    }

    voice.partialPhases = this.tone.partials.map((partial, index) => {
      return voice.partialPhases[index] ?? wrapPhase(voice.phase * (partial.ratio ?? 1));
    });
  }

  /** Updates the note-volume ramp and returns current level. */
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

  /** Applies the selected tone preset's simple smoothing filter. */
  private applyToneFilter(voice: Voice, sample: number) {
    voice.filterState += this.tone.filterCutoff * (sample - voice.filterState);
    return voice.filterState;
  }

  /** Applies the stereo multi-delay reverb. */
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

      // Feed a little of each side into the other side to make the reverb wider
      // without adding more delay buffers.
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

  /** Applies stereo chorus to a mono input sample. */
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

    // Several slowly moving delays create a wider chorus than one moving delay.
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
    // Split the chorus into center and side parts, then widen the side part.
    const wetSide = (this.chorusLeftWet - this.chorusRightWet) * 0.5 * CHORUS_STEREO_WIDTH;
    const wideLeftWet = wetMid + wetSide;
    const wideRightWet = wetMid - wetSide;

    return [
      sample * CHORUS_DRY_GAIN + wideLeftWet * CHORUS_WET_GAIN,
      sample * CHORUS_DRY_GAIN + wideRightWet * CHORUS_WET_GAIN
    ];
  }

  /** Allocates and initializes one delay line for a delay length in seconds. */
  private createDelayLine(seconds: number): DelayLine {
    return {
      buffer: new Float32Array(Math.ceil(this.params.sampleRate * seconds)),
      index: 0,
      filterState: 0
    };
  }

  /** Reads a delay time that falls between stored samples. */
  private readDelay(line: DelayLine, seconds: number) {
    const delaySamples = seconds * this.params.sampleRate;
    const readIndex = (line.index - delaySamples + line.buffer.length) % line.buffer.length;
    const indexA = Math.floor(readIndex);
    const indexB = (indexA + 1) % line.buffer.length;
    const fraction = readIndex - indexA;
    return lerp(line.buffer[indexA], line.buffer[indexB], fraction);
  }
}
