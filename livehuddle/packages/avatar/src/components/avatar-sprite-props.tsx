// What the pixel character holds or wears over its outfit (./avatar-sprite): a held drink, headphones and the
// waved flag.
import type { DrinkKind } from '../office-geometry';
import { FLAG_CLOTH, FLAG_POLE, SKIN } from './avatar-sprite-palette';

// --- A held drink -------------------------------------------------------------

const CUP_WHITE = '#f8fafc';
const CUP_EDGE = '#94a3b8';
const DRINK_TOP: Record<DrinkKind, string> = {
  water: '#7dd3fc',
  coffee: '#78350f',
  // livehuddle's bar (its docs/specs/009-elements/office.md "Drinks Cabinet, Drinks Fridge").
  juice: '#fb923c',
  soda: '#ef4444',
};

// A cup in the hand (docs/specs/009-elements/office.md "Using it"): water or coffee, lifted for a sip every few
// seconds, a coffee steaming. In the right hand from the front, the one visible hand in profile; from behind it
// is half hidden by the body, as a hand would be. The loops are CSS (globals.css), still under reduced motion.
export function HeldCup({
  kind,
  profile,
  back,
}: {
  kind: DrinkKind;
  profile: boolean;
  back: boolean;
}) {
  const x = profile ? 2 : 13;
  const y = profile ? 12 : 11;
  return (
    <g className="animate-avatar-sip" style={{ transformBox: 'fill-box' }} opacity={back ? 0.7 : 1}>
      {kind === 'coffee' ? (
        <g className="animate-avatar-steam">
          <rect x={x + 1} y={y - 3} width={1} height={2} fill="#cbd5e1" />
          <rect x={x + 2} y={y - 4} width={1} height={2} fill="#cbd5e1" />
        </g>
      ) : null}
      <rect x={x} y={y} width={3} height={4} fill={CUP_WHITE} />
      <rect x={x} y={y} width={3} height={1} fill={DRINK_TOP[kind]} />
      <rect x={x} y={y + 3} width={3} height={1} fill={CUP_EDGE} />
      {kind === 'coffee' ? <rect x={x + 3} y={y + 1} width={1} height={2} fill={CUP_EDGE} /> : null}
      <rect x={profile ? x + 2 : x - 1} y={y + 2} width={2} height={2} fill={SKIN} />
    </g>
  );
}

// --- Headphones ---------------------------------------------------------------

const PHONES_BAND = '#334155';
const PHONES_CUP = '#8b5cf6';

// Focusing (docs/specs/008-canvas/avatar-mode.md "Status"): a band over the head and an ear cup either side (one
// in profile), drawn over the hair.
export function Headphones({ profile }: { profile: boolean }) {
  return profile ? (
    <g>
      <rect x={6} y={0} width={4} height={1} fill={PHONES_BAND} />
      <rect x={9} y={0} width={1} height={4} fill={PHONES_BAND} />
      <rect x={8} y={4} width={3} height={3} fill={PHONES_CUP} />
    </g>
  ) : (
    <g>
      <rect x={4} y={0} width={8} height={1} fill={PHONES_BAND} />
      <rect x={3} y={1} width={1} height={3} fill={PHONES_BAND} />
      <rect x={12} y={1} width={1} height={3} fill={PHONES_BAND} />
      <rect x={2} y={4} width={2} height={3} fill={PHONES_CUP} />
      <rect x={12} y={4} width={2} height={3} fill={PHONES_CUP} />
    </g>
  );
}

// --- Flag -------------------------------------------------------------------

// An arm raised above the head holding a pole, with a cloth that snaps through
// three frames. Drawn last so it sits in front of the body, and drawn UP into
// the box's reserved headroom / side slack so nothing clips at the grid edges.
export function Flag({ frame }: { frame: number }) {
  const cloth =
    frame === 0
      ? 'M14 -6 h4 v3 h-4 Z'
      : frame === 1
        ? 'M14 -6 h5 v2 h-2 v2 h-3 Z'
        : 'M14 -5 h5 v3 h-5 Z';
  return (
    <g>
      <rect x={12} y={4} width={2} height={6} fill={SKIN} />
      <rect x={12} y={2} width={2} height={2} fill={SKIN} />
      <rect x={13} y={-7} width={1} height={10} fill={FLAG_POLE} />
      <path d={cloth} fill={FLAG_CLOTH} />
    </g>
  );
}
