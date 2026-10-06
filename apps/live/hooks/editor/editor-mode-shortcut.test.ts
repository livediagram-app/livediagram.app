import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorMode } from '@livediagram/document';
import { editorModeShortcut } from './editor-mode-shortcut';
import { setIllustrateModeEnabled, setPlanModeEnabled } from '@/lib/offered-editor-modes';

afterEach(() => {
  setIllustrateModeEnabled(false);
  setPlanModeEnabled(false);
});

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): next mode, announced politely.
describe('editorModeShortcut', () => {
  const state = (mode: EditorMode, canSwitch = true) => ({
    mode,
    canSwitch,
    canEdit: true,
    setMode: vi.fn(),
  });

  it('offers nothing where the switch is not offered', () => {
    expect(editorModeShortcut(state('diagram', false), vi.fn())).toBeNull();
  });

  it.each([
    ['diagram', 'draw', 'Draw mode'],
    ['draw', 'illustrate', 'Illustrate mode'],
    ['illustrate', 'plan', 'Plan mode'],
    ['plan', 'diagram', 'Diagram mode'],
  ] as const)('from %s switches to %s and announces "%s"', (from, to, message) => {
    setIllustrateModeEnabled(true);
    setPlanModeEnabled(true);
    const s = state(from);
    const announce = vi.fn();
    editorModeShortcut(s, announce)!();
    expect(s.setMode).toHaveBeenCalledWith(to);
    expect(announce).toHaveBeenCalledWith(message);
  });

  it('skips Illustrate and Plan while they are switched off in Settings', () => {
    const s = state('draw');
    editorModeShortcut(s, vi.fn())!();
    expect(s.setMode).toHaveBeenCalledWith('diagram');
  });

  it('skips Plan alone when only Plan is switched off', () => {
    setIllustrateModeEnabled(true);
    const s = state('illustrate');
    editorModeShortcut(s, vi.fn())!();
    expect(s.setMode).toHaveBeenCalledWith('diagram');
  });
});
