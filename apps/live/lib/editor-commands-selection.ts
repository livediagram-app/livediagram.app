import { SHAPE_MARKERS, type ShapeMarker } from '@livediagram/diagram';
import type { CommandContext, CommandHandlers, EditorCommand } from './editor-commands';

// COMMANDS THAT ACT ON WHAT IS SELECTED (spec/70's search palette).
//
// Split out of buildEditorCommands, which was one 250-line function assembling
// every command in the editor. This is the block that depends on the
// SELECTION rather than on the diagram, the tab or the history: duplicate,
// delete, lock, reorder, rotate, note, comment, animation, and the status
// markers.
//
// It needs nothing from the rest of that function beyond the context and the
// handlers — the two flags it used (`hasSelection`, `isSingle`) are one
// comparison each on ctx, so they are derived here rather than threaded in.

// Human-readable marker names for the "Add … marker" commands. The raw ids
// ('green-circle', 'checkbox-checked', ...) aren't search-friendly.
const MARKER_LABEL: Record<ShapeMarker, string> = {
  'green-circle': 'green status',
  'orange-circle': 'amber status',
  'red-circle': 'red status',
  'checkbox-unchecked': 'unchecked box',
  'checkbox-checked': 'checked box',
};

export function selectionCommands(ctx: CommandContext, h: CommandHandlers): EditorCommand[] {
  const out: EditorCommand[] = [];
  const hasSelection = ctx.selectionCount > 0;
  const isSingle = ctx.selectionCount === 1;
  // --- Selection commands. Ranked first so they stay in context with what's
  // selected. Delete / Duplicate / Lock / reorder work for single + multi.
  if (hasSelection) {
    out.push({
      id: 'delete',
      name: 'Delete selection',
      keywords: 'delete remove erase clear',
      run: h.deleteSelection,
    });
    out.push({
      id: 'duplicate',
      name: 'Duplicate selection',
      keywords: 'duplicate copy clone',
      run: h.duplicateSelection,
    });
    out.push({
      id: 'lock',
      name: 'Lock / unlock selection',
      keywords: 'lock unlock freeze protect',
      run: h.toggleLockSelection,
    });
    out.push({
      id: 'bring-to-front',
      name: 'Bring to front',
      keywords: 'front forward top raise order layer z-index arrange',
      run: h.bringToFront,
    });
    out.push({
      id: 'send-to-back',
      name: 'Send to back',
      keywords: 'back backward bottom lower order layer z-index arrange',
      run: h.sendToBack,
    });
  }

  // Rotation / note / comment / animation are single boxed-element actions.
  if (isSingle && ctx.singleIsBoxed) {
    for (const deg of [90, 180, 270] as const) {
      out.push({
        id: `rotate-${deg}`,
        name: `Rotate ${deg}°`,
        keywords: 'rotate turn spin angle rotation orientation',
        run: () => h.rotate(deg),
      });
    }
    out.push({
      id: 'rotate-0',
      name: 'Reset rotation',
      keywords: 'rotate reset clear angle rotation straighten upright 0',
      run: () => h.rotate(0),
    });
    out.push({
      id: 'note',
      name: 'Add / edit note',
      keywords: 'note annotate memo description',
      run: h.editNote,
    });
    out.push({
      id: 'comment',
      name: 'Add comment',
      keywords: 'comment discuss feedback thread reply',
      run: h.addComment,
    });
  }

  // Clear animation works for any single animated element — a boxed
  // `animation` or an arrow's `flow` (so it sits outside the boxed-only
  // block above). Offered only when the element actually has one.
  if (isSingle && ctx.hasAnimation) {
    out.push({
      id: 'clear-animation',
      name: 'Clear animation',
      keywords: 'animation animate clear remove stop motion flow',
      run: h.clearAnimation,
    });
  }

  // Markers are shape-only: clear the current one (if any), then offer the
  // rest of the catalogue.
  if (isSingle && ctx.singleIsShape) {
    if (ctx.marker) {
      out.push({
        id: 'clear-marker',
        name: 'Clear marker',
        keywords: 'marker status dot badge clear remove none',
        run: () => h.setMarker(null),
      });
    }
    for (const m of SHAPE_MARKERS) {
      if (m === ctx.marker) continue;
      out.push({
        id: `marker-${m}`,
        name: `Add ${MARKER_LABEL[m]} marker`,
        keywords: `marker status dot badge add ${m}`,
        run: () => h.setMarker(m),
      });
    }
  }
  return out;
}
