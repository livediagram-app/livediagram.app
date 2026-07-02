import { describe, expect, it } from 'vitest';
import { ICON_CATALOG_1 } from './icon-catalog-1';
import { iconPrimMarkup } from './markup';
import { resolveIconExportArt } from './resolve';
import { TECH_ICON_CATALOG } from './tech-icon-catalog';

describe('resolveIconExportArt', () => {
  it('resolves a Technology icon to self-coloured tile art', () => {
    const s3 = TECH_ICON_CATALOG.find((i) => i.id === 'aws-s3')!;
    const art = resolveIconExportArt('aws-s3');
    expect(art).toBeDefined();
    expect(art!.colored).toBe(true);
    // The brand tile carries the catalogue colour, and the glyph rides in
    // the white line-art group.
    expect(art!.markup).toContain(`fill="${s3.color}"`);
    expect(art!.markup).toContain('stroke="#fff"');
    expect(art!.markup).toContain(s3.glyph);
  });

  it('resolves a line-art icon to colourless prims markup', () => {
    const art = resolveIconExportArt('server');
    expect(art).toBeDefined();
    expect(art!.colored).toBe(false);
    // Colourless: the caller wraps with the element's stroke colour.
    expect(art!.markup).not.toContain('stroke=');
    expect(art!.markup).not.toContain('fill=');
  });

  it('returns undefined for an unknown id', () => {
    expect(resolveIconExportArt('nope-not-an-icon')).toBeUndefined();
  });

  it('every catalogue entry resolves', () => {
    for (const icon of TECH_ICON_CATALOG) {
      expect(resolveIconExportArt(icon.id), icon.id).toBeDefined();
    }
    for (const icon of ICON_CATALOG_1) {
      expect(resolveIconExportArt(icon.id), icon.id).toBeDefined();
    }
  });
});

describe('iconPrimMarkup', () => {
  it('renders each primitive kind', () => {
    expect(iconPrimMarkup({ t: 'path', d: 'M1 2' })).toBe('<path d="M1 2"/>');
    expect(iconPrimMarkup({ t: 'circle', cx: 1, cy: 2, r: 3 })).toBe(
      '<circle cx="1" cy="2" r="3"/>',
    );
    expect(iconPrimMarkup({ t: 'rect', x: 1, y: 2, w: 3, h: 4, rx: 0.5 })).toBe(
      '<rect x="1" y="2" width="3" height="4" rx="0.5"/>',
    );
    expect(iconPrimMarkup({ t: 'rect', x: 1, y: 2, w: 3, h: 4 })).toBe(
      '<rect x="1" y="2" width="3" height="4"/>',
    );
    expect(iconPrimMarkup({ t: 'line', x1: 1, y1: 2, x2: 3, y2: 4 })).toBe(
      '<line x1="1" y1="2" x2="3" y2="4"/>',
    );
    expect(iconPrimMarkup({ t: 'polyline', points: '1,2 3,4' })).toBe(
      '<polyline points="1,2 3,4"/>',
    );
    expect(iconPrimMarkup({ t: 'polygon', points: '1,2 3,4' })).toBe('<polygon points="1,2 3,4"/>');
    expect(iconPrimMarkup({ t: 'ellipse', cx: 1, cy: 2, rx: 3, ry: 4 })).toBe(
      '<ellipse cx="1" cy="2" rx="3" ry="4"/>',
    );
  });
});
