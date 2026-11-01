// A label's plate keeps clear of every frame's border (docs/specs/015-api/mcp-server.md "Groups keep their lines
// clear"): on the architecture with an event bus (an evaluator's D2), "publish" sat on the Services frame's edge.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  arrowLabelPass,
  buildGraphTab,
  resolveGraphInput,
  type ArrowElement,
  type BoxedElement,
} from '@livehuddle/document';

// How far a plate keeps off a border across it: at least this, in px (the look keeps 6; a pixel's rounding aside).
const MIN_CLEAR = 5;

describe('label plates and frame borders', () => {
  it('keeps every publish label off the Services frame border', () => {
    const input = JSON.parse(
      readFileSync(join(__dirname, 'routing/graph-flow-13-bus.json'), 'utf8'),
    ) as Parameters<typeof resolveGraphInput>[0];
    const tab = buildGraphTab('t', 'T', resolveGraphInput(input).graph!, undefined);
    const frames = tab.elements.filter(
      (e): e is BoxedElement => e.type === 'shape' && e.shape === 'frame',
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
      for (const f of frames) {
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
