import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, ShapeElement, Tab, TextElement } from './index';
import { migrateWhiteboardKind } from './legacy-whiteboard-tab';

// A stored whiteboard tab (docs/specs/007-editor/editor-modes.md "Existing whiteboards") reads as
// a general tab that opens in Draw, looking exactly as it did ("One look").
const board = (over: Record<string, unknown> = {}) =>
  ({ id: 't', name: 'Board', kind: 'whiteboard', elements: [], ...over }) as unknown as Tab;

const shape = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...over,
});
// A stored arrow, pen stroke and path: retired elements (docs/specs/002-project-scope/not-in-livehuddle.md "The
// element engine", part 4).
const arrow = (over: Record<string, unknown> = {}): Element => ({
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 10, y: 0 },
  ...over,
});
const freehand = (over: Record<string, unknown> = {}): Element =>
  ({
    id: 'f',
    type: 'freehand',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    packedPoints: 'AQA=',
    closed: false,
    ...over,
  }) as Element;
const path = (over: Record<string, unknown> = {}): Element => ({
  id: 'p',
  type: 'path',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...over,
});
const text = (over: Partial<TextElement> = {}): TextElement => ({
  id: 'x',
  type: 'text',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  label: 'Hi',
  ...over,
});

const migrated = (el: Element): Element =>
  migrateWhiteboardKind(board({ elements: [el] })).elements[0]!;

describe('migrateWhiteboardKind', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes a whiteboard a general tab that opens in Draw', () => {
    const out = migrateWhiteboardKind(board({ backgroundPattern: 'graph' }));
    expect(out.kind).toBe('diagram');
    expect(out.opensIn).toBe('draw');
    expect(out.backgroundPattern).toBe('graph');
    expect(out.name).toBe('Board');
  });

  it('writes Plain onto a board stored without a background, as it always showed', () => {
    expect(migrateWhiteboardKind(board()).backgroundPattern).toBe('blank');
  });

  it('logs the migration with a recognisable fingerprint', () => {
    migrateWhiteboardKind(board());
    expect(console.info).toHaveBeenCalledWith(
      '[editor-mode] whiteboard tab migrated to Draw',
      expect.objectContaining({ tabId: 't' }),
    );
  });

  it('leaves every other tab untouched, the same object', () => {
    for (const tab of [
      { id: 't', name: 'T', elements: [shape()] },
      { id: 't', name: 'T', kind: 'diagram', opensIn: 'draw', elements: [shape()] },
      { id: 't', name: 'T', kind: 'diagram', elements: [] },
    ] as Tab[]) {
      expect(migrateWhiteboardKind(tab)).toBe(tab);
    }
    expect(console.info).not.toHaveBeenCalled();
  });

  it('gives an unpainted marker shape an Ink outline, Ink label and no fill', () => {
    for (const kind of ['square', 'circle', 'triangle', 'diamond'] as const) {
      const out = migrated(shape({ shape: kind })) as ShapeElement;
      expect(out.penColour).toBe('ink');
      expect(out.penTextColour).toBe('ink');
      expect(out.fillColor).toBe('transparent');
      expect(out.strokeColor).toBeUndefined();
      expect(out.textColor).toBeUndefined();
    }
  });

  it('keeps every colour a shape already has', () => {
    const painted = shape({ strokeColor: '#ff0000', fillColor: '#00ff00', textColor: '#0000ff' });
    expect(migrated(painted)).toEqual(painted);
    const named = shape({ penColour: 'blue', penTextColour: 'red', fillColor: 'transparent' });
    expect(migrated(named)).toEqual(named);
  });

  it('fills in only what a partly painted shape lacks', () => {
    const out = migrated(shape({ strokeColor: '#ff0000' })) as ShapeElement;
    expect(out.strokeColor).toBe('#ff0000');
    expect(out.penColour).toBeUndefined();
    expect(out.fillColor).toBe('transparent');
    expect(out.penTextColour).toBe('ink');
  });

  it('leaves a shape kind the board never inked as it was', () => {
    const cylinder = shape({ shape: 'cylinder' });
    expect(migrated(cylinder)).toEqual(cylinder);
  });

  it('leaves a stored arrow, line, path and pen stroke exactly as stored, the same object', () => {
    for (const el of [
      arrow(),
      arrow({ arrowEnds: 'none' }),
      path(),
      freehand(),
      freehand({ pen: 'highlighter' }),
    ])
      expect(migrated(el)).toBe(el);
  });

  // docs/specs/007-editor/editor-modes.md "A text box's sizing": text hugged on a board.
  it("keeps a board's text boxes hugging: set width wraps, an auto width fits", () => {
    expect((migrated(text()) as TextElement).sizing).toBe('wrap');
    const fit = migrated(text({ autoWidth: true } as Partial<TextElement>)) as TextElement;
    expect(fit.sizing).toBe('fit');
    expect(fit).not.toHaveProperty('autoWidth');
    const kept = text({ sizing: 'fit' });
    expect(migrated(kept)).toBe(kept);
  });

  it('keeps an element nothing needs to change the same object', () => {
    const painted = shape({ strokeColor: '#ff0000', fillColor: '#00ff00', textColor: '#0000ff' });
    expect(migrated(painted)).toBe(painted);
  });
});
