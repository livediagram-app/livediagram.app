import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isoWallSteps } from '@/lib/isometric';

// docs/specs/008-canvas/isometric-view.md "The depth layer is one flat picture in the scene": a column's side walls
// are globals.css's `[data-iso-wall]` box-shadow list, one shadow per copy under the topmost, written from
// isoWallSteps. This keeps the list and the steps the same: a copy added, a step or a shade changed in one only would
// draw walls that no longer match the tops and the export.
const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

const pct = (b: number) => `${Math.round(b * 10_000) / 100}%`;

describe('the isometric wall shadows', () => {
  it('draws one shadow per copy, at its depth and in its shade, the first on top', () => {
    const rule = css.slice(css.indexOf('[data-iso-wall] {'));
    const from = rule.indexOf('box-shadow:') + 'box-shadow:'.length;
    const list = rule.slice(from, rule.indexOf(';', from));
    const shadows = list.split(/,\s*(?=calc)/).map((s) => s.replace(/\s+/g, ' ').trim());
    expect(shadows).toEqual(
      isoWallSteps().map(
        ({ depthPx, brightness }) =>
          `calc(var(--iso-hx) * ${depthPx}px) calc(var(--iso-hy) * ${depthPx}px) color-mix(in srgb, var(--iso-wall) ${pct(brightness)}, black)`,
      ),
    );
  });
});
