import { describe, expect, it } from 'vitest';
import { normaliseElements } from './element-normalise';
import { LOOK_MD_MAX_NODES } from '@liveworkspace/document-core/look-size';

// docs/specs/015-api/mcp-server.md "Every element takes the presentation defaults": raw boxes size their text by
// count, as graph input does.

const boxes = (n: number, extra: Record<string, unknown> = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: `b${i}`,
    type: 'shape',
    shape: 'square',
    x: i * 200,
    y: 0,
    width: 160,
    height: 64,
    label: `Box ${i}`,
    ...extra,
  }));
const sizes = (els: unknown) => (els as { textSize?: string }[]).map((e) => e.textSize);

describe('raw box text size by count', () => {
  it('keeps md up to the look threshold, and steps to sm past it', () => {
    expect(new Set(sizes(normaliseElements(boxes(LOOK_MD_MAX_NODES))))).toEqual(new Set(['md']));
    expect(new Set(sizes(normaliseElements(boxes(LOOK_MD_MAX_NODES + 1))))).toEqual(
      new Set(['sm']),
    );
  });

  it('keeps a size the box gives, and leaves containers and unlabelled boxes out of the count', () => {
    const given = normaliseElements([
      ...boxes(LOOK_MD_MAX_NODES + 1),
      { ...boxes(1)[0], id: 'g', textSize: 'lg' },
    ]);
    expect(sizes(given).at(-1)).toBe('lg');
    const framed = normaliseElements([
      ...boxes(LOOK_MD_MAX_NODES),
      { id: 'f', type: 'shape', shape: 'frame', x: 0, y: 0, width: 999, height: 999, label: 'VPC' },
      { id: 'u', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 },
    ]);
    expect(
      sizes(framed)
        .slice(0, LOOK_MD_MAX_NODES)
        .every((s) => s === 'md'),
    ).toBe(true);
  });
});
