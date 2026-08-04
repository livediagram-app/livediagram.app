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
//     hands out is a one-way portal.
//  3. It carries the affordances a button needs to look pressable: the glyph
//     over the label (the toolbar-button shape), a hover lift, and a press that
//     scales and sinks. Hover is desktop-only — a touch device has no hover, and
//     a sticky :hover after a tap reads as a stuck button.

import type { SelectionMode } from '@livediagram/diagram';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import {
  AvatarModeIcon,
  EraserIcon,
  FormatPainterIcon,
  HighlighterIcon,
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
  highlighter: <HighlighterIcon />,
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
  highlighter: 'Highlighter',
};

// The glyphs are 13px for the palette; on a button face they need to read from
// across a room, so the wrapper scales the child SVG up. CSS beats the SVG's own
// width/height attributes, and vectors stay crisp.
const ICON_BOX = 'flex items-center justify-center [&>svg]:h-[22px] [&>svg]:w-[22px]';

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
  // The mode the viewer is in RIGHT NOW. A button for the mode you are already
  // in becomes the way back out — it reads "Leave Avatar" and presses you into
  // the tool you came from — because on a read-only walkthrough it can be the
  // only control on screen, and a one-way door strands the viewer.
  activeMode?: SelectionMode;
  textColor: string;
  // Undefined on a read-only surface that can't switch tools (an embed).
  onPress?: () => void;
}) {
  const isCurrent = activeMode === mode;
  const press = usePressWithoutDrag(onPress);
  const kicker = isCurrent ? 'Leave' : 'Switch to';
  const text = label.trim() || `${kicker} ${MODE_LABEL[mode]}`;
  // The face: the glyph in a translucent chip (which is what reads as "this is
  // a control" rather than "this is a box with a picture in it"), a small
  // kicker, and the destination in the element's own text weight. A derived
  // label splits into kicker + mode; an author's own label takes the whole
  // width and skips the kicker.
  const derived = !label.trim();
  const inner = (
    <>
      <span
        className={`${ICON_BOX} h-9 w-9 shrink-0 rounded-full bg-black/[0.055] ring-1 ring-inset ring-black/[0.07] dark:bg-white/10 dark:ring-white/15`}
        style={{ color: textColor }}
        aria-hidden
      >
        {MODE_ICON[mode]}
      </span>
      {derived ? (
        <span className="flex flex-col items-center gap-0.5 leading-none">
          <span
            className="text-[9px] font-medium uppercase tracking-[0.08em] opacity-70"
            style={{ color: textColor }}
          >
            {kicker}
          </span>
          <span className="text-[13px] font-semibold" style={{ color: textColor }}>
            {MODE_LABEL[mode]}
          </span>
        </span>
      ) : (
        <span
          className="w-full px-2 text-center text-[12px] font-semibold leading-tight"
          style={{ color: textColor }}
        >
          {text}
        </span>
      )}
    </>
  );
  // Layout is shared by the live and inert renders so a read-only embed looks
  // identical, minus the interaction. Deliberately UNTINTED: the element's own
  // fill (a plain surface by default) is the button, and a gradient wash over
  // it only muddied whatever colour the author picked. What sells "raised" is
  // the hairline highlight along the top edge, which works on any fill.
  const layout =
    'flex h-full w-full flex-col items-center justify-center gap-2 rounded-[inherit] py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]';
  if (!onPress) {
    return <div className={`pointer-events-none ${layout}`}>{inner}</div>;
  }
  // Already in this mode: the button becomes the way back out — pressing it
  // returns you to the tool you came from — so it stays live and says "Leave"
  // rather than pretending it can switch you somewhere you already are.
  return (
    <>
      {/* The CHIP is the button, not the whole card. A card-sized target meant
          a click anywhere — on the label you were reading, or on padding while
          positioning the element — switched everyone's mode. Everything around
          the chip stays ordinary canvas you can click to select and drag. */}
      <span className={`pointer-events-none absolute inset-0 ${layout}`} aria-hidden>
        {inner}
      </span>
      <button
        type="button"
        // The label is already the accessible name; naming the action as well
        // keeps it unambiguous for a screen reader.
        aria-label={
          isCurrent
            ? `${text} — back to your previous mode`
            : `${text} — switch to ${MODE_LABEL[mode]} mode`
        }
        // Press on a click, silent on a drag: the button is an element too, so
        // dragging it must move it without also switching everyone's mode.
        // See usePressWithoutDrag.
        {...press}
        // Sits exactly over the chip `inner` draws. `pointer-events-auto`
        // survives the inert diagram layer of Avatar / Spotlight / Isometric
        // mode; see the file header. The hover / active treatment is what
        // sells "pressable" — a ring and a lift on hover (desktop only, via
        // `sm:`, since a tap would leave it stuck on a phone) and a shrink on
        // press — and it is on the CHIP now, so the affordance is where the
        // press actually is.
        className="pointer-events-auto absolute left-1/2 top-[14%] h-9 w-9 -translate-x-1/2 cursor-pointer rounded-full transition duration-100 active:scale-[0.92] sm:hover:scale-105 sm:hover:bg-black/[0.06] sm:hover:ring-2 sm:hover:ring-inset sm:hover:ring-black/10 dark:sm:hover:bg-white/10 dark:sm:hover:ring-white/20"
      />
    </>
  );
}
