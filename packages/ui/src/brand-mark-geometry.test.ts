import { describe, expect, it } from 'vitest';
import { brandLogoSvg } from './brand-logo-svg';
import { BRAND_FACES, brandMarkSvg } from './brand-mark-geometry';
import { PRISM_PALETTES } from './brand-prism';

const count = (svg: string, needle: string) => svg.split(needle).length - 1;

describe('brandMarkSvg', () => {
  it('draws the four faces, back to front, with two of them blending', () => {
    const svg = brandMarkSvg({ scheme: 'light' });
    let at = -1;
    for (const face of BRAND_FACES) {
      const next = svg.indexOf(`d="${face.d}"`);
      expect(next, face.key).toBeGreaterThan(at);
      at = next;
    }
    expect(count(svg, 'mix-blend-mode:multiply')).toBe(2);
    expect(svg).toContain('isolation:isolate');
  });

  it('writes literal colours for a fixed scheme', () => {
    expect(brandMarkSvg({ scheme: 'light' })).toContain(
      `stop-color="${PRISM_PALETTES.light.vivid}"`,
    );
    const dark = brandMarkSvg({ scheme: 'dark' });
    expect(dark).toContain(`stop-color="${PRISM_PALETTES.dark.vivid}"`);
    expect(dark).toContain('mix-blend-mode:screen');
    expect(dark).not.toContain('<style>');
  });

  it('follows prefers-color-scheme when auto, for favicons', () => {
    const svg = brandMarkSvg({ scheme: 'auto' });
    expect(svg).toContain(`.s-vivid{stop-color:${PRISM_PALETTES.light.vivid}}`);
    expect(svg).toContain(
      `@media (prefers-color-scheme:dark){.s-light{stop-color:${PRISM_PALETTES.dark.light}}`,
    );
    expect(svg).toContain('.blend{mix-blend-mode:screen}');
  });

  it('keeps the compact drawing to faces, and adds the detail in full', () => {
    const compact = brandMarkSvg({ variant: 'compact', scheme: 'light' });
    expect(count(compact, '<circle')).toBe(0);
    expect(compact).not.toContain('<filter');
    const full = brandMarkSvg({ variant: 'full', scheme: 'light' });
    expect(count(full, '<circle')).toBe(5);
    expect(full).toContain('stroke-dasharray');
    expect(full).toContain('url(#sheen)');
  });

  it('colours the inner nodes by scheme when auto, without filling the link', () => {
    const svg = brandMarkSvg({ variant: 'full', scheme: 'auto' });
    expect(svg).toContain('class="node-stroke" fill="none"');
    expect(svg).toContain(`.node-fill{fill:${PRISM_PALETTES.dark.highlight}}`);
  });

  it('prefixes every id and reference when asked', () => {
    const svg = brandMarkSvg({ variant: 'full', scheme: 'light', idPrefix: 'x-' });
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of [...ids, ...refs]) expect(id).toMatch(/^x-/);
    for (const ref of refs) expect(ids).toContain(ref);
  });
});

describe('brandLogoSvg', () => {
  it('sets "live" in the accent and "diagram" in ink, per scheme', () => {
    expect(brandLogoSvg('light')).toContain(
      '<tspan fill="#0284c7">live</tspan><tspan fill="#0f172a">diagram</tspan>',
    );
    expect(brandLogoSvg('dark')).toContain(
      '<tspan fill="#38bdf8">live</tspan><tspan fill="#f1f5f9">diagram</tspan>',
    );
  });

  it('nests the full mark with its own id prefix', () => {
    const svg = brandLogoSvg('light');
    expect(svg).toContain('url(#m-frontLeft)');
    expect(count(svg, 'xmlns=')).toBe(1);
  });
});
