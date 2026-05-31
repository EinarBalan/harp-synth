import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import HarpInstrument from "./components/HarpInstrument";
import { keyIndexFromPoint, keyKnobAngleDegrees } from "./components/harpGeometry";
import { createScaleMask } from "./model/music";

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "requestMIDIAccess", {
    configurable: true,
    value: undefined
  });
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: undefined
  });
  Object.defineProperty(globalThis, "AudioWorkletNode", {
    configurable: true,
    value: undefined
  });
});

describe("App UI", () => {
  it("preserves the mockup viewBox and exposes 24 bars and toggles", () => {
    render(
      <HarpInstrument
        barCount={24}
        enabledBars={createScaleMask("majorPentatonic")}
        scaleId="majorPentatonic"
        keyName="C"
        volume={0.5}
        octave={0}
        keyIndex={0}
        toneIndex={0}
        reverb={0.2}
        chorus={false}
        sustain={false}
        mono={false}
        slide={false}
        splitOctaves={false}
        showNoteLabels={false}
        activeBars={new Set()}
        onBarPointerDown={() => undefined}
        onBarPointerMove={() => undefined}
        onPointerRelease={() => undefined}
        onToggleBar={() => undefined}
        onScaleStep={() => undefined}
        onVolumeChange={() => undefined}
        onOctaveChange={() => undefined}
        onKeyChange={() => undefined}
        onToneChange={() => undefined}
        onReverbChange={() => undefined}
        onChorusToggle={() => undefined}
        onSustainToggle={() => undefined}
        onMonoToggle={() => undefined}
        onSlideToggle={() => undefined}
        onSplitOctavesToggle={() => undefined}
      />
    );

    expect(screen.getByTestId("harp-svg").getAttribute("viewBox")).toBe("0 0 270 214");
    expect(screen.getAllByTestId(/strum-bar-/)).toHaveLength(24);
    expect(screen.getAllByTestId(/bar-toggle-/)).toHaveLength(24);
    expect(screen.getAllByTestId(/interval-dot-/)).toHaveLength(6);
    expect(screen.getByTestId("reverb-stops")).toBeTruthy();
    expect(screen.getByTestId("chorus-toggle")).toBeTruthy();
    expect(screen.getByTestId("sustain-toggle")).toBeTruthy();
    expect(screen.getByTestId("mono-toggle")).toBeTruthy();
    expect(screen.getByTestId("slide-toggle")).toBeTruthy();
    expect(screen.getByTestId("split-octaves-toggle")).toBeTruthy();
    expect(screen.getByText("SUS")).toBeTruthy();
    expect(screen.getByText("MONO")).toBeTruthy();
    expect(screen.getByText("UNIFY")).toBeTruthy();
  });

  it("can show multiple active bars at once", () => {
    render(
      <HarpInstrument
        barCount={24}
        enabledBars={createScaleMask("majorPentatonic")}
        scaleId="majorPentatonic"
        keyName="C"
        volume={0.5}
        octave={0}
        keyIndex={0}
        toneIndex={0}
        reverb={0.2}
        chorus={false}
        sustain={false}
        mono={false}
        slide={false}
        splitOctaves={false}
        showNoteLabels={false}
        activeBars={new Set([0, 2])}
        onBarPointerDown={() => undefined}
        onBarPointerMove={() => undefined}
        onPointerRelease={() => undefined}
        onToggleBar={() => undefined}
        onScaleStep={() => undefined}
        onVolumeChange={() => undefined}
        onOctaveChange={() => undefined}
        onKeyChange={() => undefined}
        onToneChange={() => undefined}
        onReverbChange={() => undefined}
        onChorusToggle={() => undefined}
        onSustainToggle={() => undefined}
        onMonoToggle={() => undefined}
        onSlideToggle={() => undefined}
        onSplitOctavesToggle={() => undefined}
      />
    );

    expect(screen.getByTestId("bar-visual-0").getAttribute("fill")).toBe("#BDE7FF");
    expect(screen.getByTestId("bar-visual-2").getAttribute("fill")).toBe("#BDE7FF");
  });

  it("marks manual toggles as custom", () => {
    render(<App />);
    expect(screen.getByTestId("scale-label").textContent).toBe("MAJ PENT");
    fireEvent.pointerDown(screen.getByTestId("bar-toggle-0"));
    expect(screen.getByTestId("scale-label").textContent).toBe("CUSTOM");
  });

  it("opens the how to play guide", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "How to play" }));

    expect(screen.getByRole("dialog", { name: "How To Play" })).toBeTruthy();
    expect(screen.getByText(/Red bars indicate the root/)).toBeTruthy();
    expect(screen.getByText("Shortcuts")).toBeTruthy();
    expect(screen.getByText("Space toggles SUS. Arrow Up and Arrow Down change OCT.")).toBeTruthy();
    expect(screen.getByText(/UNIFY links matching bars across octaves/)).toBeTruthy();
  });

  it("toggles sustain with the Space key", () => {
    render(<App />);
    const sustainIndicator = screen.getByTestId("sustain-toggle").parentElement?.querySelector("circle");
    expect(sustainIndicator?.getAttribute("data-state")).toBe("disabled");

    fireEvent.keyDown(window, { code: "Space", key: " " });

    expect(sustainIndicator?.getAttribute("data-state")).toBe("enabled");
  });

  it("does not toggle a focused bar with the Space key", () => {
    render(<App />);
    const sustainIndicator = screen.getByTestId("sustain-toggle").parentElement?.querySelector("circle");
    const barToggle = screen.getByTestId("bar-toggle-0");
    const barIndicator = barToggle.querySelector("circle");

    expect(barIndicator?.getAttribute("data-state")).toBe("enabled");
    fireEvent.keyDown(barToggle, { code: "Space", key: " " });

    expect(sustainIndicator?.getAttribute("data-state")).toBe("enabled");
    expect(barIndicator?.getAttribute("data-state")).toBe("enabled");
  });

  it("changes octave with Arrow Up and Arrow Down", () => {
    render(<App />);
    const octaveSlider = screen.getByRole("slider", { name: "Octave slider" });
    expect(octaveSlider.getAttribute("aria-valuenow")).toBe("0");

    fireEvent.keyDown(window, { code: "ArrowUp", key: "ArrowUp" });
    expect(octaveSlider.getAttribute("aria-valuenow")).toBe("1");

    fireEvent.keyDown(window, { code: "ArrowDown", key: "ArrowDown" });
    fireEvent.keyDown(window, { code: "ArrowDown", key: "ArrowDown" });
    expect(octaveSlider.getAttribute("aria-valuenow")).toBe("-1");
  });

  it("toggles note names on enabled bars", () => {
    render(<App />);
    expect(screen.queryByTestId("note-label-0")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Toggle note names" }));

    expect(screen.getByTestId("note-label-0").textContent).toBe("C");
    expect(screen.getByTestId("note-label-2").textContent).toBe("D");
    expect(screen.getByTestId("note-label-4").textContent).toBe("E");
    expect(screen.queryByTestId("note-label-1")).toBeNull();
  });

  it("toggles MIDI input from the utility buttons", async () => {
    const midiInput: { id: string; state: string; onmidimessage: ((event: { data: Uint8Array }) => void) | null } = {
      id: "keyboard-1",
      state: "connected",
      onmidimessage: null
    };
    const midiAccess = {
      inputs: new Map([[midiInput.id, midiInput]]),
      onstatechange: null
    };
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: vi.fn().mockResolvedValue(midiAccess)
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Enable MIDI input" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Disable MIDI input (1 input)" })).toBeTruthy());
    expect(midiInput.onmidimessage).toEqual(expect.any(Function));

    fireEvent.click(screen.getByRole("button", { name: "Disable MIDI input (1 input)" }));

    expect(midiInput.onmidimessage).toBeNull();
    expect(screen.getByRole("button", { name: "Enable MIDI input" })).toBeTruthy();
  });

  it("marks the MIDI toggle unavailable when Web MIDI is missing", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Enable MIDI input" }));

    expect(screen.getByRole("button", { name: "MIDI input unavailable" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("highlights enabled bars from MIDI note messages", async () => {
    class FakeAudioContext {
      audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
    }

    class FakeAudioWorkletNode {
      port = { postMessage: vi.fn() };
      connect = vi.fn();
    }

    const midiInput: { id: string; state: string; onmidimessage: ((event: { data: Uint8Array }) => void) | null } = {
      id: "keyboard-1",
      state: "connected",
      onmidimessage: null
    };
    const midiAccess = {
      inputs: new Map([[midiInput.id, midiInput]]),
      onstatechange: null
    };
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: FakeAudioContext
    });
    Object.defineProperty(globalThis, "AudioWorkletNode", {
      configurable: true,
      value: FakeAudioWorkletNode
    });
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: vi.fn().mockResolvedValue(midiAccess)
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Enable MIDI input" }));
    await waitFor(() => expect(midiInput.onmidimessage).toEqual(expect.any(Function)));

    act(() => {
      midiInput.onmidimessage?.({ data: new Uint8Array([0x90, 60, 100]) });
    });

    await waitFor(() => expect(screen.getByTestId("bar-visual-0").getAttribute("fill")).toBe("#BDE7FF"));

    act(() => {
      midiInput.onmidimessage?.({ data: new Uint8Array([0x80, 60, 0]) });
    });

    await waitFor(() => expect(screen.getByTestId("bar-visual-0").getAttribute("fill")).not.toBe("#BDE7FF"));
  });

  it("switches to a three-octave layout", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "3 OCT" }));

    expect(screen.getByTestId("harp-svg").getAttribute("viewBox")).toBe("0 0 402 214");
    expect(screen.getByTestId("control-panel").getAttribute("x")).toBe("3");
    expect(screen.getByTestId("control-panel").getAttribute("width")).toBe("396");
    expect(screen.getAllByTestId(/strum-bar-/)).toHaveLength(36);
    expect(screen.getAllByTestId(/bar-toggle-/)).toHaveLength(36);
    expect(screen.getAllByTestId(/interval-dot-/)).toHaveLength(9);
  });

  it("switches down to one octave and up to a full piano-sized layout", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "1 OCT" }));

    expect(screen.getByTestId("harp-svg").getAttribute("viewBox")).toBe("0 0 270 214");
    expect(screen.getByTestId("control-panel").getAttribute("width")).toBe("264");
    expect(screen.getAllByTestId(/strum-bar-/)).toHaveLength(12);
    expect(screen.getAllByTestId(/bar-toggle-/)).toHaveLength(12);
    expect(screen.getAllByTestId(/interval-dot-/)).toHaveLength(3);

    fireEvent.click(screen.getByRole("tab", { name: "PIANO" }));

    expect(screen.getByTestId("harp-svg").getAttribute("viewBox")).toBe("0 0 974 214");
    expect(screen.getByTestId("control-panel").getAttribute("width")).toBe("968");
    expect(screen.getAllByTestId(/strum-bar-/)).toHaveLength(88);
    expect(screen.getAllByTestId(/bar-toggle-/)).toHaveLength(88);
    expect(screen.getAllByTestId(/interval-dot-/)).toHaveLength(21);
  });

  it("turns enabled toggle glow off when disabled", () => {
    render(<App />);
    const toggle = screen.getByTestId("bar-toggle-0").querySelector("circle");
    expect(toggle?.getAttribute("data-state")).toBe("enabled");
    fireEvent.pointerDown(screen.getByTestId("bar-toggle-0"));
    const disabledToggle = screen.getByTestId("bar-toggle-0").querySelector("circle");
    expect(disabledToggle?.getAttribute("data-state")).toBe("disabled");
    expect(disabledToggle?.getAttribute("filter")).toBeNull();
    expect(screen.getByTestId("bar-toggle-12").querySelector("circle")?.getAttribute("data-state")).toBe("disabled");
    expect(screen.getByTestId("bar-visual-0").getAttribute("fill")).toBe("#9E6868");
    expect(screen.getByTestId("bar-visual-12").getAttribute("fill")).toBe("#9E6868");
  });

  it("can split octave toggle editing", () => {
    render(<App />);
    fireEvent.pointerDown(screen.getByTestId("split-octaves-toggle"));
    fireEvent.pointerDown(screen.getByTestId("bar-toggle-0"));

    expect(screen.getByTestId("bar-toggle-0").querySelector("circle")?.getAttribute("data-state")).toBe("disabled");
    expect(screen.getByTestId("bar-toggle-12").querySelector("circle")?.getAttribute("data-state")).toBe("enabled");
  });

  it("spaces key selections in equal twelfths from straight up", () => {
    const center = { x: 0, y: 0 };

    expect(keyKnobAngleDegrees(0)).toBe(0);
    expect(keyKnobAngleDegrees(1)).toBe(30);
    expect(keyKnobAngleDegrees(11)).toBe(330);
    expect(keyIndexFromPoint({ x: 0, y: -10 }, center)).toBe(0);
    expect(keyIndexFromPoint({ x: 10, y: 0 }, center)).toBe(3);
    expect(keyIndexFromPoint({ x: -10, y: 0 }, center)).toBe(9);
  });
});
