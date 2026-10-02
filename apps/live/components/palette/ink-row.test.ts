import { describe, expect, it } from 'vitest';
import { PEN_INK, penColourHex, type Element } from '@livediagram/document';
import { inkSwatch, shownColour } from './ink-row';

const el = (type: string, over: Record<string, unknown> = {}): Element =>
  ({ id: 'e', type, x: 0, y: 0, width: 9, height: 9, ...over }) as unknown as Element;

// docs/specs/007-editor/editor-modes.md "One look": the element menu offers Ink where the element
// can store it by name, and shows a stored name in its version for the canvas.
describe('inkSwatch', () => {
  it('offers Ink on the lines and text that store it by name', () => {
    for (const type of ['shape', 'arrow', 'freehand'])
      expect(inkSwatch(el(type), 'line', 'dark'), type).toBe(PEN_INK.dark);
    for (const type of ['shape', 'text', 'sticky', 'arrow'])
      expect(inkSwatch(el(type), 'text', 'light'), type).toBe(PEN_INK.light);
  });

  it('offers none where no name can be stored', () => {
    expect(inkSwatch(el('table'), 'line', 'light')).toBeUndefined();
    expect(inkSwatch(el('table'), 'text', 'light')).toBeUndefined();
    expect(inkSwatch(el('sticky'), 'line', 'light')).toBeUndefined();
  });
});

describe('shownColour', () => {
  it('shows a stored name in its version for the canvas', () => {
    expect(shownColour(el('shape', { penColour: 'blue' }), 'line', 'dark', '#000')).toBe(
      penColourHex('blue', 'dark'),
    );
    expect(shownColour(el('text', { penTextColour: 'ink' }), 'text', 'light', '#000')).toBe(
      PEN_INK.light,
    );
  });

  it('shows an own colour, else the fallback', () => {
    expect(shownColour(el('shape', { strokeColor: '#123456' }), 'line', 'dark', '#000')).toBe(
      '#123456',
    );
    expect(shownColour(el('shape'), 'text', 'dark', '#abcdef')).toBe('#abcdef');
  });
});
