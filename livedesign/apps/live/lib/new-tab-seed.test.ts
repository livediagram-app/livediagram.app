import { describe, expect, it } from 'vitest';
import type { Tab } from '@livepages/document';
import { newTabOpening, newTabSeed } from './new-tab-seed';

// docs/specs/007-editor/editor-modes.md "A new tab opens in the mode it was made from", with no Quick Start.
describe('newTabOpening', () => {
  it('opens a tab added from any mode but Diagram in that mode, with no Quick Start', () => {
    for (const mode of ['draw', 'workshop', 'pages', 'plan'] as const)
      expect(newTabOpening(mode)).toEqual({ opensIn: mode });
  });

  it('opens a tab added from Diagram in Diagram, on Start Diagramming, writing no opening mode', () => {
    expect(newTabOpening('diagram')).toEqual({});
  });

  it('opens a tab asked for in a mode in that mode, on its own start, never the Quick Start', () => {
    for (const creator of ['plan', 'diagram'] as const) {
      expect(newTabOpening(creator, 'diagram')).toEqual({});
      for (const mode of ['draw', 'workshop', 'pages', 'plan'] as const)
        expect(newTabOpening(creator, mode)).toEqual({ opensIn: mode });
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

  // docs/specs/007-editor/editor-modes.md "Where the mode lives": the look is the seed's, the mode
  // newTabOpening's (the creator's mode), never the source's stored field.
  it('never carries an opening mode, even from a tab that opens in Draw', () => {
    expect(newTabSeed({ ...source, opensIn: 'draw' }).opensIn).toBeUndefined();
  });

  it('falls back to defaults with no source tab', () => {
    expect(newTabSeed(undefined)).toEqual({});
  });
});
