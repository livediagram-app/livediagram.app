'use client';

// The palette's Cards category, and Popular in Plan mode (docs/specs/025-plan/item-types.md "Where
// types show"): card tiles drawn from the document's item types, so a type someone adds shows here
// and a renamed or deleted one changes or goes. Outside the editor (no PlanContext) the built-in
// types stand.
import { ITEM_TYPES } from '@livediagram/items';
import { usePlan } from '@/components/plan/PlanContext';
import { PaletteTileGrid } from './PaletteTileGrid';
import { planCardTile, withDocumentCardTiles } from './palette-plan-tiles';

type GridProps = Omit<React.ComponentProps<typeof PaletteTileGrid>, 'tiles'>;

export function PalettePlanCardsTab(props: GridProps) {
  const types = usePlan()?.types ?? ITEM_TYPES;
  return <PaletteTileGrid {...props} tiles={types.map(planCardTile)} />;
}

export function PlanAwareTileGrid({
  tiles,
  ...props
}: GridProps & { tiles: React.ComponentProps<typeof PaletteTileGrid>['tiles'] }) {
  const types = usePlan()?.types ?? ITEM_TYPES;
  return <PaletteTileGrid {...props} tiles={withDocumentCardTiles(tiles, types)} />;
}
