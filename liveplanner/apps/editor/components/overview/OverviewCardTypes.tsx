import { CompactEmptyState, lucideGlyph } from '@liveplanner/ui';
import { lucideLayoutGrid } from '@liveworkspace/icons/lucide';
import { PlanTypeGlyph } from '@/components/plan/plan-type-glyph';
import { ACCENT_TEXT, accentVars } from '@/components/plan/plan-palette';
import { cardTypeMeta, usedOnLine, type CardTypeTileSummary } from './overview-card-types';
import { AddTile, OverviewSection, TILE_CLASS, TILE_PRESSABLE } from './OverviewSection';

const TypesGlyph = lucideGlyph(lucideLayoutGrid, 18);

const GRID = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4';

function TileBody({ tile }: { tile: CardTypeTileSummary }) {
  const used = usedOnLine(tile.usedOn);
  return (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          style={accentVars(tile.type.color)}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] dark:border-[var(--accent-lift)] dark:bg-[color-mix(in_srgb,var(--accent-lift)_20%,transparent)] ${ACCENT_TEXT}`}
        >
          <PlanTypeGlyph glyph={tile.type.glyph} size={16} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{tile.type.label}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{cardTypeMeta(tile)}</span>
        </span>
      </span>
      <span
        data-used-on={used ? '' : 'none'}
        className={`text-xs ${used ? 'text-slate-500 dark:text-slate-400' : 'font-medium text-amber-700 dark:text-amber-300'}`}
      >
        {used ?? 'Not on any board yet'}
      </span>
    </>
  );
}

// The Overview's Card Types (docs/specs/026-plan/plan-overview.md "Card Types"): a tile per type, an Editor's opening
// the type in the card type editor, and an Editor's Add Card Type last.
export function OverviewCardTypes({
  tiles,
  onEditType,
  onAddType,
}: {
  tiles: readonly CardTypeTileSummary[];
  // Absent for anyone who may not change card types: the tiles only show.
  onEditType?: ((typeId: string) => void) | undefined;
  // Absent for anyone who may not, or once the plan holds the most card types it can.
  onAddType?: (() => void) | undefined;
}) {
  const tileClass = `flex flex-col gap-2.5 p-3.5 ${TILE_CLASS}`;
  return (
    <OverviewSection id="overview-card-types" title="Card Types">
      {tiles.length === 0 ? (
        <CompactEmptyState
          icon={<TypesGlyph />}
          title="No Card Types Yet"
          description={
            onEditType
              ? 'Add a card type to give cards their own fields.'
              : 'This plan has no card types yet.'
          }
        />
      ) : null}
      {tiles.length > 0 || onAddType ? (
        <div className={GRID}>
          {tiles.map((tile) =>
            onEditType ? (
              <button
                key={tile.type.id}
                type="button"
                data-card-type-tile={tile.type.id}
                onClick={() => onEditType(tile.type.id)}
                className={`${tileClass} ${TILE_PRESSABLE}`}
              >
                <TileBody tile={tile} />
              </button>
            ) : (
              <div key={tile.type.id} data-card-type-tile={tile.type.id} className={tileClass}>
                <TileBody tile={tile} />
              </div>
            ),
          )}
          {onAddType ? (
            <AddTile label="Add Card Type" onClick={onAddType} className="min-h-[96px]" />
          ) : null}
        </div>
      ) : null}
    </OverviewSection>
  );
}
