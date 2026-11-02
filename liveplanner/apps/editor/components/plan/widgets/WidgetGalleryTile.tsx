'use client';

// One tile of the widget gallery (docs/specs/026-plan/board-widgets.md "Each widget is a tile"), on the galleries'
// shared tile (GalleryTile): a strip drawing the widget live from the board's own cards, in its own colours, as it
// would sit in the header (inert there), then its glyph, name and line. The whole tile is one button: it adds the
// widget, or takes it off when the board has it (On Board, with a check). The preview is drawn only once the tile has
// come into view (use-seen.ts).
import type { ReactNode } from 'react';
import { CheckIcon, PlusIcon } from '@liveplanner/ui';
import { BoardWidgetArt, FieldWidgetArt } from '../plan-tile-art';
import type { PlanPalette } from '../plan-palette';
import { FitWidth, GalleryTile, TILE_BADGE_SPOT } from '../gallery/GalleryTile';
import type { GalleryTile as WidgetTile } from './widget-gallery-model';
import { useSeen } from './use-seen';

export const FIELD_CAP_HINT = 'A board holds up to 12 field widgets';

export function WidgetGalleryTile({
  tile,
  on,
  capped,
  preview,
  palette,
  onToggle,
}: {
  tile: WidgetTile;
  // The board has it.
  on: boolean;
  // A field widget the board has no room for (FIELD_WIDGETS_MAX reached).
  capped: boolean;
  preview?: ((id: WidgetTile['id']) => ReactNode) | undefined;
  palette?: PlanPalette | undefined;
  onToggle: () => void;
}) {
  const [ref, seen] = useSeen();
  const glyph = tile.view ? (
    <FieldWidgetArt view={tile.view} size={14} />
  ) : tile.kind ? (
    <BoardWidgetArt kind={tile.kind} size={14} />
  ) : null;
  const name = on ? `Remove ${tile.fullName}` : `Add ${tile.fullName}`;
  return (
    <GalleryTile
      rootRef={ref}
      rootData={{ 'data-gallery-tile': tile.id }}
      buttonData={{ 'data-widget-card': '' }}
      label={capped ? `${name}: ${FIELD_CAP_HINT}` : name}
      pressed={on}
      chosen={on}
      disabled={capped}
      tooltip={FIELD_CAP_HINT}
      onPress={onToggle}
      glyph={glyph}
      name={tile.name}
      line={tile.line}
      stripStyle={
        palette
          ? {
              backgroundColor: palette.surface,
              color: palette.text,
              borderBottom: `1px solid ${palette.border}`,
            }
          : undefined
      }
      strip={
        seen && preview ? (
          <FitWidth>{preview(tile.id)}</FitWidth>
        ) : (
          // A still placeholder the widget's shape until the tile is in view.
          <span
            data-preview-placeholder=""
            className="h-7 w-32 rounded-md border"
            style={
              palette ? { borderColor: palette.border, backgroundColor: palette.column } : undefined
            }
          />
        )
      }
      // On Board, or Add on hover.
      badge={
        on ? (
          <span
            className={`${TILE_BADGE_SPOT} inline-flex items-center gap-1 rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm dark:bg-brand-600`}
          >
            <CheckIcon size={9} />
            On Board
          </span>
        ) : capped ? null : (
          <span
            aria-hidden
            className={`${TILE_BADGE_SPOT} inline-flex items-center gap-0.5 rounded-full border border-brand-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 dark:border-brand-500/40 dark:bg-slate-900 dark:text-brand-200`}
          >
            <PlusIcon size={9} />
            Add
          </span>
        )
      }
    />
  );
}
