import { describe, expect, it } from 'vitest';
import { AVATAR_CLOTHING, AVATAR_HAIR, hairColourHex } from '@livehuddle/avatar/config';
import { gameLook, gameLookKey } from './game-look';

/** The parts each pack's model file holds (scripts/build-characters.mjs PACKS). */
const PACK_PARTS = {
  men: new Set([
    'head:casual',
    'head:neat',
    'head:curly',
    'head:spiky',
    'head:mohawk',
    'body:tee',
    'body:suit',
    'body:hoodie',
    'body:vest',
    'body:jacket',
    'body:overalls',
    'body:hivis',
    'legs:jeans',
    'legs:suit',
    'legs:shorts',
    'legs:board',
    'legs:ripped',
    'legs:overalls',
    'legs:cargo',
    'feet:trainers',
    'feet:shoes',
    'feet:sneakers',
    'feet:flipflops',
    'feet:boots',
    'feet:workboots',
    'feet:safety',
  ]),
  women: new Set([
    'head:long',
    'head:bun',
    'head:neat',
    'head:mohawk',
    'head:short',
    'body:tee',
    'body:dress',
    'body:suit',
    'body:crop',
    'body:hivis',
    'legs:jeans',
    'legs:dress',
    'legs:suit',
    'legs:ripped',
    'legs:cargo',
    'feet:shoes',
    'feet:flats',
    'feet:heels',
    'feet:boots',
    'feet:safety',
  ]),
};

describe('gameLook', () => {
  it('dresses every gender, outfit and hairstyle in parts its pack holds', () => {
    for (const gender of ['male', 'female'])
      for (const { id: clothing } of AVATAR_CLOTHING)
        for (const { id: hair } of AVATAR_HAIR) {
          const g = gameLook({ gender, clothing, hair, shirt: '#22c55e' });
          expect(g.pack).toBe(gender === 'female' ? 'women' : 'men');
          for (const part of g.parts)
            expect(PACK_PARTS[g.pack].has(part), `${gender} ${clothing} ${hair} ${part}`).toBe(
              true,
            );
          for (const t of g.tints) expect(g.parts).toContain(t.part);
        }
  });

  it('paints the shirt colour on the body and the hair colour on the hair', () => {
    const g = gameLook({
      gender: 'male',
      clothing: 'tee',
      hair: 'curly',
      hairColour: 'black',
      shirt: '#22c55e',
    });
    expect(g.tints).toContainEqual({ part: 'body:tee', material: 'LightBrown', colour: '#22c55e' });
    expect(g.tints).toContainEqual({
      part: 'head:curly',
      material: 'Hair',
      colour: hairColourHex('black'),
    });
  });

  it('gives brows a deeper shade of the hair and eyes that go with it', () => {
    const g = gameLook({ gender: 'female', hair: 'long', hairColour: 'blonde', shirt: '#22c55e' });
    const brow = g.tints.find((t) => t.material === 'Eyebrows');
    expect(brow?.part).toBe('head:long');
    expect(brow?.colour).not.toBe(hairColourHex('blonde'));
    expect(g.face.iris).not.toBe(gameLook({ hairColour: 'black', shirt: '#22c55e' }).face.iris);
  });

  it('darkens a suit, whitens a lab coat and colours a dress to its hem', () => {
    expect(gameLook({ clothing: 'suit', shirt: '#ffffff' }).tints[0]!.colour).not.toBe('#ffffff');
    expect(gameLook({ clothing: 'labcoat', shirt: '#22c55e' }).tints[0]!.colour).toBe('#eef2f6');
    const dress = gameLook({ gender: 'female', clothing: 'dress', shirt: '#db2777' });
    expect(dress.tints).toContainEqual({
      part: 'legs:dress',
      material: 'LimeGreen',
      colour: '#db2777',
    });
  });

  it('falls back to the nearest head and a default shirt for anything it does not know', () => {
    const g = gameLook({
      gender: 'female',
      clothing: 'unknown',
      hair: 'unknown',
      shirt: 'not-a-colour',
    });
    expect(PACK_PARTS.women.has(g.parts[0])).toBe(true);
    expect(g.parts[1]).toBe('body:tee');
    expect(g.tints[0]!.colour).toBe('#0ea5e9');
  });

  it('keys a look by what changes its build', () => {
    const a = gameLookKey(gameLook({ clothing: 'tee', shirt: '#111111' }));
    expect(gameLookKey(gameLook({ clothing: 'tee', shirt: '#111111' }))).toBe(a);
    expect(gameLookKey(gameLook({ clothing: 'tee', shirt: '#222222' }))).not.toBe(a);
    expect(gameLookKey(gameLook({ clothing: 'suit', shirt: '#111111' }))).not.toBe(a);
  });
});
