import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_MODE,
  EDITOR_MODES,
  editorModeLabel,
  isEditorMode,
  opensInOf,
  parseEditorMode,
} from './editor-mode';

// The editor mode (docs/specs/007-editor/editor-modes.md): livehuddle has Workshop alone.
describe('editor mode', () => {
  it('is Workshop, and only Workshop', () => {
    expect(EDITOR_MODES).toEqual(['workshop']);
    expect(DEFAULT_EDITOR_MODE).toBe('workshop');
    expect(editorModeLabel('workshop')).toBe('Workshop');
  });

  it('recognises Workshop and nothing else', () => {
    expect(isEditorMode('workshop')).toBe(true);
    for (const v of ['diagram', 'draw', 'Workshop', '', undefined, null, 1]) {
      expect(isEditorMode(v)).toBe(false);
    }
  });

  it('reads every stored mode livediagram or an older build wrote as Workshop', () => {
    for (const v of [
      'workshop',
      'diagram',
      'draw',
      'pages',
      'plan',
      'illustrate',
      'infographic',
      'facilitate',
    ]) {
      expect(parseEditorMode(v)).toBe('workshop');
    }
    expect(parseEditorMode('Diagram')).toBeUndefined();
    expect(parseEditorMode('whiteboard')).toBeUndefined();
    expect(parseEditorMode(undefined)).toBeUndefined();
  });

  it('opens every tab in Workshop, whatever it stored', () => {
    expect(opensInOf({})).toBe('workshop');
    expect(opensInOf(undefined)).toBe('workshop');
    expect(opensInOf({ opensIn: 'draw' })).toBe('workshop');
    expect(opensInOf({ opensIn: 'diagram' })).toBe('workshop');
  });
});
