import { useEffect, useMemo, useRef, useState } from "react";
import { HarpAudio } from "./audio/HarpAudio";
import HarpInstrument from "./components/HarpInstrument";
import {
  barCountForRange,
  createScaleMask,
  frequencyForBar,
  getNextScaleId,
  INSTRUMENT_RANGES,
  KEYS,
  labelForInstrumentRange,
  setPitchClassEnabled,
  TONES,
  type InstrumentRange,
  type ScaleId
} from "./model/music";

const STRUM_NOTE_ID = 1;

export default function App() {
  const audioRef = useRef<HarpAudio | null>(null);
  const pointerDownRef = useRef(false);
  const activeBarRef = useRef<number | null>(null);
  const [instrumentRange, setInstrumentRange] = useState<InstrumentRange>(2);
  const [enabledBars, setEnabledBars] = useState(() => createScaleMask("majorPentatonic"));
  const [scaleId, setScaleId] = useState<ScaleId>("majorPentatonic");
  const [volume, setVolume] = useState(0.72);
  const [octave, setOctave] = useState(0);
  const [keyIndex, setKeyIndex] = useState(0);
  const [toneIndex, setToneIndex] = useState(0);
  const [reverb, setReverb] = useState(0.18);
  const [chorus, setChorus] = useState(false);
  const [sustain, setSustain] = useState(false);
  const [slide, setSlide] = useState(false);
  const [splitOctaves, setSplitOctaves] = useState(false);
  const [activeBar, setActiveBar] = useState<number | null>(null);

  const key = KEYS[keyIndex];
  const tone = TONES[toneIndex];
  const barCount = barCountForRange(instrumentRange);

  const params = useMemo(
    () => ({
      volume,
      tone,
      reverb,
      chorus,
      slide
    }),
    [volume, tone, reverb, chorus, slide]
  );

  useEffect(() => {
    audioRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    if (activeBarRef.current !== null) {
      sendAudioEvent({
        type: "glide",
        noteId: STRUM_NOTE_ID,
        frequency: frequencyForBar(activeBarRef.current, key, octave)
      });
    }
  }, [key, octave]);

  function getAudio() {
    if (!audioRef.current) {
      audioRef.current = new HarpAudio();
      audioRef.current.setParams(params);
    }
    return audioRef.current;
  }

  function sendAudioEvent(event: Parameters<HarpAudio["sendEvent"]>[0]) {
    const audio = getAudio();
    void audio.start().then(() => audio.sendEvent(event));
  }

  function noteOn(barIndex: number) {
    sendAudioEvent({
      type: "noteOn",
      noteId: STRUM_NOTE_ID,
      frequency: frequencyForBar(barIndex, key, octave),
      velocity: 0.92
    });
  }

  function stopActiveNote() {
    if (activeBarRef.current !== null) {
      sendAudioEvent({ type: "noteOff", noteId: STRUM_NOTE_ID });
    }
    activeBarRef.current = null;
    setActiveBar(null);
  }

  function glideToBar(barIndex: number) {
    activeBarRef.current = barIndex;
    setActiveBar(barIndex);
    sendAudioEvent({
      type: "glide",
      noteId: STRUM_NOTE_ID,
      frequency: frequencyForBar(barIndex, key, octave)
    });
  }

  function beginBar(barIndex: number | null) {
    pointerDownRef.current = true;
    if (barIndex === null || !enabledBars[barIndex]) {
      if (!sustain) {
        stopActiveNote();
      }
      return;
    }

    if ((sustain || slide) && activeBarRef.current !== null) {
      glideToBar(barIndex);
      return;
    }

    activeBarRef.current = barIndex;
    setActiveBar(barIndex);
    noteOn(barIndex);
  }

  function moveBar(barIndex: number | null) {
    if (!pointerDownRef.current || barIndex === activeBarRef.current) {
      return;
    }

    if (barIndex === null || !enabledBars[barIndex]) {
      if (!sustain) {
        stopActiveNote();
      }
      return;
    }

    if ((sustain || slide) && activeBarRef.current !== null) {
      glideToBar(barIndex);
      return;
    }

    stopActiveNote();
    activeBarRef.current = barIndex;
    setActiveBar(barIndex);
    noteOn(barIndex);
  }

  function releasePointer() {
    pointerDownRef.current = false;
    if (!sustain) {
      stopActiveNote();
    }
  }

  function toggleBar(barIndex: number) {
    const targetEnabled = !enabledBars[barIndex];
    const shouldRelease =
      !targetEnabled &&
      activeBarRef.current !== null &&
      (splitOctaves ? activeBarRef.current === barIndex : activeBarRef.current % 12 === barIndex % 12);

    if (shouldRelease) {
      stopActiveNote();
    }

    setScaleId("custom");
    setEnabledBars((bars) => {
      if (!splitOctaves) {
        return setPitchClassEnabled(bars, barIndex, targetEnabled, barCount);
      }

      const next = [...bars];
      next[barIndex] = targetEnabled;
      return next;
    });
  }

  function stepScale(direction: 1 | -1) {
    const nextScaleId = getNextScaleId(scaleId, direction);
    setScaleId(nextScaleId);
    setEnabledBars(createScaleMask(nextScaleId, barCount));
    pointerDownRef.current = false;
    stopActiveNote();
  }

  function toggleSustain() {
    if (sustain && !pointerDownRef.current) {
      stopActiveNote();
    }
    setSustain((value) => !value);
  }

  function setInstrumentLayout(nextRange: InstrumentRange) {
    if (nextRange === instrumentRange) {
      return;
    }

    const nextBarCount = barCountForRange(nextRange);
    pointerDownRef.current = false;
    stopActiveNote();
    setInstrumentRange(nextRange);
    setEnabledBars((bars) => {
      if (scaleId !== "custom") {
        return createScaleMask(scaleId, nextBarCount);
      }

      return Array.from({ length: nextBarCount }, (_, index) => bars[index] ?? Boolean(bars[index % 12]));
    });
  }

  return (
    <main className="app-shell">
      <section className="instrument-stage" aria-label="Harp synth">
        <div className="instrument-scroll">
          <div className="instrument-scroll-inner">
            <HarpInstrument
              barCount={barCount}
              enabledBars={enabledBars}
              scaleId={scaleId}
              volume={volume}
              octave={octave}
              keyIndex={keyIndex}
              toneIndex={toneIndex}
              reverb={reverb}
              chorus={chorus}
              sustain={sustain}
              slide={slide}
              splitOctaves={splitOctaves}
              activeBar={activeBar}
              onBarPointerDown={beginBar}
              onBarPointerMove={moveBar}
              onPointerRelease={releasePointer}
              onToggleBar={toggleBar}
              onScaleStep={stepScale}
              onVolumeChange={setVolume}
              onOctaveChange={setOctave}
              onKeyChange={setKeyIndex}
              onToneChange={setToneIndex}
              onReverbChange={setReverb}
              onChorusToggle={() => setChorus((value) => !value)}
              onSustainToggle={toggleSustain}
              onSlideToggle={() => setSlide((value) => !value)}
              onSplitOctavesToggle={() => setSplitOctaves((value) => !value)}
            />
          </div>
        </div>
        <div className="octave-tabs" role="tablist" aria-label="Instrument octave range">
          {INSTRUMENT_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              role="tab"
              aria-selected={instrumentRange === range}
              className={instrumentRange === range ? "octave-tab octave-tab-active" : "octave-tab"}
              onClick={() => setInstrumentLayout(range)}
            >
              {labelForInstrumentRange(range)}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
