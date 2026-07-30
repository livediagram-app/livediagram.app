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

import type { AvatarConfig } from '@/lib/avatar-config';
import { BARE_ARM_CLOTHING, BARE_LEG_CLOTHING } from '@/lib/avatar-config';
import type { ReactionPose } from '@/lib/avatar-reactions';
import type { AvatarFacing } from '@/lib/avatar-walk';
import {
  AVATAR_GRID_HEIGHT,
  AVATAR_HEIGHT,
  AVATAR_PORTRAIT_VIEW_BOX,
  AVATAR_VIEW_BOX,
  avatarBox,
  avatarPortraitBox,
} from '@/lib/avatar-walk';

// Sprite palette. Warm skin + brown hair, with one darker tone per material
// for the shaded edge that gives pixel art its volume. The shirt is the
// participant's presence colour (brand cyan when there isn't one).
const SKIN = '#f4c99b';
const SKIN_DARK = '#d9a674';
const HAIR = '#6b4423';
const HAIR_DARK = '#4a2e17';
const DEFAULT_SHIRT = '#0ea5e9';
const TROUSERS = '#3f4c63';
const TROUSERS_DARK = '#2c3648';
const SHOE = '#1e293b';
const EYE = '#243044';
const SHIRT_WHITE = '#f8fafc';
const FLAG_POLE = '#b8845a';
const FLAG_CLOTH = '#f43f5e';
// Tones the later outfits need beyond the shirt colour: denim for overalls, a
// clinical white-coat body, and a leather-ish apron.
const DENIM = '#41597f';
const DENIM_DARK = '#2f4260';
const COAT = '#eef2f6';
const COAT_DARK = '#cfd8e3';
const APRON = '#8b5e34';

// A darker companion to an arbitrary shirt colour, for the shaded side. Mixes
// the hex toward black; falls back to the default pair when the colour isn't a
// plain 6-digit hex (a CSS name or rgb() string from an older presence packet).
function shade(hex: string | undefined): { base: string; dark: string } {
  const base = hex ?? DEFAULT_SHIRT;
  const m = /^#([0-9a-f]{6})$/i.exec(base);
  if (!m) return { base, dark: base };
  const n = parseInt(m[1] ?? '', 16);
  const mix = (c: number) => Math.round(c * 0.78);
  const dark =
    '#' +
    [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('');
  return { base, dark };
}

// --- Legs -------------------------------------------------------------------

// A trousered leg: a column with a shoe at the bottom. `lift` raises the whole
// leg by a pixel for the mid-stride frame.
function Leg({ x, lift = 0 }: { x: number; lift?: number }) {
  return (
    <g transform={`translate(0 ${-lift})`}>
      <rect x={x} y={15} width={3} height={6} fill={TROUSERS} />
      <rect x={x + 2} y={15} width={1} height={6} fill={TROUSERS_DARK} />
      <rect x={x} y={21} width={3} height={2} fill={SHOE} />
    </g>
  );
}

// A bare leg, worn under the dress.
function BareLeg({ x, lift = 0 }: { x: number; lift?: number }) {
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
}: {
  clothing: AvatarConfig['clothing'];
  shirtDark: string;
  mid: boolean;
  walking: boolean;
  airborne: boolean;
  // Mid-jumping-jack: legs splayed rather than striding.
  legsApart: boolean;
}) {
  const strideLift = walking && !airborne;
  // Splayed stance for a jack; otherwise the two legs sit under the body. The
  // split is wide (right out to the sprite's edges) because at canvas size a
  // one-pixel stagger doesn't read as a jumping jack at all.
  const leftX = legsApart ? 1 : 5;
  const rightX = legsApart ? 12 : 9;
  const leftLift = legsApart ? 0 : mid && strideLift ? 1 : 0;
  const rightLift = legsApart ? 0 : !mid && strideLift ? 1 : 0;
  if (BARE_LEG_CLOTHING.has(clothing)) {
    return (
      <>
        <BareLeg x={leftX} lift={leftLift} />
        <BareLeg x={rightX} lift={rightLift} />
        <Skirt shirtDark={shirtDark} />
      </>
    );
  }
  return (
    <>
      <Leg x={leftX} lift={leftLift} />
      <Leg x={rightX} lift={rightLift} />
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
}: {
  clothing: AvatarConfig['clothing'];
  shirtDark: string;
  mid: boolean;
  walking: boolean;
  airborne: boolean;
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
      <Leg x={mid ? 8 : 6} />
      <Leg x={mid ? 5 : 7} lift={strideLift} />
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

// --- Head + hair ------------------------------------------------------------

// Hair, front view. Each style is a few rects over the scalp; `bald` draws
// nothing but the crown shading, and `mohawk` shaves the sides back to skin.
function HairFront({ hair }: { hair: AvatarConfig['hair'] }) {
  if (hair === 'bald') return <rect x={4} y={1} width={8} height={1} fill={SKIN_DARK} />;
  if (hair === 'mohawk') {
    return (
      <g>
        {/* a crest up the middle, sides shaved to stubble */}
        <rect x={4} y={1} width={8} height={1} fill={SKIN_DARK} />
        <rect x={7} y={-3} width={2} height={5} fill={HAIR} />
        <rect x={8} y={-3} width={1} height={5} fill={HAIR_DARK} />
      </g>
    );
  }
  if (hair === 'buzz') {
    // A close crop: one row, hugging the skull.
    return (
      <g>
        <rect x={4} y={0} width={8} height={2} fill={HAIR} />
        <rect x={10} y={0} width={2} height={2} fill={HAIR_DARK} />
      </g>
    );
  }
  if (hair === 'spiky') {
    // Points above the hairline rather than a rounded crown.
    return (
      <g>
        <rect x={3} y={0} width={10} height={2} fill={HAIR} />
        <rect x={11} y={0} width={2} height={2} fill={HAIR_DARK} />
        <rect x={4} y={-2} width={1} height={2} fill={HAIR} />
        <rect x={6} y={-3} width={1} height={3} fill={HAIR} />
        <rect x={8} y={-2} width={1} height={2} fill={HAIR} />
        <rect x={10} y={-3} width={1} height={3} fill={HAIR_DARK} />
      </g>
    );
  }
  if (hair === 'afro') {
    // A tall round halo, wider than the head on both sides.
    return (
      <g>
        <rect x={2} y={-3} width={12} height={5} fill={HAIR} />
        <rect x={1} y={-1} width={1} height={4} fill={HAIR} />
        <rect x={14} y={-1} width={1} height={4} fill={HAIR_DARK} />
        <rect x={11} y={-3} width={3} height={5} fill={HAIR_DARK} />
      </g>
    );
  }
  return (
    <g>
      <rect x={3} y={0} width={10} height={3} fill={HAIR} />
      {hair === 'short' ? (
        <>
          <rect x={3} y={3} width={2} height={3} fill={HAIR_DARK} />
          <rect x={11} y={3} width={2} height={3} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'curly' ? (
        <>
          {/* bumps along the crown, plus curls at the temples */}
          <rect x={3} y={-1} width={2} height={1} fill={HAIR} />
          <rect x={7} y={-2} width={2} height={2} fill={HAIR} />
          <rect x={11} y={-1} width={2} height={1} fill={HAIR_DARK} />
          <rect x={2} y={2} width={2} height={3} fill={HAIR} />
          <rect x={12} y={2} width={2} height={3} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'long' ? (
        <>
          <rect x={2} y={2} width={2} height={9} fill={HAIR} />
          <rect x={12} y={2} width={2} height={9} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'bun' ? (
        <>
          {/* a knot on top, hair gathered back at the sides */}
          <rect x={6} y={-3} width={4} height={3} fill={HAIR} />
          <rect x={9} y={-3} width={1} height={3} fill={HAIR_DARK} />
          <rect x={3} y={3} width={1} height={3} fill={HAIR_DARK} />
          <rect x={12} y={3} width={1} height={3} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'ponytail' ? (
        <>
          <rect x={3} y={3} width={1} height={3} fill={HAIR_DARK} />
          <rect x={12} y={3} width={1} height={3} fill={HAIR_DARK} />
          {/* the tail, gathered high on the right */}
          <rect x={13} y={2} width={2} height={2} fill={HAIR} />
          <rect x={14} y={4} width={2} height={4} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'pigtails' ? (
        <>
          {/* a bunch either side, level with the ears */}
          <rect x={1} y={2} width={2} height={4} fill={HAIR} />
          <rect x={13} y={2} width={2} height={4} fill={HAIR_DARK} />
          <rect x={3} y={3} width={1} height={2} fill={HAIR} />
          <rect x={12} y={3} width={1} height={2} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'bob' ? (
        <>
          {/* a blunt chin-length cut, straight sides */}
          <rect x={2} y={2} width={2} height={5} fill={HAIR} />
          <rect x={12} y={2} width={2} height={5} fill={HAIR_DARK} />
          <rect x={2} y={6} width={12} height={1} fill={HAIR_DARK} />
        </>
      ) : null}
      {hair === 'braid' ? (
        <>
          {/* a single plait down one side, drawn as linked segments */}
          <rect x={3} y={3} width={1} height={3} fill={HAIR_DARK} />
          <rect x={12} y={3} width={2} height={3} fill={HAIR} />
          <rect x={13} y={6} width={2} height={2} fill={HAIR_DARK} />
          <rect x={13} y={9} width={2} height={2} fill={HAIR} />
        </>
      ) : null}
      {hair === 'topknot' ? (
        <>
          {/* shaved-ish sides with a knot pulled high */}
          <rect x={7} y={-4} width={3} height={3} fill={HAIR} />
          <rect x={9} y={-4} width={1} height={3} fill={HAIR_DARK} />
          <rect x={7} y={-1} width={2} height={1} fill={HAIR_DARK} />
        </>
      ) : null}
    </g>
  );
}

// Facing the viewer: face, eyes, a mouth pixel. The female build gets a
// slightly softer jaw (one pixel narrower at the chin).
function HeadFront({
  gender,
  hair,
}: {
  gender: AvatarConfig['gender'];
  hair: AvatarConfig['hair'];
}) {
  return (
    <g>
      <rect x={4} y={1} width={8} height={8} fill={SKIN} />
      <rect x={10} y={1} width={2} height={8} fill={SKIN_DARK} />
      {gender === 'female' ? <rect x={4} y={8} width={1} height={1} fill={SKIN_DARK} /> : null}
      <HairFront hair={hair} />
      <rect x={6} y={5} width={1} height={1} fill={EYE} />
      <rect x={9} y={5} width={1} height={1} fill={EYE} />
      <rect x={7} y={7} width={2} height={1} fill={SKIN_DARK} />
    </g>
  );
}

// Walking away: the back of the head, no face. Long hair, a bun, and a tail
// read most clearly from here.
function HeadBack({ hair }: { hair: AvatarConfig['hair'] }) {
  return (
    <g>
      <rect x={4} y={1} width={8} height={8} fill={SKIN_DARK} />
      {hair === 'bald' ? null : hair === 'mohawk' ? (
        <>
          <rect x={7} y={-3} width={2} height={9} fill={HAIR} />
          <rect x={8} y={-3} width={1} height={9} fill={HAIR_DARK} />
        </>
      ) : hair === 'buzz' ? (
        <>
          <rect x={4} y={0} width={8} height={5} fill={HAIR} />
          <rect x={10} y={0} width={2} height={5} fill={HAIR_DARK} />
        </>
      ) : (
        <>
          <rect x={3} y={0} width={10} height={7} fill={HAIR} />
          <rect x={11} y={0} width={2} height={7} fill={HAIR_DARK} />
          {hair === 'curly' ? (
            <>
              <rect x={3} y={-1} width={2} height={1} fill={HAIR} />
              <rect x={7} y={-2} width={2} height={2} fill={HAIR} />
              <rect x={11} y={-1} width={2} height={1} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'long' ? <rect x={3} y={5} width={10} height={6} fill={HAIR} /> : null}
          {hair === 'bun' ? <rect x={6} y={-3} width={4} height={3} fill={HAIR} /> : null}
          {hair === 'ponytail' ? <rect x={6} y={6} width={4} height={6} fill={HAIR_DARK} /> : null}
          {hair === 'pigtails' ? (
            <>
              <rect x={1} y={2} width={2} height={5} fill={HAIR} />
              <rect x={13} y={2} width={2} height={5} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'afro' ? (
            <>
              <rect x={2} y={-3} width={12} height={4} fill={HAIR} />
              <rect x={11} y={-3} width={3} height={4} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'spiky' ? (
            <>
              <rect x={4} y={-2} width={1} height={2} fill={HAIR} />
              <rect x={6} y={-3} width={1} height={3} fill={HAIR} />
              <rect x={8} y={-2} width={1} height={2} fill={HAIR} />
              <rect x={10} y={-3} width={1} height={3} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'bob' ? <rect x={3} y={5} width={10} height={3} fill={HAIR} /> : null}
          {hair === 'braid' ? (
            <>
              <rect x={7} y={6} width={2} height={2} fill={HAIR} />
              <rect x={7} y={9} width={2} height={2} fill={HAIR_DARK} />
              <rect x={7} y={12} width={2} height={2} fill={HAIR} />
            </>
          ) : null}
          {hair === 'topknot' ? <rect x={6} y={-4} width={4} height={3} fill={HAIR} /> : null}
        </>
      )}
      <rect x={5} y={7} width={6} height={1} fill={SKIN_DARK} />
    </g>
  );
}

// Profile (drawn facing LEFT; the right-facing sprite mirrors this one).
function HeadProfile({ hair }: { hair: AvatarConfig['hair'] }) {
  return (
    <g>
      <rect x={4} y={1} width={7} height={8} fill={SKIN} />
      {/* Nose pixel */}
      <rect x={3} y={5} width={1} height={2} fill={SKIN} />
      {hair === 'bald' ? null : hair === 'mohawk' ? (
        <>
          <rect x={6} y={-3} width={4} height={4} fill={HAIR} />
          <rect x={9} y={-3} width={1} height={4} fill={HAIR_DARK} />
        </>
      ) : hair === 'buzz' ? (
        <>
          <rect x={4} y={0} width={9} height={2} fill={HAIR} />
          <rect x={10} y={2} width={3} height={3} fill={HAIR_DARK} />
        </>
      ) : (
        <>
          <rect x={4} y={0} width={9} height={3} fill={HAIR} />
          <rect x={9} y={3} width={4} height={5} fill={HAIR} />
          <rect x={11} y={3} width={2} height={5} fill={HAIR_DARK} />
          {hair === 'curly' ? (
            <>
              <rect x={5} y={-1} width={2} height={1} fill={HAIR} />
              <rect x={9} y={-2} width={3} height={2} fill={HAIR} />
            </>
          ) : null}
          {hair === 'long' ? <rect x={9} y={7} width={4} height={5} fill={HAIR} /> : null}
          {hair === 'bun' ? <rect x={11} y={-2} width={4} height={3} fill={HAIR} /> : null}
          {hair === 'ponytail' ? <rect x={12} y={4} width={3} height={4} fill={HAIR_DARK} /> : null}
          {hair === 'pigtails' ? <rect x={11} y={3} width={3} height={4} fill={HAIR} /> : null}
          {hair === 'afro' ? (
            <>
              <rect x={3} y={-3} width={11} height={4} fill={HAIR} />
              <rect x={11} y={-3} width={3} height={7} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'spiky' ? (
            <>
              <rect x={5} y={-2} width={1} height={2} fill={HAIR} />
              <rect x={7} y={-3} width={1} height={3} fill={HAIR} />
              <rect x={9} y={-2} width={1} height={2} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'bob' ? <rect x={9} y={6} width={4} height={2} fill={HAIR} /> : null}
          {hair === 'braid' ? (
            <>
              <rect x={11} y={7} width={2} height={2} fill={HAIR} />
              <rect x={11} y={10} width={2} height={2} fill={HAIR_DARK} />
            </>
          ) : null}
          {hair === 'topknot' ? <rect x={9} y={-3} width={3} height={3} fill={HAIR} /> : null}
        </>
      )}
      <rect x={5} y={5} width={1} height={1} fill={EYE} />
      <rect x={4} y={7} width={2} height={1} fill={SKIN_DARK} />
    </g>
  );
}

// The hoodie's hood, sitting behind the head. Drawn before the head so it
// reads as being behind it.
function Hood({ shirtDark }: { shirtDark: string }) {
  return <rect x={3} y={6} width={10} height={4} fill={shirtDark} />;
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
}) {
  const mid = walking && stepFrame === 1;
  // A one-pixel body bob on the mid-stride frame; mid-air the legs tuck
  // together instead of striding.
  const airborne = lift > 0;
  const bob = airborne ? 0 : mid ? -1 : 0;
  const swing = airborne ? -1 : walking ? (mid ? 1 : -1) : 0;
  const profile = facing === 'left' || facing === 'right';
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
      <ellipse
        cx={8}
        cy={23}
        rx={Math.max(2.4, 5 - liftPx / 4)}
        ry={1.2}
        fill="rgb(15 23 42 / 0.28)"
      />
      <g
        transform={
          facing === 'right'
            ? `translate(${16 - (pose?.leanX ?? 0)} ${bob - liftPx}) scale(-1 1)`
            : `translate(${pose?.leanX ?? 0} ${bob - liftPx})`
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
            {facing === 'up' ? (
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
