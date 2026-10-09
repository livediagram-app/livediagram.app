'use client';

import type { EditorMode } from '@livediagram/document';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';
import { PaletteTile } from './PaletteTileGrid';
import { paletteCategoriesFor, paletteLandingCategory } from './palette-layouts';
import { tileById, type PaletteTileDef } from './palette-tile-defs';
import { usePaletteCatalogue } from './usePaletteCatalogue';
import type { PaletteAddHandlers } from './palette-add-handlers';
import type { PaletteProps } from './palette.types';

// A Participant's palette (docs/specs/013-workspace/share-roles.md "What a Participant changes"): only what it
// may add, a sticky or text, as the full palette's own tiles, so they look and place exactly as an Editor's do.
// On an Event Storming board that is the notation's coloured notes; elsewhere the Sticky and Text tiles.

const FALLBACK_TILE_IDS = ['tools:sticky', 'tools:text'] as const;

// The tiles a Participant gets on this mode's landing category: those that add a sticky or text.
export function participantTiles(mode: EditorMode, esBoard: boolean): PaletteTileDef[] {
  const landing = paletteLandingCategory(mode, esBoard);
  const category = paletteCategoriesFor(mode, { esBoard }).find((c) => c.id === landing);
  const tiles = (category?.tiles ?? []).filter(
    (t) => t.action.type === 'sticky' || t.action.type === 'text',
  );
  if (tiles.length > 0) return tiles;
  return FALLBACK_TILE_IDS.map(tileById).filter((t): t is PaletteTileDef => t !== undefined);
}

type Props = Pick<
  PaletteProps,
  'canvasTool' | 'onSetCanvasTool' | 'onExitAvatarMode' | 'pendingDraw' | 'esBoard'
> &
  PaletteAddHandlers & { hidden?: boolean };

export function ParticipantToolbar(props: Props) {
  const { tileActions, editorMode } = usePaletteCatalogue({ ...props, canvasEmpty: false });
  const tiles = participantTiles(editorMode, !!props.esBoard);
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-3 z-[var(--z-toolbar)] justify-center [&>*]:pointer-events-auto ${props.hidden ? 'hidden' : 'flex'}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        role="toolbar"
        aria-label="Add to the board"
        data-floating-panel=""
        data-split-chrome=""
        data-participant-toolbar=""
        className={TOOLBAR_CARD}
      >
        {tiles.map((def) => (
          <PaletteTile
            key={def.id}
            def={def}
            actions={tileActions}
            pendingDraw={props.pendingDraw}
            compact
          />
        ))}
      </div>
    </div>
  );
}
