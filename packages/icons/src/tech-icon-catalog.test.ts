import { describe, expect, it } from 'vitest';

import { centreOffsetPx } from './centring';
import { techGlyphStrokeUnits } from './markup';
import { TECH_ICON_CATALOG } from './tech-icon-catalog';

// docs/specs/004-interface-design/iconography.md, "Technology tiles".

// A glyph's drawing, independent of attribute spacing and element order.
function glyphSignature(glyph: string): string {
  return [...glyph.matchAll(/<[^>]+>/g)]
    .map(([el]) => el.replace(/\s*\/?>$/, '').replace(/\s+/g, ' '))
    .flatMap((el) => {
      const d = /^<path d="([^"]*)"(.*)$/.exec(el);
      // Split a path into its subpaths, so one path and several spell the same drawing.
      return d ? d[1]!.split(/(?=M)/).map((sub) => `<path d="${sub.trim()}"${d[2]}`) : [el];
    })
    .sort()
    .join('');
}

const glyph = (id: string) => TECH_ICON_CATALOG.find((t) => t.id === id)!.glyph;

describe('technology tiles', () => {
  it('never gives two services of one provider the same glyph', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const t of TECH_ICON_CATALOG) {
      const key = `${t.provider}|${glyphSignature(t.glyph)}`;
      const first = seen.get(key);
      if (first) clashes.push(`${t.id} = ${first}`);
      else seen.set(key, t.id);
    }
    expect(clashes).toEqual([]);
  });

  it('leaves the glyph weight to the renderer', () => {
    expect(TECH_ICON_CATALOG.filter((t) => /stroke-width/.test(t.glyph)).map((t) => t.id)).toEqual(
      [],
    );
  });

  it('draws Vercel with a generic outline glyph, not its mark', () => {
    expect(glyph('vercel')).not.toContain('fill=');
    expect(glyph('vercel')).not.toBe('<path d="M12 4 21 20H3Z" fill="#fff" stroke="none"/>');
  });

  it('draws Route 53 apart from CloudFront', () => {
    const [route53, cloudfront] = ['aws-route53', 'aws-cloudfront'].map(glyph);
    const parts = (g: string) => new Set(glyphSignature(g).split('<').filter(Boolean));
    const shared = [...parts(route53!)].filter((p) => parts(cloudfront!).has(p));
    expect(shared).toEqual([]);
  });

  it('centres the redrawn glyphs on the tile', () => {
    const px = 48;
    const sw = techGlyphStrokeUnits(px);
    const off = ['aws-route53', 'cf-workers', 'vercel', 'mysql']
      .map((id) => ({
        id,
        o: centreOffsetPx(glyph(id), { units: 24, sizePx: px, strokeUnits: sw }),
      }))
      .filter(({ o }) => !o || Math.abs(o.dx) > 0.5 || Math.abs(o.dy) > 0.5)
      .map(({ id, o }) => `${id} ${JSON.stringify(o)}`);
    expect(off).toEqual([]);
  });
});
