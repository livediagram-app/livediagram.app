import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { newTabSeed } from './new-tab-seed';

const source: Tab = {
  id: 's',
  name: 'Source',
  elements: [],
  theme: 'slate',
  backgroundPattern: 'grid',
  backgroundColor: '#fdf2f8',
  backgroundOpacity: 0.8,
  patternColor: '#fbcfe8',
  font: 'caveat',
};

// A tab added from the tab bar carries the look of the tab it was added from.
describe('newTabSeed', () => {
  it('carries the source tab’s theme, canvas and type', () => {
    expect(newTabSeed(source, 'diagram')).toEqual({
      theme: 'slate',
      backgroundPattern: 'grid',
      backgroundColor: '#fdf2f8',
      backgroundOpacity: 0.8,
      patternColor: '#fbcfe8',
      font: 'caveat',
      defaultTextSize: 'sm',
    });
  });

  // docs/specs/007-editor/editor-modes.md "Where the mode lives": a new tab inherits the mode
  // its creator is in.
  it('opens in the creator’s current mode, not the source tab’s opening mode', () => {
    expect(newTabSeed(source, 'draw').opensIn).toBe('draw');
    expect(newTabSeed({ ...source, opensIn: 'draw' }, 'diagram').opensIn).toBeUndefined();
    expect(newTabSeed(undefined, 'draw')).toEqual({ opensIn: 'draw' });
  });

  it('falls back to defaults with no source tab', () => {
    expect(newTabSeed(undefined, 'diagram')).toEqual({});
  });
});
