import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import HarpInstrument from "./components/HarpInstrument";
import { keyKnobNorm } from "./components/harpGeometry";
import { createScaleMask } from "./model/music";

describe("App UI", () => {
  it("preserves the mockup viewBox and exposes 24 bars and toggles", () => {
    render(
      <HarpInstrument
        enabledBars={createScaleMask("majorPentatonic")}
        scaleId="majorPentatonic"
        volume={0.5}
        octave={0}
        keyIndex={0}
        toneIndex={0}
        reverb={0.2}
        chorus={false}
        sustain={false}
        slide={false}
        activeBar={null}
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
        onSlideToggle={() => undefined}
      />
    );

    expect(screen.getByTestId("harp-svg").getAttribute("viewBox")).toBe("0 0 270 214");
    expect(screen.getAllByTestId(/strum-bar-/)).toHaveLength(24);
    expect(screen.getAllByTestId(/bar-toggle-/)).toHaveLength(24);
    expect(screen.getAllByTestId(/interval-dot-/)).toHaveLength(6);
    expect(screen.getByTestId("reverb-stops")).toBeTruthy();
    expect(screen.getByTestId("chorus-toggle")).toBeTruthy();
    expect(screen.getByTestId("sustain-toggle")).toBeTruthy();
    expect(screen.getByTestId("slide-toggle")).toBeTruthy();
  });

  it("cycles scales and marks manual toggles as custom", () => {
    render(<App />);
    expect(screen.getByTestId("scale-label").textContent).toBe("PENT MAJ");
    fireEvent.pointerDown(screen.getByTestId("scale-next"));
    expect(screen.getByTestId("scale-label").textContent).toBe("MAJ BLUES");
    fireEvent.pointerDown(screen.getByTestId("bar-toggle-0"));
    expect(screen.getByTestId("scale-label").textContent).toBe("CUSTOM");
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

  it("keeps the key indicator displaced to the matching label", () => {
    expect(keyKnobNorm(0)).toBeCloseTo(2 / 11);
    expect(keyKnobNorm(1)).toBeCloseTo(3 / 11);
  });
});
