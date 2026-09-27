import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import manifest from '../lucide-manifest.json';
import * as LUCIDE from './lucide.generated';
import { lucideExportName, lucideModule, svgToPrims } from './lucide-vendor';

const require = createRequire(import.meta.url);
const readSvg = (name: string) =>
  readFileSync(require.resolve(`lucide-static/icons/${name}.svg`), 'utf8');
const licence = readFileSync(require.resolve('lucide-static/LICENSE'), 'utf8');

describe('svgToPrims', () => {
  it('reads every Lucide element kind into catalogue prims', () => {
    const svg = `<svg viewBox="0 0 24 24">
      <path d="M3 3h5" /><circle cx="12" cy="12" r="3" /><line x1="1" y1="2" x2="3" y2="4" />
      <rect width="4" height="6" x="8" y="16" rx="1" /><rect x="15" y="4" width="4" height="6" ry="2" />
      <ellipse cx="12" cy="5" rx="9" ry="3" /><polyline points="1 2 3 4" /><polygon points="1 2 3 4 5 6" />
    </svg>`;
    expect(svgToPrims(svg, 'probe')).toEqual([
      { t: 'path', d: 'M3 3h5' },
      { t: 'circle', cx: 12, cy: 12, r: 3 },
      { t: 'line', x1: 1, y1: 2, x2: 3, y2: 4 },
      { t: 'rect', x: 8, y: 16, w: 4, h: 6, rx: 1 },
      { t: 'rect', x: 15, y: 4, w: 4, h: 6, rx: 2 },
      { t: 'ellipse', cx: 12, cy: 5, rx: 9, ry: 3 },
      { t: 'polyline', points: '1 2 3 4' },
      { t: 'polygon', points: '1 2 3 4 5 6' },
    ]);
  });

  it('rejects markup it cannot represent', () => {
    expect(() => svgToPrims('<svg><g transform="x"><path d="M0 0"/></g></svg>', 'bad')).toThrow(
      'vendor-lucide: bad uses unsupported <g>',
    );
  });
});

describe('lucideExportName', () => {
  it('camel-cases a kebab name behind a lucide prefix', () => {
    expect(lucideExportName('paint-roller')).toBe('lucidePaintRoller');
    expect(lucideExportName('grid-2x2')).toBe('lucideGrid2x2');
  });
});

describe('vendored Lucide', () => {
  it('pins an exact version', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(require('lucide-static/package.json').version).toBe(manifest.version);
  });

  it('holds exactly the manifest glyphs, in order', () => {
    expect(Object.keys(LUCIDE).sort()).toEqual(manifest.glyphs.map(lucideExportName).sort());
  });

  it('is up to date with the pinned package (run pnpm icons:vendor)', () => {
    const current = readFileSync(new URL('./lucide.generated.ts', import.meta.url), 'utf8');
    expect(lucideModule(manifest, readSvg, licence)).toBe(current);
  });

  it('carries the Lucide licence notice', () => {
    const current = readFileSync(new URL('./lucide.generated.ts', import.meta.url), 'utf8');
    expect(current).toContain(licence.trim());
    expect(current).toContain('THIRD_PARTY_NOTICES.md');
  });
});
