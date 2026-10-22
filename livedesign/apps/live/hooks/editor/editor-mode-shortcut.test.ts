import { describe, expect, it, vi } from 'vitest';
import type { EditorMode } from '@livedesign/document';
import { editorModeShortcut } from './editor-mode-shortcut';

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): next mode, announced politely,
// only on an empty tab (crossPlan), where the start's switch is.
describe('editorModeShortcut', () => {
  const state = (mode: EditorMode, { canSwitch = true, crossPlan = true } = {}) => ({
    mode,
    canSwitch,
    crossPlan,
    canEdit: true,
    setMode: vi.fn(),
  });

  it('offers nothing where the switch is not offered', () => {
    expect(editorModeShortcut(state('diagram', { canSwitch: false }), vi.fn())).toBeNull();
  });

  it('offers nothing on a tab with content: it keeps its mode', () => {
    expect(editorModeShortcut(state('diagram', { crossPlan: false }), vi.fn())).toBeNull();
    expect(editorModeShortcut(state('plan', { crossPlan: false }), vi.fn())).toBeNull();
  });

  it.each([
    ['diagram', 'draw', 'Draw mode'],
    ['draw', 'workshop', 'Workshop mode'],
    ['workshop', 'pages', 'Pages mode'],
    ['pages', 'plan', 'Plan mode'],
    ['plan', 'diagram', 'Diagram mode'],
  ] as const)('on an empty tab, from %s switches to %s and announces "%s"', (from, to, message) => {
    const s = state(from);
    const announce = vi.fn();
    editorModeShortcut(s, announce)!();
    expect(s.setMode).toHaveBeenCalledWith(to);
    expect(announce).toHaveBeenCalledWith(message);
  });
});
