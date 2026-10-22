import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import {
  applyHighlighterStyle,
  isHighlightStroke,
  strokesHighlighterStyle,
  toolHighlighterStyle,
} from './quick-style-highlighter';

// docs/specs/008-canvas/highlighter.md "Settings": the Quick style panel's Highlighter rows.
const highlight = (over: Record<string, unknown> = {}) =>
  ({
    id: 'h',
    type: 'freehand',
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    closed: false,
    pen: 'highlighter',
    strokeColor: '#fde047',
    ...over,
  }) as unknown as Element;
const sketch = highlight({ id: 's', pen: undefined, strokeColor: '#000000' });

describe('isHighlightStroke', () => {
  it('takes unlocked highlights only', () => {
    expect(isHighlightStroke(highlight())).toBe(true);
    expect(isHighlightStroke(highlight({ locked: true }))).toBe(false);
    expect(isHighlightStroke(sketch)).toBe(false);
  });
});

describe('strokesHighlighterStyle', () => {
  it('marks the shared colour and width, Medium when no width is stored', () => {
    const style = strokesHighlighterStyle([highlight(), highlight({ id: 'h2' })])!;
    expect(style.subject).toEqual({ kind: 'strokes', ids: ['h', 'h2'], name: '2 highlights' });
    expect(style.colour.value).toBe('#fde047');
    expect(style.colour.options.map((o) => o.name)).toEqual([
      'Yellow',
      'Green',
      'Pink',
      'Blue',
      'Orange',
    ]);
    expect(style.width.value).toBe('medium');
  });

  it('marks nothing where the highlights disagree or sit off the set', () => {
    const style = strokesHighlighterStyle([
      highlight({ penWidth: 22 }),
      highlight({ id: 'h2', strokeColor: '#123456' }),
    ])!;
    expect(style.colour.value).toBeNull();
    expect(style.width.value).toBeNull();
  });

  it('names one highlight, and ignores everything else in the selection', () => {
    expect(strokesHighlighterStyle([highlight({ penWidth: 8 }), sketch])).toMatchObject({
      subject: { ids: ['h'], name: 'Highlight' },
      width: { value: 'thin' },
    });
    expect(strokesHighlighterStyle([sketch])).toBeUndefined();
  });
});

describe('toolHighlighterStyle', () => {
  it('shows the next stroke’s colour and width under the tool’s name', () => {
    expect(toolHighlighterStyle('#93c5fd', 22)).toMatchObject({
      subject: { kind: 'tool', name: 'Highlighter' },
      colour: { value: '#93c5fd' },
      width: { value: 'bold' },
    });
  });
});

describe('applyHighlighterStyle', () => {
  it('recolours and rewidths a highlight; Medium clears the stored width', () => {
    expect(applyHighlighterStyle(highlight(), { colour: '#86efac' })).toMatchObject({
      strokeColor: '#86efac',
    });
    expect(applyHighlighterStyle(highlight(), { width: 'bold' })).toMatchObject({ penWidth: 22 });
    expect(
      'penWidth' in applyHighlighterStyle(highlight({ penWidth: 22 }), { width: 'medium' }),
    ).toBe(false);
  });

  it('leaves anything that is not a highlight alone', () => {
    expect(applyHighlighterStyle(sketch, { colour: '#86efac' })).toBe(sketch);
  });
});
