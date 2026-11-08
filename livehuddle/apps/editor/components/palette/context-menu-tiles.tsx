'use client';

// Animation-picker tile grids for the editor context menu (docs/specs/008-canvas/canvas-and-palette.md), lifted
// out of EditorContextMenu.tsx to keep that god file focused on menu structure.
// Each control is an illustrated tile per kind plus a Speed row once a motion
// is picked. The boxed Animation and icon-animation pickers all
// live here; the Progress picker stays in EditorContextMenu (it pairs with the
// local MenuToggleRow) but reuses TileLabel + SpeedTiles from this module.

import { useState, type ReactNode } from 'react';
import {
  ANIMATION_SPEEDS,
  ICON_ANIMATIONS,
  animationLabel,
  type AnimationSpeed,
  ICON_SIZES,
  ICON_WEIGHTS,
  ICON_WEIGHT_PX,
  type IconWeight,
  type IconAnimation,
  type IconSize,
} from '@livehuddle/document';
import { SizeButton } from '@/components/palette/palette-controls';
import { AnimationPreviewTile } from '@/components/palette/AnimationPreviewTile';
import { IconAnimationPreview } from '@/components/palette/animation-previews-existing';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';
import {
  onMouseHover,
  useRevertOnUnmount,
} from '@liveworkspace/workbench/components/primitives/hover-preview';
import { IconPrims } from '@/components/primitives/icon-glyph';
import { Glyph } from '@livehuddle/ui';

// Stable no-op so a tile grid without preview handlers (e.g. a future caller)
// still calls useRevertOnUnmount unconditionally (hook-rule safe).
export const NOOP = () => {};

// Gate the Speed row on the COMMITTED motion, not the live hover-preview value.
// The menu derives the selection from the live tab, which the hover preview
// mutates, so without this, hovering a tile would flip the Speed row on/off and
// reflow the menu — and a bottom-anchored menu growing upward slides a different
// tile under the cursor before the click lands, committing the wrong one (the
// reported race). The state captures the committed value at open (useState ignores
// later args) and only changes on a real pick, so hovering never reflows.
export function useSpeedRowGate<T>(committed: T | null, onSet: (v: T | null) => void) {
  const [picked, setPicked] = useState(committed);
  const handleSet = (v: T | null) => {
    setPicked(v);
    onSet(v);
  };
  return { showSpeed: picked !== null, handleSet };
}

// Prepend the "None" option to a kinds list for the picker tile grids. The
// generic return type ((T | null)[]) lets each `.map` infer its element type,
// replacing the `[null, ...X] as (T | null)[]` cast that recurred per grid.
export const withNone = <T,>(kinds: readonly T[]): (T | null)[] => [null, ...kinds];

// Speed presets row (docs/specs/008-canvas/canvas-and-palette.md) — shown under an Animation / Flow control once
// an animation is picked. Slowest / Slow / Normal / Fast scale the loop's
// duration; Slow is the default for a fresh animation.
export function SpeedTiles({
  value,
  onSet,
}: {
  value: AnimationSpeed;
  onSet: (v: AnimationSpeed) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1 px-2 pb-1.5">
      {ANIMATION_SPEEDS.map((s) => (
        <SizeButton key={s} active={value === s} onClick={() => onSet(s)}>
          <span className="text-[10px] capitalize leading-none">{s}</span>
        </SizeButton>
      ))}
    </div>
  );
}

// The Speed + Repeat rows shown once a motion is picked: every animation
// surface (boxed / arrow / icon / the data-shape anims) offers the same pair,
// so the loop's pace and its play-once switch can't drift between pickers.
// Repeat defaults on; off = the animation plays a single cycle and holds.
export function SpeedAndRepeatRows({
  speed,
  repeat,
  onSetSpeed,
  onSetRepeat,
}: {
  speed: AnimationSpeed;
  repeat: boolean;
  onSetSpeed: (v: AnimationSpeed) => void;
  onSetRepeat: (v: boolean) => void;
}) {
  return (
    <>
      <SpeedTiles value={speed} onSet={onSetSpeed} />
      <MenuToggleRow
        label="Repeat"
        description="Loop the animation instead of playing it once."
        checked={repeat}
        onToggle={() => onSetRepeat(!repeat)}
      />
    </>
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

// Icon Animation control (docs/specs/008-canvas/canvas-and-palette.md): icons get their own glyph-motion set
// (Spin / Beat / Pulse / Bounce / Wiggle / Flash / Tada) instead of the
// boxed-element animation set. Like the boxed Animation + arrow Flow controls,
// a Speed row appears once a motion is picked.
export function IconAnimationTiles({
  animation,
  speed,
  repeat,
  onSet,
  onSetSpeed,
  onSetRepeat,
  onPreview,
  onPreviewEnd,
}: {
  animation: IconAnimation | null;
  speed: AnimationSpeed;
  // Whether the animation loops (on by default); false = play once and hold.
  repeat: boolean;
  onSet: (v: IconAnimation | null) => void;
  onSetSpeed: (v: AnimationSpeed) => void;
  onSetRepeat: (v: boolean) => void;
  // Desktop hover-to-preview (docs/specs/008-canvas/canvas-and-palette.md), as in AnimationTiles.
  onPreview?: (v: IconAnimation | null) => void;
  onPreviewEnd?: () => void;
}) {
  useRevertOnUnmount(onPreviewEnd ?? NOOP);
  const { showSpeed, handleSet } = useSpeedRowGate(animation, onSet);
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {withNone(ICON_ANIMATIONS).map((v) => (
          <AnimationPreviewTile
            key={v ?? 'none'}
            active={animation === v}
            label={v ? animationLabel(v) : 'None'}
            frame={v ? 0.25 : 0}
            onClick={() => handleSet(v)}
            onPreview={onPreview ? () => onPreview(v) : undefined}
            onPreviewEnd={onPreviewEnd}
          >
            <IconAnimationPreview animation={v} />
          </AnimationPreviewTile>
        ))}
      </div>
      {showSpeed ? (
        <SpeedAndRepeatRows
          speed={speed}
          repeat={repeat}
          onSetSpeed={onSetSpeed}
          onSetRepeat={onSetRepeat}
        />
      ) : null}
    </>
  );
}

// Icon-size picker (docs/specs/010-palette/technology-icons.md): a Technology icon's fixed tile size. Four
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
  // Optional hover-preview pair (docs/specs/010-palette/style-presets.md flow): hovering a tile shows the
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

const ICON_WEIGHT_LABEL: Record<IconWeight, string> = {
  thin: 'Thin',
  regular: 'Regular',
  bold: 'Bold',
};

// The selected glyph itself at each weight, so the row previews the real result.
const WEIGHT_TILE_PX = 22;
function IconWeightGlyph({ iconId, weight }: { iconId: string | undefined; weight: IconWeight }) {
  return (
    <Glyph size={WEIGHT_TILE_PX} units={24} weight={ICON_WEIGHT_PX[weight]}>
      <IconPrims iconId={iconId} />
    </Glyph>
  );
}

// Thin / Regular / Bold for a line-art icon (docs/specs/004-interface-design/iconography.md).
export function IconWeightTiles({
  iconId,
  value,
  onSet,
  onPreview,
  onPreviewEnd,
}: {
  // The glyph the tiles preview (the menu's target icon).
  iconId: string | undefined;
  value: IconWeight;
  onSet: (v: IconWeight) => void;
  onPreview?: (v: IconWeight) => void;
  onPreviewEnd?: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 px-2 py-1.5">
      {ICON_WEIGHTS.map((w) => (
        <SizeButton
          key={w}
          active={value === w}
          onClick={() => onSet(w)}
          onPointerEnter={onPreview ? onMouseHover(() => onPreview(w)) : undefined}
          onPointerLeave={onPreviewEnd ? onMouseHover(onPreviewEnd) : undefined}
        >
          <TileLabel
            glyph={<IconWeightGlyph iconId={iconId} weight={w} />}
            label={ICON_WEIGHT_LABEL[w]}
          />
        </SizeButton>
      ))}
    </div>
  );
}
