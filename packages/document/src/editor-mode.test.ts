import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_MODE,
  EDITOR_MODES,
  editorModeSwitchable,
  hasBoardLook,
  isEditorMode,
  opensInOf,
} from './editor-mode';

// Editor modes (docs/specs/007-editor/editor-modes.md): how a general tab is worked on.
describe('editor modes', () => {
  it('are Diagram and Draw, Diagram by default', () => {
    expect(EDITOR_MODES).toEqual(['diagram', 'draw']);
    expect(DEFAULT_EDITOR_MODE).toBe('diagram');
  });

  it('recognises a mode and nothing else', () => {
    expect(isEditorMode('diagram')).toBe(true);
    expect(isEditorMode('draw')).toBe(true);
    expect(isEditorMode('whiteboard')).toBe(false);
    expect(isEditorMode(undefined)).toBe(false);
    expect(isEditorMode(1)).toBe(false);
  });
});

describe('opensInOf', () => {
  it('reads a tab without an opening mode as Diagram', () => {
    expect(opensInOf({})).toBe('diagram');
    expect(opensInOf(undefined)).toBe('diagram');
  });

  it('reads a tab that opens in Draw', () => {
    expect(opensInOf({ opensIn: 'draw' })).toBe('draw');
    expect(opensInOf({ kind: 'diagram', opensIn: 'draw' })).toBe('draw');
  });

  it('reads an unknown opening mode as Diagram', () => {
    expect(opensInOf({ opensIn: 'sketch' })).toBe('diagram');
  });

  it('opens an event-storming board in Diagram whatever it stores', () => {
    expect(opensInOf({ kind: 'event-storming', opensIn: 'draw' })).toBe('diagram');
    const legacy = { opensIn: 'draw', layers: [{ id: 'layer:es:board', name: 'Event Storming' }] };
    expect(opensInOf(legacy)).toBe('diagram');
  });
});

describe('editorModeSwitchable', () => {
  it('offers the switch on a general tab', () => {
    expect(editorModeSwitchable({})).toBe(true);
    expect(editorModeSwitchable({ kind: 'diagram', opensIn: 'draw' })).toBe(true);
  });

  it('never on an event-storming board, new or legacy', () => {
    expect(editorModeSwitchable({ kind: 'event-storming' })).toBe(false);
    expect(editorModeSwitchable({ layers: [{ id: 'layer:es:board', name: 'ES' }] })).toBe(false);
  });
});

describe('hasBoardLook', () => {
  it('gives Draw mode the board look and Diagram mode none', () => {
    expect(hasBoardLook('draw')).toBe(true);
    expect(hasBoardLook('diagram')).toBe(false);
  });
});
