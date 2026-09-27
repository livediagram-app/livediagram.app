import { describe, expect, it } from 'vitest';

import { markupBounds } from './centring';
import * as LUCIDE from './lucide.generated';
import { ICON_CATALOG_1 } from './icon-catalog-1';
import { ICON_CATALOG_2 } from './icon-catalog-2';
import { iconPrimsMarkup } from './markup';

const CATALOG = [...ICON_CATALOG_1, ...ICON_CATALOG_2];

// Floor-plan furniture (docs/specs/008-canvas/canvas-and-palette.md, the palette's Furniture chip).
const FURNITURE = [
  'bed',
  'sofa',
  'armchair',
  'chair',
  'dining-table',
  'coffee-table',
  'tv',
  'desk',
  'wardrobe',
  'bathtub',
  'toilet',
  'sink',
  'stove',
  'fridge',
  'plant',
  'door',
  'stairs',
];

// Geometry (stroke excluded) of a piece must sit in the 2..22 box and span at least this many
// units on its longer side, so it reads at an 18px palette tile.
const FURNITURE_BOX = { min: 2, max: 22 };
const FURNITURE_MIN_SPAN = 14;

const bounds = (id: string) => {
  const def = CATALOG.find((d) => d.id === id);
  if (!def) throw new Error(`no catalogue entry ${id}`);
  const b = markupBounds(iconPrimsMarkup(def.prims), 0);
  if (!b) throw new Error(`${id} has no measurable geometry`);
  return b;
};

describe('floor-plan furniture', () => {
  it('fits every piece in the 2..22 box', () => {
    const eps = 1e-6;
    const out = FURNITURE.filter((id) => {
      const b = bounds(id);
      return (
        b.minX < FURNITURE_BOX.min - eps ||
        b.minY < FURNITURE_BOX.min - eps ||
        b.maxX > FURNITURE_BOX.max + eps ||
        b.maxY > FURNITURE_BOX.max + eps
      );
    });
    expect(out).toEqual([]);
  });

  it('draws every piece large enough to read at palette size', () => {
    const small = FURNITURE.map((id) => {
      const b = bounds(id);
      return { id, span: Math.max(b.maxX - b.minX, b.maxY - b.minY) };
    })
      .filter(({ span }) => span < FURNITURE_MIN_SPAN)
      .map(({ id, span }) => `${id} ${span}`);
    expect(small).toEqual([]);
  });
});

// Catalogue entries drawn from vendored Lucide data rather than hand-copied paths
// (docs/specs/004-interface-design/iconography.md, "Source").
const LUCIDE_BACKED: Record<string, readonly unknown[]> = {
  database: LUCIDE.lucideDatabase,
  wifi: LUCIDE.lucideWifi,
  tool: LUCIDE.lucideWrench,
  signal: LUCIDE.lucideSignal,
  package: LUCIDE.lucidePackage,
  settings: LUCIDE.lucideSettings,
  gear: LUCIDE.lucideSettings,
  heartbeat: LUCIDE.lucideHeartPulse,
};

describe('Lucide-backed entries', () => {
  it.each(Object.entries(LUCIDE_BACKED))('draws %s from the vendored glyph', (id, prims) => {
    expect(prims).toBeDefined();
    expect(CATALOG.find((d) => d.id === id)?.prims).toEqual(prims);
  });
});

// Ids that deliberately draw the same prims as another id, each with the reason.
const ALIASES: Record<string, { of: string; reason: string }> = {
  gear: {
    of: 'settings',
    reason: 'one meaning, one glyph: the settings gear, offered again under the Animated chip',
  },
};

describe('line-art glyphs', () => {
  const lineArt = CATALOG.filter((d) => !d.prims.some((p) => p.t === 'text'));

  it('never draws two ids with identical prims, bar the listed aliases', () => {
    const firstBySignature = new Map<string, string>();
    const clashes: string[] = [];
    for (const d of lineArt) {
      const signature = JSON.stringify(d.prims);
      const first = firstBySignature.get(signature);
      if (first === undefined) firstBySignature.set(signature, d.id);
      else if (ALIASES[d.id]?.of !== first) clashes.push(`${d.id} = ${first}`);
    }
    expect(clashes).toEqual([]);
  });

  it('lists only aliases that still draw their original', () => {
    const prims = (id: string) => JSON.stringify(lineArt.find((d) => d.id === id)?.prims ?? null);
    const stale = Object.entries(ALIASES)
      .filter(([id, { of }]) => prims(id) === 'null' || prims(id) !== prims(of))
      .map(([id]) => id);
    expect(stale).toEqual([]);
  });
});
