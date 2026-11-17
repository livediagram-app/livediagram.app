import { describe, expect, it } from 'vitest';
import { themeColourFields } from './themes';

// The theme transforms' opt-outs: a locked fill keeps its colour, and a locked ink (themeLockText) its text colour,
// so an ink chosen for a locked fill always reads on it.
describe('themeColourFields', () => {
  const fields = (el: Parameters<typeof themeColourFields>[0]) =>
    themeColourFields(el).map((f) => f.element);

  it('themes a shape’s fill, stroke and text', () => {
    expect(fields({ type: 'shape', shape: 'card' })).toEqual([
      'fillColor',
      'strokeColor',
      'textColor',
    ]);
  });

  it('leaves a locked fill, a locked ink or both alone, and still themes the stroke', () => {
    expect(fields({ type: 'shape', shape: 'card', themeLockFill: true })).toEqual([
      'strokeColor',
      'textColor',
    ]);
    expect(fields({ type: 'shape', shape: 'card', themeLockText: true })).toEqual([
      'fillColor',
      'strokeColor',
    ]);
    expect(
      fields({ type: 'shape', shape: 'card', themeLockFill: true, themeLockText: true }),
    ).toEqual(['strokeColor']);
  });
});
