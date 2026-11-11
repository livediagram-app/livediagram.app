// The pixel character's outfit above the waist (./avatar-sprite-outfit holds each look): from the front, from
// behind and in profile, with its hood, Hawaiian print and collar. Re-exported from ./avatar-sprite-outfit.
import {
  APRON,
  APRON_DARK,
  BLOOM,
  BRASS,
  COAT_DARK,
  DENIM,
  DENIM_DARK,
  DENIM_LIGHT,
  FLAG_CLOTH,
  LEAF,
  PETAL,
  SHIRT_WHITE,
  SKIN,
  type OutfitTones,
} from './avatar-sprite-palette';
import type { Clothing } from './avatar-sprite-outfit';

// --- Torso detail -------------------------------------------------------------

// The front / back torso spans x = L..R (inclusive) over rows 9 to 14: 4..11 for the male build, 5..10 for the
// female (`inset`). Details that run edge to edge use L / W so they never spill onto a narrower build's arms.
export function span(inset: number) {
  const L = 4 + inset;
  const R = 11 - inset;
  return { L, R, W: R - L + 1 };
}

// The hoodie's hood, lying around the neck: drawn behind the head (which covers its middle), so what shows is a
// thick dark ring at the sides of the face and across the shoulders.
function Hood({ t }: { t: OutfitTones }) {
  return (
    <g>
      <rect x={3} y={5} width={10} height={5} fill={t.accent} />
      <rect x={3} y={9} width={10} height={1} fill={t.dark} />
    </g>
  );
}

// Front view (facing the viewer).
export function OutfitFront({
  clothing,
  t,
  inset,
}: {
  clothing: Clothing;
  t: OutfitTones;
  inset: number;
}) {
  const { L, R, W } = span(inset);
  switch (clothing) {
    case 'stripes':
      // Three bold bands across the body (the sleeves carry two more).
      return (
        <g>
          <rect x={L} y={10} width={W} height={1} fill={t.contrast} />
          <rect x={L} y={12} width={W} height={1} fill={t.contrast} />
          <rect x={L} y={14} width={W} height={1} fill={t.contrast} />
        </g>
      );
    case 'jumper':
      // Crew collar, and a deep ribbed hem that hangs over the trousers (with ribbed cuffs on the sleeves).
      return (
        <g>
          <rect x={6} y={9} width={4} height={1} fill={t.accent} />
          <rect x={L} y={14} width={W} height={2} fill={t.accent} />
          <rect x={L + 1} y={14} width={1} height={2} fill={t.dark} />
          <rect x={L + 3} y={14} width={1} height={2} fill={t.dark} />
          <rect x={L + 5} y={14} width={1} height={2} fill={t.dark} />
        </g>
      );
    case 'hoodie':
      // Hood ring, white drawstrings, a kangaroo pocket, a ribbed hem.
      return (
        <g>
          <Hood t={t} />
          <rect x={6} y={9} width={1} height={3} fill={SHIRT_WHITE} />
          <rect x={9} y={9} width={1} height={3} fill={SHIRT_WHITE} />
          <rect x={6} y={12} width={4} height={1} fill={t.accent} />
          <rect x={5} y={13} width={6} height={1} fill={t.accent} />
          <rect x={L} y={14} width={W} height={1} fill={t.dark} />
        </g>
      );
    case 'vest':
      // A waistcoat over a white shirt: shirt shoulders and a V at the neck, buttons down the front, points at the
      // hem.
      return (
        <g>
          <rect x={L} y={9} width={1} height={2} fill={SHIRT_WHITE} />
          <rect x={R} y={9} width={1} height={2} fill={SHIRT_WHITE} />
          <rect x={6} y={9} width={4} height={1} fill={SHIRT_WHITE} />
          <rect x={7} y={10} width={2} height={1} fill={SHIRT_WHITE} />
          <rect x={7} y={11} width={1} height={1} fill={t.deep} />
          <rect x={7} y={13} width={1} height={1} fill={t.deep} />
          <rect x={6} y={15} width={1} height={1} fill={t.base} />
          <rect x={9} y={15} width={1} height={1} fill={t.dark} />
        </g>
      );
    case 'suit':
      // Dark jacket, lapels in the shirt colour, a white shirt V and a red tie.
      return (
        <g>
          <rect x={6} y={9} width={4} height={2} fill={SHIRT_WHITE} />
          <rect x={7} y={11} width={2} height={1} fill={SHIRT_WHITE} />
          <rect x={5} y={9} width={1} height={3} fill={t.dark} />
          <rect x={10} y={9} width={1} height={3} fill={t.dark} />
          <rect x={7} y={9} width={2} height={5} fill={FLAG_CLOTH} />
        </g>
      );
    case 'dress':
      // A scoop neckline; the flared skirt is OutfitLowerFront.
      return <rect x={6} y={9} width={4} height={1} fill={SKIN} />;
    case 'skirt':
      // A second-tone top with a small round neck, tucked into the skirt.
      return <rect x={7} y={9} width={2} height={1} fill={SKIN} />;
    case 'polo':
      // A spread collar with points, and a short placket with a button.
      return (
        <g>
          <rect x={5} y={9} width={6} height={1} fill={t.contrast} />
          <rect x={6} y={10} width={1} height={1} fill={t.contrast} />
          <rect x={9} y={10} width={1} height={1} fill={t.contrast} />
          <rect x={7} y={10} width={2} height={2} fill={t.dark} />
          <rect x={7} y={11} width={1} height={1} fill={t.contrast} />
        </g>
      );
    case 'flannel':
      // A check: two verticals crossed by two horizontals, plus a pointed collar.
      return (
        <g>
          <rect x={L + 1} y={9} width={1} height={6} fill={t.accent} />
          <rect x={L + 4} y={9} width={1} height={6} fill={t.accent} />
          <rect x={L} y={10} width={W} height={1} fill={t.accent} />
          <rect x={L} y={13} width={W} height={1} fill={t.accent} />
          <rect x={7} y={9} width={2} height={1} fill={t.deep} />
        </g>
      );
    case 'overalls':
      // A denim bib on two straps, brass buckles, a bib pocket (denim legs come from the look).
      return (
        <g>
          <rect x={5} y={11} width={6} height={4} fill={DENIM} />
          <rect x={9} y={11} width={2} height={4} fill={DENIM_DARK} />
          <rect x={5} y={9} width={1} height={3} fill={DENIM_LIGHT} />
          <rect x={10} y={9} width={1} height={3} fill={DENIM_LIGHT} />
          <rect x={6} y={11} width={4} height={1} fill={DENIM_LIGHT} />
          <rect x={7} y={12} width={2} height={1} fill={DENIM_DARK} />
          <rect x={5} y={11} width={1} height={1} fill={BRASS} />
          <rect x={10} y={11} width={1} height={1} fill={BRASS} />
        </g>
      );
    case 'labcoat':
      // A white coat worn open: the shirt shows in a narrowing V down the front, a breast pocket with a pen.
      return (
        <g>
          <rect x={6} y={9} width={4} height={2} fill={t.base} />
          <rect x={7} y={11} width={2} height={4} fill={t.base} />
          <rect x={6} y={11} width={1} height={4} fill={COAT_DARK} />
          <rect x={9} y={11} width={1} height={4} fill={COAT_DARK} />
          <rect x={L + 1} y={11} width={1} height={1} fill={COAT_DARK} />
          <rect x={L + 1} y={10} width={1} height={1} fill={t.base} />
        </g>
      );
    case 'hawaiian':
      return <HawaiianPrint t={t} openNeck />;
    case 'varsity':
      // Contrasting white sleeves (from the look), a block letter, a striped collar and hem.
      return (
        <g>
          <rect x={6} y={9} width={4} height={1} fill={t.accent} />
          <rect x={L} y={14} width={W} height={1} fill={t.accent} />
          <rect x={5} y={10} width={1} height={3} fill={t.contrast} />
          <rect x={6} y={12} width={1} height={1} fill={t.contrast} />
          <rect x={9} y={10} width={1} height={1} fill={SHIRT_WHITE} />
          <rect x={9} y={12} width={1} height={1} fill={SHIRT_WHITE} />
        </g>
      );
    case 'apron':
      // A long apron on a neck strap, a front pocket, and the waist ties showing at the sides.
      return (
        <g>
          <rect x={6} y={9} width={1} height={1} fill={APRON} />
          <rect x={9} y={9} width={1} height={1} fill={APRON} />
          <rect x={5} y={10} width={6} height={5} fill={APRON} />
          <rect x={10} y={10} width={1} height={5} fill={APRON_DARK} />
          <rect x={6} y={13} width={4} height={1} fill={APRON_DARK} />
          <rect x={L} y={12} width={1} height={1} fill={APRON} />
          <rect x={R} y={12} width={1} height={1} fill={APRON_DARK} />
        </g>
      );
    default:
      // tee: the plain baseline. turtleneck: its collar is OutfitCollar, over the chin.
      return null;
  }
}

// A loud print: two hibiscus blooms with leaves. White petals on a dark shirt, pink on a light one, so the blooms
// always stand out.
function HawaiianPrint({
  t,
  openNeck,
  dx = 0,
}: {
  t: OutfitTones;
  openNeck?: boolean;
  dx?: number;
}) {
  const petal = t.lightShirt ? PETAL : SHIRT_WHITE;
  return (
    <g>
      {openNeck ? <rect x={6} y={9} width={4} height={1} fill={SKIN} /> : null}
      <rect x={6 + dx} y={10} width={1} height={3} fill={petal} />
      <rect x={5 + dx} y={11} width={3} height={1} fill={petal} />
      <rect x={6 + dx} y={11} width={1} height={1} fill={BLOOM} />
      <rect x={9 + dx} y={12} width={1} height={3} fill={petal} />
      <rect x={8 + dx} y={13} width={3} height={1} fill={petal} />
      <rect x={9 + dx} y={13} width={1} height={1} fill={BLOOM} />
      <rect x={8 + dx} y={10} width={1} height={1} fill={LEAF} />
      <rect x={7 + dx} y={13} width={1} height={1} fill={LEAF} />
    </g>
  );
}

// Back view (walking away). Front-only things (a tie, buttons, pockets) are gone; each outfit keeps a signature
// that reads from behind.
export function OutfitBack({
  clothing,
  t,
  inset,
}: {
  clothing: Clothing;
  t: OutfitTones;
  inset: number;
}) {
  const { L, R, W } = span(inset);
  switch (clothing) {
    case 'stripes':
    case 'flannel':
      return <OutfitFront clothing={clothing} t={t} inset={inset} />;
    case 'jumper':
      return (
        <g>
          <rect x={L} y={14} width={W} height={2} fill={t.accent} />
          <rect x={L + 1} y={14} width={1} height={2} fill={t.dark} />
          <rect x={L + 3} y={14} width={1} height={2} fill={t.dark} />
          <rect x={L + 5} y={14} width={1} height={2} fill={t.dark} />
        </g>
      );
    case 'hoodie':
      // The hood hangs down the back as a point.
      return (
        <g>
          <Hood t={t} />
          <rect x={5} y={10} width={6} height={1} fill={t.accent} />
          <rect x={6} y={11} width={4} height={1} fill={t.accent} />
          <rect x={7} y={12} width={2} height={1} fill={t.accent} />
          <rect x={L} y={14} width={W} height={1} fill={t.dark} />
        </g>
      );
    case 'vest':
      // Shirt shoulders and collar, the waistcoat's darker satin back and its strap.
      return (
        <g>
          <rect x={L} y={9} width={W} height={1} fill={SHIRT_WHITE} />
          <rect x={L} y={10} width={1} height={1} fill={SHIRT_WHITE} />
          <rect x={R} y={10} width={1} height={1} fill={SHIRT_WHITE} />
          <rect x={L + 1} y={10} width={W - 2} height={5} fill={t.deep} />
          <rect x={L + 1} y={12} width={W - 2} height={1} fill={t.accent} />
        </g>
      );
    case 'suit':
      // A white shirt collar above the jacket, and the back vent.
      return (
        <g>
          <rect x={6} y={9} width={4} height={1} fill={SHIRT_WHITE} />
          <rect x={7} y={13} width={1} height={2} fill={t.deeper} />
        </g>
      );
    case 'dress':
      return (
        <g>
          <rect x={6} y={9} width={4} height={1} fill={SKIN} />
          <rect x={7} y={10} width={1} height={3} fill={t.dark} />
        </g>
      );
    case 'polo':
      return <rect x={5} y={9} width={6} height={1} fill={t.contrast} />;
    case 'overalls':
      // The straps cross into an X on the back, over a denim back panel.
      return (
        <g>
          <rect x={5} y={9} width={1} height={1} fill={DENIM_LIGHT} />
          <rect x={10} y={9} width={1} height={1} fill={DENIM_LIGHT} />
          <rect x={6} y={10} width={1} height={1} fill={DENIM_LIGHT} />
          <rect x={9} y={10} width={1} height={1} fill={DENIM_LIGHT} />
          <rect x={7} y={11} width={2} height={1} fill={DENIM_LIGHT} />
          <rect x={L} y={12} width={W} height={3} fill={DENIM} />
          <rect x={R - 1} y={12} width={2} height={3} fill={DENIM_DARK} />
        </g>
      );
    case 'labcoat':
      // Closed white back: a collar, a half belt, the vent.
      return (
        <g>
          <rect x={5} y={9} width={6} height={1} fill={COAT_DARK} />
          <rect x={5} y={12} width={6} height={1} fill={COAT_DARK} />
          <rect x={7} y={13} width={1} height={2} fill={COAT_DARK} />
        </g>
      );
    case 'hawaiian':
      return <HawaiianPrint t={t} />;
    case 'varsity':
      // Arched lettering across the shoulders and the striped hem.
      return (
        <g>
          <rect x={5} y={10} width={2} height={1} fill={t.contrast} />
          <rect x={8} y={10} width={3} height={1} fill={t.contrast} />
          <rect x={6} y={11} width={4} height={1} fill={t.contrast} />
          <rect x={L} y={14} width={W} height={1} fill={t.accent} />
        </g>
      );
    case 'apron':
      // Neck strap, the waist tie across the back and a bow at the middle.
      return (
        <g>
          <rect x={7} y={9} width={2} height={1} fill={APRON} />
          <rect x={L} y={12} width={W} height={1} fill={APRON} />
          <rect x={6} y={11} width={4} height={3} fill={APRON} />
          <rect x={7} y={12} width={2} height={1} fill={APRON_DARK} />
        </g>
      );
    default:
      return null;
  }
}

// Profile (facing LEFT; the right-facing sprite mirrors it). The torso spans x = 5..11 with its front edge at 5;
// the one visible arm (drawn after this) covers x = 4..5 from row 10.
export function OutfitProfile({ clothing, t }: { clothing: Clothing; t: OutfitTones }) {
  switch (clothing) {
    case 'stripes':
      return (
        <g>
          <rect x={5} y={10} width={7} height={1} fill={t.contrast} />
          <rect x={5} y={12} width={7} height={1} fill={t.contrast} />
          <rect x={5} y={14} width={7} height={1} fill={t.contrast} />
        </g>
      );
    case 'jumper':
      return (
        <g>
          <rect x={5} y={9} width={3} height={1} fill={t.accent} />
          <rect x={5} y={14} width={7} height={2} fill={t.accent} />
          <rect x={7} y={14} width={1} height={2} fill={t.dark} />
          <rect x={9} y={14} width={1} height={2} fill={t.dark} />
        </g>
      );
    case 'hoodie':
      return (
        <g>
          <rect x={6} y={9} width={1} height={3} fill={SHIRT_WHITE} />
          <rect x={6} y={12} width={3} height={2} fill={t.accent} />
          <rect x={5} y={14} width={7} height={1} fill={t.dark} />
        </g>
      );
    case 'vest':
      return (
        <g>
          <rect x={6} y={9} width={3} height={1} fill={SHIRT_WHITE} />
          <rect x={6} y={11} width={1} height={1} fill={t.deep} />
          <rect x={6} y={13} width={1} height={1} fill={t.deep} />
        </g>
      );
    case 'suit':
      return (
        <g>
          <rect x={5} y={9} width={2} height={1} fill={SHIRT_WHITE} />
          <rect x={6} y={10} width={1} height={3} fill={FLAG_CLOTH} />
          <rect x={7} y={9} width={1} height={2} fill={t.dark} />
        </g>
      );
    case 'dress':
      return <rect x={5} y={9} width={2} height={1} fill={SKIN} />;
    case 'skirt':
      return <rect x={5} y={9} width={1} height={1} fill={SKIN} />;
    case 'polo':
      return (
        <g>
          <rect x={5} y={9} width={5} height={1} fill={t.contrast} />
          <rect x={6} y={10} width={1} height={2} fill={t.dark} />
        </g>
      );
    case 'flannel':
      return (
        <g>
          <rect x={7} y={9} width={1} height={6} fill={t.accent} />
          <rect x={9} y={9} width={1} height={6} fill={t.accent} />
          <rect x={5} y={10} width={7} height={1} fill={t.accent} />
          <rect x={5} y={13} width={7} height={1} fill={t.accent} />
        </g>
      );
    case 'overalls':
      return (
        <g>
          <rect x={5} y={11} width={3} height={4} fill={DENIM} />
          <rect x={7} y={9} width={1} height={3} fill={DENIM_LIGHT} />
          <rect x={5} y={13} width={7} height={2} fill={DENIM} />
          <rect x={10} y={13} width={2} height={2} fill={DENIM_DARK} />
          <rect x={7} y={11} width={1} height={1} fill={BRASS} />
        </g>
      );
    case 'labcoat':
      return <rect x={5} y={9} width={2} height={2} fill={t.base} />;
    case 'hawaiian':
      return (
        <g>
          <rect x={5} y={9} width={2} height={1} fill={SKIN} />
          <rect x={8} y={10} width={1} height={3} fill={t.lightShirt ? PETAL : SHIRT_WHITE} />
          <rect x={7} y={11} width={3} height={1} fill={t.lightShirt ? PETAL : SHIRT_WHITE} />
          <rect x={8} y={11} width={1} height={1} fill={BLOOM} />
          <rect x={10} y={13} width={1} height={1} fill={LEAF} />
        </g>
      );
    case 'varsity':
      return (
        <g>
          <rect x={5} y={9} width={3} height={1} fill={t.accent} />
          <rect x={5} y={14} width={7} height={1} fill={t.accent} />
          <rect x={8} y={10} width={1} height={3} fill={t.contrast} />
        </g>
      );
    case 'apron':
      // The apron stands proud of the chest, tied at the waist with a bow sticking out behind.
      return (
        <g>
          <rect x={4} y={10} width={2} height={5} fill={APRON} />
          <rect x={6} y={9} width={1} height={1} fill={APRON} />
          <rect x={6} y={12} width={6} height={1} fill={APRON} />
          <rect x={12} y={11} width={1} height={3} fill={APRON_DARK} />
        </g>
      );
    default:
      return null;
  }
}

// The hoodie's hood in profile, bunched behind the neck. Drawn before the head.
export function HoodProfile({ t }: { t: OutfitTones }) {
  return (
    <g>
      <rect x={9} y={5} width={4} height={5} fill={t.accent} />
      <rect x={12} y={6} width={1} height={4} fill={t.dark} />
    </g>
  );
}

// The turtleneck's tall rolled collar, drawn AFTER the head so it rises over the chin (front / back) or the jaw
// (profile). The rest of the turtleneck is a plain long-sleeved body.
export function OutfitCollar({ t, profile }: { t: OutfitTones; profile: boolean }) {
  return profile ? (
    <g>
      <rect x={5} y={8} width={6} height={2} fill={t.base} />
      <rect x={7} y={7} width={4} height={1} fill={t.base} />
      <rect x={6} y={8} width={1} height={2} fill={t.accent} />
      <rect x={8} y={8} width={1} height={2} fill={t.accent} />
    </g>
  ) : (
    <g>
      {/* rolled up to the jaw at the sides, leaving the mouth (row 7, x 7 to 8) clear */}
      <rect x={4} y={8} width={8} height={2} fill={t.base} />
      <rect x={4} y={7} width={2} height={1} fill={t.base} />
      <rect x={10} y={7} width={2} height={3} fill={t.dark} />
      <rect x={5} y={7} width={1} height={3} fill={t.accent} />
      <rect x={7} y={8} width={1} height={2} fill={t.accent} />
      <rect x={9} y={8} width={1} height={2} fill={t.accent} />
    </g>
  );
}
