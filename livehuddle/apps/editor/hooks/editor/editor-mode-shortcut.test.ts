import { describe, expect, it, vi } from 'vitest';
import type { EditorMode } from '@livehuddle/document';
import { editorModeShortcut } from './editor-mode-shortcut';

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): next mode, announced politely, wherever the
// switch is offered, on a tab with content as on an empty one.
describe('editorModeShortcut', () => {
  const state = (mode: EditorMode, { canSwitch = true } = {}) => ({
    mode,
    canSwitch,
    canEdit: true,
    setMode: vi.fn(),
  });

  it('offers nothing where the switch is not offered (a Participant, a Viewer, a locked tab)', () => {
    expect(editorModeShortcut(state('diagram', { canSwitch: false }), vi.fn())).toBeNull();
  });

  it.each([
    ['diagram', 'draw', 'Draw mode'],
    ['draw', 'workshop', 'Workshop mode'],
    ['workshop', 'diagram', 'Diagram mode'],
  ] as const)('from %s switches to %s and announces "%s"', (from, to, message) => {
    const s = state(from);
    const announce = vi.fn();
    editorModeShortcut(s, announce)!();
    expect(s.setMode).toHaveBeenCalledWith(to);
    expect(announce).toHaveBeenCalledWith(message);
  });
});
