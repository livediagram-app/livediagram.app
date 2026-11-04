import { useMemo } from 'react';
import { CompactEmptyState, lucideGlyph } from '@liveplanner/ui';
import { lucideLayoutGrid } from '@liveworkspace/icons/lucide';
import { planPalette } from '@/components/plan/plan-palette';
import type { CardTypeTileSummary } from './overview-card-types';
import { CardTypeTile, type CardTypeTileActions } from './CardTypeTile';
import { AddTile, OverviewSection } from './OverviewSection';

const TypesGlyph = lucideGlyph(lucideLayoutGrid, 18);

// As wide as the tab tiles, so the two grids line up.
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4';

// The Overview's Card Types (docs/specs/026-plan/plan-overview.md "Card Types"): a tile per type (CardTypeTile), an
// Editor's quick actions on each, and an Editor's Add Card Type last.
export function OverviewCardTypes({
  tiles,
  scheme = 'light',
  onOpenTab,
  onEditType,
  onAddField,
  onAddCard,
  onAddToBoard,
  onAddType,
}: {
  tiles: readonly CardTypeTileSummary[];
  // The page's light or dark, which the sample cards are drawn in.
  scheme?: 'light' | 'dark';
  onOpenTab: (tabId: string) => void;
  // Each absent for anyone who may not change card types: the tiles only show.
  onEditType?: ((typeId: string) => void) | undefined;
  onAddField?: ((typeId: string) => void) | undefined;
  onAddCard?: ((typeId: string) => void) | undefined;
  onAddToBoard?: ((typeId: string, boardElementId: string) => void) | undefined;
  // Absent for anyone who may not, or once the plan holds the most card types it can.
  onAddType?: (() => void) | undefined;
}) {
  const palette = useMemo(() => planPalette(scheme), [scheme]);
  const actions = useMemo<CardTypeTileActions>(
    () => ({
      openTab: onOpenTab,
      edit: onEditType,
      addField: onAddField,
      addCard: onAddCard,
      addToBoard: onAddToBoard,
    }),
    [onOpenTab, onEditType, onAddField, onAddCard, onAddToBoard],
  );
  return (
    <OverviewSection
      id="overview-card-types"
      title="Card Types"
      subtitle="The kinds of card this plan uses"
    >
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
          {tiles.map((tile) => (
            <CardTypeTile key={tile.type.id} tile={tile} palette={palette} actions={actions} />
          ))}
          {onAddType ? (
            <AddTile label="Add Card Type" onClick={onAddType} className="min-h-[160px]" />
          ) : null}
        </div>
      ) : null}
    </OverviewSection>
  );
}
