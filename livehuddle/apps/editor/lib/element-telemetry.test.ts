import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SHAPE_KINDS, type Element } from '@livehuddle/document';
import { ALL_PALETTE_TELEMETRY_TYPES } from '@livehuddle/api-schema';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: Parameters<typeof trackMock>) => trackMock(...args),
  titleCaseType: (v: string) => (v.length === 0 ? v : v[0]!.toUpperCase() + v.slice(1)),
}));

const { elementTelemetryType, shapeTelemetryToken, trackDuplicated } =
  await import('./element-telemetry');

const box = (over: Partial<Element> = {}) =>
  ({
    id: 'e1',
    type: 'shape',
    shape: 'room',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...over,
  }) as Element;

describe('elementTelemetryType', () => {
  it('title-cases a plain shape', () => {
    expect(elementTelemetryType(box())).toBe('Room');
    expect(elementTelemetryType(box({ shape: 'plant' }))).toBe('Plant');
  });

  // Not 'Mode-Button': titleCase capitalises at the hyphen, which would split
  // the feature across two dashboard tokens (the Changed events say ModeButton).
  it('reports a mode button as one token', () => {
    expect(elementTelemetryType(box({ shape: 'mode-button' }))).toBe('ModeButton');
  });

  it('reports every non-shape kind', () => {
    expect(elementTelemetryType(box({ type: 'text' }))).toBe('Text');
    expect(elementTelemetryType(box({ type: 'sticky' }))).toBe('Sticky');
    expect(elementTelemetryType(box({ type: 'image' }))).toBe('Image');
    expect(elementTelemetryType(box({ type: 'annotation' }))).toBe('Annotation');
    expect(elementTelemetryType(box({ type: 'link-card' }))).toBe('LinkCard');
    expect(elementTelemetryType(box({ type: 'arrow' }))).toBe('Arrow');
  });

  // A stored pen stroke of any pen reports as one kind: the tools that told them apart are gone
  // (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
  it('reports every stored pen stroke as Freehand', () => {
    expect(
      elementTelemetryType(box({ type: 'freehand', pen: 'highlighter' } as Partial<Element>)),
    ).toBe('Freehand');
    expect(
      elementTelemetryType(box({ type: 'freehand', straightEdges: true } as Partial<Element>)),
    ).toBe('Freehand');
  });
});

describe('trackDuplicated', () => {
  beforeEach(() => trackMock.mockClear());

  // The bug this guards: duplicating N elements used to emit ONE untyped
  // event, so Element·Added (the census behind the Palette ranking) never
  // saw a single element born by copying.
  it('emits one Duplicated plus one Added per element', () => {
    trackDuplicated([box({ id: 'a' }), box({ id: 'b', shape: 'plant' }), box({ id: 'c' })]);
    expect(trackMock.mock.calls).toEqual([
      ['Element', 'Duplicated', undefined],
      ['Element', 'Added', 'Room'],
      ['Element', 'Added', 'Plant'],
      ['Element', 'Added', 'Room'],
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
      ['Element', 'Added', 'Room'],
    ]);
  });
});

describe('shapeTelemetryToken', () => {
  // Every shape kind reports a token the Palette tab ranks. A kind whose token
  // is missing from the catalogue is counted nowhere on the dashboard: that is
  // how 'Session-button' and friends read zero while being drawn every day.
  it('maps every shape kind to a token the palette catalogue knows', () => {
    const known = new Set(ALL_PALETTE_TELEMETRY_TYPES);
    const unknown = [...SHAPE_KINDS].filter((k) => !known.has(shapeTelemetryToken(k)));
    expect(unknown).toEqual([]);
  });
});
