import { describe, expect, it } from 'vitest';
import {
  freehandPenStroke,
  penStrokeOutline,
  type FreehandElement,
  type Tab,
} from '@livediagram/document';
import { renderTabToSvg } from '@/lib/export-tab';
import { LANDED_POINT_TOLERANCE_PX, compactElement } from './compact';

// docs/specs/020-import-export/board-scene.md "Compact output": what lands draws as if every
// field had been written in full.
const stroke = (over: Partial<FreehandElement> = {}): FreehandElement => ({
  id: 'f',
  type: 'freehand',
  x: 100.123456,
  y: 50.654321,
  width: 812.3456789,
  height: 233.3333333,
  points: Array.from({ length: 60 }, (_, i) => ({
    nx: i / 59 + (i % 7) * 1e-7,
    ny: (Math.sin(i / 5) + 1) / 2,
  })),
  pressures: Array.from({ length: 60 }, (_, i) => 0.3 + 0.4 * Math.abs(Math.sin(i / 3))),
  closed: false,
  penWidth: 1.5,
  ...over,
});
const tab = (el: FreehandElement) =>
  ({ id: 't', name: 'Board', kind: 'whiteboard', elements: [el] }) as unknown as Tab;

describe('compact output renders the same', () => {
  it('draws a stroke with its defaults dropped exactly as with them written', () => {
    const written = stroke({ streamline: 0, opacity: 1 });
    const absent = stroke();
    expect(renderTabToSvg(tab(written))).toBe(renderTabToSvg(tab(absent)));
  });

  it('draws a rounded stroke within the tolerance of the full one', () => {
    const full = stroke();
    const compact = compactElement(full) as FreehandElement;
    const a = penStrokeOutline(freehandPenStroke(full, { x: full.x, y: full.y }));
    const b = penStrokeOutline(freehandPenStroke(compact, { x: compact.x, y: compact.y }));
    expect(b).toHaveLength(a.length);
    // Point error, box rounding (0.005 px a side) and pressure rounding (1/1000 of the width)
    // together stay well under a tenth of a pixel.
    const worst = Math.max(...a.map((p, i) => Math.hypot(p.x - b[i]!.x, p.y - b[i]!.y)));
    expect(worst).toBeLessThan(2 * LANDED_POINT_TOLERANCE_PX);
  });
});
