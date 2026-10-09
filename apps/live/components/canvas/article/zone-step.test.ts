import { describe, expect, it } from 'vitest';
import type { ArticleBlock } from '@livediagram/document';
import { blocksToDoc } from '@/lib/article/article-convert';
import { zoneStepTarget } from './article-editor-handle';
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
