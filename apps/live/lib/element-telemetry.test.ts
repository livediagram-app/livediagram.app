import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/diagram';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: unknown[]) => trackMock(...args),
  titleCaseType: (v: string) => (v.length === 0 ? v : v[0]!.toUpperCase() + v.slice(1)),
}));

const { elementTelemetryType, trackDuplicated } = await import('./element-telemetry');

const box = (over: Partial<Element> = {}) =>
  ({
    id: 'e1',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...over,
  }) as Element;

describe('elementTelemetryType', () => {
  it('title-cases a plain shape', () => {
    expect(elementTelemetryType(box())).toBe('Square');
    expect(elementTelemetryType(box({ shape: 'diamond' }))).toBe('Diamond');
  });

  // Not 'Code-Block': titleCase capitalises at the hyphen, which would split
  // the feature across two dashboard tokens (the Changed events say CodeBlock).
  it('reports a code block as one token', () => {
    expect(elementTelemetryType(box({ shape: 'code-block' }))).toBe('CodeBlock');
  });

  it('reports every non-shape kind', () => {
    expect(elementTelemetryType(box({ type: 'text' }))).toBe('Text');
    expect(elementTelemetryType(box({ type: 'sticky' }))).toBe('Sticky');
    expect(elementTelemetryType(box({ type: 'image' }))).toBe('Image');
    expect(elementTelemetryType(box({ type: 'table' }))).toBe('Table');
    expect(elementTelemetryType(box({ type: 'annotation' }))).toBe('Annotation');
    expect(elementTelemetryType(box({ type: 'link-card' }))).toBe('LinkCard');
    expect(elementTelemetryType(box({ type: 'arrow' }))).toBe('Arrow');
  });

  // Three tools share the freehand element kind and the draw paths report
  // them separately, so a COPY of one has to land in the same bucket.
  it('splits the three freehand tools apart', () => {
    const free = (over: Record<string, unknown>) =>
      elementTelemetryType(box({ type: 'freehand', closed: false, ...over } as Partial<Element>));
    expect(free({})).toBe('Freehand');
    expect(free({ pen: 'highlighter' })).toBe('Highlighter');
    expect(free({ straightEdges: true })).toBe('Polyline');
    expect(free({ straightEdges: true, closed: true })).toBe('Polygon');
    // The highlighter wins over straightEdges — a highlighter stroke is
    // never polygon-drawn, but the check order should be explicit.
    expect(free({ pen: 'highlighter', straightEdges: true })).toBe('Highlighter');
  });
});

describe('trackDuplicated', () => {
  beforeEach(() => trackMock.mockClear());

  // The bug this guards: duplicating N elements used to emit ONE untyped
  // event, so Element·Added (the census behind the Palette ranking) never
  // saw a single element born by copying.
  it('emits one Duplicated plus one Added per element', () => {
    trackDuplicated([box({ id: 'a' }), box({ id: 'b', shape: 'circle' }), box({ id: 'c' })]);
    expect(trackMock.mock.calls).toEqual([
      ['Element', 'Duplicated', undefined],
      ['Element', 'Added', 'Square'],
      ['Element', 'Added', 'Circle'],
      ['Element', 'Added', 'Square'],
    ]);
  });

  // Emitting before the copy paths' guards logged duplicates that never
  // happened (a multi-selection holding nothing copyable).
  it('emits nothing for an empty result', () => {
    trackDuplicated([]);
    expect(trackMock).not.toHaveBeenCalled();
  });

  // The gesture token belongs on the single Duplicated event only: the
  // per-element Added events must stay comparable with the paths that
  // create an element from scratch.
  it('puts the gesture type on Duplicated, never on Added', () => {
    trackDuplicated([box()], 'ShiftDrag');
    expect(trackMock.mock.calls).toEqual([
      ['Element', 'Duplicated', 'ShiftDrag'],
      ['Element', 'Added', 'Square'],
    ]);
  });
});
