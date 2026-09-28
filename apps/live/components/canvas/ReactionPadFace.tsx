'use client';

import { useState } from 'react';
import {
  REACTION_EMOJI,
  REACTION_HINT,
  REACTION_HUES,
  REACTION_LABEL,
  type Reaction,
} from '@livediagram/diagram';

import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from '@/lib/element-tint';
import { HoverCard } from '@livediagram/ui';

// The face of a Reaction Pad (docs/specs/009-elements/reaction-pad.md): a big pressable glyph over a
// spotlight in the reaction's own colour, the label under it ("The look").
//
// The pad has TWO triggers, a click and an Avatar-mode character walking onto
// it, so it has to look like something you can stand on: the glowing spot
// under the emoji is that, without drawing hardware. The emoji bobs, lifts
// under the pointer, and on a press squashes and throws a ring out from the
// spot. Motion lives in qa-board.css and stops under reduced motion.
//
// Interaction rules match the Selection Mode button (docs/specs/009-elements/mode-button.md) and the Portal
// (docs/specs/009-elements/portal-element.md): a real <button> so a click travels rather than only selecting,
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
  // Counts presses, to replay the ring on each one (it is keyed on this).
  const [presses, setPresses] = useState(0);
  const press = usePressWithoutDrag(
    onFire
      ? () => {
          setPresses((n) => n + 1);
          onFire();
        }
      : undefined,
  );
  const emoji = REACTION_EMOJI[reaction];
  const [from, to] = REACTION_HUES[reaction];

  const face = (
    <span className="pointer-events-none relative flex h-full w-full flex-col items-center justify-center gap-1 px-2">
      {/* The reaction's glow, behind everything. */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-[inherit]"
        style={{
          background: `radial-gradient(70% 70% at 50% 42%, ${tint(from, 0.28)}, ${tint(to, 0.1)} 55%, transparent 80%)`,
        }}
      />
      <span className="relative flex flex-col items-center">
        <span
          // Sized against the PAD rather than in px, so a resized pad scales
          // its glyph instead of stranding a 32px emoji in a 300px square.
          className="pad-emoji relative z-10 leading-none"
          style={{
            fontSize: 'min(34cqw, 40cqh)',
            filter: `drop-shadow(0 6px 10px ${tint(to, 0.45)})`,
          }}
          aria-hidden
        >
          {emoji}
        </span>
        {/* The spot to stand on, and the ring a press throws from it. */}
        <span
          aria-hidden
          className="relative -mt-[5cqh] h-[9cqh] w-[46cqw] rounded-[50%]"
          style={{
            background: `radial-gradient(closest-side, ${tint(from, 0.55)}, ${tint(to, 0.18)} 70%, transparent)`,
          }}
        >
          {presses > 0 ? (
            <span
              key={presses}
              className="pad-ring absolute inset-0 rounded-[50%] border-2"
              style={{ borderColor: from }}
            />
          ) : null}
        </span>
      </span>
      {label ? (
        <span
          className="relative max-w-full truncate rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-tight"
          style={{ color: textColor, backgroundColor: tint(textColor, 0.07) }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );

  if (!onFire) {
    return (
      <div
        // A SIZE container, so the glyph's and the spot's cqw AND cqh resolve
        // against the pad. `@container` alone is inline-size only, and cqh
        // then falls back to the viewport, which blew the spot up to 77px.
        className="pointer-events-none relative h-full w-full rounded-[inherit] [container-type:size]"
        aria-label={`${REACTION_LABEL[reaction]} pad`}
        role="img"
      >
        {face}
      </div>
    );
  }

  return (
    <HoverCard
      block
      className="h-full w-full"
      title={`${REACTION_LABEL[reaction]} pad`}
      description={`${REACTION_HINT[reaction]}. Press it, or walk a character onto it in Avatar mode.`}
    >
      <button
        type="button"
        {...press}
        aria-label={`Set off ${REACTION_LABEL[reaction]}`}
        className="pad-button pointer-events-auto relative h-full w-full cursor-pointer rounded-[inherit] [container-type:size]"
      >
        {face}
      </button>
    </HoverCard>
  );
}
