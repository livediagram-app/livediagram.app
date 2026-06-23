'use client';

// Animation-picker tile grids for the editor context menu (spec/09), lifted
// out of EditorContextMenu.tsx to keep that god file focused on menu structure.
// Each control is an illustrated tile per kind plus a Speed row once a motion
// is picked. The boxed Animation, arrow Flow, and icon-animation pickers all
// live here; the Progress picker stays in EditorContextMenu (it pairs with the
// local MenuToggleRow) but reuses TileLabel + SpeedTiles from this module.

import type { ReactNode } from 'react';
import {
  ANIMATION_SPEEDS,
  ARROW_FLOWS,
  ELEMENT_ANIMATIONS,
  ICON_ANIMATIONS,
  type AnimationSpeed,
  type ArrowFlow,
  type ElementAnimation,
  type IconAnimation,
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
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {withNone(ELEMENT_ANIMATIONS).map((v) => (
          <SizeButton
            key={v ?? 'none'}
            active={animation === v}
            onClick={() => onSet(v)}
            onPointerEnter={onPreview ? onMouseHover(() => onPreview(v)) : undefined}
            onPointerLeave={onPreview ? onMouseHover(() => onPreviewEnd?.()) : undefined}
          >
            <TileLabel glyph={<AnimationKindGlyph kind={v} />} label={v ?? 'None'} />
          </SizeButton>
        ))}
      </div>
      {animation ? <SpeedTiles value={speed} onSet={onSetSpeed} /> : null}
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
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {withNone(ARROW_FLOWS).map((v) => (
          <SizeButton
            key={v ?? 'none'}
            active={flow === v}
            onClick={() => onSet(v)}
            onPointerEnter={onPreview ? onMouseHover(() => onPreview(v)) : undefined}
            onPointerLeave={onPreview ? onMouseHover(() => onPreviewEnd?.()) : undefined}
          >
            <TileLabel glyph={<FlowKindGlyph kind={v} />} label={v ?? 'None'} />
          </SizeButton>
        ))}
      </div>
      {flow ? <SpeedTiles value={speed} onSet={onSetSpeed} /> : null}
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
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {withNone(ICON_ANIMATIONS).map((v) => (
          <SizeButton
            key={v ?? 'none'}
            active={animation === v}
            onClick={() => onSet(v)}
            onPointerEnter={onPreview ? onMouseHover(() => onPreview(v)) : undefined}
            onPointerLeave={onPreview ? onMouseHover(() => onPreviewEnd?.()) : undefined}
          >
            <TileLabel glyph={<IconAnimKindGlyph kind={v} />} label={v ?? 'None'} />
          </SizeButton>
        ))}
      </div>
      {animation ? <SpeedTiles value={speed} onSet={onSetSpeed} /> : null}
    </>
  );
}
