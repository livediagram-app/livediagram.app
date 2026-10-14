// The Avatar-mode character's placement (docs/specs/008-canvas/avatar-mode.md): where the sprite sits in
// canvas coords, the "you are here" ring under it, and a peer's name chip.
// The pixel art itself lives in avatar-sprite.tsx.
//
// It lives INSIDE the canvas's transformed wrapper, so it pans / zooms with the
// canvas; its position is the FEET, so it stands on the point you clicked. The
// same component draws PEERS' characters (from their presence snapshot), which
// is why every animation input is a prop rather than read from the walk hook.

import { avatarStatusColour, avatarStatusLabel, type AvatarStatus } from '@/lib/avatar-status';
import { IDENTITY_FILL, identityVars } from '@livediagram/ui';
import { avatarScale, type AvatarConfig } from '@/lib/avatar-config';
import type { AvatarFacing } from '@/lib/avatar-walk';
import { AVATAR_HEIGHT, avatarBox } from '@/lib/avatar-walk';
import { AvatarSprite } from '@/components/canvas/avatar-sprite';

// An Away character fades to half (docs/specs/008-canvas/avatar-mode.md "Status").
const AWAY_OPACITY = 0.5;

// A status dot: a small circle in the status's colour with a white rim, so it reads on a name chip and on the canvas.
function StatusDot({ status }: { status: AvatarStatus }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 shrink-0 rounded-full ring-[1.5px] ring-white"
      style={{ backgroundColor: avatarStatusColour(status) }}
    />
  );
}

export function AvatarWalker({
  pos,
  facing,
  config,
  walking,
  stepFrame,
  lift = 0,
  wave = null,
  pose = null,
  seated = false,
  shirt,
  standingOn,
  name,
  onStand,
  status = null,
}: {
  // Feet position in canvas coords.
  pos: { x: number; y: number };
  facing: AvatarFacing;
  // Gender / clothing / hair / size, from the Avatar Panel (or a peer's packet).
  config: AvatarConfig;
  walking: boolean;
  // 0 / 1 — the two-frame leg swing, advanced by distance walked.
  stepFrame: number;
  // Height above the ground mid-hop, in canvas px.
  lift?: number;
  // Flag-wave frame (0..2), or null for no flag.
  wave?: number | null;
  // Active reaction pose (docs/specs/008-canvas/avatar-mode.md), or null when standing / walking.
  pose?: import('@/lib/avatar-reactions').ReactionPose | null;
  // Chair (docs/specs/009-elements/chair.md): this character is sitting on one, so it draws seated.
  seated?: boolean;
  // Shirt colour — the participant's presence colour, so your character on a
  // shared document matches your cursor / name chip. Falls back to the brand
  // cyan inside the sprite when undefined.
  shirt?: string;
  // Bounds of the element the character is standing on, for the "you are
  // here" ring. Null when it is on bare canvas.
  standingOn: { x: number; y: number; width: number; height: number } | null;
  // Peer name, rendered as a small chip above the head. Omitted for your own
  // character (you know who you are).
  name?: string;
  // Stand up from a chair (docs/specs/009-elements/chair.md). Absent for peers' characters.
  onStand?: () => void;
  // How the person is (docs/specs/008-canvas/avatar-mode.md "Status"), or none.
  status?: AvatarStatus | null;
}) {
  const scale = avatarScale(config.size);
  const box = avatarBox(scale);
  return (
    <>
      {/* Standing-on ring: what makes the mode useful for narration — the
          audience sees which box the character has arrived at. Sits under the
          sprite, inert to pointers like everything in this layer. */}
      {standingOn && !seated ? (
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
        data-avatar={onStand ? 'self' : 'peer'}
        // Your own character is the Avatar tour's push step's anchor (docs/specs/008-canvas/avatar-tour.md).
        data-tour-id={onStand ? 'avatar-self' : undefined}
        data-seated={seated ? '' : undefined}
        className="pointer-events-none absolute"
        style={{
          // The box is bigger than the figure: it reserves headroom above for
          // the hop and slack either side for the waved flag (see avatarBox),
          // so placing it means offsetting from the feet rather than the
          // sprite's own corner. The contact shadow stays on the ground while
          // the body rises.
          left: pos.x - box.offsetX,
          top: pos.y - box.offsetY,
          width: box.width,
          height: box.height,
        }}
      >
        {name ? (
          <div
            className={`absolute left-1/2 flex max-w-[120px] -translate-x-1/2 items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white ${IDENTITY_FILL}`}
            // Pinned just above the HEAD, not the (headroom-extended) box, and
            // tracking the size choice so it hugs a small character too.
            style={{
              ...identityVars(shirt ?? '#0ea5e9'),
              top: box.offsetY - AVATAR_HEIGHT * scale - 16,
            }}
            aria-label={status ? `${name}, ${avatarStatusLabel(status)}` : undefined}
          >
            {status ? <StatusDot status={status} /> : null}
            {name}
          </div>
        ) : status ? (
          // Your own character has no name chip: its status sits alone where the chip would be.
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: box.offsetY - AVATAR_HEIGHT * scale - 12 }}
            aria-label={avatarStatusLabel(status)}
          >
            <StatusDot status={status} />
          </div>
        ) : null}
        {status === 'away' ? (
          // Away: a slow Zz rising over the head (a CSS loop, still under reduced motion).
          <div
            aria-hidden
            className="animate-avatar-zz pointer-events-none absolute text-[11px] font-bold italic text-slate-400"
            style={{
              left: box.offsetX + 8 * scale,
              top: box.offsetY - AVATAR_HEIGHT * scale - 24,
            }}
          >
            Zz
          </div>
        ) : null}
        <div style={status === 'away' ? { opacity: AWAY_OPACITY } : undefined}>
          <AvatarSprite
            headphones={status === 'focus'}
            facing={facing}
            config={config}
            walking={walking}
            stepFrame={stepFrame}
            lift={lift}
            wave={wave}
            pose={pose}
            seated={seated}
            shirt={shirt}
            scale={scale}
          />
        </div>
        {/* Stand (docs/specs/009-elements/chair.md). Arrow keys and a double-click both get you out of
            a chair, and neither exists on a touch device — so the seat carries
            its own press. Only for your OWN character: you cannot stand
            somebody else up. */}
        {seated && onStand ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onStand();
            }}
            className="pointer-events-auto absolute left-1/2 top-full -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm"
          >
            Stand
          </button>
        ) : null}
      </div>
    </>
  );
}
