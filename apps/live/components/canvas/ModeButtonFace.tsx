// The pressable face of a Mode Button element (spec/103): the mode's glyph and
// the element's label, over the shape's own box.
//
// Two things make this different from every other element's content:
//
//  1. It is a real <button>, so a click PRESSES it (switching the clicker into
//     the configured mode) instead of only selecting the element. Pointer-down
//     is left alone rather than swallowed, so dragging the button still moves
//     it — a click is a click, a drag is a drag.
//  2. It keeps `pointer-events: auto` even inside a pointer-inert diagram
//     layer, which is what makes a button still work while someone is walking
//     around in Avatar mode. A control bar of these is useless if the mode it
//     hands out is a one-way door.

import type { SelectionMode } from '@livediagram/diagram';
import { Tooltip } from '@/components/primitives/Tooltip';
import {
  AvatarModeIcon,
  EraserIcon,
  FormatPainterIcon,
  IsometricIcon,
  LaserIcon,
  PanIcon,
  SelectIcon,
  SpotlightIcon,
} from '@/components/palette/palette-icons';

// The picker's own glyphs, so a button advertises the mode with exactly the
// icon the palette uses for it.
const MODE_ICON: Record<SelectionMode, React.ReactNode> = {
  select: <SelectIcon />,
  pan: <PanIcon />,
  laser: <LaserIcon />,
  spotlight: <SpotlightIcon />,
  avatar: <AvatarModeIcon />,
  eraser: <EraserIcon />,
  format: <FormatPainterIcon />,
  isometric: <IsometricIcon />,
};

export const MODE_LABEL: Record<SelectionMode, string> = {
  select: 'Select',
  pan: 'Hand',
  laser: 'Laser',
  spotlight: 'Spotlight',
  avatar: 'Avatar',
  eraser: 'Eraser',
  format: 'Format',
  isometric: 'Isometric',
};

export function ModeButtonFace({
  mode,
  label,
  textColor,
  onPress,
}: {
  mode: SelectionMode;
  // The element's own label — the author's call to action. Empty falls back to
  // naming the mode, so a button is never a blank pill.
  label: string;
  textColor: string;
  // Undefined on a read-only surface that can't switch tools (an embed).
  onPress?: () => void;
}) {
  const text = label.trim() || `${MODE_LABEL[mode]} mode`;
  const inner = (
    <>
      <span className="shrink-0" style={{ color: textColor }}>
        {MODE_ICON[mode]}
      </span>
      <span className="truncate">{text}</span>
    </>
  );
  if (!onPress) {
    return (
      <div
        className="pointer-events-none flex h-full w-full items-center justify-center gap-1.5 px-3"
        style={{ color: textColor }}
      >
        {inner}
      </div>
    );
  }
  return (
    <Tooltip
      title={`Switch to ${MODE_LABEL[mode]}`}
      description="Pressing this button changes YOUR selection mode. Everyone else keeps theirs."
    >
      <button
        type="button"
        // The label is already the accessible name; naming the action as well
        // keeps it unambiguous for a screen reader.
        aria-label={`${text} — switch to ${MODE_LABEL[mode]} mode`}
        onClick={(e) => {
          // Don't let the click fall through to the canvas (which would walk an
          // avatar to the button, or deselect).
          e.stopPropagation();
          onPress();
        }}
        // `pointer-events-auto` survives the inert diagram layer of Avatar /
        // Spotlight / Isometric mode; see the file header.
        className="pointer-events-auto flex h-full w-full cursor-pointer items-center justify-center gap-1.5 px-3 transition active:scale-[0.97]"
        style={{ color: textColor }}
      >
        {inner}
      </button>
    </Tooltip>
  );
}
