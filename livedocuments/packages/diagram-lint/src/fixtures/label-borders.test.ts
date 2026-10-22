// A label's plate keeps clear of every container's border (docs/specs/015-api/mcp-server.md "Groups keep their lines
// clear"): on the architecture with an event bus (an evaluator's D2, kept laid out as data), "publish" sat on the
// Services container's edge.
import { describe, expect, it } from 'vitest';
import {
  arrowLabelPass,
  type ArrowElement,
  type BoxedElement,
  type Tab,
} from '@livedocuments/document';
import eventBus from './event-bus-tab.json';

// How far a plate keeps off a border across it: at least this, in px (the look keeps 6; a pixel's rounding aside).
const MIN_CLEAR = 5;

describe('label plates and container borders', () => {
  it('keeps every publish label off the Services container border', () => {
    const tab = eventBus as unknown as Tab;
    const containers = tab.elements.filter(
      (e): e is BoxedElement => e.type === 'shape' && e.shape === 'stack',
    );
    const pass = arrowLabelPass(tab.elements);
    const labelled = tab.elements.filter(
      (e): e is ArrowElement => e.type === 'arrow' && e.label === 'publish',
    );
    expect(labelled.length).toBeGreaterThan(0);
    for (const a of labelled) {
      const l = pass.layouts.get(a.id)!;
      const [top, bottom] = [l.center.y - l.height / 2, l.center.y + l.height / 2];
      const [left, right] = [l.center.x - l.width / 2, l.center.x + l.width / 2];
      for (const f of containers) {
        const across = left < f.x + f.width && right > f.x;
        if (!across) continue;
        for (const edge of [f.y, f.y + f.height])
          expect(Math.min(Math.abs(top - edge), Math.abs(bottom - edge))).toBeGreaterThanOrEqual(
            top <= edge && edge <= bottom ? Infinity : MIN_CLEAR,
          );
      }
    }
  });
});
