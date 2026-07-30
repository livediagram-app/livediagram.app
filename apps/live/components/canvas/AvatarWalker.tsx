// The Avatar-mode character (spec/101): a chunky Habbo-Hotel-style pixel
// figure that stands in the diagram, walks where you click, and hops with a
// flag when you press Space.
//
// Drawn as inline SVG on a coarse 16x24 pixel grid with `shapeRendering:
// crispEdges` and flat fills — no gradients, no anti-aliased curves — so it
// reads as sprite art rather than a vector illustration. It lives INSIDE the
// canvas's transformed wrapper, so it pans / zooms with the diagram; its
// position is the FEET, so it stands on the point you clicked.
//
// The same component draws PEERS' characters (their presence snapshot), which
// is why every animation input is a prop rather than read from the walk hook.

import type { AvatarFacing, AvatarLook } from '@/lib/avatar-walk';
import { AVATAR_BOX, AVATAR_JUMP_HEADROOM } from '@/lib/avatar-walk';
import { AvatarSprite } from '@/components/canvas/avatar-sprite';

export function AvatarWalker({
  pos,
  facing,
  look,
  walking,
  stepFrame,
  lift = 0,
  wave = null,
  shirt,
  standingOn,
  name,
}: {
  // Feet position in canvas coords.
  pos: { x: number; y: number };
  facing: AvatarFacing;
  look: AvatarLook;
  walking: boolean;
  // 0 / 1 — the two-frame leg swing, advanced by distance walked.
  stepFrame: number;
  // Height above the ground mid-hop, in canvas px.
  lift?: number;
  // Flag-wave frame (0..2), or null for no flag.
  wave?: number | null;
  // Shirt colour — the participant's presence colour, so your character on a
  // shared diagram matches your cursor / name chip. Falls back to the brand
  // cyan inside the sprite when undefined.
  shirt?: string;
  // Bounds of the element the character is standing on, for the "you are
  // here" ring. Null when it is on bare canvas.
  standingOn: { x: number; y: number; width: number; height: number } | null;
  // Peer name, rendered as a small chip above the head. Omitted for your own
  // character (you know who you are).
  name?: string;
}) {
  return (
    <>
      {/* Standing-on ring: what makes the mode useful for narration — the
          audience sees which box the character has arrived at. Sits under the
          sprite, inert to pointers like everything in this layer. */}
      {standingOn ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg ring-2 ring-brand-400/70"
          style={{
            left: standingOn.x - 4,
            top: standingOn.y - 4,
            width: standingOn.width + 8,
            height: standingOn.height + 8,
            boxShadow: '0 0 0 4px rgb(14 165 233 / 0.12)',
          }}
        />
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          // The box is bigger than the figure: it reserves headroom above for
          // the hop and slack either side for the waved flag (see AVATAR_BOX),
          // so placing it means offsetting from the feet rather than the
          // sprite's own corner. The contact shadow stays on the ground while
          // the body rises.
          left: pos.x - AVATAR_BOX.offsetX,
          top: pos.y - AVATAR_BOX.offsetY,
          width: AVATAR_BOX.width,
          height: AVATAR_BOX.height,
        }}
      >
        {name ? (
          <div
            className="absolute left-1/2 max-w-[120px] -translate-x-1/2 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white"
            // Pinned just above the HEAD, not the (headroom-extended) box.
            style={{
              backgroundColor: shirt ?? '#0ea5e9',
              top: AVATAR_JUMP_HEADROOM - 18,
            }}
          >
            {name}
          </div>
        ) : null}
        <AvatarSprite
          facing={facing}
          look={look}
          walking={walking}
          stepFrame={stepFrame}
          lift={lift}
          wave={wave}
          shirt={shirt}
        />
      </div>
    </>
  );
}
