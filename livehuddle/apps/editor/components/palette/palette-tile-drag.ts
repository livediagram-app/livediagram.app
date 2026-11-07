import { applyShapeVariant, createShape } from '@livehuddle/document';
import { PALETTE_DND_MIME, STICKER_DND_MIME } from '@/lib/icons';
import { setPaletteDragPreview, suppressNativeDragImage } from '@/lib/palette-drag-preview';
import { cancelDragUnderCarry, startCarry } from '@/lib/palette-carry';
import type { PaletteTileDef } from './palette-tile-defs';

// The drag payload of a catalogue tile (docs/specs/010-palette/palette-drag-ghost.md), one definition for every
// rendering of it: the grid tile, the Toolbar strip's tile, and the list row (category rows and search
// results). Returns undefined for tools that arm a gesture rather than place an element.
export function tileDragStart(
  action: PaletteTileDef['action'],
): ((e: React.DragEvent) => void) | undefined {
  switch (action.type) {
    case 'shape': {
      const choice = action.mode ?? action.variant;
      return (e) => {
        // A mouse press on a piece that turns is carried by the pointer instead (tileCarryStart).
        if (cancelDragUnderCarry(e)) return;
        // `kind` or `kind|choice`, so a dragged Eraser button drops an Eraser button.
        copy(e, PALETTE_DND_MIME, choice ? `${action.kind}|${choice}` : action.kind);
        // At the preset's own size when it has one (a Boardroom, a Double Door, a Runner).
        const { width, height } = applyShapeVariant(createShape(action.kind, 0, 0), action.variant);
        setPaletteDragPreview({
          kind: action.kind,
          width,
          height,
          ...(action.variant ? { variant: action.variant } : {}),
        });
        suppressNativeDragImage(e);
      };
    }
    case 'sticky':
      return (e) => {
        copy(e, PALETTE_DND_MIME, 'sticky');
        // A note has no shape kind: a square footprint at its real size reads as the note it becomes.
        setPaletteDragPreview({ kind: 'square', width: 200, height: 200 });
        suppressNativeDragImage(e);
      };
    case 'sticker':
      return (e) => copy(e, STICKER_DND_MIME, action.stickerId);
    default:
      return undefined;
  }
}

// The press that carries a catalogue tile by the pointer rather than the browser's drag, so Space can turn the piece
// on its way (lib/palette-carry.ts, docs/specs/009-elements/furniture-facing.md "Turning while placing"): a shape
// tile's, used for the kinds that turn and a mouse or pen press. Undefined for every other tile.
export function tileCarryStart(
  action: PaletteTileDef['action'],
): ((e: React.PointerEvent) => void) | undefined {
  if (action.type !== 'shape') return undefined;
  const choice = action.mode ?? action.variant;
  return (e) => startCarry(e, action.kind, choice);
}

function copy(e: React.DragEvent, mime: string, value: string): void {
  e.dataTransfer.setData(mime, value);
  e.dataTransfer.effectAllowed = 'copy';
}
