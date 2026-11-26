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
  /** Each shin and shoe, about its knee (in its thigh's units). */
  shinL: CharacterPart;
  shinR: CharacterPart;
  /** What hangs from the hips over the legs (a skirt, a dress, a lab coat's tails), about the hips. */
  skirt: CharacterPart | null;
};

/** The figure's measures, in sprite pixels. */
export const BODY = {
  hip: 6.8,
  thigh: 3.3,
  shin: 3.5,
  shoulder: 12.9,
  arm: 6.2,
  legX: 1.55,
  armX: 4.15,
  height: 22.4,
} as const;

const SKIN = 0xf4c99b;
const SKIN_DARK = 0xd9a674;
const TROUSERS = 0x3f4c63;
const SHOE = 0x1e293b;
const EYE = 0x243044;
const WHITE = 0xf8fafc;
const DENIM = 0x41597f;
const DENIM_LIGHT = 0x7391c2;
const COAT = 0xeef2f6;
const APRON = 0x8b5e34;
const BRASS = 0xe0b13e;
const LEAF = 0x22a34a;
const BLOOM = 0xfde047;
const PETAL = 0xdb2777;
const LIP = 0xc0606a;
const BLUSH = 0xf0a0a0;

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
      o.skirt = { colour: t.base, to: 1.8, flare: 1.5 };
      break;
    case 'skirt':
      o.sleeves = 'short';
      o.legs = SKIN;
      o.skirt = { colour: t.alt, to: 3.2, flare: 1.1 };
      break;
    case 'overalls':
      o.sleeves = 'short';
      o.legs = DENIM;
      break;
    case 'labcoat':
      o.torso = COAT;
      o.sleeve = COAT;
      o.skirt = { colour: COAT, to: 2.4, flare: 0.6 };
      break;
    case 'varsity':
      o.sleeve = t.contrast;
      break;
    default:
      break;
  }
  return o;
}

/** The head, face and hair, about the neck's foot (z = 0 at the top of the torso). */
function head(m: MeshBuilder, look: CharacterLook, z0: number): void {
  const hair = hairColour(look.hairColour);
  const hairLit = lighter(hair, 0.12);
  const style = look.hair ?? 'short';
  const female = look.gender === 'female';
  const hz = z0 + 0.6;
  const H = 8.4;
  const hw = 4.25;
  const hd = 3.8;
  // The neck and the head.
  m.cylinder(0, 0, z0 - 0.4, hz + 0.6, 1.25, 1.2, SKIN_DARK, { segments: 12 });
  rb(m, -hw, -hd, hz, hw, hd, hz + H, SKIN, 3.1);
  // Ears.
  for (const s of [-1, 1])
    rb(m, s * (hw - 0.5), -0.9, hz + 2.9, s * (hw + 0.55), 0.7, hz + 4.9, SKIN_DARK, 0.4);
  // The face, on its front: eyes with a catchlight, brows, a nose, a mouth and blush.
  const fy = hd;
  const ez = hz + 3.7;
  for (const s of [-1, 1]) {
    const ex = s * 1.75;
    rb(m, ex - 0.55, fy - 0.35, ez - 0.95, ex + 0.55, fy + 0.3, ez + 0.95, EYE, 0.35);
    rb(
      m,
      ex - 0.1 + s * -0.15,
      fy + 0.25,
      ez + 0.25,
      ex + 0.3 + s * -0.15,
      fy + 0.4,
      ez + 0.65,
      WHITE,
      0.08,
    );
    rb(m, ex - 0.85, fy - 0.2, ez + 1.45, ex + 0.85, fy + 0.3, ez + 1.85, darker(hair, 0.1), 0.15);
    if (female)
      rb(m, ex + s * 0.45, fy - 0.2, ez + 0.75, ex + s * 0.95, fy + 0.35, ez + 1.15, EYE, 0.1);
    rb(
      m,
      s * 2.7 - 0.6,
      fy - 0.3,
      ez - 1.75,
      s * 2.7 + 0.6,
      fy + 0.12,
      ez - 1.25,
      mix(SKIN, BLUSH, 0.55),
      0.15,
    );
  }
  rb(m, -0.35, fy - 0.2, ez - 1.25, 0.35, fy + 0.4, ez - 0.45, SKIN_DARK, 0.2);
  rb(m, -0.75, fy - 0.2, ez - 2.35, 0.75, fy + 0.25, ez - 2.0, LIP, 0.12);
  if (style === 'bald') return;
  const top = hz + H;
  // Every style but a buzz cut and a mohawk starts from a cap over the crown and down the back.
  const cap = (lift = 0.5, back = 3.2) => {
    rb(m, -hw - 0.35, -hd - 0.4, top - 3.4, hw + 0.35, hd + 0.35, top + lift, hair, 3.2, hairLit);
    rb(m, -hw - 0.3, -hd - 0.45, top - 3 - back, hw + 0.3, -hd + 1.4, top - 1, hair, 1.6);
    // A side-swept fringe.
    rb(m, -hw + 0.2, hd - 0.4, top - 3.8, 1.2, hd + 0.55, top - 1.2, hair, 0.8, hairLit);
    rb(m, 1.0, hd - 0.4, top - 3.1, hw - 0.2, hd + 0.5, top - 1.2, hair, 0.8, hairLit);
    // Sideburns over the ears.
    for (const s of [-1, 1])
      rb(m, s * hw - 0.4, -hd + 0.6, top - 4.6, s * hw + 0.4, hd - 1.3, top - 1.4, hair, 0.5);
  };
  const ball = (x: number, y: number, z: number, r: number, c = hair) =>
    m.sphere(x, y, z, r, r, r, c, { segments: 14, rings: 8 });
  switch (style) {
    case 'buzz':
      rb(
        m,
        -hw - 0.15,
        -hd - 0.15,
        top - 2.8,
        hw + 0.15,
        hd + 0.15,
        top + 0.18,
        hair,
        2.4,
        hairLit,
      );
      rb(m, -hw - 0.15, -hd - 0.2, top - 5.5, hw + 0.15, -hd + 1, top - 1.5, hair, 1);
      break;
    case 'mohawk':
      rb(
        m,
        -hw - 0.1,
        -hd - 0.1,
        top - 2.2,
        hw + 0.1,
        hd + 0.1,
        top + 0.1,
        darker(hair, 0.25),
        2.2,
      );
      for (let i = 0; i < 5; i++) {
        const y = -hd + 0.6 + i * 1.6;
        rb(
          m,
          -0.8,
          y - 0.8,
          top - 0.5,
          0.8,
          y + 0.8,
          top + 2.6 - Math.abs(i - 2) * 0.4,
          hair,
          0.6,
          hairLit,
        );
      }
      break;
    case 'curly':
    case 'afro': {
      const big = style === 'afro' ? 1.35 : 1;
      cap(0.3, 2.4);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ball(
          Math.cos(a) * 3.6 * big,
          Math.sin(a) * 3.3 * big,
          top - 0.6 + (i % 2) * 0.6,
          1.9 * big,
          i % 3 === 0 ? hairLit : hair,
        );
      }
      ball(0, 0, top + 0.6 * big, 3 * big, hairLit);
      if (style === 'afro') for (const s of [-1, 1]) ball(s * hw * 1.1, -0.6, top - 3.2, 2.4, hair);
      break;
    }
    case 'long':
      cap();
      rb(m, -hw - 0.4, -hd - 0.5, hz - 3.2, hw + 0.4, -hd + 1.8, top - 1, hair, 1.4);
      for (const s of [-1, 1])
        rb(m, s * (hw - 0.1), -hd, hz - 2.6, s * (hw + 0.9), hd - 1.4, top - 2, hair, 0.8);
      break;
    case 'bob':
      cap();
      for (const s of [-1, 1])
        rb(m, s * (hw - 0.3), -hd - 0.4, hz + 1.2, s * (hw + 0.7), hd - 0.6, top - 1.5, hair, 1.6);
      rb(m, -hw - 0.5, -hd - 0.6, hz + 1.2, hw + 0.5, -hd + 1.6, top - 1, hair, 1.2);
      break;
    case 'ponytail':
      cap();
      ball(0, -hd - 0.8, top - 2.4, 1.1, darker(hair, 0.2));
      for (let i = 0; i < 4; i++)
        ball(0, -hd - 1.5 - i * 0.35, top - 3.4 - i * 1.6, 1.45 - i * 0.18);
      break;
    case 'bun':
    case 'topknot':
      cap();
      if (style === 'bun') ball(0, -hd - 0.6, top - 1.2, 2.2, hairLit);
      else ball(0, -0.4, top + 1.4, 1.9, hairLit);
      break;
    case 'pigtails':
      cap();
      for (const s of [-1, 1]) {
        ball(s * (hw + 0.9), -1, top - 2.6, 1.0, darker(hair, 0.2));
        for (let i = 0; i < 3; i++)
          ball(s * (hw + 1.5 + i * 0.25), -1.2, top - 3.8 - i * 1.5, 1.4 - i * 0.15);
      }
      break;
    case 'braid':
      cap();
      for (let i = 0; i < 6; i++)
        ball(0, -hd - 0.9, top - 3 - i * 1.25, 1.05 - i * 0.04, i % 2 ? hair : hairLit);
      break;
    case 'spiky':
      cap(0.2, 2.6);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const x = Math.cos(a) * 2.4;
        const y = Math.sin(a) * 2.2;
        m.cylinder(x, y, top - 0.6, top + 2.4, 1.5, 0, i % 2 ? hair : hairLit, { segments: 8 });
      }
      m.cylinder(0, 0, top - 0.4, top + 3, 1.7, 0, hairLit, { segments: 8 });
      break;
    default:
      cap();
      break;
  }
}

/** One arm about its shoulder, hanging down -z: its sleeve, the bare forearm or cuff, and its hand. */
function arm(o: ReturnType<typeof outfit>): MeshBuilder {
  const m = new MeshBuilder();
  const w = 1.1;
  const L = BODY.arm;
  const bare = o.sleeves === 'none' ? 0 : o.sleeves === 'short' ? L * 0.42 : L * 0.86;
  if (bare > 0) rb(m, -w - 0.1, -w - 0.1, -bare, w + 0.1, w + 0.1, 0.9, o.sleeve, 1);
  if (bare < L) rb(m, -w + 0.1, -w + 0.1, -L + 0.2, w - 0.1, w - 0.1, -bare + 0.3, SKIN, 0.9);
  if (o.sleeves === 'long')
    rb(
      m,
      -w - 0.15,
      -w - 0.15,
      -L * 0.88,
      w + 0.15,
      w + 0.15,
      -L * 0.76,
      darker(o.sleeve, 0.12),
      0.4,
    );
  m.sphere(0, 0.1, -L - 0.25, 1.2, 1.15, 1.25, SKIN, { segments: 12, rings: 7 });
  return m;
}

/** A thigh about its hip, down to the knee. */
function thigh(o: ReturnType<typeof outfit>): MeshBuilder {
  const m = new MeshBuilder();
  rb(m, -1.3, -1.35, -BODY.thigh - 0.3, 1.3, 1.35, 0.4, o.legs, 1);
  return m;
}

/** A shin and its shoe, about the knee. */
function shin(o: ReturnType<typeof outfit>): MeshBuilder {
  const m = new MeshBuilder();
  const L = BODY.shin;
  rb(m, -1.2, -1.25, -L + 1.1, 1.2, 1.25, 0.3, o.legs, 0.9);
  if (o.legs === SKIN) rb(m, -1.22, -1.27, -L + 1.0, 1.22, 1.27, -L + 1.6, WHITE, 0.4);
  // The shoe: a rounded toe forward, a sole a shade darker.
  rb(m, -1.3, -1.5, -L, 1.3, 2.0, -L + 1.35, SHOE, 0.6);
  rb(m, -1.32, -1.52, -L - 0.05, 1.32, 2.02, -L + 0.35, darker(SHOE, 0.35), 0.15);
  return m;
}

/** The torso in its outfit, about the hips (z = 0 at the hips), with the head on it. */
function torso(look: CharacterLook, o: ReturnType<typeof outfit>): MeshBuilder {
  const m = new MeshBuilder();
  const clothing = look.clothing ?? 'tee';
  const t = o.t;
  const H = BODY.shoulder - BODY.hip + 0.9;
  const female = look.gender === 'female';
  const W = female ? 3.4 : 3.65;
  const D = 2.05;
  // Hips in the legs' colour (or the skirt's) and a belt; the chest above, a little broader at the shoulders.
  rb(m, -W + 0.15, -D, -0.6, W - 0.15, D, 1.4, o.skirt ? o.skirt.colour : o.legs, 1);
  if (!o.skirt && clothing !== 'overalls')
    rb(m, -W + 0.1, -D - 0.05, 1.0, W - 0.1, D + 0.05, 1.6, darker(o.legs, 0.4), 0.3);
  rb(m, -W, -D, 1.3, W, D, H, o.torso, 1.5);
  rb(m, -W - 0.25, -D + 0.1, H - 2.2, W + 0.25, D - 0.1, H, o.torso, 1.1);
  const fy = D;
  const front = (x0: number, z0: number, x1: number, z1: number, c: Rgb, out = 0.25) =>
    rb(m, x0, fy - 0.3, z0, x1, fy + out, z1, c, 0.2);
  switch (clothing) {
    case 'stripes':
      for (let z = 2.3; z < H - 0.6; z += 1.6) {
        rb(m, -W - 0.06, -D - 0.06, z, W + 0.06, D + 0.06, z + 0.6, t.contrast, 0.25);
      }
      break;
    case 'jumper':
      rb(m, -W - 0.06, -D - 0.06, 1.3, W + 0.06, D + 0.06, 2.0, t.accent, 0.3);
      front(-1.3, H - 0.9, 1.3, H - 0.3, t.accent);
      break;
    case 'hoodie':
      rb(m, -2.6, -D - 1.0, H - 1.4, 2.6, -D + 0.6, H + 0.9, t.accent, 0.9);
      front(-2.2, 2.2, 2.2, 4.4, t.dark, 0.4);
      for (const s of [-1, 1]) front(s * 0.7 - 0.12, H - 3, s * 0.7 + 0.12, H - 0.6, WHITE, 0.4);
      break;
    case 'vest':
      front(-0.6, 1.6, 0.6, H - 0.4, t.dark, 0.3);
      break;
    case 'suit':
      front(-1.05, 2.0, 1.05, H - 0.2, WHITE, 0.3);
      front(-0.42, 2.4, 0.42, H - 0.8, t.base, 0.45);
      front(-0.6, H - 1.0, 0.6, H - 0.35, t.base, 0.5);
      for (const s of [-1, 1])
        front(s * 1.05 - 0.4, 2.8, s * 1.05 + 0.4, H - 0.4, darker(t.deep, 0.2), 0.42);
      break;
    case 'polo':
      front(-1.6, H - 0.9, 1.6, H + 0.1, t.contrast, 0.4);
      front(-0.3, H - 2.6, 0.3, H - 0.9, t.dark, 0.3);
      break;
    case 'flannel':
      for (let z = 2.2; z < H; z += 1.9)
        rb(m, -W - 0.05, -D - 0.05, z, W + 0.05, D + 0.05, z + 0.35, t.accent, 0.12);
      for (let x = -W + 1; x < W; x += 1.9) front(x, 1.4, x + 0.35, H - 0.2, t.accent, 0.3);
      break;
    case 'overalls':
      rb(m, -W - 0.06, -D - 0.06, -0.6, W + 0.06, D + 0.06, 3.2, DENIM, 0.9);
      front(-2.0, 2.6, 2.0, H - 1.6, DENIM, 0.4);
      for (const s of [-1, 1]) {
        front(s * 1.6 - 0.45, H - 2.2, s * 1.6 + 0.45, H + 0.1, DENIM_LIGHT, 0.45);
        front(s * 1.6 - 0.35, H - 2.2, s * 1.6 + 0.35, H - 1.5, BRASS, 0.6);
      }
      break;
    case 'labcoat':
      front(-0.9, 2.4, 0.9, H - 0.2, o.t.base, 0.3);
      for (const s of [-1, 1])
        front(s * 0.95 - 0.25, 1.5, s * 0.95 + 0.25, H - 0.1, mix(COAT, 0x000000, 0.12), 0.4);
      front(1.6, H - 3.0, 2.8, H - 2.3, o.t.base, 0.45);
      break;
    case 'hawaiian':
      for (const [x, z, c] of [
        [-2, 3, PETAL],
        [1.6, 4.4, BLOOM],
        [-0.4, 6.2, LEAF],
        [2.2, 7.2, PETAL],
        [-2.4, 7.4, BLOOM],
        [0.6, 2.4, LEAF],
      ] as const)
        front(x - 0.55, z - 0.55, x + 0.55, z + 0.55, c, 0.35);
      break;
    case 'varsity':
      front(-2.6, 4.6, -0.8, 6.8, t.contrast, 0.4);
      rb(m, -W - 0.06, -D - 0.06, 1.3, W + 0.06, D + 0.06, 1.9, t.contrast, 0.3);
      break;
    case 'turtleneck':
      m.cylinder(0, 0, H - 0.4, H + 1.0, 1.8, 1.7, t.dark, { segments: 16 });
      break;
    case 'apron':
      front(-2.6, -0.4, 2.6, H - 1.8, APRON, 0.45);
      for (const s of [-1, 1]) front(s * 1.8 - 0.3, H - 2, s * 1.8 + 0.3, H, APRON, 0.45);
      break;
    case 'dress':
      front(-W + 0.4, 1.0, W - 0.4, 1.6, t.dark, 0.2);
      break;
    default:
      front(-1.1, H - 0.7, 1.1, H - 0.2, t.dark, 0.2);
      break;
  }
  head(m, look, H);
  return m;
}

/** A skirt, a dress's skirt or a coat's tails: a flared tube from the hips down to `to`, about the hips. */
function skirt(o: ReturnType<typeof outfit>): MeshBuilder | null {
  if (!o.skirt) return null;
  const m = new MeshBuilder();
  const { colour, to, flare } = o.skirt;
  m.lathe(
    0,
    0,
    [
      { r: 3.5 + flare, z: to - BODY.hip },
      { r: 3.6 + flare * 0.5, z: (to - BODY.hip) * 0.5 },
      { r: 3.6, z: 0.6 },
      { r: 0, z: 0.7 },
    ],
    colour,
    { segments: 20, sy: 0.62, colours: [darker(colour, 0.08), colour, colour] },
  );
  return m;
}

/** A character's parts from its look, each about its joint. */
export function characterParts(look: CharacterLook): CharacterParts {
  const o = outfit(look.clothing ?? 'tee', look.shirt ? parseColour(look.shirt) : 0x0ea5e9);
  const sk = skirt(o);
  return {
    torso: { mesh: torso(look, o), pivot: [0, 0, BODY.hip] },
    armL: { mesh: arm(o), pivot: [-BODY.armX, 0, BODY.shoulder - BODY.hip] },
    armR: { mesh: arm(o), pivot: [BODY.armX, 0, BODY.shoulder - BODY.hip] },
    thighL: { mesh: thigh(o), pivot: [-BODY.legX, 0, BODY.hip] },
    thighR: { mesh: thigh(o), pivot: [BODY.legX, 0, BODY.hip] },
    shinL: { mesh: shin(o), pivot: [0, 0, -BODY.thigh] },
    shinR: { mesh: shin(o), pivot: [0, 0, -BODY.thigh] },
    skirt: sk ? { mesh: sk, pivot: [0, 0, BODY.hip] } : null,
  };
}

/** A look's key: what changes the model (never the pose). */
export function lookKey(look: CharacterLook): string {
  return [look.gender, look.clothing, look.hair, look.hairColour, look.shirt].join('|');
}
