// The pixel character's body below the head (./avatar-sprite draws the whole figure): its legs, front and in
// profile, bare or dressed, its arms for each pose, and its torso. The head is ./avatar-sprite-head.
import type { AvatarConfig } from '../config';
import { BARE_LEG_CLOTHING } from '../config';
import type { ReactionPose } from '../reactions';
import {
  OutfitBack,
  OutfitFront,
  OutfitLowerFront,
  OutfitLowerProfile,
  OutfitProfile,
  type ClothPair,
  type OutfitLook,
  type SleeveLook,
} from './avatar-sprite-outfit';
import { SHOE, SKIN, SKIN_DARK, type OutfitTones } from './avatar-sprite-palette';

// --- Legs -------------------------------------------------------------------

// A trousered leg: a column with a shoe at the bottom. `lift` raises the whole
// leg by a pixel for the mid-stride frame. `cloth` is the outfit's legs
// (trousers, a suit's matching cloth, overall denim).
function Leg({
  x,
  cloth,
  lift = 0,
  seated = false,
}: {
  x: number;
  cloth: ClothPair;
  lift?: number;
  seated?: boolean;
}) {
  // Seated (docs/specs/009-elements/chair.md): the thigh goes AWAY from the viewer, so from the front
  // it is a short stub, and the shin drops in front of it to a foot planted
  // forward. Two rows shorter overall, which is what makes the silhouette read
  // as folded rather than standing.
  if (seated) {
    return (
      <g transform={`translate(0 ${-lift})`}>
        {/* Thigh: one row, wide, foreshortened. */}
        <rect x={x - 1} y={16} width={5} height={2} fill={cloth.base} />
        <rect x={x + 3} y={16} width={1} height={2} fill={cloth.dark} />
        {/* Shin, dropping to the floor in front of the seat. */}
        <rect x={x} y={18} width={3} height={3} fill={cloth.dark} />
        <rect x={x} y={21} width={3} height={2} fill={SHOE} />
      </g>
    );
  }
  return (
    <g transform={`translate(0 ${-lift})`}>
      <rect x={x} y={15} width={3} height={6} fill={cloth.base} />
      <rect x={x + 2} y={15} width={1} height={6} fill={cloth.dark} />
      <rect x={x} y={21} width={3} height={2} fill={SHOE} />
    </g>
  );
}

// A bare leg, worn under the dress and the skirt (each hem covers its top).
function BareLeg({ x, lift = 0, seated = false }: { x: number; lift?: number; seated?: boolean }) {
  if (seated) {
    return (
      <g transform={`translate(0 ${-lift})`}>
        <rect x={x - 1} y={17} width={4} height={2} fill={SKIN} />
        <rect x={x} y={19} width={2} height={2} fill={SKIN} />
        <rect x={x} y={21} width={2} height={2} fill={SHOE} />
      </g>
    );
  }
  return (
    <g transform={`translate(0 ${-lift})`}>
      <rect x={x} y={16} width={2} height={5} fill={SKIN} />
      <rect x={x} y={21} width={2} height={2} fill={SHOE} />
    </g>
  );
}

// The lower half, front / back view: legs in the outfit's cloth (or bare under
// a dress / skirt), then whatever the outfit wears below the waist.
export function LowerFront({
  clothing,
  tones,
  legs,
  inset,
  back,
  mid,
  walking,
  airborne,
  legsApart,
  seated = false,
}: {
  clothing: AvatarConfig['clothing'];
  tones: OutfitTones;
  legs: ClothPair;
  inset: number;
  back: boolean;
  mid: boolean;
  walking: boolean;
  airborne: boolean;
  // Mid-jumping-jack: legs splayed rather than striding.
  legsApart: boolean;
  // Sitting (docs/specs/009-elements/chair.md): knees apart and the legs drawn folded.
  seated?: boolean;
}) {
  const strideLift = walking && !airborne;
  // Splayed stance for a jack; otherwise the two legs sit under the body. The
  // split is wide (right out to the sprite's edges) because at canvas size a
  // one-pixel stagger doesn't read as a jumping jack at all.
  // Seated: knees a touch apart, which is what a person sitting looks like
  // from the front and also stops the two folded legs merging into one block.
  const leftX = legsApart ? 1 : seated ? 4 : 5;
  const rightX = legsApart ? 12 : seated ? 10 : 9;
  const leftLift = legsApart ? 0 : mid && strideLift ? 1 : 0;
  const rightLift = legsApart ? 0 : !mid && strideLift ? 1 : 0;
  const bare = BARE_LEG_CLOTHING.has(clothing);
  return (
    <>
      {bare ? (
        <>
          <BareLeg x={leftX} lift={leftLift} seated={seated} />
          <BareLeg x={rightX} lift={rightLift} seated={seated} />
        </>
      ) : (
        <>
          <Leg x={leftX} cloth={legs} lift={leftLift} seated={seated} />
          <Leg x={rightX} cloth={legs} lift={rightLift} seated={seated} />
        </>
      )}
      <OutfitLowerFront clothing={clothing} t={tones} inset={inset} back={back} />
    </>
  );
}

// The lower half in profile: one leg forward, one back.
export function LowerProfile({
  clothing,
  tones,
  legs,
  mid,
  walking,
  airborne,
  seated = false,
}: {
  clothing: AvatarConfig['clothing'];
  tones: OutfitTones;
  legs: ClothPair;
  mid: boolean;
  walking: boolean;
  airborne: boolean;
  seated?: boolean;
}) {
  const strideLift = walking && !airborne ? 1 : 0;
  return (
    <>
      {BARE_LEG_CLOTHING.has(clothing) ? (
        <>
          <BareLeg x={mid ? 9 : 7} />
          <BareLeg x={mid ? 6 : 8} lift={strideLift} />
        </>
      ) : (
        <>
          <Leg x={mid ? 8 : 6} cloth={legs} seated={seated} />
          <Leg x={mid ? 5 : 7} cloth={legs} lift={strideLift} seated={seated} />
        </>
      )}
      <OutfitLowerProfile clothing={clothing} t={tones} />
    </>
  );
}

// --- Arms -------------------------------------------------------------------

type Cell = { x: number; y: number; w: number; h: number };

// One arm: four sleeve cells from the shoulder (offset 0) to the wrist (offset
// 3), then the hand. A short sleeve turns the last two cells to skin and a band
// repaints one (a cuff, tipping, a stripe). Consecutive cells of one colour are
// merged into one rect, so a plain long sleeve is still a single rect.
function Arm({
  cells,
  hand,
  sleeve,
  shaded,
  handFill,
}: {
  cells: readonly [Cell, Cell, Cell, Cell];
  hand: Cell;
  sleeve: SleeveLook;
  // The far (right-hand) arm takes the darker tones.
  shaded: boolean;
  // Override for the hand (the raised waving hand is always lit).
  handFill?: string;
}) {
  const cloth = shaded ? sleeve.cloth.dark : sleeve.cloth.base;
  const skin = shaded ? SKIN_DARK : SKIN;
  const fills = cells.map((_, at) => {
    const band = sleeve.bands.find((b) => b.at === at);
    if (band) return band.fill;
    return sleeve.short && at >= 2 ? skin : cloth;
  });
  const runs: { cell: Cell; fill: string }[] = [];
  cells.forEach((cell, at) => {
    const fill = fills[at] as string;
    const last = runs[runs.length - 1];
    if (last && last.fill === fill) {
      const x = Math.min(last.cell.x, cell.x);
      const y = Math.min(last.cell.y, cell.y);
      last.cell = {
        x,
        y,
        w: Math.max(last.cell.x + last.cell.w, cell.x + cell.w) - x,
        h: Math.max(last.cell.y + last.cell.h, cell.y + cell.h) - y,
      };
    } else {
      runs.push({ cell, fill });
    }
  });
  return (
    <g>
      {runs.map(({ cell, fill }) => (
        <rect
          key={`${cell.x},${cell.y}`}
          x={cell.x}
          y={cell.y}
          width={cell.w}
          height={cell.h}
          fill={fill}
        />
      ))}
      <rect x={hand.x} y={hand.y} width={hand.w} height={hand.h} fill={handFill ?? skin} />
    </g>
  );
}

// A hanging arm at column x: sleeve rows 9 to 12, hand 13 to 14.
const down = (x: number): [Cell, Cell, Cell, Cell] => [
  { x, y: 9, w: 2, h: 1 },
  { x, y: 10, w: 2, h: 1 },
  { x, y: 11, w: 2, h: 1 },
  { x, y: 12, w: 2, h: 1 },
];
// A raised arm at column x, its wrist at row `top`: shoulder rows 8 to 9, then up.
const up = (x: number, top: number): [Cell, Cell, Cell, Cell] => [
  { x, y: 8, w: 2, h: 2 },
  { x, y: 7, w: 2, h: 1 },
  { x, y: 6, w: 2, h: 1 },
  { x, y: top, w: 2, h: 6 - top },
];

// The front / back arms. Normally two sleeves swinging in opposition with the
// walk; a reaction (docs/specs/008-canvas/avatar-mode.md) can instead throw
// them straight out to the sides (jumping jacks), raise both (cheer), or raise
// one and swing it (wave / dance). Only one of those is ever set at a time;
// reactionPose guarantees it.
function Arms({
  inset,
  swing,
  sleeve,
  armsOut,
  armsUp,
  waveArm,
  waveOut,
}: {
  inset: number;
  swing: number;
  sleeve: SleeveLook;
  armsOut: boolean;
  armsUp: boolean;
  waveArm: boolean;
  // Which half of the wave's swing we're on: the raised hand crosses in and
  // out rather than just sitting there.
  waveOut: boolean;
}) {
  const left = 2 + inset;
  const right = 12 - inset;
  if (armsOut) {
    return (
      <g>
        <Arm
          cells={[
            { x: 3, y: 9, w: 1, h: 2 },
            { x: 2, y: 9, w: 1, h: 2 },
            { x: 1, y: 9, w: 1, h: 2 },
            { x: 0, y: 9, w: 1, h: 2 },
          ]}
          hand={{ x: -2, y: 9, w: 2, h: 2 }}
          sleeve={sleeve}
          shaded={false}
        />
        <Arm
          cells={[
            { x: 12, y: 9, w: 1, h: 2 },
            { x: 13, y: 9, w: 1, h: 2 },
            { x: 14, y: 9, w: 1, h: 2 },
            { x: 15, y: 9, w: 1, h: 2 },
          ]}
          hand={{ x: 16, y: 9, w: 2, h: 2 }}
          sleeve={sleeve}
          shaded
        />
      </g>
    );
  }
  if (armsUp) {
    return (
      <g>
        <Arm
          cells={up(left, 4)}
          hand={{ x: left, y: 2, w: 2, h: 2 }}
          sleeve={sleeve}
          shaded={false}
        />
        <Arm cells={up(right, 4)} hand={{ x: right, y: 2, w: 2, h: 2 }} sleeve={sleeve} shaded />
      </g>
    );
  }
  if (waveArm) {
    return (
      <g>
        {/* left arm down, right arm up and waving */}
        <Arm
          cells={down(left)}
          hand={{ x: left, y: 13, w: 2, h: 2 }}
          sleeve={sleeve}
          shaded={false}
        />
        <Arm
          cells={up(right, 5)}
          hand={{ x: waveOut ? right + 2 : right, y: 3, w: 2, h: 2 }}
          sleeve={sleeve}
          shaded
          handFill={SKIN}
        />
      </g>
    );
  }
  return (
    <g>
      <g transform={`translate(0 ${swing})`}>
        <Arm
          cells={down(left)}
          hand={{ x: left, y: 13, w: 2, h: 2 }}
          sleeve={sleeve}
          shaded={false}
        />
      </g>
      <g transform={`translate(0 ${-swing})`}>
        <Arm cells={down(right)} hand={{ x: right, y: 13, w: 2, h: 2 }} sleeve={sleeve} shaded />
      </g>
    </g>
  );
}

// --- Torso ------------------------------------------------------------------

// The front / back torso: the body block in the outfit's cloth (the female
// build narrows the shoulders by a pixel), the outfit's detail for this facing,
// then the arms.
export function Torso({
  swing,
  tones,
  look,
  clothing,
  gender,
  back,
  pose,
}: {
  swing: number;
  tones: OutfitTones;
  look: OutfitLook;
  clothing: AvatarConfig['clothing'];
  gender: AvatarConfig['gender'];
  back: boolean;
  // Active reaction pose, when one is playing.
  pose?: ReactionPose | null;
}) {
  const inset = gender === 'female' ? 1 : 0;
  return (
    <g>
      <rect x={4 + inset} y={9} width={8 - inset * 2} height={6} fill={look.body.base} />
      <rect x={10 - inset} y={9} width={2} height={6} fill={look.body.dark} />
      {back ? (
        <OutfitBack clothing={clothing} t={tones} inset={inset} />
      ) : (
        <OutfitFront clothing={clothing} t={tones} inset={inset} />
      )}
      <Arms
        inset={inset}
        swing={swing}
        sleeve={look.sleeve}
        armsOut={pose?.armsOut ?? false}
        armsUp={pose?.armsUp ?? false}
        waveArm={pose?.waveArm ?? false}
        waveOut={(pose?.leanX ?? 0) !== 0}
      />
    </g>
  );
}

// The profile torso: one visible arm, swinging fore and aft rather than up
// and down.
export function TorsoProfile({
  swing,
  tones,
  look,
  clothing,
}: {
  swing: number;
  tones: OutfitTones;
  look: OutfitLook;
  clothing: AvatarConfig['clothing'];
}) {
  return (
    <g>
      <rect x={5} y={9} width={7} height={6} fill={look.body.base} />
      <rect x={10} y={9} width={2} height={6} fill={look.body.dark} />
      <OutfitProfile clothing={clothing} t={tones} />
      <g transform={`translate(${-swing} 0)`}>
        <Arm
          cells={[
            { x: 4, y: 10, w: 2, h: 1 },
            { x: 4, y: 11, w: 2, h: 1 },
            { x: 4, y: 12, w: 2, h: 1 },
            { x: 4, y: 13, w: 2, h: 1 },
          ]}
          hand={{ x: 4, y: 14, w: 2, h: 2 }}
          sleeve={look.sleeve}
          shaded={false}
        />
      </g>
    </g>
  );
}
