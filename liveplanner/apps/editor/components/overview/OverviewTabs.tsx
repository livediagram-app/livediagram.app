import type { ReactNode } from 'react';
import { Tooltip } from '@liveplanner/ui';
import type { StartCategory } from '@/components/plan/start/start-planning-items';
import type { TabTileSummary } from './overview-tabs';
import { AddTabTile } from './AddTabTile';
import { OverviewSection, TILE_CLASS, TILE_PRESSABLE } from './OverviewSection';

// The Overview's Tabs (docs/specs/026-plan/plan-overview.md "Tabs"): a tile per tab, pressing one opens it; an
// Editor's Add Tab as the last tile (the one way in: no button on the heading). Each tile's preview is the page's to draw (TabPreview), so
// this stays plain data for tests.
export function OverviewTabs({
  tiles,
  preview,
  onOpenTab,
  onAddTab,
}: {
  tiles: readonly TabTileSummary[];
  preview: (tile: TabTileSummary) => ReactNode;
  onOpenTab: (tabId: string) => void;
  // Absent for anyone who may not add a tab; `start` opens the new tab's Start Planning on that kind.
  onAddTab?: ((start?: StartCategory) => void) | undefined;
}) {
  return (
    <OverviewSection id="overview-tabs" title="Tabs" subtitle="Every tab in this plan">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            data-tab-tile={tile.id}
            onClick={() => onOpenTab(tile.id)}
            className={`flex flex-col ${TILE_CLASS} ${TILE_PRESSABLE}`}
          >
            {preview(tile)}
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
        {onAddTab ? <AddTabTile onAdd={onAddTab} /> : null}
      </div>
    </OverviewSection>
  );
}
