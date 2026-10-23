import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_MODE,
  EDITOR_MODE_CATALOGUE,
  EDITOR_MODES,
  editorModeLabel,
  isEditorMode,
} from './editor-mode';

// Editor modes (docs/specs/007-editor/pages-mode.md "One mode"): livedocuments has one, Pages.
describe('editor modes', () => {
  it('are Pages alone, Pages by default', () => {
    expect(EDITOR_MODES).toEqual(['pages']);
    expect(DEFAULT_EDITOR_MODE).toBe('pages');
    expect(EDITOR_MODE_CATALOGUE.map((m) => editorModeLabel(m.id))).toEqual(['Pages']);
  });

  it('recognises Pages and nothing else', () => {
    expect(isEditorMode('pages')).toBe(true);
    expect(isEditorMode('diagram')).toBe(false);
    expect(isEditorMode('Pages')).toBe(false);
    expect(isEditorMode(undefined)).toBe(false);
    expect(isEditorMode('')).toBe(false);
  });
});
