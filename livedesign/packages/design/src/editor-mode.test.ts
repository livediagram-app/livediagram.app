import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_MODE,
  EDITOR_MODE_CATALOGUE,
  EDITOR_MODES,
  isEditorMode,
  opensInOf,
  parseEditorMode,
} from './editor-mode';

// Editor modes (docs/specs/007-editor/pages-mode.md "One mode"): livedesign has one, Pages.
describe('editor modes', () => {
  it('are Pages alone, Pages by default', () => {
    expect(EDITOR_MODES).toEqual(['pages']);
    expect(DEFAULT_EDITOR_MODE).toBe('pages');
    expect(EDITOR_MODE_CATALOGUE.map((m) => m.label)).toEqual(['Pages']);
  });

  it('recognises Pages and nothing else', () => {
    expect(isEditorMode('pages')).toBe(true);
    expect(isEditorMode('diagram')).toBe(false);
    expect(isEditorMode('Pages')).toBe(false);
    expect(isEditorMode(undefined)).toBe(false);
    expect(isEditorMode('')).toBe(false);
  });
});

describe('parseEditorMode', () => {
  it('reads every mode livediagram stored, and its old names for Pages, as Pages', () => {
    for (const mode of [
      'pages',
      'diagram',
      'draw',
      'workshop',
      'facilitate',
      'plan',
      'illustrate',
      'infographic',
    ])
      expect(parseEditorMode(mode)).toBe('pages');
  });

  it('reads anything else as no mode', () => {
    expect(parseEditorMode('whiteboard')).toBeUndefined();
    expect(parseEditorMode(3)).toBeUndefined();
    expect(parseEditorMode(undefined)).toBeUndefined();
  });
});

describe('opensInOf', () => {
  it('reads every tab as Pages, whatever it stored', () => {
    expect(opensInOf(undefined)).toBe('pages');
    expect(opensInOf({})).toBe('pages');
    expect(opensInOf({ opensIn: 'draw' })).toBe('pages');
  });
});
