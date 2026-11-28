// Real 3D's characters (docs/specs/008-canvas/3d-engine.md "Characters"): a character modelled in the round from its
// look (gender, clothes, hair, hair colour, shirt colour), in the sprite's own palette and proportions: a big head
// with a face, a body in its outfit, jointed arms and legs. Built as parts, each about its joint, so the scene bends
// them to walk, sit, wave and react (character-rig.ts). Units are the sprite's pixels: x across the shoulders, y
// toward the face (+y faces the default camera), z up from the soles. Pure: no three.js, no DOM.

import { hairColourHex, type AvatarHairColour } from '@livehuddle/avatar/config';
import { MeshBuilder, mix, parseColour, type Rgb, type Vec3 } from './mesh-builder';

/** The look a character is built from: the walker's config and shirt colour. */
export type CharacterLook = {
  gender?: string;
  clothing?: string;
  hair?: string;
  hairColour?: string;
  /** How broad the game character is (avatar-mode.md "Build"); the modelled stand-in draws every build alike. */
  build?: string;
  shirt?: string;
};

/** A part and the joint it turns about, in its parent's units. */
export type CharacterPart = { mesh: MeshBuilder; pivot: Vec3 };

export type CharacterParts = {
  /** The body above the hips: torso, neck, head, hair (turns about the hips). */
  torso: CharacterPart;
  armL: CharacterPart;
  armR: CharacterPart;
  thighL: CharacterPart;
  thighR: CharacterPart;
  /** Each shin, about its knee (in its thigh's units). */
  shinL: CharacterPart;
  shinR: CharacterPart;
  /** Each shoe, about its ankle (in its shin's units), so a planted foot stays flat. */
  footL: CharacterPart;
  footR: CharacterPart;
  /** What hangs from the hips over the legs (a skirt, a dress, a lab coat's tails), about the hips. */
  skirt: CharacterPart | null;
};

/**
 * The figure's measures, in sprite pixels. Proportioned as a person drawn a little stylised (the owner, 2026-11-27:
 * "more detailed, more realistic and way better looking"): the head about a quarter of the height, legs half of it,
 * hands reaching mid-thigh. As tall as the sprite, so chips and presses line up. `hip` is always `thigh + shin`.
 */
export const BODY = {
  hip: 9.6,
  thigh: 4.7,
  shin: 4.9,
  /** The ankle's height above the sole. */
  ankle: 0.75,
  shoulder: 16.4,
  /** Shoulder to the middle of the hand. */
  arm: 6.8,
  legX: 1.2,
  armX: 2.78,
  height: 22.6,
} as const;

const SKIN = 0xf2c6a0;
const SKIN_DARK = 0xd9a47c;
const SKIN_SHADE = 0xe4b38c;
const TROUSERS = 0x3f4c63;
const SHOE = 0x262f3f;
const SOLE = 0xe7e5e4;
const EYE = 0x2a2f3a;
const IRIS = 0x5b4636;
const SCLERA = 0xf6f4f0;
const WHITE = 0xf8fafc;
const DENIM = 0x41597f;
const DENIM_LIGHT = 0x7391c2;
const COAT = 0xeef2f6;
const APRON = 0x8b5e34;
const BRASS = 0xe0b13e;
const LEAF = 0x22a34a;
const BLOOM = 0xfde047;
const PETAL = 0xdb2777;
const LIP = 0xc27272;
const BLUSH = 0xeea29a;

/** The hair's colour, as the sprite draws it (the palette's brown when none is set). */
export function hairColour(id: string | undefined): Rgb {
  return parseColour(hairColourHex(id as AvatarHairColour | undefined));
}

const darker = (c: Rgb, t: number) => mix(c, 0x000000, t);
const lighter = (c: Rgb, t: number) => mix(c, 0xffffff, t);
const lightness = (c: Rgb) =>
  (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;

/** An outfit's tones from its shirt colour, as the sprite's outfitTones: told apart by shape, not hue. */
function tones(shirt: Rgb) {
  const light = lightness(shirt) > 0.62;
  return {
    base: shirt,
    dark: darker(shirt, 0.22),
    deep: darker(shirt, 0.55),
    alt: light ? darker(shirt, 0.35) : lighter(shirt, 0.6),
    accent: light ? darker(shirt, 0.42) : lighter(shirt, 0.45),
    contrast: light ? darker(shirt, 0.62) : lighter(shirt, 0.78),
  };
}

/** A box from corner to corner with eased edges. */
function rb(
  m: MeshBuilder,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  c: Rgb,
  bevel: number,
  top?: Rgb,
): void {
  m.rounded(
    Math.min(x0, x1),
    Math.min(y0, y1),
    Math.min(z0, z1),
    Math.max(x0, x1),
    Math.max(y0, y1),
    Math.max(z0, z1),
    c,
    bevel,
    { top },
  );
}

const ball = (
  m: MeshBuilder,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  c: Rgb,
  n = 12,
) => m.sphere(x, y, z, rx, ry, rz, c, { segments: n, rings: Math.max(6, Math.round(n * 0.6)) });

type Sleeve = 'long' | 'short' | 'none';

/** What an outfit puts on the arms, the torso, the legs and below the hips. */
function outfit(clothing: string, shirt: Rgb) {
  const t = tones(shirt);
  const o = {
    torso: t.base,
    sleeve: t.base,
    sleeves: 'long' as Sleeve,
    legs: TROUSERS,
    cuff: t.base,
    skirt: null as null | { colour: Rgb; to: number; flare: number },
    t,
  };
  switch (clothing) {
    case 'tee':
    case 'stripes':
    case 'polo':
    case 'hawaiian':
      o.sleeves = 'short';
      break;
    case 'vest':
      o.sleeves = 'none';
      break;
    case 'suit':
      o.torso = t.deep;
      o.sleeve = t.deep;
      o.legs = darker(t.deep, 0.15);
      break;
    case 'dress':
      o.sleeves = 'short';
      o.legs = SKIN;
      o.skirt = { colour: t.base, to: 3.6, flare: 1.3 };
      break;
    case 'skirt':
      o.sleeves = 'short';
      o.legs = SKIN;
      o.skirt = { colour: t.alt, to: 5.4, flare: 0.9 };
      break;
    case 'overalls':
      o.sleeves = 'short';
      o.legs = DENIM;
      break;
    case 'labcoat':
      o.torso = COAT;
      o.sleeve = COAT;
      o.skirt = { colour: COAT, to: 5.0, flare: 0.5 };
      break;
    case 'varsity':
      o.sleeve = t.contrast;
      break;
    default:
      break;
  }
  return o;
}

/** The torso's outline: its half-width (before `TORSO_SX`) at each height above the hips, waist in, chest out. */
function torsoProfile(female: boolean): { r: number; z: number }[] {
  return [
    { r: 0, z: -1.05 },
    { r: female ? 1.95 : 1.85, z: -1.0 },
    { r: female ? 2.15 : 2.0, z: -0.2 },
    { r: female ? 2.05 : 1.95, z: 0.9 },
    { r: female ? 1.6 : 1.8, z: 2.4 },
    { r: female ? 1.85 : 2.05, z: 4.2 },
    { r: female ? 1.95 : 2.2, z: 5.2 },
    { r: female ? 1.95 : 2.25, z: 6.0 },
    { r: female ? 1.6 : 1.8, z: 6.6 },
    { r: 0.95, z: 6.95 },
    { r: 0, z: 7.0 },
  ];
}
const TORSO_SX = 1.12;
const TORSO_SY = 0.6;
/** Where the shoulders' tops are, above the hips. */
const SHOULDER_Z = BODY.shoulder - BODY.hip;

/** The torso's half-width at height z (linear between its profile's points). */
function torsoR(profile: { r: number; z: number }[], z: number): number {
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1]!;
    const b = profile[i]!;
    if (z >= a.z && z <= b.z) return a.r + ((b.r - a.r) * (z - a.z)) / Math.max(1e-6, b.z - a.z);
  }
  return 0;
}

/** The head, face and hair, about the hips (the head sits on the neck at `neck`). */
function head(m: MeshBuilder, look: CharacterLook, neck: number): void {
  const hair = hairColour(look.hairColour);
  const hairLit = lighter(hair, 0.14);
  const hairDeep = darker(hair, 0.18);
  const style = look.hair ?? 'short';
  const female = look.gender === 'female';
  // The neck, then the skull and the jaw beneath it.
  m.cylinder(0, -0.1, neck - 0.6, neck + 1.2, 0.72, 0.66, SKIN_SHADE, { segments: 12 });
  const cz = neck + 2.55;
  const R = { x: 2.0, y: 2.15, z: 2.3 };
  ball(m, 0, 0, cz, R.x, R.y, R.z, SKIN, 20);
  ball(m, 0, 0.3, cz - 0.95, female ? 1.5 : 1.62, 1.72, 1.35, SKIN, 16);
  // Ears.
  for (const s of [-1, 1]) ball(m, s * 1.95, 0.0, cz - 0.15, 0.28, 0.42, 0.58, SKIN_DARK, 8);
  // The face: eyes (white, iris, a catchlight), brows, a nose, lips and a little colour in the cheeks.
  const ez = cz - 0.1;
  for (const s of [-1, 1]) {
    const ex = s * 0.76;
    ball(m, ex, 1.86, ez, 0.4, 0.22, 0.3, SCLERA, 10);
    ball(m, ex + s * -0.03, 2.02, ez - 0.02, 0.23, 0.12, 0.25, IRIS, 10);
    ball(m, ex + s * -0.03, 2.1, ez - 0.02, 0.13, 0.06, 0.15, EYE, 8);
    ball(m, ex - 0.07, 2.15, ez + 0.08, 0.06, 0.03, 0.06, WHITE, 6);
    // An upper lid line, longer and lashed for a woman.
    m.tube(
      [ex - s * 0.38, 1.92, ez + 0.22],
      [ex + s * (female ? 0.5 : 0.42), 1.95, ez + 0.26],
      0.06,
      EYE,
      {
        segments: 6,
      },
    );
    m.tube(
      [ex - s * 0.34, 1.98, ez + 0.6],
      [ex + s * 0.42, 1.88, ez + 0.66],
      female ? 0.07 : 0.1,
      hairDeep,
      {
        segments: 6,
      },
    );
    ball(m, s * 1.25, 1.62, ez - 0.72, 0.38, 0.12, 0.22, mix(SKIN, BLUSH, 0.45), 8);
  }
  ball(m, 0, 2.1, ez - 0.55, 0.26, 0.3, 0.42, SKIN_SHADE, 10);
  m.tube([-0.38, 1.98, ez - 1.18], [0, 2.06, ez - 1.24], 0.08, LIP, { segments: 6 });
  m.tube([0, 2.06, ez - 1.24], [0.38, 1.98, ez - 1.18], 0.08, LIP, { segments: 6 });
  if (style === 'bald') return;
  // Hair: a cap over the crown, its hairline above the brow, and the back of the head.
  const cap = (grow = 0.18, front = 0.62) => {
    m.sphere(0, -0.08, cz + 0.08, R.x + grow, R.y + grow, R.z + grow, hair, {
      segments: 20,
      rings: 10,
      from: front,
      to: 1,
    });
    m.sphere(0, -0.45, cz - 0.1, R.x + grow - 0.05, R.y - 0.25, R.z + grow - 0.1, hair, {
      segments: 18,
      rings: 9,
      from: 0.28,
      to: 0.75,
    });
  };
  // A soft fringe of locks along the hairline, swept to one side.
  const fringe = () => {
    for (const [x, z, r] of [
      [-1.25, 0.95, 0.62],
      [-0.4, 1.12, 0.7],
      [0.5, 1.05, 0.66],
      [1.3, 0.86, 0.55],
    ] as const)
      ball(m, x, 1.62, cz + z, r, 0.48, 0.42, x < 0 ? hairLit : hair, 10);
  };
  const lock = (x: number, y: number, z: number, r: number, c = hair) =>
    ball(m, x, y, z, r, r, r, c, 10);
  switch (style) {
    case 'buzz':
      m.sphere(0, -0.05, cz + 0.05, R.x + 0.06, R.y + 0.06, R.z + 0.06, hairDeep, {
        segments: 20,
        rings: 10,
        from: 0.6,
        to: 1,
      });
      m.sphere(0, -0.3, cz - 0.05, R.x + 0.04, R.y - 0.2, R.z + 0.02, hairDeep, {
        segments: 18,
        rings: 8,
        from: 0.3,
        to: 0.7,
      });
      break;
    case 'mohawk':
      m.sphere(0, -0.05, cz + 0.05, R.x + 0.04, R.y + 0.04, R.z + 0.04, darker(hair, 0.35), {
        segments: 20,
        rings: 10,
        from: 0.62,
        to: 1,
      });
      for (let i = 0; i < 6; i++) {
        const y = 1.6 - i * 0.7;
        const z = cz + R.z * Math.sqrt(Math.max(0, 1 - (y / R.y) ** 2)) - 0.1;
        m.cylinder(
          0,
          y,
          z - 0.2,
          z + 1.5 - Math.abs(i - 2) * 0.18,
          0.46,
          0.08,
          i % 2 ? hair : hairLit,
          {
            segments: 8,
            sx: 0.7,
          },
        );
      }
      break;
    case 'curly':
    case 'afro': {
      const big = style === 'afro' ? 1.45 : 1.08;
      cap(0.2, 0.55);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const ring = i % 2 ? 0.55 : 0.85;
        const x = Math.cos(a) * R.x * ring * big;
        const y = Math.sin(a) * R.y * ring * big - 0.25;
        const z = cz + 1.4 + (1 - ring) * 1.2 * big;
        lock(x, y, z, 0.85 * big, i % 3 === 0 ? hairLit : hair);
      }
      lock(0, -0.2, cz + 2.0 * big, 1.25 * big, hairLit);
      for (const s of [-1, 1]) lock(s * R.x * big * 0.95, -0.5, cz + 0.2, 0.95 * big, hair);
      lock(0, -R.y * big * 0.85, cz + 0.3, 1.1 * big, hair);
      break;
    }
    case 'long':
      cap();
      fringe();
      // Falling down the back past the shoulders, and a lock either side in front of them.
      rb(m, -1.85, -2.05, neck - 2.6, 1.85, -0.6, cz + 0.6, hair, 1.3);
      for (const s of [-1, 1])
        rb(m, s * 1.55, -0.6, neck - 1.6, s * 2.25, 1.1, cz + 0.4, hair, 0.6);
      break;
    case 'bob':
      cap();
      fringe();
      for (const s of [-1, 1]) ball(m, s * 1.85, -0.2, cz - 0.7, 0.62, 1.7, 1.35, hair, 12);
      ball(m, 0, -1.4, cz - 0.6, 1.95, 1.1, 1.3, hair, 12);
      break;
    case 'ponytail':
      cap();
      fringe();
      lock(0, -2.2, cz + 0.5, 0.55, hairDeep);
      for (let i = 0; i < 5; i++) lock(0, -2.5 - i * 0.12, cz - 0.2 - i * 0.95, 0.78 - i * 0.08);
      break;
    case 'bun':
      cap();
      fringe();
      lock(0, -1.9, cz + 1.3, 1.05, hairLit);
      break;
    case 'topknot':
      cap();
      fringe();
      lock(0, -0.4, cz + R.z + 0.6, 0.95, hairLit);
      break;
    case 'pigtails':
      cap();
      fringe();
      for (const s of [-1, 1]) {
        lock(s * 2.1, -0.6, cz + 0.6, 0.45, hairDeep);
        for (let i = 0; i < 4; i++)
          lock(s * (2.35 + i * 0.1), -0.7, cz - 0.1 - i * 0.85, 0.66 - i * 0.07);
      }
      break;
    case 'braid':
      cap();
      fringe();
      for (let i = 0; i < 7; i++)
        lock(0, -2.25, cz - 0.4 - i * 0.78, 0.55 - i * 0.025, i % 2 ? hair : hairLit);
      break;
    case 'spiky':
      cap(0.12, 0.6);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const x = Math.cos(a) * 1.3;
        const y = Math.sin(a) * 1.3 - 0.2;
        m.cylinder(x, y, cz + 1.7, cz + 3.2, 0.7, 0, i % 2 ? hair : hairLit, { segments: 7 });
      }
      m.cylinder(0, 0.4, cz + 2.0, cz + 3.5, 0.8, 0, hairLit, { segments: 7 });
      break;
    default:
      cap();
      fringe();
      for (const s of [-1, 1]) rb(m, s * 1.78, -0.3, cz - 0.9, s * 2.12, 0.7, cz + 0.6, hair, 0.25);
      break;
  }
}

/** One arm about its shoulder, hanging down -z: the upper arm, an elbow, the forearm and a hand with a thumb. */
function arm(o: ReturnType<typeof outfit>, female: boolean): MeshBuilder {
  const m = new MeshBuilder();
  const k = female ? 0.9 : 1;
  const E = -3.15;
  const W = -BODY.arm + 0.55;
  const top = o.sleeves === 'none' ? SKIN : o.sleeve;
  // The shoulder's round top, then the upper arm.
  ball(m, 0, 0, -0.35, 0.7 * k, 0.7 * k, 0.62, top, 12);
  const sleeveTo = o.sleeves === 'long' ? W + 0.35 : o.sleeves === 'short' ? -1.7 : 0.2;
  if (o.sleeves !== 'none') {
    m.tube([0, 0, -0.3], [0, 0.05, Math.max(sleeveTo, E)], 0.68 * k, o.sleeve, {
      segments: 12,
      r1: 0.6 * k,
    });
    if (o.sleeves === 'short')
      m.cylinder(
        0,
        0.02,
        sleeveTo - 0.2,
        sleeveTo + 0.1,
        0.64 * k,
        0.65 * k,
        darker(o.sleeve, 0.06),
        {
          segments: 12,
        },
      );
  }
  if (sleeveTo > E)
    m.tube([0, 0.02, Math.min(sleeveTo, -0.2)], [0, 0.05, E], 0.56 * k, SKIN, {
      segments: 10,
      r1: 0.5 * k,
    });
  ball(
    m,
    0,
    0.05,
    E,
    (o.sleeves === 'long' ? 0.6 : 0.5) * k,
    0.55 * k,
    0.55,
    o.sleeves === 'long' ? o.sleeve : SKIN,
    10,
  );
  // The forearm, a little forward of the elbow as an arm hangs.
  if (o.sleeves === 'long') {
    m.tube([0, 0.05, E], [0, 0.25, W + 0.45], 0.58 * k, o.sleeve, { segments: 12, r1: 0.5 * k });
    m.cylinder(0, 0.25, W + 0.3, W + 0.75, 0.52 * k, 0.54 * k, darker(o.sleeve, 0.14), {
      segments: 12,
    });
  } else m.tube([0, 0.05, E], [0, 0.25, W + 0.3], 0.5 * k, SKIN, { segments: 10, r1: 0.38 * k });
  // The hand: a palm, closed fingers below it and a thumb forward.
  ball(m, 0, 0.3, W - 0.2, 0.36 * k, 0.5 * k, 0.6, SKIN, 10);
  ball(m, 0, 0.34, W - 0.75, 0.32 * k, 0.44 * k, 0.4, SKIN, 8);
  m.tube([0, 0.62, W + 0.05], [0, 0.95, W - 0.45], 0.15, SKIN_SHADE, { segments: 6 });
  return m;
}

/** A thigh about its hip, down to the knee, tapering. */
function thigh(o: ReturnType<typeof outfit>, female: boolean): MeshBuilder {
  const m = new MeshBuilder();
  const k = female ? 0.95 : 1;
  ball(m, 0, 0, 0, 1.0 * k, 1.0 * k, 0.95, o.legs, 12);
  m.tube([0, 0, 0], [0, 0.05, -BODY.thigh], 1.0 * k, o.legs, { segments: 14, r1: 0.74 * k });
  ball(m, 0, 0.08, -BODY.thigh, 0.76 * k, 0.8 * k, 0.72, o.legs, 10);
  return m;
}

/** A shin, about the knee, down to the ankle, with the calf behind it; trousers break over the shoe. */
function shin(o: ReturnType<typeof outfit>, female: boolean): MeshBuilder {
  const m = new MeshBuilder();
  const k = female ? 0.92 : 1;
  const L = BODY.shin - BODY.ankle;
  const bare = o.legs === SKIN;
  m.tube([0, 0.05, 0], [0, 0, -L + 0.2], 0.74 * k, o.legs, {
    segments: 14,
    r1: bare ? 0.42 : 0.6 * k,
  });
  ball(m, 0, -0.28, -1.5, 0.7 * k, 0.6 * k, 1.2, o.legs, 10);
  if (bare) m.cylinder(0, 0, -L - 0.1, -L + 0.75, 0.48, 0.46, WHITE, { segments: 10 });
  else
    m.cylinder(0, 0.05, -L - 0.25, -L + 0.5, 0.66 * k, 0.62 * k, darker(o.legs, 0.08), {
      segments: 12,
    });
  return m;
}

/** A shoe, about the ankle: a rounded toe forward, a heel, a pale sole. */
function foot(): MeshBuilder {
  const m = new MeshBuilder();
  const a = BODY.ankle;
  // The upper: an egg from heel to toe, cut flat at the sole.
  m.sphere(0, 0.75, -a + 0.25, 0.66, 1.62, 0.95, SHOE, {
    segments: 14,
    rings: 8,
    from: 0.5,
    to: 1,
  });
  ball(m, 0, -0.2, -a + 0.6, 0.6, 0.62, 0.65, SHOE, 10);
  // The sole and its heel.
  rb(m, -0.68, -0.88, -a, 0.68, 2.4, -a + 0.3, SOLE, 0.14);
  // The laces' strip over the instep.
  rb(m, -0.28, 0.6, -a + 0.95, 0.28, 1.45, -a + 1.15, lighter(SHOE, 0.35), 0.1);
  return m;
}

/** The torso in its outfit, about the hips (z = 0 at the hips), with the head on it. */
function torso(look: CharacterLook, o: ReturnType<typeof outfit>): MeshBuilder {
  const m = new MeshBuilder();
  const clothing = look.clothing ?? 'tee';
  const t = o.t;
  const female = look.gender === 'female';
  const P = torsoProfile(female);
  const H = SHOULDER_Z;
  const opt = { segments: 22, sx: TORSO_SX, sy: TORSO_SY };
  // Below the belt in the legs' colour (or the skirt's), the shirt above.
  const BELT = 1.05;
  const lower = P.filter((p) => p.z <= BELT);
  lower.push({ r: torsoR(P, BELT), z: BELT }, { r: 0, z: BELT });
  m.lathe(0, 0, lower, o.skirt ? o.skirt.colour : o.legs, opt);
  const upper = [
    { r: 0, z: BELT - 0.05 },
    { r: torsoR(P, BELT - 0.05), z: BELT - 0.05 },
    ...P.filter((p) => p.z > BELT),
  ];
  m.lathe(0, 0, upper, o.torso, {
    ...opt,
    colours: upper.map((p) => (p.z > H - 1.2 ? o.torso : o.torso)),
  });
  // A band round the body between two heights (a belt, a stripe, a hem), just proud of it.
  const band = (z0: number, z1: number, c: Rgb, out = 0.06) =>
    m.lathe(
      0,
      0,
      [
        { r: torsoR(P, z0) + out, z: z0 },
        { r: torsoR(P, (z0 + z1) / 2) + out, z: (z0 + z1) / 2 },
        { r: torsoR(P, z1) + out, z: z1 },
      ],
      c,
      opt,
    );
  if (!o.skirt && clothing !== 'overalls' && clothing !== 'dress') {
    band(BELT - 0.25, BELT + 0.2, darker(o.legs, 0.45));
    rb(
      m,
      -0.32,
      TORSO_SY * torsoR(P, BELT) - 0.1,
      BELT - 0.22,
      0.32,
      TORSO_SY * torsoR(P, BELT) + 0.12,
      BELT + 0.17,
      BRASS,
      0.06,
    );
  }
  // A patch on the chest's front, following the body's curve at its height.
  const frontY = (x: number, z: number) =>
    TORSO_SY * Math.sqrt(Math.max(0, torsoR(P, z) ** 2 - (x / TORSO_SX) ** 2));
  const front = (x0: number, z0: number, x1: number, z1: number, c: Rgb, out = 0.08) => {
    const y = Math.min(
      frontY(x0, (z0 + z1) / 2),
      frontY(x1, (z0 + z1) / 2),
      frontY((x0 + x1) / 2, z0),
      frontY((x0 + x1) / 2, z1),
    );
    rb(m, x0, y - 0.25, z0, x1, y + out, z1, c, Math.min(0.15, (x1 - x0) / 3, (z1 - z0) / 3));
  };
  // The collar's opening at the neck.
  const collar = (c: Rgb) =>
    m.cylinder(0, 0, H - 0.25, H + 0.45, 1.05, 0.9, c, { segments: 16, sy: 0.8 });
  switch (clothing) {
    case 'stripes':
      for (let z = 1.8; z < H - 0.8; z += 1.15) band(z, z + 0.45, t.contrast);
      collar(t.dark);
      break;
    case 'jumper':
      band(BELT + 0.1, BELT + 0.75, t.accent);
      collar(t.accent);
      break;
    case 'hoodie':
      // The hood lying round the back of the neck, a front pocket and the drawstrings.
      ball(m, 0, -1.0, H - 0.1, 1.9, 1.05, 0.85, t.accent, 14);
      front(-1.6, 1.6, 1.6, 3.4, t.dark, 0.14);
      for (const s of [-1, 1]) front(s * 0.5 - 0.07, H - 2.4, s * 0.5 + 0.07, H - 0.5, WHITE, 0.16);
      break;
    case 'vest':
      front(-0.5, BELT, 0.5, H - 0.3, t.dark, 0.1);
      collar(t.dark);
      break;
    case 'suit':
      // A shirt and tie in the jacket's V, lapels either side and a pocket square.
      front(-0.75, H - 2.6, 0.75, H - 0.15, WHITE, 0.1);
      front(-0.2, H - 2.9, 0.2, H - 0.45, t.base, 0.16);
      front(-0.26, H - 0.75, 0.26, H - 0.35, darker(t.base, 0.2), 0.18);
      for (const s of [-1, 1])
        front(s * 0.95 - 0.28, H - 2.8, s * 0.95 + 0.28, H - 0.2, darker(t.deep, 0.22), 0.14);
      front(-1.75, H - 2.0, -1.2, H - 1.65, WHITE, 0.14);
      for (const z of [2.0, 3.0])
        ball(m, 0.32, frontY(0.32, z) + 0.05, z, 0.12, 0.08, 0.12, darker(t.deep, 0.4), 6);
      break;
    case 'polo':
      collar(t.contrast);
      for (const s of [-1, 1])
        front(s * 0.62 - 0.4, H - 0.7, s * 0.62 + 0.4, H - 0.15, t.contrast, 0.14);
      front(-0.16, H - 1.9, 0.16, H - 0.6, t.dark, 0.1);
      break;
    case 'flannel':
      for (let z = 1.8; z < H - 0.4; z += 1.2) band(z, z + 0.22, t.accent, 0.05);
      for (let x = -1.6; x <= 1.6; x += 0.8)
        front(x - 0.09, BELT + 0.2, x + 0.09, H - 0.6, t.accent, 0.1);
      collar(t.dark);
      break;
    case 'overalls':
      band(-0.95, 2.3, DENIM, 0.08);
      front(-1.3, 2.0, 1.3, H - 1.4, DENIM, 0.12);
      for (const s of [-1, 1]) {
        front(s * 1.05 - 0.26, H - 1.6, s * 1.05 + 0.26, H - 0.1, DENIM_LIGHT, 0.16);
        ball(m, s * 1.05, frontY(s * 1.05, H - 1.55) + 0.14, H - 1.55, 0.18, 0.1, 0.18, BRASS, 6);
      }
      collar(t.dark);
      break;
    case 'labcoat':
      front(-0.6, H - 2.4, 0.6, H - 0.15, o.t.base, 0.1);
      for (const s of [-1, 1])
        front(s * 0.72 - 0.18, BELT, s * 0.72 + 0.18, H - 0.1, mix(COAT, 0x000000, 0.12), 0.14);
      front(1.0, H - 2.4, 1.7, H - 1.8, o.t.base, 0.14);
      break;
    case 'hawaiian':
      for (const [x, z, c] of [
        [-1.3, 2.0, PETAL],
        [1.1, 2.8, BLOOM],
        [-0.3, 3.8, LEAF],
        [1.3, 4.6, PETAL],
        [-1.4, 4.9, BLOOM],
        [0.4, 1.6, LEAF],
      ] as const)
        ball(m, x, frontY(x, z) + 0.02, z, 0.38, 0.12, 0.38, c, 8);
      collar(t.dark);
      break;
    case 'varsity':
      band(BELT + 0.05, BELT + 0.55, t.contrast);
      front(-1.7, 3.3, -0.6, 4.6, t.contrast, 0.12);
      collar(t.contrast);
      break;
    case 'turtleneck':
      m.cylinder(0, -0.08, H - 0.3, H + 1.2, 0.98, 0.9, t.dark, { segments: 16 });
      break;
    case 'apron':
      front(-1.7, -0.6, 1.7, H - 1.6, APRON, 0.16);
      for (const s of [-1, 1]) front(s * 1.2 - 0.18, H - 1.7, s * 1.2 + 0.18, H, APRON, 0.16);
      collar(t.dark);
      break;
    case 'dress':
      band(BELT - 0.1, BELT + 0.35, t.dark);
      collar(t.dark);
      break;
    default:
      collar(t.dark);
      break;
  }
  head(m, look, H + 0.5);
  return m;
}

/** A skirt, a dress's skirt or a coat's tails: a flared tube from the hips down to `to`, about the hips. */
function skirt(o: ReturnType<typeof outfit>, female: boolean): MeshBuilder | null {
  if (!o.skirt) return null;
  const m = new MeshBuilder();
  const { colour, to, flare } = o.skirt;
  const hips = female ? 2.2 : 2.05;
  m.lathe(
    0,
    0,
    [
      { r: hips + flare, z: to - BODY.hip },
      { r: hips + flare * 0.92, z: to - BODY.hip + 0.3 },
      { r: hips + flare * 0.45, z: (to - BODY.hip) * 0.5 },
      { r: hips + 0.08, z: 1.0 },
      { r: 0, z: 1.1 },
    ],
    colour,
    {
      segments: 24,
      sx: TORSO_SX,
      sy: TORSO_SY + 0.12,
      colours: [darker(colour, 0.12), darker(colour, 0.05), colour, colour, colour],
    },
  );
  return m;
}

/** A character's parts from its look, each about its joint. */
export function characterParts(look: CharacterLook): CharacterParts {
  const o = outfit(look.clothing ?? 'tee', look.shirt ? parseColour(look.shirt) : 0x0ea5e9);
  const female = look.gender === 'female';
  const sk = skirt(o, female);
  const armX = female ? BODY.armX - 0.2 : BODY.armX;
  return {
    torso: { mesh: torso(look, o), pivot: [0, 0, BODY.hip] },
    armL: { mesh: arm(o, female), pivot: [-armX, 0, SHOULDER_Z - 0.55] },
    armR: { mesh: arm(o, female), pivot: [armX, 0, SHOULDER_Z - 0.55] },
    thighL: { mesh: thigh(o, female), pivot: [-BODY.legX, 0, BODY.hip] },
    thighR: { mesh: thigh(o, female), pivot: [BODY.legX, 0, BODY.hip] },
    shinL: { mesh: shin(o, female), pivot: [0, 0, -BODY.thigh] },
    shinR: { mesh: shin(o, female), pivot: [0, 0, -BODY.thigh] },
    footL: { mesh: foot(), pivot: [0, 0, -(BODY.shin - BODY.ankle)] },
    footR: { mesh: foot(), pivot: [0, 0, -(BODY.shin - BODY.ankle)] },
    skirt: sk ? { mesh: sk, pivot: [0, 0, BODY.hip] } : null,
  };
}

/** A look's key: what changes the model (never the pose). */
export function lookKey(look: CharacterLook): string {
  return [look.gender, look.clothing, look.hair, look.hairColour, look.shirt].join('|');
}
