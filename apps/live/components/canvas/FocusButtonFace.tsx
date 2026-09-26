'use client';

// Bring Focus (docs/specs/012-collaboration/bring-focus.md): press it and everyone else in the room is offered a
// jump to it, at your zoom, on your tab.
//
// The same keycap the mode button wears, for the same reason: this is a thing
// you press, and it should look pressed-able before you have read the label.
// The press target is the CHIP rather than the whole card, so clicking the
// label you were reading, or the padding while positioning the element, does
// not send the room somewhere.

import { keycapEdge } from '@/components/canvas/paper-kit';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';

// A target: the reticle you put over the thing you want looked at. Not an eye
// (that is the reveal's, docs/specs/009-elements/reveal-zone.md) and not an arrow (that is the portal's):
// this one is about WHERE, not about seeing or travelling.
function TargetGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </svg>
  );
}

export function FocusButtonFace({
  label,
  textColor,
  onPress,
}: {
  // The element's own label. Empty falls back to naming the action, so a
  // freshly dropped button reads as what it does; an author who types "The
  // problem" over it wins, which is the point of having several on a board.
  label: string;
  textColor: string;
  // Undefined on a surface that cannot ask anyone to look anywhere: an export,
  // the minimap, a solo board. The face still renders, inert, because a viewer
  // should see what the board is offering.
  onPress?: () => void;
}) {
  const press = usePressWithoutDrag(onPress);
  const text = label.trim() || 'Bring Focus';
  // The chip IS the button, in the same flow as the label rather than pinned
  // over it at a guessed percentage. A card-sized target would send the room
  // somewhere on a click meant to select or drag the element; an absolutely
  // positioned one drifts off the chip the moment the label wraps to a second
  // line or the element is resized. This cannot: the hover ring is drawn by
  // the same box the layout places.
  const chip =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.055] ring-1 ring-inset ring-black/[0.07] dark:bg-white/10 dark:ring-white/15';
  return (
    // Inert as a whole so the card still selects and drags; the button below
    // takes pointers back for itself.
    <div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[inherit] py-1"
      style={{ ...keycapEdge(textColor) }}
    >
      {onPress ? (
        <button
          type="button"
          aria-label={`${text}: ask everyone else to look here`}
          // Press on a click, silent on a drag: the button is an element too,
          // so dragging it must move it without also asking the room to look.
          {...press}
          // Hover treatment is desktop-only (`sm:`): a tap would leave it stuck
          // on a phone.
          className={`${chip} pointer-events-auto cursor-pointer transition duration-100 active:scale-[0.92] sm:hover:scale-105 sm:hover:bg-black/[0.06] sm:hover:ring-2 sm:hover:ring-black/10 dark:sm:hover:bg-white/10 dark:sm:hover:ring-white/20`}
          style={{ color: textColor }}
        >
          <TargetGlyph />
        </button>
      ) : (
        <span className={chip} style={{ color: textColor }} aria-hidden>
          <TargetGlyph />
        </span>
      )}
      <span
        className="w-full px-2 text-center text-[12px] font-semibold leading-tight"
        style={{ color: textColor }}
      >
        {text}
      </span>
    </div>
  );
}
