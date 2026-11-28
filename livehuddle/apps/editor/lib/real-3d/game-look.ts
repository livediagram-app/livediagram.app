// Real 3D's game characters (docs/specs/008-canvas/3d-engine.md "Characters"): which of the artist-made parts
// (components/canvas/real-3d/characters/*.glb, Quaternius' Ultimate Modular Men and Women, CC0) a look wears, and
// which of their materials take its shirt and hair colours. Each pack is one rig with swappable heads, bodies, legs
// and feet; an outfit picks the nearest body and tints it, a hairstyle the nearest head. Pure: no three.js.

import { avatarBuildScale, hairColourHex, type AvatarHairColour } from '@livehuddle/avatar/config';
import type { CharacterLook } from './character';

export type GamePack = 'men' | 'women';

export type GameLook = {
  pack: GamePack;
  /** The part nodes' names in the pack (head:…, body:…, legs:…, feet:…). */
  parts: [head: string, body: string, legs: string, feet: string];
  /** Material colours by part and material name: what the shirt and hair colours paint. */
  tints: { part: string; material: string; colour: string }[];
  /** The face laid over the head: its iris and lip colours. */
  face: { iris: string; lips: string };
  /** The build's width-and-depth scale (avatar-mode.md "Build"): 1 at Regular, the character as it always was. */
  build: number;
};

type Outfit = { body: string; legs: string; feet: string; shirt: string[]; legsTint?: string };

const MEN: Record<string, Outfit> = {
  tee: { body: 'body:tee', legs: 'legs:jeans', feet: 'feet:trainers', shirt: ['LightBrown'] },
  hoodie: { body: 'body:hoodie', legs: 'legs:jeans', feet: 'feet:sneakers', shirt: ['Purple'] },
  suit: { body: 'body:suit', legs: 'legs:suit', feet: 'feet:shoes', shirt: ['Suit'] },
  vest: { body: 'body:vest', legs: 'legs:board', feet: 'feet:flipflops', shirt: ['LightBrown'] },
  jacket: { body: 'body:jacket', legs: 'legs:ripped', feet: 'feet:boots', shirt: ['Black'] },
  overalls: {
    body: 'body:overalls',
    legs: 'legs:overalls',
    feet: 'feet:workboots',
    shirt: ['Brown'],
  },
  hivis: { body: 'body:hivis', legs: 'legs:cargo', feet: 'feet:safety', shirt: ['Worker_Vest'] },
};
const WOMEN: Record<string, Outfit> = {
  tee: { body: 'body:tee', legs: 'legs:jeans', feet: 'feet:shoes', shirt: ['White'] },
  dress: { body: 'body:dress', legs: 'legs:dress', feet: 'feet:flats', shirt: ['LimeGreen'] },
  suit: { body: 'body:suit', legs: 'legs:suit', feet: 'feet:heels', shirt: ['Black'] },
  crop: { body: 'body:crop', legs: 'legs:ripped', feet: 'feet:boots', shirt: ['Pink'] },
  hivis: { body: 'body:hivis', legs: 'legs:cargo', feet: 'feet:safety', shirt: ['Worker_Vest'] },
};

/** Each clothing option's nearest outfit, per pack. */
const CLOTHES: Record<string, [men: string, women: string]> = {
  tee: ['tee', 'tee'],
  stripes: ['tee', 'tee'],
  jumper: ['hoodie', 'tee'],
  hoodie: ['hoodie', 'tee'],
  vest: ['vest', 'crop'],
  suit: ['suit', 'suit'],
  dress: ['tee', 'dress'],
  skirt: ['tee', 'dress'],
  polo: ['tee', 'tee'],
  flannel: ['overalls', 'tee'],
  overalls: ['overalls', 'tee'],
  labcoat: ['suit', 'suit'],
  hawaiian: ['vest', 'tee'],
  varsity: ['jacket', 'crop'],
  turtleneck: ['tee', 'tee'],
  apron: ['hivis', 'hivis'],
};

/** Each hairstyle's nearest head, and the materials that are its hair. */
const HEADS: Record<GamePack, Record<string, { head: string; hair: string[] }>> = {
  men: {
    short: { head: 'head:neat', hair: ['Hair'] },
    buzz: { head: 'head:casual', hair: ['Hair'] },
    bald: { head: 'head:casual', hair: ['Hair'] },
    curly: { head: 'head:curly', hair: ['Hair'] },
    afro: { head: 'head:curly', hair: ['Hair'] },
    spiky: { head: 'head:spiky', hair: ['Hair'] },
    mohawk: { head: 'head:mohawk', hair: ['Red'] },
  },
  women: {
    long: { head: 'head:long', hair: ['Hair_Blond'] },
    bun: { head: 'head:bun', hair: ['Red'] },
    short: { head: 'head:short', hair: ['Hair_Brown'] },
    mohawk: { head: 'head:mohawk', hair: ['Pink'] },
  },
};
const HAIR_FALLBACK: Record<GamePack, Record<string, string>> = {
  men: {
    long: 'short',
    ponytail: 'short',
    bun: 'short',
    topknot: 'short',
    pigtails: 'curly',
    braid: 'short',
    bob: 'curly',
  },
  women: {
    ponytail: 'long',
    pigtails: 'long',
    braid: 'long',
    bob: 'long',
    topknot: 'bun',
    spiky: 'mohawk',
    buzz: 'short',
    bald: 'short',
    curly: 'short',
    afro: 'short',
  },
};

/** A colour darkened to `k` of itself. */
function shade(hex: string, k: number): string {
  const v = parseInt(hex.replace('#', ''), 16);
  const ch = (s: number) => Math.round(((v >> s) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** The darker shade a suit takes of its shirt colour (as the sprite's outfitTones' deep). */
const deep = (hex: string) => shade(hex, 0.45);

/** Eye colours that go with a hair colour; brown for the rest. */
const IRIS: Record<string, string> = {
  blonde: '#3d6fb0',
  platinum: '#4f86c6',
  ginger: '#4c7a3c',
  auburn: '#4c7a3c',
  grey: '#5a7488',
  white: '#5a7488',
};

/** The game parts and colours a look wears. */
export function gameLook(look: CharacterLook): GameLook {
  const pack: GamePack = look.gender === 'female' ? 'women' : 'men';
  const clothing = look.clothing ?? 'tee';
  const outfits = pack === 'men' ? MEN : WOMEN;
  const outfit = outfits[CLOTHES[clothing]?.[pack === 'men' ? 0 : 1] ?? 'tee'] ?? outfits.tee!;
  const style = look.hair ?? 'short';
  const heads = HEADS[pack];
  const head = heads[style] ?? heads[HAIR_FALLBACK[pack][style] ?? ''] ?? Object.values(heads)[0]!;
  const shirt = /^#[0-9a-f]{6}$/i.test(look.shirt ?? '') ? look.shirt! : '#0ea5e9';
  const cloth = clothing === 'labcoat' ? '#eef2f6' : clothing === 'suit' ? deep(shirt) : shirt;
  const tints: GameLook['tints'] = [
    ...outfit.shirt.map((material) => ({ part: outfit.body, material, colour: cloth })),
    ...head.hair.map((material) => ({
      part: head.head,
      material,
      colour: hairColourHex(look.hairColour as AvatarHairColour | undefined),
    })),
  ];
  // Brows in the hair's colour, a shade deeper.
  const hair = hairColourHex(look.hairColour as AvatarHairColour | undefined);
  tints.push({ part: head.head, material: 'Eyebrows', colour: shade(hair, 0.72) });
  // A dress is one colour from the shoulders to the hem.
  if (outfit.body === 'body:dress')
    tints.push({ part: 'legs:dress', material: 'LimeGreen', colour: cloth });
  const iris = IRIS[look.hairColour ?? ''] ?? '#5b3a24';
  return {
    pack,
    parts: [head.head, outfit.body, outfit.legs, outfit.feet],
    tints,
    face: { iris, lips: pack === 'women' ? '#c45a63' : '#b5675f' },
    build: avatarBuildScale(look.build),
  };
}

/** What changes a game character's build (never its pose). */
export function gameLookKey(g: GameLook): string {
  const key = [g.pack, ...g.parts, ...g.tints.map((t) => `${t.part}/${t.material}=${t.colour}`)];
  // Only off Regular, so a Regular look's key (and every image cached under it) is as it was.
  if (g.build !== 1) key.push(`build=${g.build}`);
  return key.join('|');
}

/** The hairstyles the Hair flyout offers for a pack: every one, as before (a style the pack has no head for wears its nearest). */
export function gameHairStyles(pack: GamePack): string[] {
  return [...new Set([...Object.keys(HEADS[pack]), ...Object.keys(HAIR_FALLBACK[pack])])];
}

/** The style a tile stands for: the stored one itself. */
export function gameHairStyle(_pack: GamePack, style: string | undefined): string {
  return style ?? 'short';
}

/** The pack a look's gender wears. */
export function gamePackOf(gender: string | undefined): GamePack {
  return gender === 'female' ? 'women' : 'men';
}
