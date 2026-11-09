import { describe, expect, it } from 'vitest';
import type { ArticleBlock } from '@livedocuments/document';
import { blocksToDoc } from '@/lib/article/article-convert';
import { nearestDrop, zoneStepTarget } from './article-editor-handle';
import { zoneGripStep } from './ZoneBar';

// docs/specs/007-editor/article-pages.md "Zones": the zone bar's grip, focused, steps its zone a
// block up or down with the arrow keys.
const blocks: ArticleBlock[] = [
  { id: 'a', type: 'paragraph', runs: [{ text: 'A' }] },
  { id: 'z', type: 'zone', zone: 'drawing', width: 100, height: 100 },
  { id: 'b', type: 'paragraph', runs: [{ text: 'B' }] },
];

describe('zone keyboard moves', () => {
  const doc = blocksToDoc(blocks);
  const starts: number[] = [];
  doc.forEach((_n, pos) => starts.push(pos));
  const zoneAt = starts[1]!;

  it('lands before the block above, or after the block below', () => {
    expect(zoneStepTarget(doc, zoneAt, -1)).toBe(starts[0]);
    expect(zoneStepTarget(doc, zoneAt, 1)).toBe(doc.content.size);
  });

  it('goes nowhere past either end, or for a zone not found', () => {
    const top = blocksToDoc([blocks[1]!, blocks[0]!]);
    expect(zoneStepTarget(top, 0, -1)).toBeNull();
    const bottom = blocksToDoc([blocks[0]!, blocks[1]!]);
    let last = 0;
    bottom.forEach((_n, pos) => (last = pos));
    expect(zoneStepTarget(bottom, last, 1)).toBeNull();
    expect(zoneStepTarget(doc, -1, 1)).toBeNull();
    expect(zoneStepTarget(doc, 1, 1)).toBeNull();
  });

  it('reads the arrow keys as steps', () => {
    expect(zoneGripStep('ArrowUp')).toBe(-1);
    expect(zoneGripStep('ArrowLeft')).toBe(-1);
    expect(zoneGripStep('ArrowDown')).toBe(1);
    expect(zoneGripStep('ArrowRight')).toBe(1);
    expect(zoneGripStep('Enter')).toBeNull();
  });
});

// docs/specs/007-editor/article-pages.md "Zones", Moving a zone: the drop caret shows where a zone lands.
describe('the drop boundary', () => {
  const rect = (left: number, top: number, bottom: number) => ({
    left,
    right: left + 100,
    top,
    bottom,
    height: bottom - top,
  });
  // A paragraph (pos 0, size 10) at the foot of column one that runs on at the top of column two, then
  // a paragraph (pos 10) below it in column two.
  const boxes = [
    { pos: 0, size: 10, rects: [rect(0, 900, 1000), rect(200, 0, 100)] },
    { pos: 10, size: 6, rects: [rect(200, 100, 160)] },
  ];

  it('draws the caret where a split paragraph really lands', () => {
    // Over the upper half of the part in column two: before the paragraph, whose start is in column one.
    const before = nearestDrop(boxes, 250, 20, 24)!;
    expect(before.pos).toBe(0);
    expect(before.edge.left).toBe(0);
    expect(before.edge.top).toBe(900);
    // Over the lower half of the part in column one: after it, below its end in column two.
    const after = nearestDrop(boxes, 50, 990, 24)!;
    expect(after.pos).toBe(10);
    expect(after.edge.left).toBe(200);
    expect(after.edge.bottom).toBe(100);
  });

  it("is the nearest box in the point's column, or nothing", () => {
    expect(nearestDrop(boxes, 250, 150, 24)).toMatchObject({ pos: 16, before: false });
    expect(nearestDrop(boxes, 250, 110, 24)).toMatchObject({ pos: 10, before: true });
    expect(nearestDrop(boxes, 700, 110, 24)).toBeNull();
  });
});
