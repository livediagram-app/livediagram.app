import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

  // docs/specs/008-canvas/canvas-and-palette.md text size: a slider px is a fixed size, and Clean echoes an
  // element's own size back; flattening it to 'md' lost the size the user set.
  it('keeps a slider px, and pins one out of range', () => {
    const kept = extractElementsFromBuffer(`{"elements":[${shape(',"textSize":18')}]}`);
    expect((kept[0] as { textSize?: unknown }).textSize).toBe(18);
    const wild = extractElementsFromBuffer(`{"elements":[${shape(',"textSize":400')}]}`);
    expect((wild[0] as { textSize?: unknown }).textSize).toBe('md');
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

  // The stream is held to the same guard as a save, so nothing it yields can
  // fail the api's tab validation later.
  it('drops what a save would reject: junk endpoints, bad anchors, infinite coordinates', () => {
    const out = extractElementsFromBuffer(
      `{"elements":[` +
        `{"id":"a1","type":"arrow","from":{},"to":{}},` +
        `{"id":"a2","type":"arrow","from":{"kind":"pinned","elementId":"s","anchor":"right"},"to":{"kind":"free","x":0,"y":0}},` +
        `{"id":"s1","type":"shape","shape":"square","x":1e999,"y":0,"width":140,"height":60},` +
        `{"id":"a3","type":"arrow","from":{"kind":"pinned","elementId":"s","anchor":"e"},"to":{"kind":"free","x":0,"y":0}}` +
        `]}`,
    );
    expect(out.map((e) => e.id)).toEqual(['a3']);
  });

  it('defaults a missing size on text and sticky too', () => {
    const out = extractElementsFromBuffer(
      `{"elements":[{"id":"t","type":"text","x":0,"y":0,"label":"Title"},{"id":"n","type":"sticky","x":0,"y":0}]}`,
    );
    expect(out.map((e) => e.id)).toEqual(['t', 'n']);
  });

  it('ignores element types the assistant may not add', () => {
    const out = extractElementsFromBuffer(
      `{"elements":[{"id":"i","type":"image","x":0,"y":0,"width":10,"height":10,"src":"x"}]}`,
    );
    expect(out).toEqual([]);
  });

  it('parses a shape whose label contains braces (no depth miscount)', () => {
    const out = extractElementsFromBuffer(
      `{"elements":[{"id":"a","type":"shape","shape":"square","x":0,"y":0,"width":140,"height":60,"label":"if (x) { y }"},{"id":"b","type":"shape","shape":"circle","x":200,"y":0,"width":80,"height":80}]}`,
    );
    expect(out).toHaveLength(2);
    expect(out[1]!.id).toBe('b');
  });
});

// The prompt (apps/api) and the client's accept-set are two halves of one
// vocabulary: the worker tells the model which ShapeKinds to use, and the
// client coerces anything outside AI_SHAPE_KINDS to a plain square so an
// invented node still renders. They must agree in one direction — everything
// the prompt asks for has to survive ingestion — and they silently didn't:
// "checklist" was requested by name, with its checklistItems schema, and
// squared on arrival, so the rows rode along on an element whose renderer is
// gated on the kind and never appeared.
//
// Read from the worker's source rather than restated here, because a second
// hand-written copy is the thing that drifted. The set-difference direction
// matters: the client is deliberately a superset (models emit unprompted kinds
// and synonyms), so only prompt-minus-client is a defect.
describe('AI shape vocabulary agrees with the server prompt', () => {
  const promptSource = readFileSync(
    fileURLToPath(new URL('../../../api/src/ai-prompt.ts', import.meta.url)),
    'utf8',
  );

  // The `ShapeKind — pick semantically` block lists one quoted kind per line.
  const promptKinds = (() => {
    const start = promptSource.indexOf('ShapeKind — pick semantically');
    expect(start).toBeGreaterThan(-1);
    const block = promptSource.slice(start, promptSource.indexOf('\n\n', start));
    return [...block.matchAll(/^\s+"([a-z0-9-]+)"/gm)].map((m) => m[1]!);
  })();

  it('found the prompt block', () => {
    // Guards the extraction itself: if the prompt is reformatted this test
    // must fail loudly rather than pass over an empty list.
    expect(promptKinds.length).toBeGreaterThan(10);
    expect(promptKinds).toContain('square');
  });

  it('keeps every kind the prompt asks for, rather than squaring it', () => {
    const squared = promptKinds.filter((kind) => {
      const buf = `{"elements":[{"id":"x","type":"shape","shape":"${kind}","x":0,"y":0,"width":140,"height":60}]}`;
      const [el] = extractElementsFromBuffer(buf);
      return (el as { shape?: string } | undefined)?.shape !== kind;
    });
    expect(squared).toEqual([]);
  });
});
