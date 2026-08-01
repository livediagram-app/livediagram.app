// The Avatar-mode pixel sprite (spec/101): the figure itself, split out of
// AvatarWalker so that component keeps to placement (the ring, the name chip,
// the canvas-coords box) and this one owns the pixel art.
//
// Grid: 16 wide x 24 tall, `crispEdges`, flat fills only. The bottom row is
// the ground — the contact shadow lives there and does NOT rise with a jump,
// so a hop reads as leaving the floor. Three facings are drawn (front, back,
// left profile), with the right profile mirrored from the left.
//
// Everything the Avatar Panel offers is a costume on ONE skeleton, so the walk
// cycle, the hop, and the flag wave are shared across every combination:
//   - gender   → shoulder width + a softer face
//   - clothing → eight outfits. Two rules travel with them rather than being
//     re-checked per view: BARE_LEG_CLOTHING (dress / skirt) swaps trousers for
//     bare legs, BARE_ARM_CLOTHING (vest) drops the sleeves.
//   - hair     → eight styles, drawn per view (front / back / profile)
//   - size     → a scale on the whole sprite, applied by the caller's box
// Colour is not a choice: the shirt takes the participant's presence colour.
//
// This file draws the body and assembles the whole figure. Two pieces sit
// beside it: avatar-sprite-head.tsx (everything above the neck, where the
// eight-hairstyles-by-three-facings combinations live) and
// avatar-sprite-palette.ts (the colours both halves have to agree on).

import type { AvatarConfig } from '@/lib/avatar-config';
import { BARE_ARM_CLOTHING, BARE_LEG_CLOTHING } from '@/lib/avatar-config';
import type { ReactionPose } from '@/lib/avatar-reactions';
import type { AvatarFacing } from '@/lib/avatar-walk';
import { HeadBack, HeadFront, HeadProfile, Hood } from '@/components/canvas/avatar-sprite-head';
import {
  APRON,
  COAT,
  COAT_DARK,
  DENIM,
  DENIM_DARK,
  FLAG_CLOTH,
  FLAG_POLE,
  SHIRT_WHITE,
  SHOE,
  SKIN,
  SKIN_DARK,
  TROUSERS,
  TROUSERS_DARK,
  shade,
} from '@/components/canvas/avatar-sprite-palette';
import {
  AVATAR_GRID_HEIGHT,
  AVATAR_HEIGHT,
  AVATAR_PORTRAIT_VIEW_BOX,
  AVATAR_VIEW_BOX,
  avatarBox,
  avatarPortraitBox,
} from '@/lib/avatar-walk';

// --- Legs -------------------------------------------------------------------

// A trousered leg: a column with a shoe at the bottom. `lift` raises the whole
// leg by a pixel for the mid-stride frame.
function Leg({ x, lift = 0, seated = false }: { x: number; lift?: number; seated?: boolean }) {
  // Seated (spec/130): the thigh goes AWAY from the viewer, so from the front
  // it is a short stub, and the shin drops in front of it to a foot planted
  // forward. Two rows shorter overall, which is what makes the silhouette read
  // as folded rather than standing.
  if (seated) {
    return (
      <g transform={`translate(0 ${-lift})`}>
        {/* Thigh: one row, wide, foreshortened. */}
        <rect x={x - 1} y={16} width={5} height={2} fill={TROUSERS} />
        <rect x={x + 3} y={16} width={1} height={2} fill={TROUSERS_DARK} />
        {/* Shin, dropping to the floor in front of the seat. */}
        <rect x={x} y={18} width={3} height={3} fill={TROUSERS_DARK} />
        <rect x={x} y={21} width={3} height={2} fill={SHOE} />
      </g>
    );
  }
  return (
    <g transform={`translate(0 ${-lift})`}>
      <rect x={x} y={15} width={3} height={6} fill={TROUSERS} />
      <rect x={x + 2} y={15} width={1} height={6} fill={TROUSERS_DARK} />
      <rect x={x} y={21} width={3} height={2} fill={SHOE} />
    </g>
  );
}

// A bare leg, worn under the dress.
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
      <rect x={x} y={18} width={2} height={3} fill={SKIN} />
      <rect x={x} y={21} width={2} height={2} fill={SHOE} />
    </g>
  );
}

// The dress's flared skirt, over two bare legs.
function Skirt({ shirtDark }: { shirtDark: string }) {
  return (
    <g>
      <rect x={3} y={14} width={10} height={4} fill={shirtDark} />
      <rect x={2} y={17} width={12} height={1} fill={shirtDark} />
    </g>
  );
}

// The lower half, front / back view: trousers for every outfit but the dress.
function LowerFront({
  clothing,
  shirtDark,
  mid,
  walking,
  airborne,
  legsApart,
  seated = false,
}: {
  clothing: AvatarConfig['clothing'];
  shirtDark: string;
  mid: boolean;
  walking: boolean;
  airborne: boolean;
  // Mid-jumping-jack: legs splayed rather than striding.
  legsApart: boolean;
  // Sitting (spec/130): knees apart and the legs drawn folded.
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
  if (BARE_LEG_CLOTHING.has(clothing)) {
    return (
      <>
        <BareLeg x={leftX} lift={leftLift} seated={seated} />
        <BareLeg x={rightX} lift={rightLift} seated={seated} />
        <Skirt shirtDark={shirtDark} />
      </>
    );
  }
  return (
    <>
      <Leg x={leftX} lift={leftLift} seated={seated} />
      <Leg x={rightX} lift={rightLift} seated={seated} />
    </>
  );
}

// The lower half in profile: one leg forward, one back.
function LowerProfile({
  clothing,
  shirtDark,
  mid,
  walking,
  airborne,
  seated = false,
}: {
  clothing: AvatarConfig['clothing'];
  shirtDark: string;
  mid: boolean;
  walking: boolean;
  airborne: boolean;
  seated?: boolean;
}) {
  const strideLift = walking && !airborne ? 1 : 0;
  if (BARE_LEG_CLOTHING.has(clothing)) {
    return (
      <>
        <BareLeg x={mid ? 9 : 7} />
        <BareLeg x={mid ? 6 : 8} lift={strideLift} />
        <Skirt shirtDark={shirtDark} />
      </>
    );
  }
  return (
    <>
      <Leg x={mid ? 8 : 6} seated={seated} />
      <Leg x={mid ? 5 : 7} lift={strideLift} seated={seated} />
    </>
  );
}

// --- Torso ------------------------------------------------------------------

// Outfit detailing painted over the plain torso block. The tee gets nothing —
// it IS the plain block — and every other outfit is a few rects on top, so the
// silhouette work (legs / sleeves) stays in the shared sets.
function OutfitDetail({
  clothing,
  shirtDark,
}: {
  clothing: AvatarConfig['clothing'];
  shirtDark: string;
}) {
  switch (clothing) {
    case 'stripes':
      // Two bands across the chest.
      return (
        <g>
          <rect x={4} y={10} width={8} height={1} fill={SHIRT_WHITE} />
          <rect x={4} y={12} width={8} height={1} fill={SHIRT_WHITE} />
        </g>
      );
    case 'jumper':
      // A crew collar plus a ribbed hem, the two things that read as knitwear
      // at this size.
      return (
        <g>
          <rect x={6} y={9} width={4} height={1} fill={shirtDark} />
          <rect x={4} y={14} width={8} height={1} fill={shirtDark} />
        </g>
      );
    case 'hoodie':
      // Drawstrings + a kangaroo pocket (the hood itself is drawn behind the
      // head, see Hood).
      return (
        <g>
          <rect x={7} y={9} width={1} height={3} fill={SHIRT_WHITE} />
          <rect x={9} y={9} width={1} height={3} fill={SHIRT_WHITE} />
          <rect x={5} y={12} width={6} height={2} fill={shirtDark} />
        </g>
      );
    case 'vest':
      // A tank top: narrow straps over the chest (the bare arms come from
      // BARE_ARM_CLOTHING in the torso).
      return (
        <g>
          <rect x={4} y={9} width={1} height={2} fill={SKIN} />
          <rect x={11} y={9} width={1} height={2} fill={SKIN} />
        </g>
      );
    case 'suit':
      // Open jacket over a white shirt, with a tie down the middle.
      return (
        <g>
          <rect x={7} y={9} width={2} height={5} fill={SHIRT_WHITE} />
          <rect x={5} y={9} width={2} height={2} fill={shirtDark} />
          <rect x={9} y={9} width={2} height={2} fill={shirtDark} />
          <rect x={7} y={10} width={1} height={4} fill={FLAG_CLOTH} />
        </g>
      );
    case 'dress':
      return <rect x={6} y={9} width={4} height={1} fill={SHIRT_WHITE} />;
    case 'skirt':
      // A tucked-in top: a belt line where the skirt starts.
      return <rect x={4} y={13} width={8} height={1} fill={shirtDark} />;
    case 'polo':
      // A short placket with two buttons and a flat collar.
      return (
        <g>
          <rect x={5} y={9} width={6} height={1} fill={SHIRT_WHITE} />
          <rect x={7} y={10} width={2} height={3} fill={shirtDark} />
          <rect x={7} y={10} width={1} height={1} fill={SHIRT_WHITE} />
        </g>
      );
    case 'flannel':
      // A check: two verticals crossed by two horizontals.
      return (
        <g>
          <rect x={6} y={9} width={1} height={6} fill={shirtDark} />
          <rect x={9} y={9} width={1} height={6} fill={shirtDark} />
          <rect x={4} y={11} width={8} height={1} fill={shirtDark} />
          <rect x={4} y={13} width={8} height={1} fill={shirtDark} />
        </g>
      );
    case 'overalls':
      // Denim bib with two straps over a plain tee.
      return (
        <g>
          <rect x={5} y={11} width={6} height={4} fill={DENIM} />
          <rect x={9} y={11} width={2} height={4} fill={DENIM_DARK} />
          <rect x={5} y={9} width={1} height={2} fill={DENIM} />
          <rect x={10} y={9} width={1} height={2} fill={DENIM_DARK} />
          <rect x={7} y={12} width={2} height={1} fill={DENIM_DARK} />
        </g>
      );
    case 'labcoat':
      // An open white coat over the shirt, lapels and all.
      return (
        <g>
          <rect x={4} y={9} width={3} height={6} fill={COAT} />
          <rect x={9} y={9} width={3} height={6} fill={COAT} />
          <rect x={11} y={9} width={1} height={6} fill={COAT_DARK} />
          <rect x={6} y={9} width={1} height={2} fill={COAT_DARK} />
          <rect x={9} y={9} width={1} height={2} fill={COAT_DARK} />
        </g>
      );
    case 'hawaiian':
      // A loud print: scattered blooms on an open shirt (bare arms come from
      // BARE_ARM_CLOTHING).
      return (
        <g>
          <rect x={5} y={10} width={1} height={1} fill={SHIRT_WHITE} />
          <rect x={8} y={11} width={1} height={1} fill={SHIRT_WHITE} />
          <rect x={6} y={13} width={1} height={1} fill={SHIRT_WHITE} />
          <rect x={10} y={13} width={1} height={1} fill={FLAG_CLOTH} />
          <rect x={9} y={9} width={1} height={1} fill={FLAG_CLOTH} />
          <rect x={6} y={9} width={4} height={1} fill={SHIRT_WHITE} />
        </g>
      );
    case 'varsity':
      // A letterman: white sleeves-stripe band and a chest letter.
      return (
        <g>
          <rect x={4} y={12} width={8} height={1} fill={SHIRT_WHITE} />
          <rect x={6} y={9} width={1} height={3} fill={SHIRT_WHITE} />
          <rect x={7} y={10} width={1} height={1} fill={SHIRT_WHITE} />
          <rect x={8} y={9} width={1} height={3} fill={SHIRT_WHITE} />
        </g>
      );
    case 'turtleneck':
      // The collar IS the outfit: a raised neck plus a smooth body.
      return (
        <g>
          <rect x={5} y={7} width={6} height={2} fill={shirtDark} />
          <rect x={9} y={7} width={2} height={2} fill={shirtDark} />
        </g>
      );
    case 'apron':
      // A bib apron with neck strap, over whatever shirt is underneath.
      return (
        <g>
          <rect x={5} y={10} width={6} height={5} fill={APRON} />
          <rect x={6} y={9} width={1} height={1} fill={APRON} />
          <rect x={9} y={9} width={1} height={1} fill={APRON} />
          <rect x={5} y={12} width={6} height={1} fill={SHIRT_WHITE} />
        </g>
      );
    default:
      return null;
  }
}

// The front / back torso with sleeves. `swing` moves the arms in opposition
// for the walk cycle; the female build narrows the shoulders by a pixel.
// The arms. Normally two sleeves swinging in opposition with the walk; a
// reaction (spec/101) can instead throw them straight out to the sides (jumping
// jacks), raise both (cheer), or raise one and swing it (wave / dance). Only one
// of those is ever set at a time — reactionPose guarantees it.
function Arms({
  inset,
  swing,
  sleeve,
  sleeveDark,
  armsOut,
  armsUp,
  waveArm,
  waveOut,
}: {
  inset: number;
  swing: number;
  sleeve: string;
  sleeveDark: string;
  armsOut: boolean;
  armsUp: boolean;
  waveArm: boolean;
  // Which half of the wave's swing we're on — the raised hand crosses in and
  // out rather than just sitting there.
  waveOut: boolean;
}) {
  if (armsOut) {
    return (
      <g>
        <rect x={0} y={9} width={4} height={2} fill={sleeve} />
        <rect x={-2} y={9} width={2} height={2} fill={SKIN} />
        <rect x={12} y={9} width={4} height={2} fill={sleeveDark} />
        <rect x={16} y={9} width={2} height={2} fill={SKIN_DARK} />
      </g>
    );
  }
  if (armsUp) {
    return (
      <g>
        <rect x={2 + inset} y={4} width={2} height={6} fill={sleeve} />
        <rect x={2 + inset} y={2} width={2} height={2} fill={SKIN} />
        <rect x={12 - inset} y={4} width={2} height={6} fill={sleeveDark} />
        <rect x={12 - inset} y={2} width={2} height={2} fill={SKIN_DARK} />
      </g>
    );
  }
  if (waveArm) {
    return (
      <g>
        {/* left arm down, right arm up and waving */}
        <rect x={2 + inset} y={9} width={2} height={4} fill={sleeve} />
        <rect x={2 + inset} y={13} width={2} height={2} fill={SKIN} />
        <rect x={12 - inset} y={5} width={2} height={5} fill={sleeveDark} />
        <rect x={waveOut ? 14 - inset : 12 - inset} y={3} width={2} height={2} fill={SKIN} />
      </g>
    );
  }
  return (
    <g>
      <g transform={`translate(0 ${swing})`}>
        <rect x={2 + inset} y={9} width={2} height={4} fill={sleeve} />
        <rect x={2 + inset} y={13} width={2} height={2} fill={SKIN} />
      </g>
      <g transform={`translate(0 ${-swing})`}>
        <rect x={12 - inset} y={9} width={2} height={4} fill={sleeveDark} />
        <rect x={12 - inset} y={13} width={2} height={2} fill={SKIN_DARK} />
      </g>
    </g>
  );
}

function Torso({
  swing,
  shirt,
  shirtDark,
  clothing,
  gender,
  pose,
}: {
  swing: number;
  shirt: string;
  shirtDark: string;
  clothing: AvatarConfig['clothing'];
  gender: AvatarConfig['gender'];
  // Active reaction pose, when one is playing.
  pose?: ReactionPose | null;
}) {
  const inset = gender === 'female' ? 1 : 0;
  // A vest leaves the arms bare, so the sleeve blocks take skin tones.
  const bareArms = BARE_ARM_CLOTHING.has(clothing);
  const sleeve = bareArms ? SKIN : shirt;
  const sleeveDark = bareArms ? SKIN_DARK : shirtDark;
  return (
    <g>
      <rect x={4 + inset} y={9} width={8 - inset * 2} height={6} fill={shirt} />
      <rect x={10 - inset} y={9} width={2} height={6} fill={shirtDark} />
      <OutfitDetail clothing={clothing} shirtDark={shirtDark} />
      <Arms
        inset={inset}
        swing={swing}
        sleeve={sleeve}
        sleeveDark={sleeveDark}
        armsOut={pose?.armsOut ?? false}
        armsUp={pose?.armsUp ?? false}
        waveArm={pose?.waveArm ?? false}
        waveOut={(pose?.leanX ?? 0) !== 0}
      />
    </g>
  );
}

function TorsoProfile({
  swing,
  shirt,
  shirtDark,
  clothing,
}: {
  swing: number;
  shirt: string;
  shirtDark: string;
  clothing: AvatarConfig['clothing'];
}) {
  return (
    <g>
      <rect x={5} y={9} width={7} height={6} fill={shirt} />
      <rect x={10} y={9} width={2} height={6} fill={shirtDark} />
      {clothing === 'suit' ? <rect x={6} y={9} width={1} height={5} fill={SHIRT_WHITE} /> : null}
      {clothing === 'hoodie' ? <rect x={6} y={12} width={5} height={2} fill={shirtDark} /> : null}
      {clothing === 'stripes' ? (
        <>
          <rect x={5} y={10} width={7} height={1} fill={SHIRT_WHITE} />
          <rect x={5} y={12} width={7} height={1} fill={SHIRT_WHITE} />
        </>
      ) : null}
      {clothing === 'jumper' ? <rect x={5} y={14} width={7} height={1} fill={shirtDark} /> : null}
      {clothing === 'skirt' ? <rect x={5} y={13} width={7} height={1} fill={shirtDark} /> : null}
      {clothing === 'flannel' ? (
        <>
          <rect x={5} y={11} width={7} height={1} fill={shirtDark} />
          <rect x={8} y={9} width={1} height={6} fill={shirtDark} />
        </>
      ) : null}
      {clothing === 'overalls' ? (
        <>
          <rect x={5} y={11} width={7} height={4} fill={DENIM} />
          <rect x={10} y={11} width={2} height={4} fill={DENIM_DARK} />
          <rect x={6} y={9} width={1} height={2} fill={DENIM} />
        </>
      ) : null}
      {clothing === 'labcoat' ? (
        <>
          <rect x={5} y={9} width={2} height={6} fill={COAT} />
          <rect x={10} y={9} width={2} height={6} fill={COAT_DARK} />
        </>
      ) : null}
      {clothing === 'turtleneck' ? (
        <rect x={5} y={7} width={7} height={2} fill={shirtDark} />
      ) : null}
      {clothing === 'apron' ? <rect x={4} y={10} width={3} height={5} fill={APRON} /> : null}
      {clothing === 'varsity' ? (
        <rect x={5} y={12} width={7} height={1} fill={SHIRT_WHITE} />
      ) : null}
      {clothing === 'polo' ? <rect x={5} y={9} width={5} height={1} fill={SHIRT_WHITE} /> : null}
      {clothing === 'hawaiian' ? (
        <>
          <rect x={6} y={10} width={1} height={1} fill={SHIRT_WHITE} />
          <rect x={9} y={12} width={1} height={1} fill={FLAG_CLOTH} />
        </>
      ) : null}
      {/* One visible arm, swinging fore and aft rather than up and down. */}
      <g transform={`translate(${-swing} 0)`}>
        <rect
          x={4}
          y={10}
          width={2}
          height={4}
          fill={BARE_ARM_CLOTHING.has(clothing) ? SKIN : shirt}
        />
        <rect x={4} y={14} width={2} height={2} fill={SKIN} />
      </g>
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

export function AvatarSprite({
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
  // Active reaction (spec/101): overrides the arms / legs / lean for the length
  // of the performance. Null when the character is just standing or walking.
  pose?: ReactionPose | null;
  // Chair (spec/130): drawn sitting. The body drops onto the seat and the legs
  // tuck together rather than striding — the same leg treatment the hop
  // already uses, so sitting needs no second set of artwork. It is a pose, not
  // a new sprite: a character who sits down is still the character you built.
  seated?: boolean;
}) {
  // Seated characters never walk (walkTo refuses while seated), so the stride
  // is forced off rather than merely unlikely.
  const mid = !seated && walking && stepFrame === 1;
  // A one-pixel body bob on the mid-stride frame; mid-air the legs tuck
  // together instead of striding.
  const airborne = lift > 0;
  // How far the body drops onto the seat, in sprite pixels. The legs also
  // fold (see Leg), so the whole figure loses about five rows of height —
  // three of drop and two of folded leg — which is what reads as sitting. At
  // the old 3 with straight legs it just looked like standing on the chair.
  const sitDrop = seated ? 5 : 0;
  const bob = airborne ? 0 : mid ? -1 : 0;
  const swing = airborne ? -1 : walking ? (mid ? 1 : -1) : 0;
  // Seated (spec/130): always face the reader. A chair's occupant drawn in
  // profile reads as perched on the arm rather than sitting in it, and which
  // way you happened to walk in from is not information worth keeping.
  const facingNow = seated ? 'down' : facing;
  const profile = facingNow === 'left' || facingNow === 'right';
  const { base: shirtBase, dark: shirtDark } = shade(shirt);
  const box = portrait ? avatarPortraitBox(scale) : avatarBox(scale);
  // The hop is expressed in SPRITE pixels, so the whole body rises while the
  // ground row — and the shadow drawn on it — stays put.
  const liftPx = (lift / (AVATAR_HEIGHT + 4)) * AVATAR_GRID_HEIGHT;
  return (
    <svg
      width={box.width}
      height={box.height}
      viewBox={portrait ? AVATAR_PORTRAIT_VIEW_BOX : AVATAR_VIEW_BOX}
      shapeRendering="crispEdges"
      aria-hidden
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
          facingNow === 'right'
            ? `translate(${16 - (pose?.leanX ?? 0)} ${bob - liftPx + sitDrop}) scale(-1 1)`
            : `translate(${pose?.leanX ?? 0} ${bob - liftPx + sitDrop})`
        }
      >
        {profile ? (
          <>
            <LowerProfile
              clothing={config.clothing}
              shirtDark={shirtDark}
              mid={mid}
              walking={walking}
              airborne={airborne}
              seated={seated}
            />
            <TorsoProfile
              swing={swing}
              shirt={shirtBase}
              shirtDark={shirtDark}
              clothing={config.clothing}
            />
            {config.clothing === 'hoodie' ? <Hood shirtDark={shirtDark} /> : null}
            <HeadProfile hair={config.hair} />
          </>
        ) : (
          <>
            <LowerFront
              clothing={config.clothing}
              shirtDark={shirtDark}
              mid={mid}
              walking={walking}
              airborne={airborne}
              legsApart={pose?.legsApart ?? false}
              seated={seated}
            />
            <Torso
              swing={swing}
              shirt={shirtBase}
              shirtDark={shirtDark}
              clothing={config.clothing}
              gender={config.gender}
              pose={pose}
            />
            {config.clothing === 'hoodie' ? <Hood shirtDark={shirtDark} /> : null}
            {facingNow === 'up' ? (
              <HeadBack hair={config.hair} />
            ) : (
              <HeadFront gender={config.gender} hair={config.hair} />
            )}
          </>
        )}
        {wave !== null ? <Flag frame={wave} /> : null}
      </g>
    </svg>
  );
}
