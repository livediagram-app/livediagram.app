// Whether the empty-canvas card shows (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): while
// the active tab has no elements, outside an embed, with no draw tool armed. The sign-in nudge has no say: it
// sits at the foot of the canvas, clear of the card.

export function showsEmptyCanvasCard(at: {
  hydrated: boolean;
  embed: boolean;
  drawToolArmed: boolean;
  elementCount: number;
}): boolean {
  return at.hydrated && !at.embed && !at.drawToolArmed && at.elementCount === 0;
}
