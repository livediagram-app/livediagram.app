import { describe, expect, it } from 'vitest';
import {
  KEY_MEANINGS_MAX,
  createArrow,
  createShape,
  diagramKeyHeight,
  isValidElement,
  keyRowsOf,
  meaningOf,
  migrateStoredTab,
  renderElementsToSvg,
  settleDiagramKeys,
  withKeyMeaning,
  withWebRows,
  type Element,
  type ShapeElement,
} from './index';

// docs/specs/009-elements/diagram-key.md, blueprint diagram-key.md.

const arrow = (style?: string) =>
  ({ ...createArrow(0, 0, 100, 0), ...(style ? { strokeStyle: style } : {}) }) as Element;
const key = (over: Partial<ShapeElement> = {}) =>
  ({ ...(createShape('diagram-key', 0, 0) as ShapeElement), id: 'k', ...over }) as ShapeElement;
const map = [{ tag: 'Payments', color: '#d97706' }];

describe('the diagram key rows', () => {
  it('lists each line pattern once, in first use, then the tag colours', () => {
    const rows = keyRowsOf([arrow(), arrow('dashed'), arrow(), arrow('dotted')], map);
    expect(rows.map((r) => r.id)).toEqual([
      'line:solid',
      'line:dashed',
      'line:dotted',
      'tag:payments',
    ]);
  });

  it('settles every key to the tab: rows stored and height fitted (I1), the same array when nothing changed', () => {
    const els = [arrow('dashed'), key()];
    const settled = settleDiagramKeys(els, map);
    const k = settled[1] as ShapeElement;
    expect(k.keyRows!.map((r) => r.id)).toEqual(['line:dashed', 'tag:payments']);
    expect(k.height).toBe(diagramKeyHeight(2));
    expect(settleDiagramKeys(settled, map)).toBe(settled);
    expect(settleDiagramKeys([arrow()], map)).toEqual(
      [arrow()].map((a) => ({ ...a, id: expect.any(String) })),
    );
  });

  it('settles on read from the stored tab and its tag colours', () => {
    const tab = migrateStoredTab({
      theme: 'default',
      tagColours: map,
      elements: [arrow(), key()],
    } as never) as {
      elements: ShapeElement[];
    };
    expect(tab.elements[1]!.keyRows!.map((r) => r.id)).toEqual(['line:solid', 'tag:payments']);
  });
});

describe('meanings', () => {
  const settled = settleDiagramKeys([arrow('dashed'), key()], map)[1] as ShapeElement;

  it("starts from the pattern or the tag, and takes the author's words", () => {
    const [line, tag] = settled.keyRows!;
    expect(meaningOf(settled, line!)).toBe('Dashed line');
    expect(meaningOf(settled, tag!)).toBe('Payments');
    const written = withKeyMeaning(settled, 'line:dashed', '  Event,   fire and forget ');
    expect(meaningOf(written, line!)).toBe('Event, fire and forget');
    expect('keyMeanings' in withKeyMeaning(written, 'line:dashed', '')).toBe(false);
  });

  it('writes through the web rows setter, and keeps at most 24 meanings, dropping unused ones', () => {
    expect(
      withWebRows(settled, { keyMeaning: { rowId: 'tag:payments', text: 'Owned by Payments' } })
        .keyMeanings,
    ).toEqual({
      'tag:payments': 'Owned by Payments',
    });
    let k: ShapeElement = settled;
    for (let i = 0; i < 30; i++) k = withKeyMeaning(k, `line:gone-${i}`, `m${i}`);
    k = withKeyMeaning(k, 'line:dashed', 'kept');
    expect(Object.keys(k.keyMeanings!).length).toBeLessThanOrEqual(KEY_MEANINGS_MAX);
    expect(k.keyMeanings!['line:dashed']).toBe('kept');
    expect(isValidElement(k)).toBe(true);
  });
});

describe('exporting a key (I2)', () => {
  it('draws the title, a dashed swatch with its meaning, and a tag edge in its colour', () => {
    const k = settleDiagramKeys([arrow('dashed'), key()], map)[1] as ShapeElement;
    const svg = renderElementsToSvg({ id: 't', name: 't', elements: [k] } as never);
    expect(svg).toContain('>Key<');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('Dashed line');
    expect(svg.toLowerCase()).toContain('#d97706');
    expect(svg.match(/>Key</g)).toHaveLength(1);
  });

  it('shows a hint when there is nothing to list', () => {
    const svg = renderElementsToSvg({
      id: 't',
      name: 't',
      elements: [key({ keyRows: [] })],
    } as never);
    expect(svg).toContain('Your line styles show here');
  });
});
