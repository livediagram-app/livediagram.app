// Each status's signature on the Avatar-mode character (docs/specs/008-canvas/avatar-mode.md "Status"), in the spirit
// of Focusing's headphones (which stay in avatar-sprite.tsx): a sparkle, a "?", a headset, a sandwich, a no-entry
// sign, steam from the ears, a party hat and confetti, a thought bubble, an ice pack, a water bottle, a phone. Drawn on the sprite's own
// 16 x 24 grid inside its body group, so a signature bobs with the walk, rises with a hop, drops with a sitter and
// mirrors with a right-facing profile.
//
// Motion is CSS only (../status-effects.css): a few rects per loop, each a stepped keyframe so the pixels move whole,
// and none of it a timer per character. A status with no loop renders no animated node at all. Every loop's resting
// frame is the art as drawn here, which is what reduced motion holds.
//
// Animated groups never carry a `transform` attribute: the CSS transform would replace it.

import type { AvatarConfig } from '../config';
import type { AvatarStatus } from '../status';
import { AVATAR_GRID_HEIGHT, AVATAR_HEIGHT } from '../walk';
import { EYE, SKIN } from './avatar-sprite-palette';

export type AvatarStatusView = 'front' | 'back' | 'profile';

// --- Where the head ends ------------------------------------------------------

// The top row each hairstyle reaches (avatar-sprite-head.tsx), so what sits on or over the head (the hat, the "?",
// the bubble) clears a tall style rather than vanishing into it. Every style not listed tops out at row 0.
const HAIR_TOP: Partial<Record<AvatarConfig['hair'], number>> = {
  afro: -3,
  mohawk: -3,
  spiky: -3,
  bun: -3,
  topknot: -4,
  curly: -2,
};

function hairTop(hair: AvatarConfig['hair']): number {
  return HAIR_TOP[hair] ?? 0;
}

// How far above the head each over-the-head signature reaches, in sprite pixels above the hair's top (its loop's
// highest frame included). The rest stay beside the head, below the name chip.
const REACH: Partial<Record<AvatarStatus, number>> = {
  celebrating: 5,
  help: 7,
  thinking: 7,
  sick: 1,
};

// One sprite pixel, in canvas px at size 1 (walk.ts's grid unit).
const UNIT_PX = (AVATAR_HEIGHT + 4) / AVATAR_GRID_HEIGHT;

/** The px a name or status chip rises by so it clears this status's signature over the head (0 for most). */
export function avatarStatusHeadroomPx(
  status: AvatarStatus | null,
  hair: AvatarConfig['hair'],
  scale: number,
): number {
  const reach = status ? REACH[status] : undefined;
  if (reach === undefined) return 0;
  // The chip normally sits on the head's top row; one row of air above the signature's highest pixel.
  return (reach - hairTop(hair) + 1) * UNIT_PX * scale;
}

/** Whether this status draws past the sprite's box at the top or side (so a cropped portrait must not clip it). */
export function avatarStatusOverflows(status: AvatarStatus | null): boolean {
  return status !== null && status !== 'focus' && status !== 'away';
}

// --- Colours ------------------------------------------------------------------

const STEAM = '#e2e8f0';
const STEAM_EDGE = '#94a3b8';
const FLUSH = '#ef4444';
const SICK_TINT = '#84cc16';
const ICE = '#bae6fd';
const ICE_DARK = '#38bdf8';
const SPARKLE = '#22c55e';
const SPARKLE_CORE = '#86efac';
const QUERY = '#f59e0b';
const QUERY_SHADOW = '#92400e';
const HEADSET = '#334155';
const HEADSET_CUP = '#475569';
const LIVE = '#ef4444';
const NO_ENTRY = '#e11d48';
const WHITE = '#ffffff';
const HAT = '#ec4899';
const HAT_DARK = '#be185d';
const HAT_STRIPE = '#facc15';
const HAT_STRIPE_DARK = '#ca8a04';
const POM = '#fef08a';
const CONFETTI = ['#ec4899', '#facc15', '#38bdf8', '#4ade80'] as const;
const BUBBLE_EDGE = '#64748b';
const BUBBLE = '#ffffff';
const BREAD = '#e8b066';
const BREAD_DARK = '#c2843f';
const LETTUCE = '#65a30d';
const BOTTLE = '#60a5fa';
const BOTTLE_DARK = '#2563eb';
const BOTTLE_CAP = '#e2e8f0';
const PHONE = '#1f2937';
const PHONE_SCREEN = '#fbbf24';

// --- Pieces -------------------------------------------------------------------

/** A puff of steam, rising and drifting outward from an ear (Angry): a little pixel cloud with a shaded underside. */
function Puff({ x, y, side, late }: { x: number; y: number; side: 'l' | 'r'; late?: boolean }) {
  return (
    <g className={`avatar-status-steam-${side}${late ? ' avatar-status-late' : ''}`}>
      <rect x={x + 1} y={y} width={2} height={1} fill={STEAM} />
      <rect x={x} y={y + 1} width={4} height={1} fill={STEAM} />
      <rect x={x + 1} y={y + 1} width={2} height={1} fill={WHITE} />
      <rect x={x + 1} y={y + 2} width={2} height={1} fill={STEAM_EDGE} />
    </g>
  );
}

/** The jet a puff leaves the ear by: two still pixels, so the steam reads as coming from the head. */
function Jet({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y} width={1} height={1} fill={STEAM} />
      <rect x={x} y={y + 1} width={1} height={1} fill={STEAM_EDGE} />
    </>
  );
}

function Angry({ view }: { view: AvatarStatusView }) {
  if (view === 'profile') {
    return (
      <g data-status-effect="angry">
        <rect x={3} y={6} width={5} height={2} fill={FLUSH} opacity={0.35} />
        <rect x={4} y={4} width={1} height={1} fill={EYE} />
        <rect x={5} y={3} width={1} height={1} fill={EYE} />
        {/* The one ear in view, behind the face: the steam rises off the back of the head. */}
        <Jet x={13} y={4} />
        <Puff x={13} y={1} side="r" />
        <Puff x={15} y={-2} side="r" late />
      </g>
    );
  }
  return (
    <g data-status-effect="angry">
      {view === 'front' ? (
        <>
          <rect x={4} y={6} width={8} height={2} fill={FLUSH} opacity={0.35} />
          {/* Brows drawn down to the nose, a V over the eyes. */}
          <rect x={5} y={3} width={1} height={1} fill={EYE} />
          <rect x={6} y={4} width={1} height={1} fill={EYE} />
          <rect x={10} y={3} width={1} height={1} fill={EYE} />
          <rect x={9} y={4} width={1} height={1} fill={EYE} />
        </>
      ) : null}
      <Jet x={2} y={5} />
      <Jet x={13} y={5} />
      <Puff x={-1} y={2} side="l" />
      <Puff x={-3} y={-1} side="l" late />
      <Puff x={13} y={2} side="r" />
      <Puff x={15} y={-1} side="r" late />
    </g>
  );
}

/** A green twinkle by the head (Available): a big star and a small one taking turns. */
function Sparkle() {
  return (
    <g data-status-effect="available">
      <g className="avatar-status-blink">
        <rect x={15} y={1} width={1} height={5} fill={SPARKLE} />
        <rect x={13} y={3} width={5} height={1} fill={SPARKLE} />
        <rect x={15} y={3} width={1} height={1} fill={SPARKLE_CORE} />
      </g>
      <g className="avatar-status-blink avatar-status-late">
        <rect x={15} y={2} width={1} height={3} fill={SPARKLE} />
        <rect x={14} y={3} width={3} height={1} fill={SPARKLE} />
      </g>
    </g>
  );
}

/** A pixel "?" over the head (Need Help), bobbing a pixel. Drawn twice, the shadow a pixel down and right. */
function Query({ top }: { top: number }) {
  const y = top - 6;
  const glyph = (dx: number, fill: string) => (
    <>
      <rect x={7 + dx} y={y + dx} width={2} height={1} fill={fill} />
      <rect x={6 + dx} y={y + 1 + dx} width={1} height={1} fill={fill} />
      <rect x={9 + dx} y={y + 1 + dx} width={1} height={2} fill={fill} />
      <rect x={8 + dx} y={y + 2 + dx} width={1} height={2} fill={fill} />
      <rect x={8 + dx} y={y + 5 + dx} width={1} height={1} fill={fill} />
    </>
  );
  return (
    <g data-status-effect="help" className="avatar-status-bob">
      {glyph(1, QUERY_SHADOW)}
      {glyph(0, QUERY)}
    </g>
  );
}

/** A slim headset with a mic boom to the mouth and a red live tip (In a Meeting); still. */
function Headset({ view }: { view: AvatarStatusView }) {
  if (view === 'profile') {
    return (
      <g data-status-effect="meeting">
        <rect x={6} y={0} width={4} height={1} fill={HEADSET} />
        <rect x={9} y={0} width={1} height={4} fill={HEADSET} />
        <rect x={8} y={4} width={2} height={3} fill={HEADSET_CUP} />
        <rect x={4} y={7} width={5} height={1} fill={HEADSET} />
        <rect x={3} y={7} width={1} height={1} fill={LIVE} />
      </g>
    );
  }
  return (
    <g data-status-effect="meeting">
      <rect x={4} y={0} width={8} height={1} fill={HEADSET} />
      <rect x={3} y={1} width={1} height={3} fill={HEADSET} />
      <rect x={12} y={1} width={1} height={3} fill={HEADSET} />
      <rect x={2} y={4} width={2} height={2} fill={HEADSET_CUP} />
      <rect x={12} y={4} width={2} height={2} fill={HEADSET_CUP} />
      {view === 'front' ? (
        <>
          {/* The boom from the right cup, round the chin to the mouth. */}
          <rect x={13} y={6} width={1} height={2} fill={HEADSET} />
          <rect x={10} y={8} width={4} height={1} fill={HEADSET} />
          <rect x={9} y={8} width={1} height={1} fill={LIVE} />
        </>
      ) : (
        // From behind, the boom's root on the far side, the rest hidden by the head.
        <rect x={2} y={6} width={1} height={2} fill={HEADSET} />
      )}
    </g>
  );
}

/** A red no-entry sign floating beside the head (Do Not Disturb); still. */
function NoEntry() {
  return (
    <g data-status-effect="dnd">
      <rect x={14} y={2} width={3} height={1} fill={NO_ENTRY} />
      <rect x={13} y={3} width={5} height={3} fill={NO_ENTRY} />
      <rect x={14} y={6} width={3} height={1} fill={NO_ENTRY} />
      <rect x={14} y={4} width={3} height={1} fill={WHITE} />
    </g>
  );
}

/** A striped party hat on the hair and confetti falling round the head (Celebrating). */
function Party({ view, top }: { view: AvatarStatusView; top: number }) {
  // In profile the head is a pixel narrower, its crown a pixel further left.
  const dx = view === 'profile' ? -1 : 0;
  const row = (y: number, x: number, w: number, fill: string, dark: string) => (
    <>
      <rect x={x + dx} y={y} width={w} height={1} fill={fill} />
      <rect x={x + dx + w - 1} y={y} width={1} height={1} fill={dark} />
    </>
  );
  return (
    <g data-status-effect="celebrating">
      {row(top, 5, 6, HAT, HAT_DARK)}
      {row(top - 1, 6, 4, HAT_STRIPE, HAT_STRIPE_DARK)}
      {row(top - 2, 6, 4, HAT, HAT_DARK)}
      {row(top - 3, 7, 2, HAT_STRIPE, HAT_STRIPE_DARK)}
      {row(top - 4, 7, 2, HAT, HAT_DARK)}
      <rect x={7 + dx} y={top - 5} width={2} height={1} fill={POM} />
      {(
        [
          [1, top - 1],
          [14, top - 2],
          [0, 4],
          [15, 5],
        ] as const
      ).map(([x, y], i) => (
        <rect
          key={i}
          className={`avatar-status-fall avatar-status-fall-${i}`}
          x={x}
          y={y}
          width={1}
          height={2}
          fill={CONFETTI[i]}
        />
      ))}
    </g>
  );
}

/** A thought bubble up and to the side of the head, its three dots lighting in turn (Thinking). */
function Thought({ top }: { top: number }) {
  const y = top - 7;
  return (
    <g data-status-effect="thinking">
      <rect x={10} y={top - 1} width={1} height={1} fill={BUBBLE_EDGE} />
      <rect x={11} y={top - 2} width={1} height={1} fill={BUBBLE_EDGE} />
      <rect x={13} y={y} width={7} height={1} fill={BUBBLE_EDGE} />
      <rect x={12} y={y + 1} width={9} height={3} fill={BUBBLE_EDGE} />
      <rect x={13} y={y + 4} width={7} height={1} fill={BUBBLE_EDGE} />
      <rect x={13} y={y + 1} width={7} height={3} fill={BUBBLE} />
      {[14, 16, 18].map((x, i) => (
        <rect
          key={x}
          className={`avatar-status-dot avatar-status-dot-${i}`}
          x={x}
          y={y + 2}
          width={1}
          height={1}
          fill={BUBBLE_EDGE}
        />
      ))}
    </g>
  );
}

/** A green tinge, an ice pack on the head and a bead of sweat (Feeling Sick); still. */
function Sick({ view, top }: { view: AvatarStatusView; top: number }) {
  // In profile the head is a pixel narrower, its crown a pixel further left.
  const dx = view === 'profile' ? -1 : 0;
  return (
    <g data-status-effect="sick">
      {view === 'front' ? (
        <rect x={4} y={3} width={8} height={6} fill={SICK_TINT} opacity={0.3} />
      ) : view === 'profile' ? (
        <rect x={3} y={3} width={7} height={6} fill={SICK_TINT} opacity={0.3} />
      ) : null}
      {/* The ice pack, slumped over the crown: a pale bag with a darker fold and a glint. */}
      <rect x={5 + dx} y={top - 1} width={6} height={1} fill={ICE} />
      <rect x={4 + dx} y={top} width={8} height={1} fill={ICE} />
      <rect x={4 + dx} y={top + 1} width={8} height={1} fill={ICE_DARK} />
      <rect x={6 + dx} y={top - 1} width={1} height={1} fill={WHITE} />
      {view === 'back' ? null : (
        <rect x={view === 'profile' ? 2 : 12} y={3} width={1} height={2} fill={ICE_DARK} />
      )}
    </g>
  );
}

/** A sandwich in the hand, lifted for a bite every few seconds (Out to Lunch); where the held cup goes. */
function Sandwich({ view }: { view: AvatarStatusView }) {
  const profile = view === 'profile';
  const x = profile ? 1 : 13;
  const y = 11;
  return (
    <g data-status-effect="lunch" opacity={view === 'back' ? 0.7 : 1}>
      <g className="avatar-status-bite">
        <rect x={x} y={y} width={4} height={1} fill={BREAD} />
        <rect x={x} y={y + 1} width={4} height={1} fill={LETTUCE} />
        <rect x={x} y={y + 2} width={4} height={1} fill={BREAD_DARK} />
        <rect x={profile ? x + 3 : x - 1} y={y + 1} width={2} height={2} fill={SKIN} />
      </g>
    </g>
  );
}

/** A water bottle in the hand (On a Break), where the held cup goes; still. */
function Bottle({ view }: { view: AvatarStatusView }) {
  const profile = view === 'profile';
  const x = profile ? 2 : 13;
  const y = 9;
  return (
    <g data-status-effect="break" opacity={view === 'back' ? 0.7 : 1}>
      <rect x={x} y={y} width={2} height={1} fill={BOTTLE_CAP} />
      <rect x={x} y={y + 1} width={2} height={4} fill={BOTTLE} />
      <rect x={x + 1} y={y + 1} width={1} height={4} fill={BOTTLE_DARK} />
      <rect x={profile ? x + 1 : x - 1} y={y + 3} width={2} height={2} fill={SKIN} />
    </g>
  );
}

/** A phone held to the ear (Busy), its screen's edge lit; still. From behind, only its edge past the head. */
function Phone({ view }: { view: AvatarStatusView }) {
  if (view === 'profile') {
    return (
      <g data-status-effect="busy">
        <rect x={8} y={3} width={2} height={5} fill={PHONE} />
        <rect x={10} y={4} width={1} height={3} fill={PHONE_SCREEN} />
        <rect x={9} y={8} width={2} height={2} fill={SKIN} />
      </g>
    );
  }
  return (
    <g data-status-effect="busy">
      <rect x={view === 'front' ? 12 : 2} y={3} width={2} height={5} fill={PHONE} />
      {view === 'front' ? (
        <>
          <rect x={14} y={4} width={1} height={3} fill={PHONE_SCREEN} />
          <rect x={13} y={8} width={2} height={2} fill={SKIN} />
        </>
      ) : null}
    </g>
  );
}

/**
 * The status's signature, for the sprite to draw inside its body group after the head. `handFree` is false while a
 * drink, a Behaviour or the flag holds the hand, and the sandwich (or the bottle) waits. Focusing's headphones and Away's fade and
 * Zz are drawn by the sprite and the walker, so those two draw nothing here.
 */
export function AvatarStatusEffect({
  status,
  view,
  hair,
  handFree,
}: {
  status: AvatarStatus;
  view: AvatarStatusView;
  hair: AvatarConfig['hair'];
  handFree: boolean;
}) {
  const top = hairTop(hair);
  switch (status) {
    case 'available':
      return <Sparkle />;
    case 'help':
      return <Query top={top} />;
    case 'meeting':
      return <Headset view={view} />;
    case 'lunch':
      return handFree ? <Sandwich view={view} /> : null;
    case 'dnd':
      return <NoEntry />;
    case 'angry':
      return <Angry view={view} />;
    case 'celebrating':
      return <Party view={view} top={top} />;
    case 'thinking':
      return <Thought top={top} />;
    case 'sick':
      return <Sick view={view} top={top} />;
    case 'break':
      return handFree ? <Bottle view={view} /> : null;
    case 'busy':
      return <Phone view={view} />;
    default:
      return null;
  }
}
