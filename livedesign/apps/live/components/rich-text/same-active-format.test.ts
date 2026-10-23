import { describe, expect, it } from 'vitest';
import { sameActiveFormat, type ActiveFormat } from './rich-text-format';

// The toolbar keeps its previous state object while nothing changed (useRichTextDesign), so a keystroke
// renders the editor once. A field the comparison missed would leave the toolbar showing a stale state.
const BASE: ActiveFormat = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  color: null,
  heading: null,
  link: null,
};
const CHANGED: { [K in keyof ActiveFormat]-?: ActiveFormat[K] } = {
  bold: true,
  italic: true,
  underline: true,
  strikethrough: true,
  color: '#ff0000',
  heading: 1,
  link: 'https://example.com',
};

describe('sameActiveFormat', () => {
  it('holds for an equal state', () => {
    expect(sameActiveFormat(BASE, { ...BASE })).toBe(true);
  });

  it('notices a change to every field', () => {
    for (const key of Object.keys(CHANGED) as (keyof ActiveFormat)[]) {
      expect(sameActiveFormat(BASE, { ...BASE, [key]: CHANGED[key] }), key).toBe(false);
    }
    expect(Object.keys(CHANGED).sort()).toEqual(Object.keys(BASE).sort());
  });
});
