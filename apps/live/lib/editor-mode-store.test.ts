import { describe, expect, it } from 'vitest';
import { resolveEditorMode } from './editor-mode-store';

// docs/specs/007-editor/editor-modes.md "Where the mode lives": the mode is the tab's, the same for
// everyone on it.
describe('resolveEditorMode', () => {
  it("reads the tab's own mode, Diagram when it has none, switchable by an editor", () => {
    expect(resolveEditorMode({ tab: { id: 't' }, canEdit: true })).toEqual({
      mode: 'diagram',
      canSwitch: true,
    });
    expect(resolveEditorMode({ tab: { id: 't', opensIn: 'draw' }, canEdit: true }).mode).toBe(
      'draw',
    );
  });

  it('gives a view-role visitor and everyone on a locked tab the mode, with no switch', () => {
    expect(resolveEditorMode({ tab: { id: 't', opensIn: 'illustrate' }, canEdit: false })).toEqual({
      mode: 'illustrate',
      canSwitch: false,
    });
    expect(
      resolveEditorMode({ tab: { id: 't', opensIn: 'plan', locked: true }, canEdit: true }),
    ).toEqual({ mode: 'plan', canSwitch: false });
  });

  it('keeps an event-storming board in Diagram mode with no switch', () => {
    expect(
      resolveEditorMode({
        tab: { id: 't', kind: 'event-storming', opensIn: 'draw' },
        canEdit: true,
      }),
    ).toEqual({ mode: 'diagram', canSwitch: false });
  });

  it('reads Diagram with no switch while there is no tab', () => {
    expect(resolveEditorMode({ tab: undefined, canEdit: true })).toEqual({
      mode: 'diagram',
      canSwitch: false,
    });
  });
});
