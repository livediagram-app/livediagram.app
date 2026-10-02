import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_MODE,
  EDITOR_MODE_CATALOGUE,
  EDITOR_MODES,
  editorModeLabel,
  setTabOpensIn,
  editorModeSwitchable,
  hasBoardLook,
  isEditorMode,
  opensInOf,
} from './editor-mode';
import type { Tab } from './index';

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

// One catalogue (docs/specs/007-editor/editor-modes.md "Opens in"): a further mode is one entry.
describe('the editor mode catalogue', () => {
  it('lists every mode once, in order, with the words the interface shows', () => {
    expect(EDITOR_MODE_CATALOGUE.map((m) => m.id)).toEqual(EDITOR_MODES);
    expect(EDITOR_MODES.map(editorModeLabel)).toEqual(['Diagram', 'Draw']);
    for (const m of EDITOR_MODE_CATALOGUE) expect(m.description.length).toBeGreaterThan(0);
  });
});

describe('setTabOpensIn', () => {
  const general: Tab = { id: 't', name: 'T', elements: [] };

  it('sets the mode a tab opens in', () => {
    expect(setTabOpensIn(general, 'draw').opensIn).toBe('draw');
    expect(setTabOpensIn({ ...general, opensIn: 'draw' as const }, 'diagram').opensIn).toBe(
      'diagram',
    );
  });

  it('returns the same tab when nothing changes', () => {
    const draw = { ...general, opensIn: 'draw' as const };
    expect(setTabOpensIn(draw, 'draw')).toBe(draw);
    expect(setTabOpensIn(general, 'diagram')).toBe(general);
  });

  it('never gives an event-storming board an opening mode', () => {
    const es = { ...general, kind: 'event-storming' as const };
    expect(setTabOpensIn(es, 'draw')).toBe(es);
  });
});
