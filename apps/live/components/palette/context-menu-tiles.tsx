'use client';

// Animation-picker tile grids for the editor context menu (spec/09), lifted
// out of EditorContextMenu.tsx to keep that god file focused on menu structure.
// Each control is an illustrated tile per kind plus a Speed row once a motion
// is picked. The boxed Animation, arrow Flow, and icon-animation pickers all
// live here; the Progress picker stays in EditorContextMenu (it pairs with the
// local MenuToggleRow) but reuses TileLabel + SpeedTiles from this module.

import { useRef, type ReactNode } from 'react';
import {
  ANIMATION_SPEEDS,
  ARROW_FLOWS,
  ELEMENT_ANIMATIONS,
  ICON_ANIMATIONS,
  type AnimationSpeed,
  type ArrowFlow,
  type ChartLegendPosition,
  ICON_SIZES,
  type ElementAnimation,
  type IconAnimation,
  type IconSize,
} from '@livediagram/diagram';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  AnimationKindGlyph,
  FlowKindGlyph,
  IconAnimKindGlyph,
} from '@/components/palette/context-menu-icons';
import { onMouseHover, useRevertOnUnmount } from '@/components/primitives/hover-preview';

// Stable no-op so a tile grid without preview handlers (e.g. a future caller)
// still calls useRevertOnUnmount unconditionally (hook-rule safe).
const NOOP = () => {};

// Gate the Speed row on the COMMITTED motion, not the live hover-preview value.
// The menu derives the selection from the live tab, which the hover preview
// mutates, so without this, hovering a tile would flip the Speed row on/off and
// reflow the menu — and a bottom-anchored menu growing upward slides a different
// tile under the cursor before the click lands, committing the wrong one (the
// reported race). The ref captures the committed value at open (useRef ignores
// later args) and only changes on a real pick, so hovering never reflows.
function useSpeedRowGate<T>(committed: T | null, onSet: (v: T | null) => void) {
  const ref = useRef(committed);
  const handleSet = (v: T | null) => {
    ref.current = v;
    onSet(v);
  };
  return { showSpeed: ref.current !== null, handleSet };
}

// Prepend the "None" option to a kinds list for the picker tile grids. The
// generic return type ((T | null)[]) lets each `.map` infer its element type,
// replacing the `[null, ...X] as (T | null)[]` cast that recurred per grid.
export const withNone = <T,>(kinds: readonly T[]): (T | null)[] => [null, ...kinds];

// Speed presets row (spec/09) — shown under an Animation / Flow control once
// an animation is picked. Slow / Normal / Fast scale the loop's duration.
export function SpeedTiles({
  value,
  onSet,
}: {
  value: AnimationSpeed;
  onSet: (v: AnimationSpeed) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 px-2 pb-1.5">
      {ANIMATION_SPEEDS.map((s) => (
        <SizeButton key={s} active={value === s} onClick={() => onSet(s)}>
          <span className="text-[10px] capitalize leading-none">{s}</span>
        </SizeButton>
      ))}
    </div>
  );
}

// The glyph-over-label content inside one animation-picker tile (an illustrated
// kind glyph above its capitalised name). Shared by the Animation / Flow / Icon
// / Progress tile grids so the four can't drift on spacing or type scale.
export function TileLabel({ glyph, label }: { glyph: ReactNode; label: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      {glyph}
      <span className="text-[9px] capitalize leading-none">{label}</span>
    </span>
  );
}

// Boxed-element Animation control: an illustrated tile per kind (None / Pulse /
// Blink / Glow / Trace / Gradient / Bounce / Wobble) plus the Speed row once one
// is active. Shared by the single and multi-select menus.
export function AnimationTiles({
  animation,
  speed,
  onSet,
  onSetSpeed,
  onPreview,
  onPreviewEnd,
}: {
  animation: ElementAnimation | null;
  speed: AnimationSpeed;
  onSet: (v: ElementAnimation | null) => void;
  onSetSpeed: (v: AnimationSpeed) => void;
  // Desktop hover-to-preview (spec/09): play the hovered motion live on the
  // selection without committing; onPreviewEnd reverts. Omitted = no preview.
  onPreview?: (v: ElementAnimation | null) => void;
  onPreviewEnd?: () => void;
}) {
  useRevertOnUnmount(onPreviewEnd ?? NOOP);
  const { showSpeed, handleSet } = useSpeedRowGate(animation, onSet);
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {withNone(ELEMENT_ANIMATIONS).map((v) => (
          <SizeButton
            key={v ?? 'none'}
            active={animation === v}
            onClick={() => handleSet(v)}
            onPointerEnter={onPreview ? onMouseHover(() => onPreview(v)) : undefined}
            onPointerLeave={onPreview ? onMouseHover(() => onPreviewEnd?.()) : undefined}
          >
            <TileLabel glyph={<AnimationKindGlyph kind={v} />} label={v ?? 'None'} />
          </SizeButton>
        ))}
      </div>
      {showSpeed ? <SpeedTiles value={speed} onSet={onSetSpeed} /> : null}
    </>
  );
}

// Arrow Flow control: None / Dashes / Dots / Beads / Pulse / Grow / Glow
// illustrated, plus the Speed row.
export function FlowTiles({
  flow,
  speed,
  onSet,
  onSetSpeed,
  onPreview,
  onPreviewEnd,
}: {
  flow: ArrowFlow | null;
  speed: AnimationSpeed;
  onSet: (v: ArrowFlow | null) => void;
  onSetSpeed: (v: AnimationSpeed) => void;
  // Desktop hover-to-preview (spec/09), as in AnimationTiles.
  onPreview?: (v: ArrowFlow | null) => void;
  onPreviewEnd?: () => void;
}) {
  useRevertOnUnmount(onPreviewEnd ?? NOOP);
  const { showSpeed, handleSet } = useSpeedRowGate(flow, onSet);
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {withNone(ARROW_FLOWS).map((v) => (
          <SizeButton
            key={v ?? 'none'}
            active={flow === v}
            onClick={() => handleSet(v)}
            onPointerEnter={onPreview ? onMouseHover(() => onPreview(v)) : undefined}
            onPointerLeave={onPreview ? onMouseHover(() => onPreviewEnd?.()) : undefined}
          >
            <TileLabel glyph={<FlowKindGlyph kind={v} />} label={v ?? 'None'} />
          </SizeButton>
        ))}
      </div>
      {showSpeed ? <SpeedTiles value={speed} onSet={onSetSpeed} /> : null}
    </>
  );
}

// Icon Animation control (spec/09): icons get their own glyph-motion set
// (Spin / Beat / Pulse / Bounce / Wiggle / Flash / Tada) instead of the
// boxed-element animation set. Like the boxed Animation + arrow Flow controls,
// a Speed row appears once a motion is picked.
export function IconAnimationTiles({
  animation,
  speed,
  onSet,
  onSetSpeed,
  onPreview,
  onPreviewEnd,
}: {
  animation: IconAnimation | null;
  speed: AnimationSpeed;
  onSet: (v: IconAnimation | null) => void;
  onSetSpeed: (v: AnimationSpeed) => void;
  // Desktop hover-to-preview (spec/09), as in AnimationTiles.
  onPreview?: (v: IconAnimation | null) => void;
  onPreviewEnd?: () => void;
}) {
  useRevertOnUnmount(onPreviewEnd ?? NOOP);
  const { showSpeed, handleSet } = useSpeedRowGate(animation, onSet);
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {withNone(ICON_ANIMATIONS).map((v) => (
          <SizeButton
            key={v ?? 'none'}
            active={animation === v}
            onClick={() => handleSet(v)}
            onPointerEnter={onPreview ? onMouseHover(() => onPreview(v)) : undefined}
            onPointerLeave={onPreview ? onMouseHover(() => onPreviewEnd?.()) : undefined}
          >
            <TileLabel glyph={<IconAnimKindGlyph kind={v} />} label={v ?? 'None'} />
          </SizeButton>
        ))}
      </div>
      {showSpeed ? <SpeedTiles value={speed} onSet={onSetSpeed} /> : null}
    </>
  );
}

// Legend placement (spec/53): Off plus the four sides, drawn as a chart-area
// box with a legend bar on the relevant edge (none for Off).
const LEGEND_PLACEMENTS = ['off', 'top', 'left', 'right', 'bottom'] as const;
type LegendPlacement = (typeof LEGEND_PLACEMENTS)[number];

function LegendPosGlyph({ pos }: { pos: LegendPlacement }) {
  const box = (x: number, y: number, w: number, h: number) => (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={1.5}
      className="fill-none stroke-current"
      strokeWidth={1.2}
    />
  );
  const bar = (x: number, y: number, w: number, h: number) => (
    <rect x={x} y={y} width={w} height={h} rx={1} className="fill-current opacity-60" />
  );
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      {pos === 'top' && (
        <>
          {bar(3, 2, 10, 2.5)}
          {box(3, 6, 10, 8)}
        </>
      )}
      {pos === 'bottom' && (
        <>
          {box(3, 2, 10, 8)}
          {bar(3, 11.5, 10, 2.5)}
        </>
      )}
      {pos === 'left' && (
        <>
          {bar(2, 3, 2.5, 10)}
          {box(6, 3, 8, 10)}
        </>
      )}
      {pos === 'right' && (
        <>
          {box(2, 3, 8, 10)}
          {bar(11.5, 3, 2.5, 10)}
        </>
      )}
      {pos === 'off' && box(2.5, 3, 11, 10)}
    </svg>
  );
}

// Chart legend placement picker (spec/53): Off / Top / Left / Right / Below.
// The four sides set both the position and chartLegend=true (onSetPosition);
// Off flips chartLegend=false (onSetOff). Default position is 'right'.
export function LegendPositionTiles({
  position,
  show,
  onSetOff,
  onSetPosition,
}: {
  position: ChartLegendPosition;
  show: boolean;
  onSetOff: () => void;
  onSetPosition: (pos: ChartLegendPosition) => void;
}) {
  const isActive = (p: LegendPlacement) => (p === 'off' ? !show : show && position === p);
  return (
    <div className="grid grid-cols-5 gap-1 px-2 py-1.5">
      {LEGEND_PLACEMENTS.map((p) => (
        <SizeButton
          key={p}
          active={isActive(p)}
          onClick={() => (p === 'off' ? onSetOff() : onSetPosition(p))}
        >
          <TileLabel glyph={<LegendPosGlyph pos={p} />} label={p === 'bottom' ? 'Below' : p} />
        </SizeButton>
      ))}
    </div>
  );
}

// Icon-size picker (spec/41): a Technology icon's fixed tile size. Four
// preset tiles, each a rounded-square chip glyph at a graduated size over
// its caption — icon buttons, matching the other tile grids here.
const ICON_SIZE_LABEL: Record<IconSize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Huge',
};

function IconSizeGlyph({ size }: { size: IconSize }) {
  // Chip edge lengths graduated per preset, all inside one 22x22 canvas so
  // the row of glyphs reads as the same chip growing.
  const edge = { sm: 8, md: 11, lg: 14, xl: 18 }[size];
  const off = (22 - edge) / 2;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect
        x={off}
        y={off}
        width={edge}
        height={edge}
        rx={edge * 0.22}
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

export function IconSizeTiles({
  value,
  onSet,
  onPreview,
  onPreviewEnd,
}: {
  // The element's committed preset ('md' when unset).
  value: IconSize;
  onSet: (v: IconSize) => void;
  // Optional hover-preview pair (spec/48 flow): hovering a tile shows the
  // size live on the icon, leaving reverts.
  onPreview?: (v: IconSize) => void;
  onPreviewEnd?: () => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
      {ICON_SIZES.map((s) => (
        <SizeButton
          key={s}
          active={value === s}
          onClick={() => onSet(s)}
          onPointerEnter={onPreview ? onMouseHover(() => onPreview(s)) : undefined}
          onPointerLeave={onPreviewEnd ? onMouseHover(onPreviewEnd) : undefined}
        >
          <TileLabel glyph={<IconSizeGlyph size={s} />} label={ICON_SIZE_LABEL[s]} />
        </SizeButton>
      ))}
    </div>
  );
}
