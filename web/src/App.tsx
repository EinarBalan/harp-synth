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
  const [helpOpen, setHelpOpen] = useState(false);
  const [showNoteLabels, setShowNoteLabels] = useState(false);

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

  useEffect(() => {
    if (!helpOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHelpOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen]);

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
      <div className="utility-buttons">
        <button type="button" className="utility-button" aria-label="How to play" onClick={() => setHelpOpen(true)}>
          <span aria-hidden="true">?</span>
        </button>
        <button
          type="button"
          className={showNoteLabels ? "utility-button utility-button-active" : "utility-button"}
          aria-label="Toggle note names"
          aria-pressed={showNoteLabels}
          onClick={() => setShowNoteLabels((value) => !value)}
        >
          <span aria-hidden="true">ABC</span>
        </button>
      </div>

      {helpOpen ? (
        <div className="help-backdrop" role="presentation" onPointerDown={() => setHelpOpen(false)}>
          <section
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="help-close" aria-label="Close how to play" onClick={() => setHelpOpen(false)}>
              <span aria-hidden="true">x</span>
            </button>
            <h1 id="help-title">How To Play</h1>

            <h2>Strum First</h2>
            <p>
              Hold the mouse down and sweep across the bars like a harp. Note that each bar is a half step higher than the one before it.
            </p>

            <h2>Scales And Toggles</h2>
            <p>
              The small buttons above the bars decide which pitches are allowed to sound. Lit buttons are enabled. Dark buttons are skipped,
              so a strum automatically lands on the closest active note.
            </p>
            <p>
              You can set a scale preset using the arrow buttons on the right side of the control panel. Scale presets are powerful because you don't need to know any music theory to get an interesting sound (although it certainly helps). Start with a preset, strum it, then turn bars on or off until you get something you like. 
            </p>

            <h2>Panel Controls</h2>
            <p>
              VOL controls loudness. OCT shifts the starting pitch up or down an octave. KEY moves the root around the circle of fifths. TONE the timbre or how the sound is produced. REVERB adds space. The scale selector and arrows move through preset interval sets.
            </p>
            <p>
              CHOR adds an amp-style chorus effect. SUSTAIN lets notes keep ringing after release. SLIDE glides between notes instead of
              jumping (e.g. legato). UNIFY links matching bars across octaves; turn it off when you want each octave edited independently.
            </p>

            <p className="help-highlight">
              <mark>The best way to get started is to mess around and see what sounds cool!</mark>
            </p>

            <h2>Reading The Bars</h2>
            <p>
              By default we're in the key of C. There are several visual indicators to help you navigate the notes. Red bars indicate the root of the scale, the note that gives the key its name. Blue bars indicate the perfect fourth interval. The black dots mark the major third, perfect fifth, and major seventh intervals, also known as the major chord tones.
            </p>
            <p>
              You do not need to memorize theory here: the colors and dots give you landmarks and you can figure out what sounds good by ear!
            </p>

          </section>
        </div>
      ) : null}

      <section className="instrument-stage" aria-label="Harp synth">
        <div className="instrument-scroll">
          <div className="instrument-scroll-inner">
            <HarpInstrument
              barCount={barCount}
              enabledBars={enabledBars}
              scaleId={scaleId}
              keyName={key}
              volume={volume}
              octave={octave}
              keyIndex={keyIndex}
              toneIndex={toneIndex}
              reverb={reverb}
              chorus={chorus}
              sustain={sustain}
              slide={slide}
              splitOctaves={splitOctaves}
              showNoteLabels={showNoteLabels}
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
