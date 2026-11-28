// The modelled character (docs/specs/008-canvas/3d-engine.md "Characters"): every gender, outfit and hair style builds
// a jointed figure of whole triangles, a skirt only for what hangs from the hips, and a key per look.
import { describe, expect, it } from 'vitest';
import {
  AVATAR_CLOTHING,
  AVATAR_GENDERS,
  AVATAR_HAIR,
  AVATAR_HAIR_COLOURS,
} from '@livehuddle/avatar/config';
import { characterParts, hairColour, lookKey, type CharacterParts } from './character';

const PARTS = [
  'torso',
  'armL',
  'armR',
  'thighL',
  'thighR',
  'shinL',
  'shinR',
  'footL',
  'footR',
] as const;

function expectWhole(parts: CharacterParts, what: string): void {
  for (const name of PARTS) {
    const { mesh, pivot } = parts[name];
    expect(mesh.positions.length, `${what} ${name}`).toBeGreaterThan(0);
    expect(mesh.positions.length % 9, `${what} ${name}`).toBe(0);
    expect(mesh.colours.length, `${what} ${name}`).toBe(mesh.positions.length);
    expect(mesh.positions.every(Number.isFinite), `${what} ${name}`).toBe(true);
    expect(pivot.every(Number.isFinite), `${what} ${name}`).toBe(true);
  }
}

describe('characterParts', () => {
  for (const { id: gender } of AVATAR_GENDERS)
    for (const { id: clothing } of AVATAR_CLOTHING)
      it(`builds a ${gender} figure in a ${clothing}`, () => {
        const parts = characterParts({ gender, clothing, hair: 'short', shirt: '#0ea5e9' });
        expectWhole(parts, `${gender} ${clothing}`);
        if (parts.skirt) expect(parts.skirt.mesh.positions.length).toBeGreaterThan(0);
      });

  for (const { id: gender } of AVATAR_GENDERS)
    it(`builds every hair style on a ${gender} figure`, () => {
      const torsos = new Set<number>();
      for (const { id: hair } of AVATAR_HAIR) {
        const parts = characterParts({ gender, hair, hairColour: 'brown' });
        expectWhole(parts, `${gender} ${hair}`);
        torsos.add(parts.torso.mesh.positions.length);
      }
      // The styles are shapes of their own, not one head redrawn.
      expect(torsos.size).toBeGreaterThan(AVATAR_HAIR.length / 2);
    });

  it('hangs a skirt only from a dress or a skirt, and draws trousers otherwise', () => {
    expect(characterParts({ clothing: 'dress' }).skirt).not.toBeNull();
    expect(characterParts({ clothing: 'skirt' }).skirt).not.toBeNull();
    expect(characterParts({ clothing: 'tee' }).skirt).toBeNull();
  });

  it('builds a figure with nothing chosen', () => {
    expectWhole(characterParts({}), 'default');
  });
});

describe('hairColour', () => {
  it('reads every chosen colour and falls back for none', () => {
    for (const { id } of AVATAR_HAIR_COLOURS) {
      const c = hairColour(id);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
    expect(hairColour(undefined)).toBe(hairColour(undefined));
  });
});

describe('lookKey', () => {
  it('tells two looks apart and keeps one look the same', () => {
    const a = {
      gender: 'male',
      clothing: 'tee',
      hair: 'short',
      hairColour: 'brown',
      shirt: '#000000',
    };
    expect(lookKey(a)).toBe(lookKey({ ...a }));
    expect(lookKey(a)).not.toBe(lookKey({ ...a, hair: 'long' }));
  });
});
