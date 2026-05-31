import { useEffect, useMemo, useRef, useState } from "react";
import { midiForBar, type KeyName } from "../model/music";

const MIDI_POINTER_ID_START = -100_000;

export type MidiStatus = "idle" | "requesting" | "enabled" | "unsupported" | "error";

interface MidiMessageEventLike {
  data: ArrayLike<number>;
}

interface MidiInputLike {
  id: string;
  name?: string | null;
  state?: string;
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
}

interface MidiAccessLike {
  inputs: {
    values(): IterableIterator<MidiInputLike>;
  };
  onstatechange: ((event: Event) => void) | null;
}

interface MidiNavigatorLike {
  requestMIDIAccess?: () => Promise<MidiAccessLike>;
}

interface ActiveMidiPointer {
  inputId: string;
  pointerId: number;
}

export interface UseMidiInputOptions {
  keyName: KeyName;
  octave: number;
  barCount: number;
  enabledBars: readonly boolean[];
  onNoteStart: (pointerId: number, barIndex: number, velocity: number) => void;
  onNoteStop: (pointerId: number, forceStop?: boolean) => void;
}

export function useMidiInput(options: UseMidiInputOptions) {
  const optionsRef = useRef(options);
  const midiAccessRef = useRef<MidiAccessLike | null>(null);
  const activeMidiPointersRef = useRef<Map<string, ActiveMidiPointer>>(new Map());
  const nextMidiPointerIdRef = useRef(MIDI_POINTER_ID_START);
  const midiMessageHandlerRef = useRef<(inputId: string, event: MidiMessageEventLike) => void>(() => undefined);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<MidiStatus>("idle");
  const [inputCount, setInputCount] = useState(0);

  optionsRef.current = options;

  useEffect(() => {
    return () => {
      unbindMidiInputs();
    };
  }, []);

  function midiNoteKey(inputId: string, channel: number, midiNote: number) {
    return `${inputId}:${channel}:${midiNote}`;
  }

  function midiNoteToBarIndex(midiNote: number) {
    const settings = optionsRef.current;
    const baseMidi = midiForBar(0, settings.keyName, settings.octave);
    const barIndex = midiNote - baseMidi;
    if (barIndex < 0 || barIndex >= settings.barCount || !settings.enabledBars[barIndex]) {
      return null;
    }

    return barIndex;
  }

  function noteVelocityFromMidi(velocityByte: number) {
    return Math.max(0.05, Math.min(1, velocityByte / 127));
  }

  function startMidiNote(inputId: string, channel: number, midiNote: number, velocityByte: number) {
    const keyName = midiNoteKey(inputId, channel, midiNote);
    const existing = activeMidiPointersRef.current.get(keyName);
    if (existing) {
      optionsRef.current.onNoteStop(existing.pointerId, true);
      activeMidiPointersRef.current.delete(keyName);
    }

    const barIndex = midiNoteToBarIndex(midiNote);
    if (barIndex === null) {
      return;
    }

    const pointerId = nextMidiPointerIdRef.current;
    nextMidiPointerIdRef.current -= 1;
    activeMidiPointersRef.current.set(keyName, { inputId, pointerId });
    optionsRef.current.onNoteStart(pointerId, barIndex, noteVelocityFromMidi(velocityByte));
  }

  function stopMidiNote(inputId: string, channel: number, midiNote: number, forceStop = false) {
    const keyName = midiNoteKey(inputId, channel, midiNote);
    const activeMidiPointer = activeMidiPointersRef.current.get(keyName);
    if (!activeMidiPointer) {
      return;
    }

    optionsRef.current.onNoteStop(activeMidiPointer.pointerId, forceStop);
    activeMidiPointersRef.current.delete(keyName);
  }

  function stopMidiNotesForInput(inputId: string, forceStop = true) {
    for (const [keyName, activeMidiPointer] of [...activeMidiPointersRef.current]) {
      if (activeMidiPointer.inputId === inputId) {
        optionsRef.current.onNoteStop(activeMidiPointer.pointerId, forceStop);
        activeMidiPointersRef.current.delete(keyName);
      }
    }
  }

  function stopActiveNotes(forceStop = true) {
    for (const activeMidiPointer of activeMidiPointersRef.current.values()) {
      optionsRef.current.onNoteStop(activeMidiPointer.pointerId, forceStop);
    }
    activeMidiPointersRef.current.clear();
  }

  function clearActiveNotes() {
    activeMidiPointersRef.current.clear();
  }

  function handleMidiMessage(inputId: string, event: MidiMessageEventLike) {
    const statusByte = event.data[0] ?? 0;
    const command = statusByte & 0xf0;
    const channel = statusByte & 0x0f;
    const midiNote = event.data[1] ?? 0;
    const velocityByte = event.data[2] ?? 0;

    if (command === 0x90 && velocityByte > 0) {
      startMidiNote(inputId, channel, midiNote, velocityByte);
      return;
    }

    if (command === 0x80 || (command === 0x90 && velocityByte === 0)) {
      stopMidiNote(inputId, channel, midiNote);
      return;
    }

    if (command === 0xb0 && (midiNote === 120 || midiNote === 121 || midiNote === 123)) {
      stopMidiNotesForInput(inputId);
    }
  }

  midiMessageHandlerRef.current = handleMidiMessage;

  function connectedMidiInputs(access: MidiAccessLike) {
    return Array.from(access.inputs.values()).filter((input) => input.state !== "disconnected");
  }

  function bindMidiInputs(access: MidiAccessLike) {
    const inputs = Array.from(access.inputs.values());
    const connectedInputs = connectedMidiInputs(access);
    const connectedInputIds = new Set(connectedInputs.map((input) => input.id));

    for (const input of inputs) {
      input.onmidimessage = connectedInputIds.has(input.id)
        ? (event) => midiMessageHandlerRef.current(input.id, event)
        : null;
    }

    for (const activeMidiPointer of [...activeMidiPointersRef.current.values()]) {
      if (!connectedInputIds.has(activeMidiPointer.inputId)) {
        stopMidiNotesForInput(activeMidiPointer.inputId);
      }
    }

    setInputCount(connectedInputs.length);
  }

  function unbindMidiInputs() {
    const access = midiAccessRef.current;
    if (!access) {
      return;
    }

    access.onstatechange = null;
    for (const input of access.inputs.values()) {
      input.onmidimessage = null;
    }
  }

  function disable() {
    unbindMidiInputs();
    stopActiveNotes();
    midiAccessRef.current = null;
    setEnabled(false);
    setStatus("idle");
    setInputCount(0);
  }

  async function enable() {
    const midiNavigator = typeof navigator === "undefined" ? null : (navigator as unknown as MidiNavigatorLike);
    if (!midiNavigator?.requestMIDIAccess) {
      setEnabled(false);
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");

    try {
      const access = await midiNavigator.requestMIDIAccess();
      midiAccessRef.current = access;
      bindMidiInputs(access);
      access.onstatechange = () => bindMidiInputs(access);
      setEnabled(true);
      setStatus("enabled");
    } catch {
      setEnabled(false);
      setStatus("error");
      setInputCount(0);
    }
  }

  function toggle() {
    if (status === "requesting") {
      return;
    }

    if (enabled) {
      disable();
      return;
    }

    void enable();
  }

  const buttonLabel = useMemo(() => {
    if (status === "requesting") {
      return "Requesting MIDI input";
    }

    if (enabled) {
      return `Disable MIDI input${inputCount === 1 ? " (1 input)" : ` (${inputCount} inputs)`}`;
    }

    if (status === "unsupported") {
      return "MIDI input unavailable";
    }

    if (status === "error") {
      return "MIDI input blocked";
    }

    return "Enable MIDI input";
  }, [enabled, inputCount, status]);

  return {
    enabled,
    status,
    inputCount,
    buttonLabel,
    toggle,
    stopActiveNotes,
    clearActiveNotes
  };
}
