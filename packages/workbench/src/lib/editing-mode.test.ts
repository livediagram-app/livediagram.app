import { describe, expect, it } from 'vitest';
import { EDITING_MODES, editingModes, nextEditingMode } from './editing-mode';

// liveworkspace/docs/specs/004-index/footer-tools-menu.md "The Editing Mode button": the modes run down from the real
// role (Editor, Participant, Viewer) and a press wraps back round to it.

describe('editingModes', () => {
  it('runs from the real role down, widest first', () => {
    expect(EDITING_MODES).toEqual(['edit', 'participate', 'view']);
    expect(editingModes('edit')).toEqual(['edit', 'participate', 'view']);
    expect(editingModes('participate')).toEqual(['participate', 'view']);
    expect(editingModes('view')).toEqual(['view']);
  });

  it('keeps to the roles an app offers', () => {
    // livehuddle: no Viewer step.
    const offered = ['edit', 'participate'] as const;
    expect(editingModes('edit', offered)).toEqual(['edit', 'participate']);
    expect(editingModes('participate', offered)).toEqual(['participate']);
    // A legacy Viewer the app no longer offers has its own mode alone.
    expect(editingModes('view', offered)).toEqual(['view']);
  });
});

describe('nextEditingMode', () => {
  it('steps to the next mode and wraps back to the real role', () => {
    const modes = editingModes('edit');
    expect(nextEditingMode('edit', modes)).toBe('participate');
    expect(nextEditingMode('participate', modes)).toBe('view');
    expect(nextEditingMode('view', modes)).toBe('edit');
    const participant = editingModes('participate');
    expect(nextEditingMode('participate', participant)).toBe('view');
    expect(nextEditingMode('view', participant)).toBe('participate');
  });

  it('has nothing to switch to with one mode', () => {
    expect(nextEditingMode('view', ['view'])).toBeNull();
    expect(nextEditingMode('edit', [])).toBeNull();
  });

  it('steps a mode outside the list to the first', () => {
    expect(nextEditingMode('edit', ['participate', 'view'])).toBe('participate');
  });
});
