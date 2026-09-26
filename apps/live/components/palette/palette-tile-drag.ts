import {
  eventStormingNoteSize,
  SHAPE_DEFAULT_SIZE,
  type EventStormingNoteKind,
} from '@livediagram/diagram';
import { ICON_DND_MIME, PALETTE_DND_MIME } from '@/lib/icons';
import { setPaletteDragPreview, suppressNativeDragImage } from '@/lib/palette-drag-preview';
import { STICKER_DND_MIME } from '@/lib/stickers';
import { TECH_ICON_DND_MIME } from '@/lib/tech-icons';
import type { PaletteTileDef } from './palette-tile-defs';

// The drag payload of a catalogue tile (docs/specs/010-palette/palette-drag-ghost.md), one definition for every
// rendering of it: the grid tile, the Toolbar strip's tile, and the list row (category rows and search
// results). Returns undefined for tools that arm a gesture rather than place an element.
export function tileDragStart(
  action: PaletteTileDef['action'],
): ((e: React.DragEvent) => void) | undefined {
  switch (action.type) {
    case 'shape': {
      const choice = action.session ?? action.reaction ?? action.mode ?? action.estimateScale;
      return (e) => {
        // `kind` or `kind|choice`, so a dragged Poll drops a poll, not a timer.
        copy(e, PALETTE_DND_MIME, choice ? `${action.kind}|${choice}` : action.kind);
        const { width, height } = SHAPE_DEFAULT_SIZE[action.kind];
        setPaletteDragPreview({ kind: action.kind, width, height });
        suppressNativeDragImage(e);
      };
    }
    case 'sticky':
      return (e) => {
        copy(e, PALETTE_DND_MIME, action.esKind ? `sticky|${action.esKind}` : 'sticky');
        const size = action.esKind
          ? eventStormingNoteSize(action.esKind as EventStormingNoteKind)
          : { width: 200, height: 200 };
        // A note has no shape kind: a square footprint at its real size reads as the note it becomes.
        setPaletteDragPreview({ kind: 'square', ...size, note: true });
        suppressNativeDragImage(e);
      };
    case 'icon':
      return (e) => copy(e, ICON_DND_MIME, action.iconId);
    case 'tech-icon':
      return (e) => copy(e, TECH_ICON_DND_MIME, action.iconId);
    case 'sticker':
      return (e) => copy(e, STICKER_DND_MIME, action.stickerId);
    default:
      return undefined;
  }
}

function copy(e: React.DragEvent, mime: string, value: string): void {
  e.dataTransfer.setData(mime, value);
  e.dataTransfer.effectAllowed = 'copy';
}
