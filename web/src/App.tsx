import { useEffect, useMemo, useRef, useState } from "react";
import { HarpAudio } from "./audio/HarpAudio";
import HarpInstrument from "./components/HarpInstrument";
import {
  DEFAULT_CHORUS,
  DEFAULT_REVERB,
  DEFAULT_SLIDE,
  DEFAULT_TONE_INDEX,
  DEFAULT_VOLUME,
  MAX_VOICES
} from "./dsp/config";
import {
  barCountForRange,
  createScaleMask,
  frequencyForBar,
  getNextScaleId,
  INSTRUMENT_RANGES,
  KEYS,
  labelForInstrumentRange,
  setPitchClassEnabled,
  type InstrumentRange,
  type ScaleId
} from "./model/music";

const MONO_STRUM_NOTE_ID = 1;
const POLY_NOTE_ID_OFFSET = 100;
const MAX_POLY_VOICES = MAX_VOICES;

function noteIdForBar(barIndex: number) {
  return POLY_NOTE_ID_OFFSET + barIndex;
}

export default function App() {
  const audioRef = useRef<HarpAudio | null>(null);
  const activePointerIdsRef = useRef<Set<number>>(new Set());
  const activePointerBarsRef = useRef<Map<number, number>>(new Map());
  const monoActiveBarRef = useRef<number | null>(null);
  const activePolyBarsRef = useRef<Set<number>>(new Set());
  const [instrumentRange, setInstrumentRange] = useState<InstrumentRange>(2);
  const [enabledBars, setEnabledBars] = useState(() => createScaleMask("majorPentatonic"));
  const [scaleId, setScaleId] = useState<ScaleId>("majorPentatonic");
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [octave, setOctave] = useState(0);
  const [keyIndex, setKeyIndex] = useState(0);
  const [toneIndex, setToneIndex] = useState(DEFAULT_TONE_INDEX);
  const [reverb, setReverb] = useState(DEFAULT_REVERB);
  const [chorus, setChorus] = useState(DEFAULT_CHORUS);
  const [sustain, setSustain] = useState(false);
  const [mono, setMono] = useState(false);
  const [slide, setSlide] = useState(DEFAULT_SLIDE);
  const [splitOctaves, setSplitOctaves] = useState(false);
  const [activeBars, setActiveBars] = useState<ReadonlySet<number>>(() => new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const [showNoteLabels, setShowNoteLabels] = useState(false);

  const key = KEYS[keyIndex];
  const barCount = barCountForRange(instrumentRange);

  const params = useMemo(
    () => ({
      volume,
      toneIndex,
      reverb,
      chorus,
      slide
    }),
    [volume, toneIndex, reverb, chorus, slide]
  );

  useEffect(() => {
    audioRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    if (monoActiveBarRef.current !== null) {
      sendAudioEvent({
        type: "glide",
        noteId: MONO_STRUM_NOTE_ID,
        frequency: frequencyForBar(monoActiveBarRef.current, key, octave)
      });
    }

    for (const barIndex of activePolyBarsRef.current) {
      sendAudioEvent({
        type: "glide",
        noteId: noteIdForBar(barIndex),
        frequency: frequencyForBar(barIndex, key, octave)
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

  useEffect(() => {
    const handleKeyboardShortcuts = (event: KeyboardEvent) => {
      const isSpace = event.code === "Space" || event.key === " " || event.key === "Spacebar";
      const isOctaveUp = event.key === "ArrowUp";
      const isOctaveDown = event.key === "ArrowDown";
      const isTextEditingTarget =
        event.target instanceof Element &&
        Boolean(event.target.closest("input, textarea, select, [contenteditable='true']"));

      if ((!isSpace && !isOctaveUp && !isOctaveDown) || isTextEditingTarget || (isSpace && event.repeat)) {
        return;
      }

      event.preventDefault();

      if (isSpace) {
        toggleSustain();
      } else if (isOctaveUp) {
        setOctave((value) => Math.min(2, value + 1));
      } else {
        setOctave((value) => Math.max(-2, value - 1));
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcuts, true);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts, true);
  }, [mono, slide, sustain]);

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

  function syncActiveBars() {
    const nextActiveBars = new Set(activePolyBarsRef.current);
    if (monoActiveBarRef.current !== null) {
      nextActiveBars.add(monoActiveBarRef.current);
    }
    setActiveBars(nextActiveBars);
  }

  function isBarHeldByPointer(barIndex: number, ignoredPointerId?: number) {
    for (const [pointerId, heldBarIndex] of activePointerBarsRef.current) {
      if (pointerId !== ignoredPointerId && heldBarIndex === barIndex) {
        return true;
      }
    }

    return false;
  }

  function sendNoteOn(noteId: number, barIndex: number) {
    sendAudioEvent({
      type: "noteOn",
      noteId,
      frequency: frequencyForBar(barIndex, key, octave),
      velocity: 0.92
    });
  }

  function sendNoteOff(noteId: number) {
    sendAudioEvent({ type: "noteOff", noteId });
  }

  function sendNoteGlide(noteId: number, barIndex: number) {
    sendAudioEvent({
      type: "glide",
      noteId,
      frequency: frequencyForBar(barIndex, key, octave)
    });
  }

  function startMonoNote(barIndex: number) {
    monoActiveBarRef.current = barIndex;
    sendNoteOn(MONO_STRUM_NOTE_ID, barIndex);
    syncActiveBars();
  }

  function retriggerMonoNote(barIndex: number) {
    monoActiveBarRef.current = barIndex;
    sendNoteOn(MONO_STRUM_NOTE_ID, barIndex);
    syncActiveBars();
  }

  function stopMonoNote(sync = true) {
    if (monoActiveBarRef.current !== null) {
      sendNoteOff(MONO_STRUM_NOTE_ID);
      monoActiveBarRef.current = null;
      if (sync) {
        syncActiveBars();
      }
    }
  }

  function glideMonoToBar(barIndex: number) {
    monoActiveBarRef.current = barIndex;
    sendNoteGlide(MONO_STRUM_NOTE_ID, barIndex);
    syncActiveBars();
  }

  function stopPolyBar(barIndex: number, sync = true) {
    if (activePolyBarsRef.current.delete(barIndex)) {
      sendNoteOff(noteIdForBar(barIndex));
      if (sync) {
        syncActiveBars();
      }
    }
  }

  function stopOldestPolyBar() {
    const oldestBar = activePolyBarsRef.current.values().next().value;
    if (oldestBar !== undefined) {
      for (const [pointerId, barIndex] of activePointerBarsRef.current) {
        if (barIndex === oldestBar) {
          activePointerBarsRef.current.delete(pointerId);
        }
      }
      stopPolyBar(oldestBar, false);
    }
  }

  function startPolyNote(barIndex: number, sync = true) {
    if (activePolyBarsRef.current.has(barIndex)) {
      return;
    }

    if (activePolyBarsRef.current.size >= MAX_POLY_VOICES) {
      stopOldestPolyBar();
    }

    activePolyBarsRef.current.add(barIndex);
    sendNoteOn(noteIdForBar(barIndex), barIndex);
    if (sync) {
      syncActiveBars();
    }
  }

  function stopAllPolyNotes(sync = true) {
    for (const barIndex of activePolyBarsRef.current) {
      sendNoteOff(noteIdForBar(barIndex));
    }
    activePolyBarsRef.current.clear();
    if (sync) {
      syncActiveBars();
    }
  }

  function stopAllNotes() {
    activePointerIdsRef.current.clear();
    activePointerBarsRef.current.clear();
    stopMonoNote(false);
    stopAllPolyNotes(false);
    syncActiveBars();
  }

  function stopMatchingNotes(matches: (barIndex: number) => boolean) {
    let changed = false;

    if (monoActiveBarRef.current !== null && matches(monoActiveBarRef.current)) {
      sendNoteOff(MONO_STRUM_NOTE_ID);
      monoActiveBarRef.current = null;
      changed = true;
    }

    for (const barIndex of [...activePolyBarsRef.current]) {
      if (matches(barIndex)) {
        activePolyBarsRef.current.delete(barIndex);
        sendNoteOff(noteIdForBar(barIndex));
        changed = true;
      }
    }

    if (changed) {
      syncActiveBars();
    }
  }

  function stopUnheldPolyNotes() {
    let changed = false;

    for (const barIndex of [...activePolyBarsRef.current]) {
      if (!isBarHeldByPointer(barIndex)) {
        activePolyBarsRef.current.delete(barIndex);
        sendNoteOff(noteIdForBar(barIndex));
        changed = true;
      }
    }

    if (changed) {
      syncActiveBars();
    }
  }

  function playMonoBar(pointerId: number, barIndex: number) {
    activePointerBarsRef.current.set(pointerId, barIndex);
    if (monoActiveBarRef.current === barIndex) {
      return;
    }

    retriggerMonoNote(barIndex);
  }

  function playSlideBar(pointerId: number, barIndex: number) {
    activePointerBarsRef.current.set(pointerId, barIndex);

    if (monoActiveBarRef.current === null) {
      startMonoNote(barIndex);
      return;
    }

    if (monoActiveBarRef.current !== barIndex) {
      glideMonoToBar(barIndex);
    }
  }

  function playPolyBar(pointerId: number, barIndex: number) {
    const previousBarIndex = activePointerBarsRef.current.get(pointerId);
    if (previousBarIndex === barIndex) {
      return;
    }

    if (!sustain && previousBarIndex !== undefined && !isBarHeldByPointer(previousBarIndex, pointerId)) {
      stopPolyBar(previousBarIndex, false);
    }

    activePointerBarsRef.current.set(pointerId, barIndex);
    startPolyNote(barIndex, false);
    syncActiveBars();
  }

  function playBar(pointerId: number, barIndex: number) {
    if (slide) {
      playSlideBar(pointerId, barIndex);
      return;
    }

    if (mono) {
      playMonoBar(pointerId, barIndex);
      return;
    }

    playPolyBar(pointerId, barIndex);
  }

  function clearPointerBar(pointerId: number) {
    const previousBarIndex = activePointerBarsRef.current.get(pointerId);
    activePointerBarsRef.current.delete(pointerId);

    if (sustain || previousBarIndex === undefined) {
      return;
    }

    if (slide || mono) {
      if (activePointerBarsRef.current.size === 0) {
        stopMonoNote();
        return;
      }

      if (previousBarIndex === monoActiveBarRef.current) {
        const remainingBarIndexes = [...activePointerBarsRef.current.values()];
        const nextBarIndex = remainingBarIndexes[remainingBarIndexes.length - 1];
        if (nextBarIndex !== undefined) {
          if (slide) {
            glideMonoToBar(nextBarIndex);
          } else {
            retriggerMonoNote(nextBarIndex);
          }
        }
      }
      return;
    }

    if (!isBarHeldByPointer(previousBarIndex)) {
      stopPolyBar(previousBarIndex);
    }
  }

  function beginBar(pointerId: number, barIndex: number | null) {
    activePointerIdsRef.current.add(pointerId);
    if (barIndex === null || !enabledBars[barIndex]) {
      if (!sustain) {
        clearPointerBar(pointerId);
      }
      return;
    }

    playBar(pointerId, barIndex);
  }

  function moveBar(pointerId: number, barIndex: number | null) {
    if (!activePointerIdsRef.current.has(pointerId)) {
      return;
    }

    if (barIndex === null || !enabledBars[barIndex]) {
      if (!sustain) {
        clearPointerBar(pointerId);
      } else {
        activePointerBarsRef.current.delete(pointerId);
      }
      return;
    }

    playBar(pointerId, barIndex);
  }

  function releasePointer(pointerId: number) {
    clearPointerBar(pointerId);
    activePointerIdsRef.current.delete(pointerId);
  }

  function toggleBar(barIndex: number) {
    const targetEnabled = !enabledBars[barIndex];
    if (!targetEnabled) {
      stopMatchingNotes((activeBarIndex) => (splitOctaves ? activeBarIndex === barIndex : activeBarIndex % 12 === barIndex % 12));
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
    stopAllNotes();
  }

  function toggleSustain() {
    if (sustain) {
      if (activePointerIdsRef.current.size === 0) {
        stopAllNotes();
      } else if (slide || mono) {
        if (monoActiveBarRef.current !== null && !isBarHeldByPointer(monoActiveBarRef.current)) {
          stopMonoNote();
        }
      } else {
        stopUnheldPolyNotes();
      }
    }
    setSustain((value) => !value);
  }

  function toggleMono() {
    stopAllNotes();
    setMono((value) => !value);
  }

  function toggleSlide() {
    stopAllNotes();
    setSlide((value) => !value);
  }

  function setInstrumentLayout(nextRange: InstrumentRange) {
    if (nextRange === instrumentRange) {
      return;
    }

    const nextBarCount = barCountForRange(nextRange);
    stopAllNotes();
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
              CHOR adds an amp-style chorus effect. SUS lets notes keep ringing after release. MONO keeps only one voice active. SLIDE
              glides between notes instead of jumping (e.g. legato). UNIFY links matching bars across octaves; turn it off when you want
              each octave edited independently.
            </p>

            <h2>Shortcuts</h2>
            <p>Space toggles SUS. Arrow Up and Arrow Down change OCT.</p>

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
              mono={mono}
              slide={slide}
              splitOctaves={splitOctaves}
              showNoteLabels={showNoteLabels}
              activeBars={activeBars}
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
              onMonoToggle={toggleMono}
              onSlideToggle={toggleSlide}
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
