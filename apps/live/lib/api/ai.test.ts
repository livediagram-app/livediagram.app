import { describe, it, expect } from 'vitest';
import { extractElementsFromBuffer } from './ai';

// Regression guard for the "generated nodes are inconsistently sized" bug: an
// AI shape with no textSize (or "scale") used to fall through to the canvas
// 'scale' auto-fit default, ballooning some labels to fill their box while
// siblings with an explicit size stayed small. Ingestion now pins any
// missing / non-fixed size to 'md', leaving the model's explicit sm/md/lg
// hierarchy intact.
describe('extractElementsFromBuffer textSize normalisation', () => {
  function shape(extra: string): string {
    return `{"id":"ai-1","type":"shape","shape":"square","x":0,"y":0,"width":140,"height":60${extra}}`;
  }

  it('fills a missing textSize with "md" (no scale auto-fit)', () => {
    const out = extractElementsFromBuffer(`{"elements":[${shape('')}]}`);
    expect(out).toHaveLength(1);
    expect((out[0] as { textSize?: string }).textSize).toBe('md');
  });

  it('rewrites "scale" to "md"', () => {
    const out = extractElementsFromBuffer(`{"elements":[${shape(',"textSize":"scale"')}]}`);
    expect((out[0] as { textSize?: string }).textSize).toBe('md');
  });

  it('preserves an explicit hierarchy size', () => {
    const out = extractElementsFromBuffer(`{"elements":[${shape(',"textSize":"lg"')}]}`);
    expect((out[0] as { textSize?: string }).textSize).toBe('lg');
  });
});

// Regression guard for "AI said 4 elements but only arrows show": a shape
// whose kind is off-vocabulary (a synonym like "rectangle", or a valid kind
// the prompt didn't list) used to fail validation and get dropped, leaving
// its connecting arrows pinned to a node that no longer existed. Such shapes
// are now KEPT and coerced to "square" rather than dropped.
describe('extractElementsFromBuffer shape coercion', () => {
  it('keeps an off-vocabulary shape kind, coerced to square', () => {
    const out = extractElementsFromBuffer(
      `{"elements":[{"id":"a","type":"shape","shape":"rectangle","x":0,"y":0,"width":140,"height":60,"label":"Box"}]}`,
    );
    expect(out).toHaveLength(1);
    expect((out[0] as { shape?: string }).shape).toBe('square');
  });

  it('keeps a valid-but-unprompted kind as-is (e.g. triangle)', () => {
    const out = extractElementsFromBuffer(
      `{"elements":[{"id":"a","type":"shape","shape":"triangle","x":0,"y":0,"width":140,"height":60}]}`,
    );
    expect((out[0] as { shape?: string }).shape).toBe('triangle');
  });

  it('defaults a missing width/height so the box still renders', () => {
    const out = extractElementsFromBuffer(
      `{"elements":[{"id":"a","type":"shape","shape":"square","x":0,"y":0}]}`,
    );
    expect(out).toHaveLength(1);
    const s = out[0] as { width?: number; height?: number };
    expect(s.width).toBeGreaterThan(0);
    expect(s.height).toBeGreaterThan(0);
  });

  it('parses a shape whose label contains braces (no depth miscount)', () => {
    const out = extractElementsFromBuffer(
      `{"elements":[{"id":"a","type":"shape","shape":"square","x":0,"y":0,"width":140,"height":60,"label":"if (x) { y }"},{"id":"b","type":"shape","shape":"circle","x":200,"y":0,"width":80,"height":80}]}`,
    );
    expect(out).toHaveLength(2);
    expect(out[1]!.id).toBe('b');
  });
});
