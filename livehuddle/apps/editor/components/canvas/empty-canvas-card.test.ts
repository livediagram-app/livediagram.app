import { describe, expect, it } from 'vitest';
import { showsEmptyCanvasCard } from './empty-canvas-card';

// docs/specs/007-editor/new-document-route.md "The empty-canvas hint".
const empty = {
  hydrated: true,
  embed: false,
  drawToolArmed: false,
  elementCount: 0,
};

describe('the empty-canvas card', () => {
  it('shows on an empty tab', () => {
    expect(showsEmptyCanvasCard(empty)).toBe(true);
  });

  it('hides once there is content, in an embed, or with a draw tool armed', () => {
    expect(showsEmptyCanvasCard({ ...empty, elementCount: 1 })).toBe(false);
    expect(showsEmptyCanvasCard({ ...empty, embed: true })).toBe(false);
    expect(showsEmptyCanvasCard({ ...empty, drawToolArmed: true })).toBe(false);
    expect(showsEmptyCanvasCard({ ...empty, hydrated: false })).toBe(false);
  });
});
