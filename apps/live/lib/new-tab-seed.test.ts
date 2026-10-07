import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { newTabOpening, newTabSeed } from './new-tab-seed';

// docs/specs/007-editor/editor-modes.md: a tab added from Plan opens in Plan with no Quick Start.
describe('newTabOpening', () => {
  it('opens a tab added from Plan in Plan, with no Quick Start', () => {
    expect(newTabOpening('plan')).toEqual({ opensIn: 'plan', quickStart: false });
  });

  it('leaves every other mode as before: Diagram, with the Quick Start', () => {
    for (const mode of ['diagram', 'draw', 'illustrate'] as const)
      expect(newTabOpening(mode)).toEqual({ quickStart: true });
  });
});

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

  // docs/specs/007-editor/editor-modes.md "Where the mode lives": a new tab opens in Diagram,
  // whatever mode its creator is in.
  it('never carries an opening mode, even from a tab that opens in Draw', () => {
    expect(newTabSeed({ ...source, opensIn: 'draw' }).opensIn).toBeUndefined();
  });

  it('falls back to defaults with no source tab', () => {
    expect(newTabSeed(undefined)).toEqual({});
  });
});
