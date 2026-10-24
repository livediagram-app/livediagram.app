import { describe, expect, it } from 'vitest';
import { STICKER_CATALOG } from './sticker-catalog';
import { stickerArt } from './sticker-markup';
import { capBandBaselineY } from './svg-cap-band';

// A badge sticker's word sits dead centre in its coloured pill (docs/specs/004-interface-design/
// optical-alignment.md): its cap band on the pill's centre line, and its trailing letter-space given back.
const PILL = { x: 14, y: 14, width: 192, height: 60 };

describe('badge sticker text', () => {
  const badges = STICKER_CATALOG.filter((s) => s.kind === 'badge');

  it('has badges to check', () => {
    expect(badges.length).toBeGreaterThan(5);
  });

  it.each(badges.map((b) => [b.id, b] as const))('%s centres its word on the pill', (_id, def) => {
    const { markup } = stickerArt(def);
    const open = /<text [^>]*>(?=[^<]*<\/text>$)/.exec(markup)![0];
    const attr = (n: string) => Number(new RegExp(` ${n}="([\\d.-]+)"`).exec(open)![1]);
    expect(open).not.toMatch(/dominant-baseline/);
    expect(attr('y')).toBeCloseTo(capBandBaselineY(PILL.y + PILL.height / 2, attr('font-size')), 2);
    expect(attr('x') - attr('letter-spacing') / 2).toBeCloseTo(PILL.x + PILL.width / 2, 2);
  });
});
