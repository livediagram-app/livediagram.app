'use client';

// Bring Focus (docs/specs/012-collaboration/bring-focus.md): press it and everyone else in the room is offered a
// jump to it, on your tab.
//
// A real push button (furniture-art-style.md): a red dome in a brass ring on a walnut base, the target engraved on
// it, and the label on a cream nameplate (FOCUS_BUTTON_ART, shared with the export). It looks pressable before you
// have read the label. The press target is the DOME rather than the whole card, so clicking the label you were
// reading, or the base while positioning the element, does not send the room somewhere.

import { FOCUS_BUTTON_ART as A } from '@livehuddle/document';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { Glyph, HoverCard } from '@livehuddle/ui';

const T = A.tones;

// A target: the reticle you put over the thing you want looked at. Not an eye
// (that is the reveal's, docs/specs/009-elements/reveal-zone.md) and not an arrow (that is the portal's):
// this one is about WHERE, not about seeing or travelling.
function TargetGlyph() {
  return (
    <Glyph size={18} units={24} strokeLinejoin="miter">
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </Glyph>
  );
}

// The brass ring round the dome, lit from above.
const RING = {
  width: A.ring * 2,
  height: A.ring * 2,
  background: `linear-gradient(${T.brassLit}, ${T.brass} 55%, ${T.brassEdge})`,
  boxShadow: `0 2px 3px rgb(0 0 0 / 0.35), inset 0 0 0 1px ${T.brassEdge}`,
} as const;

// The red dome: a highlight up and to the left, deepening to its rim.
const DOME = {
  width: A.dome * 2,
  height: A.dome * 2,
  color: T.engrave,
  background: `radial-gradient(circle at 38% 30%, ${T.domeLit}, ${T.dome} 55%, ${T.domeDeep})`,
  boxShadow: `inset 0 -2px 3px rgb(0 0 0 / 0.3), inset 0 0 0 1px ${T.domeDeep}`,
} as const;

export function FocusButtonFace({
  label,
  onPress,
}: {
  // The element's own label. Empty falls back to naming the action, so a
  // freshly dropped button reads as what it does; an author who types "The
  // problem" over it wins, which is the point of having several on a canvas.
  label: string;
  // Undefined where this session may not ask anyone to look anywhere: a
  // Participant or a Viewer, an Editor while someone else holds the baton
  // (docs/specs/012-collaboration/bring-focus.md "Rules"). The face still
  // renders, inert, because a viewer should see what the canvas is offering,
  // and its target says on hover who may press it.
  onPress?: () => void;
}) {
  const press = usePressWithoutDrag(onPress);
  const text = label.trim() || 'Bring Focus';
  const dome = (
    <span
      className="flex items-center justify-center rounded-full transition duration-100 group-active/dome:translate-y-px group-active/dome:brightness-90 motion-reduce:transition-none"
      style={DOME}
    >
      <TargetGlyph />
    </span>
  );
  return (
    // Inert as a whole so the card still selects and drags; the dome below
    // takes pointers back for itself. The walnut base fills the card.
    <div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[inherit] py-1"
      style={{
        background: `linear-gradient(${T.baseLit}, ${T.base})`,
        boxShadow: `inset 0 0 0 1px ${T.baseEdge}, inset 0 1px 0 rgb(255 255 255 / 0.18), 0 2px 4px rgb(11 18 32 / 0.28)`,
      }}
    >
      {onPress ? (
        <button
          type="button"
          aria-label={`${text}: ask everyone else to look here`}
          // Press on a click, silent on a drag: the button is an element too,
          // so dragging it must move it without also asking the room to look.
          {...press}
          data-piece-main=""
          // Hover treatment is desktop-only (`sm:`): a tap would leave it stuck
          // on a phone.
          className="group/dome pointer-events-auto flex shrink-0 cursor-pointer items-center justify-center rounded-full transition duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:hover:brightness-110"
          style={RING}
        >
          {dome}
        </button>
      ) : (
        // Not a button: a walking click on it does nothing (lib/avatar-click-intent NO_READER_KINDS), so the
        // cursor stays the arrow, and the card says why. It takes pointers back only to be hovered.
        <HoverCard
          title="Bring Focus"
          description="An Editor presses this to ask everyone to look here. While someone facilitates, only they can."
          className="pointer-events-auto cursor-default"
        >
          <span className="flex shrink-0 items-center justify-center rounded-full" style={RING}>
            {dome}
          </span>
        </HoverCard>
      )}
      {/* The cream nameplate. */}
      <span
        className="max-w-[calc(100%-16px)] truncate px-2 text-center text-[12px] font-semibold leading-[18px]"
        style={{
          color: T.ink,
          borderRadius: A.plate.rx,
          background: T.plate,
          boxShadow: `inset 0 0 0 0.75px ${T.plateEdge}, 0 1px 1px rgb(0 0 0 / 0.25)`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
