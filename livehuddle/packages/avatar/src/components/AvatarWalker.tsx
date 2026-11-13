// The Avatar-mode character's placement (docs/specs/008-canvas/avatar-mode.md): where the sprite sits in
// canvas coords, the "you are here" ring under it, and a peer's name chip.
// The pixel art itself lives in avatar-sprite.tsx.
//
// It lives INSIDE the canvas's transformed wrapper, so it pans / zooms with the
// canvas; its position is the FEET, so it stands on the point you clicked. The
// same component draws PEERS' characters (from their presence snapshot), which
// is why every animation input is a prop rather than read from the walk hook.

import { memo, useLayoutEffect, useRef } from 'react';
import type { DrinkKind } from '../office-geometry';
import { avatarGlides } from '../relay';
import { avatarStatusColour, avatarStatusLabel, type AvatarStatus } from '../status';
import { IDENTITY_FILL } from '@liveworkspace/ui/identity-fill';
import { avatarBindings } from '../bindings';
import { AVATAR_FALLBACK_COLOUR, avatarScale, type AvatarConfig } from '../config';
import type { AvatarFacing } from '../walk';
import {
  AVATAR_HEIGHT,
  AVATAR_NAME_CHIP_RISE,
  AVATAR_STATUS_CHIP_RISE,
  AVATAR_ZZ_RISE,
  avatarBox,
} from '../walk';
import { AvatarSprite } from './avatar-sprite';
import { propsEqualByField } from './props-equal';
import { avatarStatusHeadroomPx } from './avatar-status-effects';
import { chipNeedsMeasure, chipWidthKey, reportChipWidth } from '../chip-widths';

// An Away character fades to half (docs/specs/008-canvas/avatar-mode.md "Status").
const AWAY_OPACITY = 0.5;

// A status dot: a small circle in the status's colour with a white rim, so it reads on a name chip and on the canvas.
// Do Not Disturb (livehuddle's calls status) is a touch larger with a white bar across it, the sign everyone knows.
export function StatusDot({ status }: { status: AvatarStatus }) {
  if (status === 'dnd') {
    return (
      <span
        aria-hidden
        data-status-dot="dnd"
        className="relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full ring-[1.5px] ring-white"
        style={{ backgroundColor: avatarStatusColour(status) }}
      >
        <span className="block h-[2px] w-[6px] rounded-full bg-white" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 shrink-0 rounded-full ring-[1.5px] ring-white"
      style={{ backgroundColor: avatarStatusColour(status) }}
    />
  );
}

function AvatarWalkerView({
  pos,
  facing,
  config,
  walking,
  stepFrame,
  lift = 0,
  wave = null,
  pose = null,
  seated = false,
  holding = null,
  shirt,
  standingOn,
  name,
  self = false,
  host = false,
  status = null,
  glideMs = 0,
  chipShift = 0,
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
  pose?: import('../reactions').ReactionPose | null;
  // Chair (docs/specs/009-elements/chair.md): this character is sitting on one, so it draws seated.
  seated?: boolean;
  // A drink in the hand (docs/specs/009-elements/office.md "Using it"), or none.
  holding?: DrinkKind | null;
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
  // Your own character rather than a peer's (the e2e and the Avatar tour find it by `data-avatar="self"`).
  self?: boolean;
  // A character nobody plays (livehuddle's Receptionist): marked `data-avatar="host"`, so nothing counting people's
  // characters by `data-avatar="peer"` counts it.
  host?: boolean;
  // How the person is (docs/specs/008-canvas/avatar-mode.md "Status"), or none.
  status?: AvatarStatus | null;
  // A peer's character in a busy room (docs/specs/008-canvas/avatar-mode.md "A busy room"): how long it slides to
  // each new position while it walks (avatarGlideMs), or 0 to draw each packet where it lands.
  glideMs?: number;
  // How far the chip over the head moves sideways, in canvas px, so a seated neighbour's chip never covers it
  // (docs/specs/008-canvas/avatar-mode.md "Seated neighbours' chips never cover each other"; seatedChipShifts).
  chipShift?: number;
}) {
  // A transform on top of the chip's centring (the `translate` of -translate-x-1/2), so the two add up.
  const chipMove = chipShift ? `translateX(${chipShift}px)` : undefined;
  const chip = useChipMeasure(name, status ? avatarStatusLabel(status) : null);
  const scale = avatarScale(config.size);
  const box = avatarBox(scale);
  // A status worn over the head (a party hat, a "?", a thought bubble) lifts the chip clear of it.
  const headroom = avatarStatusHeadroomPx(status, config.hair, scale);
  // The glide is a CSS transition on the box, set (or cleared) before the browser styles the new position, so a
  // walking step slides and a jump (a portal, a pad, a seat) lands at once. Written to the element rather than the
  // style prop: whether a move glides depends on where the character stood before it.
  const placed = useRef<HTMLDivElement>(null);
  const from = useRef(pos);
  // By coordinates: a caller hands a fresh `pos` each render, and a render for anything else must not re-judge the glide.
  const { x, y } = pos;
  useLayoutEffect(() => {
    const el = placed.current;
    const at = { x, y };
    const glides = avatarGlides(from.current, at, glideMs, walking);
    from.current = at;
    if (el) el.style.transition = glides ? `transform ${glideMs}ms linear` : '';
  }, [x, y, glideMs, walking]);
  return (
    <>
      {/* The status for a screen reader (docs/specs/008-canvas/avatar-mode.md "Status"): the character itself is
          hidden from assistive tech, so its status is said here, with the name when it is a peer's. */}
      {status ? (
        <span className="sr-only">
          {name
            ? `${name}, ${avatarStatusLabel(status)}`
            : `Your status: ${avatarStatusLabel(status)}`}
        </span>
      ) : null}
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
        ref={placed}
        aria-hidden
        data-avatar={self ? 'self' : host ? 'host' : 'peer'}
        // Your own character is the Avatar tour's push step's anchor (docs/specs/008-canvas/avatar-tour.md).
        data-tour-id={self ? 'avatar-self' : undefined}
        data-seated={seated ? '' : undefined}
        className="pointer-events-none absolute"
        style={{
          // The box is bigger than the figure: it reserves headroom above for
          // the hop and slack either side for the waved flag (see avatarBox),
          // so placing it means offsetting from the feet rather than the
          // sprite's own corner. The contact shadow stays on the ground while
          // the body rises.
          // Placed by a transform from the canvas's corner, never by left and top: a step then moves the box
          // without laying the page out (docs/specs/008-canvas/canvas-performance.md "Walking renders the
          // characters, not the canvas"), and a peer's glide is a transition of it.
          left: 0,
          top: 0,
          transform: `translate(${pos.x - box.offsetX}px, ${pos.y - box.offsetY}px)`,
          width: box.width,
          height: box.height,
        }}
      >
        {name ? (
          <div
            ref={chip}
            className={`absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 overflow-hidden rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white ${status ? 'max-w-[180px]' : 'max-w-[120px]'} ${IDENTITY_FILL}`}
            // Pinned just above the HEAD, not the (headroom-extended) box, and
            // tracking the size choice so it hugs a small character too.
            style={{
              ...avatarBindings.identityVars(shirt ?? AVATAR_FALLBACK_COLOUR),
              top: box.offsetY - AVATAR_HEIGHT * scale - AVATAR_NAME_CHIP_RISE - headroom,
              transform: chipMove,
            }}
          >
            {status ? <StatusDot status={status} /> : null}
            {/* Its own box, so a long name ends in an ellipsis: a flex item's bare text cannot. */}
            <span className="min-w-0 truncate">{name}</span>
            {status ? (
              // The dot's label ("Status": every dot is labelled): whole, the name gives way first.
              <span aria-hidden className="shrink-0 whitespace-nowrap font-medium opacity-90">
                · {avatarStatusLabel(status)}
              </span>
            ) : null}
          </div>
        ) : status ? (
          // Your own character has no name chip: its labelled status sits where the chip would be, on a quiet chip.
          <div
            ref={chip}
            data-own-status
            className="absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-700"
            style={{
              top: box.offsetY - AVATAR_HEIGHT * scale - AVATAR_STATUS_CHIP_RISE - headroom,
              transform: chipMove,
            }}
          >
            <StatusDot status={status} />
            <span aria-hidden>{avatarStatusLabel(status)}</span>
          </div>
        ) : null}
        {status === 'away' ? (
          // Away: a slow Zz rising over the head (a CSS loop, still under reduced motion).
          <div
            aria-hidden
            className="animate-avatar-zz pointer-events-none absolute z-10 text-[11px] font-bold italic text-slate-500 dark:text-slate-400"
            style={{
              left: box.offsetX + 8 * scale,
              top: box.offsetY - AVATAR_HEIGHT * scale - AVATAR_ZZ_RISE,
            }}
          >
            Zz
          </div>
        ) : null}
        <div style={status === 'away' ? { opacity: AWAY_OPACITY } : undefined}>
          <AvatarSprite
            headphones={status === 'focus'}
            status={status}
            facing={facing}
            config={config}
            walking={walking}
            stepFrame={stepFrame}
            lift={lift}
            wave={wave}
            pose={pose}
            seated={seated}
            holding={holding}
            shirt={shirt}
            scale={scale}
          />
        </div>
      </div>
    </>
  );
}

// The chip's width for the spread (chip-widths.ts): measured once per name and status, after layout, in CSS px before
// the canvas's zoom, and once more when the web fonts land (a chip laid out in the fallback font measures narrower or
// wider). A chip already measured anywhere is not read again, so a room of walkers lays nothing out per frame.
function useChipMeasure(name: string | undefined, status: string | null) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || (!name && !status)) return;
    const key = chipWidthKey(name, status);
    if (chipNeedsMeasure(key)) reportChipWidth(key, el.offsetWidth);
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    if (!fonts || fonts.status === 'loaded') return;
    let live = true;
    void fonts.ready.then(() => {
      if (live && ref.current) reportChipWidth(key, ref.current.offsetWidth);
    });
    return () => {
      live = false;
    };
  }, [name, status]);
  return ref;
}

type WalkerProps = Parameters<typeof AvatarWalkerView>[0];

// The props equal when each is the same value, or a plain object (pos, config, pose, standingOn) with the same fields:
// callers build those afresh every render (a peer's position and parsed costume from their latest packet).
export const walkerPropsEqual: (prev: WalkerProps, next: WalkerProps) => boolean =
  propsEqualByField;

// Memoised: a room's presence flush re-renders the layer that maps every peer, and only the peers who moved, turned
// or changed costume need their sprite (a few hundred SVG nodes) drawn again.
export const AvatarWalker = memo(AvatarWalkerView, walkerPropsEqual);
