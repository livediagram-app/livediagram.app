import { describe, expect, it } from 'vitest';
import type { Tab } from '@livedesign/design';
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
    expect(newTabSeed(source)).toEqual({
      theme: 'slate',
      backgroundPattern: 'grid',
      backgroundColor: '#fdf2f8',
      backgroundOpacity: 0.8,
      patternColor: '#fbcfe8',
      font: 'caveat',
      defaultTextSize: 'sm',
    });
  });

  // The look is the seed's; a stored mode from livediagram is never carried.
  it('never carries an opening mode', () => {
    expect(newTabSeed({ ...source, opensIn: 'pages' }).opensIn).toBeUndefined();
  });

  it('falls back to defaults with no source tab', () => {
    expect(newTabSeed(undefined)).toEqual({});
  });
});
