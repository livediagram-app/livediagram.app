// Whether the empty-canvas card shows (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): while
// the active tab has no elements, outside zen and embed, with no draw tool armed, in Diagram or
// Workshop. Draw's dock is its own hint (docs/specs/023-draw-mode/draw-mode.md), an empty infographic page invites
// a layout in its own title bar (docs/specs/007-editor/pages-mode.md) and Plan offers its boards in the middle
// (docs/specs/026-plan/plan-mode.md "Starting a board"). The sign-in nudge has no say: it sits at the foot of the
// canvas, clear of the card.
import type { EditorMode } from '@livedesign/document';

const CARD_MODES: ReadonlySet<EditorMode> = new Set(['diagram', 'workshop']);

export function showsEmptyCanvasCard(at: {
  hydrated: boolean;
  zen: boolean;
  embed: boolean;
  drawToolArmed: boolean;
  mode: EditorMode;
  elementCount: number;
}): boolean {
  return (
    at.hydrated &&
    !at.zen &&
    !at.embed &&
    !at.drawToolArmed &&
    CARD_MODES.has(at.mode) &&
    at.elementCount === 0
  );
}
