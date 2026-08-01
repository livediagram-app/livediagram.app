'use client';

import { REACTION_EMOJI, REACTION_HINT, REACTION_LABEL, type Reaction } from '@livediagram/diagram';

import { Tooltip } from '@/components/primitives/Tooltip';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';

// The face of a Reaction Pad (spec/135): a big pressable glyph over the
// element's label.
//
// It is a floor pad, not a button, and it is drawn like one: the glyph sits
// large and centred with the label beneath, and pressing depresses the whole
// face. That matters because the pad has TWO triggers — a click, and an
// Avatar-mode character walking onto it — and a thing you can stand on has to
// look like a thing you can stand on.
//
// Interaction rules match the Selection Mode button (spec/103) and the Portal
// (spec/104): a real <button> so a click travels rather than only selecting,
// `pointer-events: auto` so it works inside the pointer-inert Avatar /
// Spotlight / Isometric layers, and pointer-down left alone so dragging still
// moves the element.

export function ReactionPadFace({
  label,
  reaction,
  textColor,
  onFire,
}: {
  label: string;
  reaction: Reaction;
  textColor: string;
  // Undefined on a read-only surface, which renders the pad inert rather than
  // hiding it: a viewer should still see what the board is offering.
  onFire?: () => void;
}) {
  const press = usePressWithoutDrag(onFire);
  const emoji = REACTION_EMOJI[reaction];

  const face = (
    <span className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-0.5 px-2">
      <span
        // Sized against the PAD rather than in px, so a resized pad scales its
        // glyph instead of stranding a 32px emoji in a 300px square.
        className="leading-none"
        style={{ fontSize: 'min(46cqw, 46cqh)' }}
        aria-hidden
      >
        {emoji}
      </span>
      {label ? (
        <span
          className="max-w-full truncate text-[11px] font-medium leading-tight"
          style={{ color: textColor }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );

  if (!onFire) {
    return (
      <div
        // `@container` so the glyph's cqw/cqh sizing has a box to resolve
        // against; without it the font-size collapses to zero.
        className="pointer-events-none relative h-full w-full @container"
        aria-label={`${REACTION_LABEL[reaction]} pad`}
        role="img"
      >
        {face}
      </div>
    );
  }

  return (
    <Tooltip
      block
      className="h-full w-full"
      title={`${REACTION_LABEL[reaction]} pad`}
      description={`${REACTION_HINT[reaction]}. Press it, or walk a character onto it in Avatar mode.`}
    >
      <button
        type="button"
        {...press}
        aria-label={`Set off ${REACTION_LABEL[reaction]}`}
        className="pointer-events-auto relative h-full w-full cursor-pointer rounded-[inherit] transition active:scale-[0.97] @container"
      >
        {face}
      </button>
    </Tooltip>
  );
}
