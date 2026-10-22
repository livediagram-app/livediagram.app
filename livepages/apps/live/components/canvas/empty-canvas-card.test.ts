import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@livepages/document';
import { showsEmptyCanvasCard } from './empty-canvas-card';

// docs/specs/007-editor/new-document-route.md "The empty-canvas hint".
const empty = {
  hydrated: true,
  zen: false,
  embed: false,
  drawToolArmed: false,
  mode: 'diagram' as const,
  elementCount: 0,
};

describe('the empty-canvas card', () => {
  it('shows on an empty Diagram or Workshop tab, and in no other mode', () => {
    const shown = EDITOR_MODES.filter((mode) => showsEmptyCanvasCard({ ...empty, mode }));
    expect(shown).toEqual(['diagram', 'workshop']);
  });

  it('hides once there is content, in zen or embed, or with a draw tool armed', () => {
    expect(showsEmptyCanvasCard({ ...empty, elementCount: 1 })).toBe(false);
    expect(showsEmptyCanvasCard({ ...empty, zen: true })).toBe(false);
    expect(showsEmptyCanvasCard({ ...empty, embed: true })).toBe(false);
    expect(showsEmptyCanvasCard({ ...empty, drawToolArmed: true })).toBe(false);
    expect(showsEmptyCanvasCard({ ...empty, hydrated: false })).toBe(false);
  });
});
