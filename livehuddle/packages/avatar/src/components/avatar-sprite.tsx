// The Avatar-mode pixel sprite (docs/specs/008-canvas/avatar-mode.md): the figure itself, split out of
// AvatarWalker so that component keeps to placement (the ring, the name chip,
// the canvas-coords box) and this one owns the pixel art.
//
// Grid: 16 wide x 24 tall, `crispEdges`, flat fills only. The bottom row is
// the ground: the contact shadow lives there and does NOT rise with a jump,
// so a hop reads as leaving the floor. Three facings are drawn (front, back,
// left profile), with the right profile mirrored from the left.
//
// Everything the Avatar Panel offers is a costume on ONE skeleton, so the walk
// cycle, the hop, and the flag wave are shared across every combination:
//   - gender   → shoulder width + a softer face
//   - clothing → sixteen outfits, drawn by avatar-sprite-outfit.tsx: what the
//     body, sleeves and legs are cut from (outfitLook) plus a signature detail
//     per facing. BARE_LEG_CLOTHING (dress / skirt) swaps trousers for bare
//     legs in every view.
//   - hair     → eight styles, drawn per view (front / back / profile)
//   - size     → a scale on the whole sprite, applied by the caller's box
// Colour is not a choice: the shirt takes the participant's presence colour.
//
// This file draws the body and assembles the whole figure. Three pieces sit
// beside it: avatar-sprite-head.tsx (everything above the neck, where the
// hairstyles-by-three-facings combinations live), avatar-sprite-outfit.tsx
// (the clothes) and avatar-sprite-palette.ts (the colours they agree on).

import { memo } from 'react';
import type { DrinkKind } from '../office-geometry';
import { propsEqualByField } from './props-equal';
import type { AvatarConfig } from '../config';
import { BARE_LEG_CLOTHING } from '../config';
import type { ReactionPose } from '../reactions';
import type { AvatarFacing } from '../walk';
import { HeadBack, HeadFront, HeadProfile } from './avatar-sprite-head';
import type { AvatarStatus } from '../status';
import { AvatarStatusEffect, avatarStatusOverflows } from './avatar-status-effects';
import {
  HoodProfile,
  OutfitBack,
  OutfitCollar,
  OutfitFront,
  OutfitLowerFront,
  OutfitLowerProfile,
  OutfitProfile,
  outfitLook,
  type ClothPair,
  type OutfitLook,
  type SleeveLook,
} from './avatar-sprite-outfit';
import {
  FLAG_CLOTH,
  FLAG_POLE,
  SHOE,
  SKIN,
  SKIN_DARK,
  outfitTones,
  type OutfitTones,
} from './avatar-sprite-palette';
import {
  AVATAR_GRID_HEIGHT,
  AVATAR_HEIGHT,
  AVATAR_PORTRAIT_VIEW_BOX,
  AVATAR_VIEW_BOX,
  avatarBox,
  avatarPortraitBox,
} from '../walk';

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
function LowerFront({
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
function LowerProfile({
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
function Torso({
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
function TorsoProfile({
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
function HeldCup({ kind, profile, back }: { kind: DrinkKind; profile: boolean; back: boolean }) {
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
function Headphones({ profile }: { profile: boolean }) {
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
function Flag({ frame }: { frame: number }) {
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

function AvatarSpriteView({
  facing,
  config,
  walking,
  stepFrame,
  lift,
  wave,
  shirt,
  scale = 1,
  portrait = false,
  pose = null,
  seated = false,
  holding = null,
  headphones = false,
  status = null,
}: {
  facing: AvatarFacing;
  config: AvatarConfig;
  walking: boolean;
  stepFrame: number;
  lift: number;
  wave: number | null;
  shirt?: string;
  // Size multiplier from the config (or a fixed one for the panel preview).
  scale?: number;
  // Draw as a cropped standing portrait (the Avatar Panel's preview): the box
  // hugs the figure instead of reserving room for the hop and the flag.
  portrait?: boolean;
  // Active reaction (docs/specs/008-canvas/avatar-mode.md): overrides the arms / legs / lean for the length
  // of the performance. Null when the character is just standing or walking.
  pose?: ReactionPose | null;
  // Chair (docs/specs/009-elements/chair.md): drawn sitting. The body drops onto the seat and the legs
  // tuck together rather than striding: the same leg treatment the hop
  // already uses, so sitting needs no second set of artwork. It is a pose, not
  // a new sprite: a character who sits down is still the character you built.
  seated?: boolean;
  // A drink in the hand (docs/specs/009-elements/office.md "Using it"), or none.
  holding?: DrinkKind | null;
  // Focusing (docs/specs/008-canvas/avatar-mode.md "Status"): headphones on.
  headphones?: boolean;
  // The status whose signature the character wears (avatar-status-effects.tsx), or none.
  status?: AvatarStatus | null;
}) {
  // Seated characters never walk (walkTo refuses while seated), so the stride
  // is forced off rather than merely unlikely.
  const mid = !seated && walking && stepFrame === 1;
  // A one-pixel body bob on the mid-stride frame; mid-air the legs tuck
  // together instead of striding.
  const airborne = lift > 0;
  // How far the body drops onto the seat, in sprite pixels. The legs also
  // fold (see Leg), so the whole figure loses about five rows of height ,
  // three of drop and two of folded leg: which is what reads as sitting. At
  // the old 3 with straight legs it just looked like standing on the chair.
  const sitDrop = seated ? 5 : 0;
  const bob = airborne ? 0 : mid ? -1 : 0;
  const swing = airborne ? -1 : walking ? (mid ? 1 : -1) : 0;
  // Seated (docs/specs/009-elements/chair.md), `facing` is the CHAIR's: sitting down turns the figure
  // the way the seat points, so a sitter in profile is in a sideways chair.
  const profile = facing === 'left' || facing === 'right';
  const tones = outfitTones(shirt);
  const look = outfitLook(config.clothing, tones);
  const inset = config.gender === 'female' ? 1 : 0;
  const box = portrait ? avatarPortraitBox(scale) : avatarBox(scale);
  // The hop is expressed in SPRITE pixels, so the whole body rises while the
  // ground row (and the shadow drawn on it) stays put.
  const liftPx = (lift / (AVATAR_HEIGHT + 4)) * AVATAR_GRID_HEIGHT;
  return (
    <svg
      width={box.width}
      height={box.height}
      viewBox={portrait ? AVATAR_PORTRAIT_VIEW_BOX : AVATAR_VIEW_BOX}
      shapeRendering="crispEdges"
      aria-hidden
      // A status's signature can reach past a cropped portrait's top or side (avatar-status-effects).
      style={avatarStatusOverflows(status) ? { overflow: 'visible' } : undefined}
    >
      {/* Contact shadow on the ground row. It shrinks as the character rises,
          which is what sells the jump. */}
      {/* No contact shadow while seated: the chair draws its own, and a
          shadow under a sitting figure reads as hovering. */}
      {seated ? null : (
        <ellipse
          cx={8}
          cy={23}
          rx={Math.max(2.4, 5 - liftPx / 4)}
          ry={1.2}
          fill="rgb(15 23 42 / 0.28)"
        />
      )}
      <g
        transform={
          facing === 'right'
            ? `translate(${16 - (pose?.leanX ?? 0)} ${bob - liftPx + sitDrop}) scale(-1 1)`
            : `translate(${pose?.leanX ?? 0} ${bob - liftPx + sitDrop})`
        }
      >
        {profile ? (
          <>
            <LowerProfile
              clothing={config.clothing}
              tones={tones}
              legs={look.legs}
              mid={mid}
              walking={walking}
              airborne={airborne}
              seated={seated}
            />
            <TorsoProfile swing={swing} tones={tones} look={look} clothing={config.clothing} />
            {config.clothing === 'hoodie' ? <HoodProfile t={tones} /> : null}
            <HeadProfile hair={config.hair} colour={config.hairColour} />
            {config.clothing === 'turtleneck' ? <OutfitCollar t={tones} profile /> : null}
            {headphones ? <Headphones profile /> : null}
          </>
        ) : (
          <>
            <LowerFront
              clothing={config.clothing}
              tones={tones}
              legs={look.legs}
              inset={inset}
              back={facing === 'up'}
              mid={mid}
              walking={walking}
              airborne={airborne}
              legsApart={pose?.legsApart ?? false}
              seated={seated}
            />
            <Torso
              swing={swing}
              tones={tones}
              look={look}
              clothing={config.clothing}
              gender={config.gender}
              back={facing === 'up'}
              pose={pose}
            />
            {facing === 'up' ? (
              <HeadBack hair={config.hair} colour={config.hairColour} />
            ) : (
              <HeadFront gender={config.gender} hair={config.hair} colour={config.hairColour} />
            )}
            {config.clothing === 'turtleneck' ? <OutfitCollar t={tones} profile={false} /> : null}
            {headphones ? <Headphones profile={false} /> : null}
          </>
        )}
        {status ? (
          <AvatarStatusEffect
            status={status}
            view={profile ? 'profile' : facing === 'up' ? 'back' : 'front'}
            hair={config.hair}
            handFree={!holding && !pose && wave === null}
          />
        ) : null}
        {holding && !pose && wave === null ? (
          <HeldCup kind={holding} profile={profile} back={facing === 'up'} />
        ) : null}
        {wave !== null ? <Flag frame={wave} /> : null}
      </g>
    </svg>
  );
}

// Memoised (docs/specs/008-canvas/canvas-performance.md "Walking renders the characters, not the canvas"): a step
// moves the walker's box every frame, and the figure (a few hundred SVG nodes) draws again only when its frame,
// facing, hop, wave, pose or costume changes, about a dozen times a second at a walk rather than every frame.
export const AvatarSprite = memo(AvatarSpriteView, propsEqualByField);
