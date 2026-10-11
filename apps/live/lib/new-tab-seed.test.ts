import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { newTabOpening, newTabSeed } from './new-tab-seed';

// docs/specs/007-editor/editor-modes.md: a tab added from Plan opens in Plan with no Quick Start.
describe('newTabOpening', () => {
  it('opens a tab added from Plan in Plan, with no Quick Start', () => {
    expect(newTabOpening('plan')).toEqual({ opensIn: 'plan', quickStart: false });
  });

  it('opens a tab added from any other mode in Diagram, on Start Diagramming, with no Quick Start', () => {
    for (const mode of ['diagram', 'draw', 'illustrate'] as const)
      expect(newTabOpening(mode)).toEqual({ quickStart: false });
  });

  it('opens a tab asked for in a mode in that mode, on its own start, never the Quick Start', () => {
    for (const creator of ['plan', 'diagram'] as const) {
      expect(newTabOpening(creator, 'diagram')).toEqual({ quickStart: false });
      for (const mode of ['draw', 'facilitate', 'illustrate', 'plan'] as const)
        expect(newTabOpening(creator, mode)).toEqual({ opensIn: mode, quickStart: false });
    }
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
