// docs/specs/029-sheets/sheet.md "Sheet templates" and "Readable cells": every template's every cell reads at WCAG AA
// (4.5:1) as drawn: made on a light or a dark canvas, then shown on a light, dark or other themed Sheet. Its own
// colours read on the canvas it was made for without any rescue.
import { describe, expect, it } from 'vitest';
import { cellColours, contrastRatio, type CellSurface } from '@livedesign/document';
import { SHEET_TEMPLATE_IDS, sheetFromTemplate } from '@livedesign/sheets';

const NOW = Date.UTC(2026, 9, 8, 15);
const SURFACES: Record<string, CellSurface> = {
  light: { fill: '#f8fafc', ink: '#0f172a', dark: false },
  dark: { fill: '#111827', ink: '#e2e8f0', dark: true },
  warm: { fill: '#fdf6e3', ink: '#3b2f1e', dark: false },
  navy: { fill: '#0b1e3a', ink: '#dbeafe', dark: true },
};

function cellsOf(template: (typeof SHEET_TEMPLATE_IDS)[number], dark: boolean) {
  const made = sheetFromTemplate({ id: 'sheetAA01', tabId: 't', template, now: NOW, dark })!;
  return made.sheet.cells.filter((c) => c.i !== undefined && c.i !== null);
}

describe.each(SHEET_TEMPLATE_IDS)('%s reads at AA', (template) => {
  it.each([false, true])('made on a dark canvas: %s, on every surface', (dark) => {
    for (const [name, surface] of Object.entries(SURFACES))
      for (const c of cellsOf(template, dark)) {
        const { fill, ink } = cellColours(c.f, surface);
        const ratio = contrastRatio(ink, fill ?? surface.fill);
        expect(
          ratio,
          `${name} ${c.r}:${c.c} ${ink} on ${fill ?? surface.fill}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
  });

  it.each([false, true])(
    'its own colours read on the canvas it was made for (dark: %s)',
    (dark) => {
      const surface = dark ? SURFACES.dark! : SURFACES.light!;
      for (const c of cellsOf(template, dark)) {
        const f = (c.f ?? {}) as { bg?: string; fc?: string };
        const ratio = contrastRatio(f.fc ?? surface.ink, f.bg ?? surface.fill);
        expect(
          ratio,
          `${c.r}:${c.c} ${f.fc ?? surface.ink} on ${f.bg ?? surface.fill}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
