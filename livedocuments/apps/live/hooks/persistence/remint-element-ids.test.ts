import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement } from '@livedocuments/document';
import { remintElements } from './useTabImport';

const remintElementIds = (elements: Element[]) => remintElements(elements).elements;

// Duplicate Tab and JSON import re-mint ids.
// References between elements must follow the new ids, or the copy points
// back at the source tab.

const shape = (id: string, extra: Partial<ShapeElement> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...extra,
});

describe('remintElementIds', () => {
  it('keeps element order, which is stacking order', () => {
    const out = remintElementIds([
      {
        id: 'a',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'free', x: 1, y: 1 },
      },
      shape('s'),
    ]);
    expect(out.map((e) => e.type)).toEqual(['arrow', 'shape']);
  });
});
