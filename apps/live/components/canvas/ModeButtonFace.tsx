// The pressable face of a Mode Button element (spec/103): the mode's glyph
// ABOVE the element's label, drawn as a real button.
//
// Three things make this different from every other element's content:
//
//  1. It is a real <button>, so a click PRESSES it (switching the clicker into
//     the configured mode) instead of only selecting the element. Pointer-down
//     is left alone rather than swallowed, so dragging the button still moves
//     it — a click is a click, a drag is a drag.
//  2. It keeps `pointer-events: auto` even inside a pointer-inert diagram
//     layer, which is what makes a button still work while someone is walking
//     around in Avatar mode. A control bar of these is useless if the mode it
//     hands out is a one-way door.
//  3. It carries the affordances a button needs to look pressable: the glyph
//     over the label (the toolbar-button shape), a hover lift, and a press that
//     scales and sinks. Hover is desktop-only — a touch device has no hover, and
//     a sticky :hover after a tap reads as a stuck button.

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

// What each mode actually does, for the hover tooltip — the button's label is
// the author's copy ("Walk with me"), which doesn't have to say which mode it
// hands out, so the tooltip is where that gets spelled out.
const MODE_BLURB: Record<SelectionMode, string> = {
  select: 'The normal pointer: select, move, and edit elements.',
  pan: 'Drag anywhere to scroll the canvas around.',
  laser: 'Your pointer leaves a glowing trail everyone can see.',
  spotlight: 'Dims the canvas except a circle around your cursor.',
  avatar: 'Drops a little character you walk around the diagram.',
  eraser: 'Click or drag across elements to delete them.',
  format: "Copy one element's style and paint it onto others.",
  isometric: 'Tilts the tab into a three-dimensional view.',
};

// The glyphs are 13px for the palette; on a button face they need to read from
// across a room, so the wrapper scales the child SVG up. CSS beats the SVG's own
// width/height attributes, and vectors stay crisp.
const ICON_BOX = 'flex items-center justify-center [&>svg]:h-[26px] [&>svg]:w-[26px]';

export function ModeButtonFace({
  mode,
  label,
  activeMode,
  textColor,
  onPress,
}: {
  mode: SelectionMode;
  // The element's own label. Empty (the default) falls back to naming the
  // action — "Switch to Avatar" — so the face never goes stale when the button
  // is re-pointed, and an author who types their own copy still wins.
  label: string;
  // The mode the viewer is in RIGHT NOW. A button offering the mode you are
  // already in is disabled: pressing it would do nothing, and a control that
  // does nothing should say so rather than look live.
  activeMode?: SelectionMode;
  textColor: string;
  // Undefined on a read-only surface that can't switch tools (an embed).
  onPress?: () => void;
}) {
  const text = label.trim() || `Switch to ${MODE_LABEL[mode]}`;
  const isCurrent = activeMode === mode;
  const inner = (
    <>
      <span className={ICON_BOX} style={{ color: textColor }} aria-hidden>
        {MODE_ICON[mode]}
      </span>
      <span className="w-full px-1.5 text-center leading-tight" style={{ color: textColor }}>
        {text}
      </span>
    </>
  );
  // Layout is shared by the live and inert renders so a read-only embed looks
  // identical, minus the interaction.
  const layout = 'flex h-full w-full flex-col items-center justify-center gap-1.5 py-1';
  if (!onPress) {
    return <div className={`pointer-events-none ${layout}`}>{inner}</div>;
  }
  // Already in this mode: the face dims and stops taking clicks, and the
  // tooltip says why rather than leaving the user to wonder.
  if (isCurrent) {
    return (
      <Tooltip title={`Already in ${MODE_LABEL[mode]}`} description={MODE_BLURB[mode]}>
        <div aria-disabled className={`pointer-events-auto cursor-default opacity-60 ${layout}`}>
          {inner}
        </div>
      </Tooltip>
    );
  }
  return (
    <Tooltip title={`Switch to ${MODE_LABEL[mode]}`} description={MODE_BLURB[mode]}>
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
        // Spotlight / Isometric mode; see the file header. The hover / active
        // treatment is what sells "pressable": a brightening lift on hover
        // (desktop only, via `sm:`, since a tap would leave it stuck on a
        // phone), and a shrink + sink on press.
        className={`pointer-events-auto cursor-pointer rounded-[inherit] transition duration-100 active:scale-[0.96] active:brightness-95 sm:hover:brightness-[1.07] ${layout}`}
      >
        {inner}
      </button>
    </Tooltip>
  );
}
