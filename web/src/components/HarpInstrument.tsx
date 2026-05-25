import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import mockupUrl from "../../Harp Synth.svg";
import { getScaleDefinition, noteNameForBar, TONES, type KeyName, type ScaleId } from "../model/music";
import { keyIndexFromPoint, keyKnobAngleDegrees } from "./harpGeometry";

const SVG_WIDTH = 270;
const SVG_HEIGHT = 214;
const BAR_TOP = 64.5;
const BAR_WIDTH = 11;
const BUTTON_Y = 59;
const KNOB_MIN_ANGLE = -135;
const KNOB_SWEEP = 270;
const DISPLAY_SCALE = 1120 / SVG_WIDTH;
const MODE_BUTTON_CENTER_X = 227;
const MODE_BUTTON_SPACING = 9.5;

export interface HarpInstrumentProps {
  barCount: number;
  enabledBars: boolean[];
  scaleId: ScaleId;
  keyName: KeyName;
  volume: number;
  octave: number;
  keyIndex: number;
  toneIndex: number;
  reverb: number;
  chorus: boolean;
  sustain: boolean;
  mono: boolean;
  slide: boolean;
  splitOctaves: boolean;
  showNoteLabels: boolean;
  activeBars: ReadonlySet<number>;
  onBarPointerDown: (pointerId: number, barIndex: number | null) => void;
  onBarPointerMove: (pointerId: number, barIndex: number | null) => void;
  onPointerRelease: (pointerId: number) => void;
  onToggleBar: (barIndex: number) => void;
  onScaleStep: (direction: 1 | -1) => void;
  onVolumeChange: (volume: number) => void;
  onOctaveChange: (octave: number) => void;
  onKeyChange: (keyIndex: number) => void;
  onToneChange: (toneIndex: number) => void;
  onReverbChange: (reverb: number) => void;
  onChorusToggle: () => void;
  onSustainToggle: () => void;
  onMonoToggle: () => void;
  onSlideToggle: () => void;
  onSplitOctavesToggle: () => void;
}

interface SvgPoint {
  x: number;
  y: number;
}

type KnobId = "key" | "tone" | "reverb";

export default function HarpInstrument(props: HarpInstrumentProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const barCount = props.barCount;
  const svgWidth = getSvgWidth(barCount);
  const barStartX = getBarStartX(svgWidth, barCount);
  const barCenters = getBarCenters(barCount, barStartX);
  const controlOffset = (svgWidth - SVG_WIDTH) / 2;
  const rightEdge = barStartX + barCount * BAR_WIDTH;
  const controlPanelX = Math.min(barStartX, controlOffset + 3);
  const controlPanelRight = Math.max(rightEdge, controlOffset + SVG_WIDTH - 3);
  const controlPanelWidth = controlPanelRight - controlPanelX;
  const knobCenters: Record<KnobId, SvgPoint> = {
    key: { x: controlOffset + 109.5, y: 28 },
    tone: { x: controlOffset + 144.5, y: 28 },
    reverb: { x: controlOffset + 179.5, y: 28 }
  };
  const intervalDotIndices = getIntervalDotIndices(barCount);
  const svgStyle = {
    "--instrument-aspect-ratio": String(svgWidth / SVG_HEIGHT),
    "--instrument-display-height": `${SVG_HEIGHT * DISPLAY_SCALE}px`,
    "--instrument-display-width": `${svgWidth * DISPLAY_SCALE}px`
  } as CSSProperties;

  function shiftX(x: number) {
    return x + controlOffset;
  }

  function clientToSvg(event: Pick<PointerEvent | ReactPointerEvent<SVGElement>, "clientX" | "clientY">): SvgPoint | null {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) {
      return null;
    }

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function barIndexFromPoint(point: SvgPoint | null, allowVerticalDrift = false) {
    if (!point || (!allowVerticalDrift && (point.y < BAR_TOP || point.y > SVG_HEIGHT))) {
      return null;
    }

    const clampedX = clamp(point.x, barStartX, rightEdge - Number.EPSILON);
    const directBar = Math.max(0, Math.min(barCount - 1, Math.floor((clampedX - barStartX) / BAR_WIDTH)));
    if (point.x >= barStartX && point.x <= rightEdge && props.enabledBars[directBar]) {
      return directBar;
    }

    return closestEnabledBar(point.x, props.enabledBars, barCenters);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const barIndex = barIndexFromPoint(clientToSvg(event));
    if (barIndex === null) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    props.onBarPointerDown(event.pointerId, barIndex);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.buttons !== 1) {
      return;
    }

    props.onBarPointerMove(event.pointerId, barIndexFromPoint(clientToSvg(event), true));
  }

  function handleSlider(event: ReactPointerEvent<SVGElement>, slider: "volume" | "octave") {
    event.stopPropagation();
    const target = event.currentTarget;

    const update = (nextEvent: PointerEvent | ReactPointerEvent<SVGElement>) => {
      const point = clientToSvg(nextEvent);
      if (!point) {
        return;
      }

      const norm = clamp((42 - point.y) / 30, 0, 1);
      if (slider === "volume") {
        props.onVolumeChange(norm);
      } else {
        props.onOctaveChange(Math.round(norm * 4 - 2));
      }
    };

    update(event);
    target.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => update(moveEvent);
    const done = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", done);
      target.removeEventListener("pointercancel", done);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", done);
    target.addEventListener("pointercancel", done);
  }

  function handleKnob(event: ReactPointerEvent<SVGElement>, knob: KnobId) {
    event.stopPropagation();
    const target = event.currentTarget;

    const update = (nextEvent: PointerEvent | ReactPointerEvent<SVGElement>) => {
      const point = clientToSvg(nextEvent);
      if (!point) {
        return;
      }

      if (knob === "key") {
        props.onKeyChange(keyIndexFromPoint(point, knobCenters.key));
        return;
      }

      const center = knobCenters[knob];
      const angle = (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
      const norm = clamp((angle - KNOB_MIN_ANGLE) / KNOB_SWEEP, 0, 1);

      if (knob === "tone") {
        props.onToneChange(Math.round(norm * (TONES.length - 1)));
      } else {
        props.onReverbChange(norm);
      }
    };

    update(event);
    target.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => update(moveEvent);
    const done = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", done);
      target.removeEventListener("pointercancel", done);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", done);
    target.addEventListener("pointercancel", done);
  }

  const volumeY = sliderY(props.volume);
  const octaveY = sliderY((props.octave + 2) / 4);
  const scaleLabel = getScaleDefinition(props.scaleId).label;

  return (
    <svg
      ref={svgRef}
      className="instrument-svg"
      viewBox={`0 0 ${svgWidth} ${SVG_HEIGHT}`}
      style={svgStyle}
      role="img"
      aria-label="Harp synth prototype"
      data-testid="harp-svg"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => props.onPointerRelease(event.pointerId)}
      onPointerCancel={(event) => props.onPointerRelease(event.pointerId)}
      onLostPointerCapture={(event) => props.onPointerRelease(event.pointerId)}
    >
      <defs>
        <filter id="enabledToggleGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.38 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="mockupControlsClip">
          <rect x={shiftX(9.5)} y="10" width="250" height="34" rx="3" />
        </clipPath>
      </defs>

      <rect
        x={controlPanelX}
        y="0.5"
        width={controlPanelWidth}
        height="64"
        fill="#1D1D1D"
        stroke="black"
        data-testid="control-panel"
      />
      <image href={mockupUrl} x={controlOffset} width={SVG_WIDTH} height={SVG_HEIGHT} clipPath="url(#mockupControlsClip)" />
      <rect x={controlPanelX} y={BAR_TOP} width={controlPanelWidth} height={SVG_HEIGHT - BAR_TOP} fill="#1D1D1D" pointerEvents="none" />

      <g aria-hidden="true">
        {barCenters.map((center, index) => (
          <rect
            key={center}
            x={center - 5.5}
            y={BAR_TOP}
            width={11}
            height={149}
            fill={barFill(index, props.activeBars.has(index), props.enabledBars[index])}
            stroke="black"
            strokeWidth={1}
            data-testid={`bar-visual-${index}`}
          />
        ))}
      </g>

      <rect x={controlPanelX} y="50.2" width={controlPanelWidth} height="17.6" fill="black" stroke="black" strokeWidth="0.4" />

      <g>
        {barCenters.map((center, index) => {
          const enabled = props.enabledBars[index];
          return (
            <g
              key={center}
              data-testid={`bar-toggle-${index}`}
              role="button"
              aria-label={`Toggle bar ${index + 1}`}
              tabIndex={0}
              onPointerDown={(event) => {
                event.stopPropagation();
                props.onToggleBar(index);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  props.onToggleBar(index);
                }
              }}
            >
              <circle
                cx={center}
                cy={BUTTON_Y}
                r={enabled ? 3.6 : 3.25}
                fill={enabled ? "white" : "#242424"}
                stroke={enabled ? "black" : "#080808"}
                strokeWidth={enabled ? 0.5 : 0.8}
                filter={enabled ? "url(#enabledToggleGlow)" : undefined}
                data-state={enabled ? "enabled" : "disabled"}
              />
              <circle cx={center} cy={BUTTON_Y} r={7} fill="transparent" />
            </g>
          );
        })}
      </g>

      <g aria-label="Volume slider" role="slider" aria-valuemin={0} aria-valuemax={1} aria-valuenow={props.volume}>
        <rect x={shiftX(44)} y="8" width="10" height="38" fill="transparent" onPointerDown={(event) => handleSlider(event, "volume")} />
        <rect x={shiftX(47.5)} y="12" width="3" height="30" fill="#2E2E2E" pointerEvents="none" />
        <rect x={shiftX(45)} y={volumeY - 1} width="8" height="2" fill="#D9D9D9" stroke="black" strokeWidth="0.7" pointerEvents="none" />
      </g>

      <g aria-label="Octave slider" role="slider" aria-valuemin={-2} aria-valuemax={2} aria-valuenow={props.octave}>
        <rect x={shiftX(65)} y="8" width="10" height="38" fill="transparent" onPointerDown={(event) => handleSlider(event, "octave")} />
        <rect x={shiftX(68.5)} y="12" width="3" height="30" fill="#2E2E2E" pointerEvents="none" />
        <rect x={shiftX(66)} y={octaveY - 1} width="8" height="2" fill="#D9D9D9" stroke="black" strokeWidth="0.7" pointerEvents="none" />
      </g>

      <Knob
        id="key"
        center={knobCenters.key}
        norm={0}
        indicatorDegreesFromUp={keyKnobAngleDegrees(props.keyIndex)}
        testId="key-knob"
        onPointerDown={(event) => handleKnob(event, "key")}
      />
      <Knob
        id="tone"
        center={knobCenters.tone}
        norm={props.toneIndex / (TONES.length - 1)}
        testId="tone-knob"
        onPointerDown={(event) => handleKnob(event, "tone")}
      />
      <Knob
        id="reverb"
        center={knobCenters.reverb}
        norm={props.reverb}
        testId="reverb-knob"
        showStops
        onPointerDown={(event) => handleKnob(event, "reverb")}
      />

      <g aria-label="Scale selector">
        <rect x={shiftX(205.5)} y="20" width="37" height="6" rx="1" fill="#444444" />
        <text
          x={shiftX(224)}
          y="24.35"
          fill="white"
          fontFamily="Arial, sans-serif"
          fontSize={scaleLabel.length > 7 ? 3.6 : 4.1}
          textAnchor="middle"
          pointerEvents="none"
          data-testid="scale-label"
        >
          {scaleLabel}
        </text>
        <path d={`M${shiftX(246)} 20L${shiftX(248.165)} 22.25H${shiftX(243.835)}L${shiftX(246)} 20Z`} fill="#393939" pointerEvents="none" />
        <path d={`M${shiftX(246)} 25L${shiftX(243.835)} 22.75H${shiftX(248.165)}L${shiftX(246)} 25Z`} fill="#393939" pointerEvents="none" />
        <rect
          x={shiftX(241)}
          y="17.5"
          width="10"
          height="6"
          fill="transparent"
          role="button"
          aria-label="Previous scale"
          data-testid="scale-prev"
          onPointerDown={(event) => {
            event.stopPropagation();
            props.onScaleStep(-1);
          }}
        />
        <rect
          x={shiftX(241)}
          y="22.5"
          width="10"
          height="6"
          fill="transparent"
          role="button"
          aria-label="Next scale"
          data-testid="scale-next"
          onPointerDown={(event) => {
            event.stopPropagation();
            props.onScaleStep(1);
          }}
        />
      </g>

      <g>
        <rect x={shiftX(202)} y="28" width="55" height="10.4" fill="#D9D9D9" />
        <ModeButton
          x={shiftX(MODE_BUTTON_CENTER_X - MODE_BUTTON_SPACING * 2)}
          y={31}
          label="CHOR"
          active={props.chorus}
          testId="chorus-toggle"
          ariaLabel="Toggle chorus"
          onToggle={props.onChorusToggle}
        />
        <ModeButton
          x={shiftX(MODE_BUTTON_CENTER_X - MODE_BUTTON_SPACING)}
          y={31}
          label="SUS"
          active={props.sustain}
          testId="sustain-toggle"
          ariaLabel="Toggle sustain"
          onToggle={props.onSustainToggle}
          compact
        />
        <ModeButton
          x={shiftX(MODE_BUTTON_CENTER_X)}
          y={31}
          label="MONO"
          active={props.mono}
          testId="mono-toggle"
          ariaLabel="Toggle mono voice mode"
          onToggle={props.onMonoToggle}
          compact
        />
        <ModeButton
          x={shiftX(MODE_BUTTON_CENTER_X + MODE_BUTTON_SPACING)}
          y={31}
          label="SLIDE"
          active={props.slide}
          testId="slide-toggle"
          ariaLabel="Toggle slide"
          onToggle={props.onSlideToggle}
        />
        <ModeButton
          x={shiftX(MODE_BUTTON_CENTER_X + MODE_BUTTON_SPACING * 2)}
          y={31}
          label="UNIFY"
          active={!props.splitOctaves}
          testId="split-octaves-toggle"
          ariaLabel="Toggle unified octave bar editing"
          onToggle={props.onSplitOctavesToggle}
        />
      </g>

      <g aria-label="Interval indicators">
        {intervalDotIndices.map((index) => (
          <circle
            key={index}
            cx={barCenters[index]}
            cy="185"
            r="3.5"
            fill="black"
            data-testid={`interval-dot-${index}`}
            pointerEvents="none"
          />
        ))}
      </g>

      {props.showNoteLabels ? (
        <g aria-label="Note names" pointerEvents="none">
          {barCenters.map((center, index) =>
            props.enabledBars[index] ? (
              <text
                key={center}
                x={center}
                y="202"
                fill={noteLabelFill(index)}
                fontFamily="Arial, sans-serif"
                fontSize={noteNameForBar(index, props.keyName).length > 1 ? 4.6 : 5.1}
                fontWeight="700"
                textAnchor="middle"
                data-testid={`note-label-${index}`}
              >
                {noteNameForBar(index, props.keyName)}
              </text>
            ) : null
          )}
        </g>
      ) : null}

      <g aria-label="Bar hit areas">
        {barCenters.map((center, index) => (
          <rect
            key={center}
            x={center - 5.5}
            y={BAR_TOP}
            width="11"
            height="149"
            fill="transparent"
            data-testid={`strum-bar-${index}`}
          />
        ))}
      </g>
    </svg>
  );
}

function Knob({
  center,
  norm,
  testId,
  indicatorDegreesFromUp,
  showStops = false,
  onPointerDown
}: {
  id: KnobId;
  center: SvgPoint;
  norm: number;
  testId: string;
  indicatorDegreesFromUp?: number;
  showStops?: boolean;
  onPointerDown: (event: ReactPointerEvent<SVGElement>) => void;
}) {
  const indicatorEnd = indicatorDegreesFromUp === undefined ? knobSweepEnd(center, norm, 7) : clockwiseFromUpEnd(center, indicatorDegreesFromUp, 7);

  return (
    <g data-testid={testId}>
      {showStops ? <KnobStops center={center} /> : null}
      <circle cx={center.x} cy={center.y} r="11" fill="#2E2E2E" />
      <circle cx={center.x} cy={center.y} r="9" fill="#B7B7B7" />
      <line
        x1={center.x}
        y1={center.y}
        x2={indicatorEnd.x}
        y2={indicatorEnd.y}
        stroke="#555555"
        strokeWidth="2"
        strokeLinecap="round"
        data-testid={`${testId}-indicator`}
      />
      <circle cx={center.x} cy={center.y} r="12" fill="transparent" onPointerDown={onPointerDown} />
    </g>
  );
}

function ModeButton({
  x,
  y,
  label,
  active,
  testId,
  ariaLabel,
  compact = false,
  onToggle
}: {
  x: number;
  y: number;
  label: string;
  active: boolean;
  testId: string;
  ariaLabel: string;
  compact?: boolean;
  onToggle: () => void;
}) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={active ? 2.15 : 1.65}
        fill={active ? "#efefef" : "#444444"}
        stroke={active ? "#111" : "none"}
        data-state={active ? "enabled" : "disabled"}
      />
      <text
        x={x}
        y="36.55"
        fill="black"
        fontFamily="Arial, sans-serif"
        fontSize={compact ? 2.05 : 2.25}
        fontWeight="600"
        textAnchor="middle"
        pointerEvents="none"
      >
        {label}
      </text>
      <circle
        cx={x}
        cy={y}
        r="4.8"
        fill="transparent"
        role="button"
        aria-label={ariaLabel}
        data-testid={testId}
        onPointerDown={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      />
    </g>
  );
}

function KnobStops({ center }: { center: SvgPoint }) {
  const minTick = tickPoints(center, 0);
  const maxTick = tickPoints(center, 1);

  return (
    <g data-testid="reverb-stops" pointerEvents="none">
      <line {...minTick} stroke="#555555" strokeWidth="0.8" strokeLinecap="round" />
      <line {...maxTick} stroke="#555555" strokeWidth="0.8" strokeLinecap="round" />
      <text x={center.x - 14.5} y={center.y - 8.5} fill="#555555" fontFamily="Arial, sans-serif" fontSize="3.2">
        0
      </text>
      <text x={center.x - 18.3} y={center.y + 11.3} fill="#555555" fontFamily="Arial, sans-serif" fontSize="3.2">
        MAX
      </text>
    </g>
  );
}

function tickPoints(center: SvgPoint, norm: number) {
  const angle = ((KNOB_MIN_ANGLE + norm * KNOB_SWEEP) * Math.PI) / 180;
  return {
    x1: center.x + Math.cos(angle) * 12,
    y1: center.y + Math.sin(angle) * 12,
    x2: center.x + Math.cos(angle) * 15,
    y2: center.y + Math.sin(angle) * 15
  };
}

function knobSweepEnd(center: SvgPoint, norm: number, radius: number) {
  const angle = ((KNOB_MIN_ANGLE + norm * KNOB_SWEEP) * Math.PI) / 180;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius
  };
}

function clockwiseFromUpEnd(center: SvgPoint, degrees: number, radius: number) {
  const angle = (degrees * Math.PI) / 180;
  return {
    x: center.x + Math.sin(angle) * radius,
    y: center.y - Math.cos(angle) * radius
  };
}

function sliderY(norm: number) {
  return 42 - clamp(norm, 0, 1) * 30;
}

function barFill(index: number, active: boolean, enabled: boolean) {
  if (active) {
    return "#BDE7FF";
  }

  if (!enabled) {
    if (index % 12 === 0) {
      return "#9E6868";
    }

    if (index % 12 === 5) {
      return "#676697";
    }

    return "#A7A7A7";
  }

  if (index % 12 === 0) {
    return "#F63232";
  }

  if (index % 12 === 5) {
    return "#2B2A7B";
  }

  return "#EDECEC";
}

function noteLabelFill(index: number) {
  return index % 12 === 0 || index % 12 === 5 ? "white" : "#111111";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBarCenters(barCount: number, startX: number) {
  return Array.from({ length: barCount }, (_, index) => startX + BAR_WIDTH / 2 + index * BAR_WIDTH);
}

function getSvgWidth(barCount: number) {
  return Math.max(SVG_WIDTH, barCount * BAR_WIDTH + 6);
}

function getBarStartX(svgWidth: number, barCount: number) {
  return (svgWidth - barCount * BAR_WIDTH) / 2;
}

function getIntervalDotIndices(barCount: number) {
  const indices: number[] = [];

  for (let octaveStart = 0; octaveStart < barCount; octaveStart += 12) {
    for (const interval of [4, 7, 11]) {
      const index = octaveStart + interval;
      if (index < barCount) {
        indices.push(index);
      }
    }
  }

  return indices;
}

function closestEnabledBar(x: number, enabledBars: readonly boolean[], barCenters: readonly number[]) {
  let closestIndex: number | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < enabledBars.length; index += 1) {
    if (!enabledBars[index]) {
      continue;
    }

    const distance = Math.abs(x - barCenters[index]);
    if (distance < closestDistance) {
      closestIndex = index;
      closestDistance = distance;
    }
  }

  return closestIndex;
}
