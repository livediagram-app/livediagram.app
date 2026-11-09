import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AVATAR_DEFAULTS, configureAvatar } from '../bindings';
import { AVATAR_CLOTHING, type AvatarConfig } from '../config';
import { AVATAR_PALETTE } from '../palette';
import { AvatarSprite } from './avatar-sprite';
import { lightness, outfitTones } from './avatar-sprite-palette';

// Real colour maths, as the products bind it, so derived trims are visible tones rather than the shirt itself.
const mix = (hex: string, to: number, amount: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) =>
      Math.round(v + (to - v) * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};
beforeAll(() =>
  configureAvatar({
    ...AVATAR_DEFAULTS,
    shade: (hex, amount) => mix(hex, 0, amount),
    tint: (hex, amount) => mix(hex, 255, amount),
  }),
);
afterAll(() => configureAvatar(AVATAR_DEFAULTS));

// The sprite as a pixel grid: each rect painted in order, so a later rect covers an earlier one, as on screen.
// Standing still, every group transform is a zero translate, so the rects' own coordinates are the pixels.
function pixels(svg: string): Map<string, string> {
  const grid = new Map<string, string>();
  const rects = svg.matchAll(
    /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="([^"]+)"/g,
  );
  for (const m of rects) {
    const [x, y, w, h] = m.slice(1, 5).map(Number) as [number, number, number, number];
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) grid.set(`${i},${j}`, m[5]!);
  }
  return grid;
}

function differing(a: Map<string, string>, b: Map<string, string>): number {
  let n = 0;
  for (const key of new Set([...a.keys(), ...b.keys()])) if (a.get(key) !== b.get(key)) n++;
  return n;
}

const draw = (
  clothing: AvatarConfig['clothing'],
  facing: 'down' | 'up' | 'left',
  shirt: string,
  gender: AvatarConfig['gender'] = 'male',
) =>
  pixels(
    renderToStaticMarkup(
      <AvatarSprite
        facing={facing}
        config={{ gender, clothing, hair: 'short', size: 'regular' }}
        walking={false}
        stepFrame={0}
        lift={0}
        wave={null}
        shirt={shirt}
      />,
    ),
  );

// docs/specs/008-canvas/avatar-mode.md "Clothes"
describe('the sixteen outfits', () => {
  // A light shirt, a dark one and the default cyan: the trims flip direction between them.
  const SHIRTS = ['#facc15', '#1e3a8a', AVATAR_PALETTE.shirt];

  it.each(
    SHIRTS.flatMap((shirt) =>
      (['male', 'female'] as const).flatMap((gender) =>
        (['down', 'up', 'left'] as const).map((facing) => ({ shirt, gender, facing })),
      ),
    ),
  )(
    'are told apart by at least eight pixels: $gender, $facing, $shirt',
    ({ shirt, gender, facing }) => {
      const drawn = AVATAR_CLOTHING.map((o) => ({
        id: o.id,
        grid: draw(o.id, facing, shirt, gender),
      }));
      for (let i = 0; i < drawn.length; i++) {
        for (let j = i + 1; j < drawn.length; j++) {
          const a = drawn[i]!;
          const b = drawn[j]!;
          expect(differing(a.grid, b.grid), `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(8);
        }
      }
    },
  );

  it('give the T-shirt short sleeves and the jumper long ones', () => {
    // Row 11 of the near arm is the forearm: skin under a short sleeve, cloth under a long one.
    expect(draw('tee', 'down', '#1e3a8a').get('2,11')).toBe(AVATAR_PALETTE.skin);
    expect(draw('jumper', 'down', '#1e3a8a').get('2,11')).toBe('#1e3a8a');
  });

  it('put the vest over a white shirt and the varsity jacket in white sleeves', () => {
    expect(draw('vest', 'down', '#1e3a8a').get('2,10')).toBe(AVATAR_PALETTE.shirtWhite);
    expect(draw('varsity', 'down', '#1e3a8a').get('2,10')).toBe(AVATAR_PALETTE.shirtWhite);
  });

  it('cut the overalls’ legs from denim and the suit’s from its jacket', () => {
    expect(draw('overalls', 'down', '#facc15').get('5,17')).toBe(AVATAR_PALETTE.denim);
    const suit = draw('suit', 'down', '#facc15');
    expect(suit.get('5,17')).toBe(suit.get('4,13'));
  });

  it('roll the turtleneck’s collar over the chin but leave the mouth clear', () => {
    const turtleneck = draw('turtleneck', 'down', '#1e3a8a');
    expect(turtleneck.get('4,8')).toBe('#1e3a8a');
    expect(turtleneck.get('7,7')).toBe(AVATAR_PALETTE.skinDark);
  });

  it('flare the dress past the hips, wider than the body', () => {
    const dress = draw('dress', 'down', '#1e3a8a');
    expect(dress.get('2,17')).toBeDefined();
    expect(draw('tee', 'down', '#1e3a8a').get('2,17')).toBeUndefined();
  });
});

describe('outfitTones', () => {
  it('takes trims darker on a light shirt and lighter on a dark one', () => {
    const light = outfitTones('#facc15');
    const dark = outfitTones('#1e3a8a');
    expect(light.lightShirt).toBe(true);
    expect(dark.lightShirt).toBe(false);
    expect(lightness(light.accent)).toBeLessThan(lightness('#facc15'));
    expect(lightness(light.contrast)).toBeLessThan(lightness(light.accent));
    expect(lightness(dark.accent)).toBeGreaterThan(lightness('#1e3a8a'));
    expect(lightness(dark.contrast)).toBeGreaterThan(lightness(dark.accent));
    // The skirt's second tone moves the same way, so it never fades into the theme behind it.
    expect(lightness(light.alt)).toBeLessThan(lightness('#facc15'));
    expect(lightness(dark.alt)).toBeGreaterThan(lightness('#1e3a8a'));
  });

  it('falls back to fixed neutrals for a colour it cannot do maths on', () => {
    const tones = outfitTones('rebeccapurple');
    expect(tones.base).toBe('rebeccapurple');
    expect(tones.contrast).toBe(AVATAR_PALETTE.shirtWhite);
    expect(tones.lightShirt).toBe(false);
  });

  it('stays correct past its cache bound', () => {
    for (let i = 0; i < 80; i++) outfitTones(`#${i.toString(16).padStart(2, '0')}3355`);
    expect(outfitTones('#facc15').lightShirt).toBe(true);
  });
});
