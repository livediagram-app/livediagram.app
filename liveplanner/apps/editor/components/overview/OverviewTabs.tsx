import { Button, PlusIcon, Tooltip } from '@liveplanner/ui';
import type { TabTileSummary } from './overview-tabs';
import { AddTile, OverviewSection, TILE_CLASS, TILE_PRESSABLE } from './OverviewSection';
import { TabTilePicture } from './TabTilePicture';

// The Overview's Tabs (docs/specs/026-plan/plan-overview.md "Tabs"): a tile per tab, pressing one opens it; an
// Editor's Add Tab beside the heading and as the last tile.
export function OverviewTabs({
  tiles,
  onOpenTab,
  onAddTab,
}: {
  tiles: readonly TabTileSummary[];
  onOpenTab: (tabId: string) => void;
  // Absent for anyone who may not add a tab.
  onAddTab?: (() => void) | undefined;
}) {
  return (
    <OverviewSection
      id="overview-tabs"
      title="Tabs"
      action={
        onAddTab ? (
          <Button variant="secondary" size="xs" onClick={onAddTab}>
            <PlusIcon size={14} />
            Add Tab
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            data-tab-tile={tile.id}
            onClick={() => onOpenTab(tile.id)}
            className={`flex flex-col ${TILE_CLASS} ${TILE_PRESSABLE}`}
          >
            <TabTilePicture picture={tile.picture} />
            <span className="flex min-w-0 items-center justify-between gap-3 px-3.5 py-2.5">
              <Tooltip label={tile.name}>
                <span className="min-w-0 truncate text-sm font-semibold">{tile.name}</span>
              </Tooltip>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {tile.detail ? `${tile.kindLabel} · ${tile.detail}` : tile.kindLabel}
              </span>
            </span>
          </button>
        ))}
        {onAddTab ? (
          <AddTile
            label="Add Tab"
            hint="Board, Sheet, Dashboard or Form"
            onClick={onAddTab}
            className="min-h-[150px]"
          />
        ) : null}
      </div>
    </OverviewSection>
  );
}
