// The face of a Reveal zone (docs/specs/009-elements/reveal-zone.md): an opaque, accent-lit cover over
// whatever it overlaps ("The look"), with the two ways to take it off.
//
// The cover is opaque rather than blurred ON PURPOSE. A blur would imply the
// content underneath is protected, and it isn't: everything under a cover is
// still in the document, the export, and the API response. The hover card says
// so, and the spec is the honest record of it.
//
// Uncovering locally takes a DOUBLE press: a cover exists to stay closed, and
// one stray click on a board people are dragging things around would undo the
// whole point of it. The Hide pill stays a single click — putting the cover
// back by accident costs nothing.
//
// Local reveal is a viewer's own business and never touches the
// document; the shared reveal lives in `revealed` on the element and is an
// ordinary edit. When it is uncovered locally, the panel gets out of the way
// completely — pointer-events included, so the content underneath is editable
// — leaving one small Hide pill to put it back.

import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { useCoarsePointer } from '@/hooks/ui/useCoarsePointer';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { tint } from '@/lib/element-tint';
import { LockGlyph } from '@/components/canvas/collab/qa/qa-parts';
import { Glyph, GlyphDisc } from '@livediagram/ui';

// The cover's base, from the PAPER under it rather than the app's appearance,
// so a dark theme in light mode still gets a dark cover (docs/specs/009-elements/reveal-zone.md "The look").
const COVER_BASE = { light: '#f1f5f9', dark: '#172131' } as const;

function EyeOffIcon() {
  return (
    <Glyph size={13} units={16}>
      <path d="M1.6 8s2.4-4 6.4-4 6.4 4 6.4 4-2.4 4-6.4 4-6.4-4-6.4-4z" />
      <circle cx="8" cy="8" r="1.8" />
      <path d="M2.4 2.4l11.2 11.2" />
    </Glyph>
  );
}

export function RevealFace({
  label,
  textColor,
  strokeColor,
  // Uncovered for EVERYONE (the element's own state), vs just for me.
  revealedForAll,
  revealedForMe,
  onToggleForMe,
}: {
  label: string;
  textColor: string;
  // The element's themed stroke: the cover's accent.
  strokeColor: string;
  revealedForAll: boolean;
  revealedForMe: boolean;
  // Absent on a surface with no interaction at all (an export render).
  onToggleForMe?: () => void;
}) {
  // The cover needs two presses; the pill needs one (see the header).
  const coverPress = usePressWithoutDrag(onToggleForMe, { requireDouble: true });
  const pillPress = usePressWithoutDrag(onToggleForMe);
  const coarse = useCoarsePointer();
  const paper = useCanvasSurface();
  const gesture = coarse ? 'Double-tap' : 'Double-click';
  const uncovered = revealedForAll || revealedForMe;
  const accent = strokeColor;

  // Uncovered for the room: nothing to draw. The element is still selectable
  // by its outline in Select mode (the selection chrome renders regardless),
  // so it can be moved, re-hidden from the menu, or deleted.
  if (revealedForAll) return null;

  if (uncovered) {
    return (
      // Only the pill takes pointers, so a locally-revealed zone doesn't sit
      // between the user and the content they came to read.
      <div className="pointer-events-none absolute inset-0">
        <button
          type="button"
          {...pillPress}
          className="flex cursor-pointer items-center gap-1 rounded-full bg-slate-900/75 px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg ring-1 ring-white/10 backdrop-blur transition hover:bg-slate-900/90"
        >
          <EyeOffIcon />
          Hide
        </button>
      </div>
    );
  }

  // No hover card on the cover. It wrapped the WHOLE element, so hovering
  // anywhere on a reveal popped a card over the selection toolbar sitting
  // just above it, and it was redundant besides: the face already shows the
  // label and "<gesture> to reveal" in the middle of it, and the button's
  // aria-label carries the same for screen readers.
  return (
    <button
      type="button"
      aria-label={`${label.trim() || 'Hidden'}, ${gesture.toLowerCase()} to reveal`}
      {...coverPress}
      // FULLY opaque, on purpose: a cover you can read through is not a
      // cover. The base is the paper's tone, lit by two soft glows of the
      // accent, with a solid accent border (it replaced a dashed grey panel
      // with scratch-panel hatching, which read as a disabled box).
      className="reveal-cover pointer-events-auto relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[inherit] border-[1.5px] px-3"
      style={{
        borderColor: tint(accent, 0.55),
        backgroundColor: COVER_BASE[paper],
        backgroundImage: `radial-gradient(120% 90% at 0% 0%, ${tint(accent, 0.22)}, transparent 60%), radial-gradient(110% 90% at 100% 100%, ${tint(accent, 0.16)}, transparent 55%)`,
      }}
    >
      {/* The slow sweep of light: "something is under here". */}
      <span aria-hidden className="reveal-sweep pointer-events-none absolute inset-0" />
      <GlyphDisc
        size={40}
        className="relative"
        style={{
          color: accent,
          backgroundColor: tint(accent, 0.14),
          boxShadow: `0 0 0 6px ${tint(accent, 0.07)}`,
        }}
      >
        <LockGlyph size={18} />
      </GlyphDisc>
      <span
        className="relative text-center text-[14px] font-semibold leading-tight"
        style={{ color: textColor }}
      >
        {label.trim() || 'Hidden'}
      </span>
      <span
        className="relative rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
        style={{ color: textColor, backgroundColor: tint(textColor, 0.07) }}
      >
        {gesture} to reveal
      </span>
    </button>
  );
}
