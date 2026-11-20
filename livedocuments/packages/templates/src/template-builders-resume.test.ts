// The Résumé template's ink is locked against the theme (template-builders-resume.ts), so the paper under it must
// be locked too: on a dark theme's page, dark ink on the theme's own paper vanished (docs/specs/008-canvas/
// canvas-and-palette.md "Templates on pages").
import { describe, expect, it } from 'vitest';
import type { Element } from '@livedocuments/document';
import { buildResume } from './template-builders-resume';

type Box = { x: number; y: number; width: number; height: number };
const inside = (a: Box, b: Box) =>
  a.x >= b.x - 0.5 &&
  a.y >= b.y - 0.5 &&
  a.x + a.width <= b.x + b.width + 0.5 &&
  a.y + a.height <= b.y + b.height + 0.5;

// Dark enough to vanish on a dark page: slate-900 ink and slate-600 muted text.
const DARK_INK = new Set(['#0f172a', '#475569']);

describe('the Résumé on any theme', () => {
  const els = buildResume() as (Element & Box & Record<string, unknown>)[];
  const lockedPanels = els.filter((e) => e.type === 'shape' && e.themeLockFill === true);

  it('puts every line of dark ink on a locked light panel', () => {
    const ink = els.filter((e) => e.type === 'text' && DARK_INK.has(String(e.textColor)));
    expect(ink.length).toBeGreaterThan(10);
    for (const t of ink) {
      const under = lockedPanels.filter((p) => inside(t, p));
      expect(under.map((p) => p.fillColor)).not.toEqual([]);
      for (const p of under) expect(['#ffffff', '#eef2ff']).toContain(p.fillColor);
    }
  });
});
