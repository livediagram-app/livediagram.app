// Everything the Overview shows, derived in one pass from what the editor holds (docs/specs/026-plan/plan-overview.md
// "Performance"): the cards are grouped by status once and every section reads those groups. Pure, so the budget test
// times exactly what the page runs.
import type { Item, ItemTypeDef } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { recentActivityOf, type ActivityEntry } from './overview-activity';
import { boardsOf, cardsByStatus } from './overview-boards';
import { cardTypeTilesOf, type CardTypeTileSummary } from './overview-card-types';
import { planPeopleOf, type PlanPerson } from './overview-people';
import { tabTilesOf, type TabTileSummary } from './overview-tabs';

export type OverviewInput = {
  tabs: readonly Tab[];
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  statusNames?: ReadonlyMap<string, string>;
  loadedTabIds: ReadonlySet<string>;
  owner: PlanPerson | null;
  present: readonly PlanPerson[];
  createdAt: number;
};

export type OverviewModel = {
  tabTiles: TabTileSummary[];
  cardTypes: CardTypeTileSummary[];
  activity: ActivityEntry[];
  people: PlanPerson[];
  // The latest card change, for the header's Edited (0: none).
  lastCardChange: number;
};

export function overviewModelOf(input: OverviewInput): OverviewModel {
  const byStatus = cardsByStatus(input.items.values());
  const boards = boardsOf(input.tabs);
  let lastCardChange = 0;
  for (const it of input.items.values())
    if (it.updatedAt > lastCardChange) lastCardChange = it.updatedAt;
  return {
    tabTiles: tabTilesOf(input.tabs, {
      items: input.items,
      byStatus,
      types: input.types,
      loaded: input.loadedTabIds,
    }),
    cardTypes: cardTypeTilesOf(input.types, input.items.values(), boards, {
      ...(input.statusNames ? { statusNames: input.statusNames } : {}),
    }),
    activity: recentActivityOf({
      items: input.items,
      types: input.types,
      boards,
      ...(input.statusNames ? { statusNames: input.statusNames } : {}),
      plan: {
        createdAt: input.createdAt,
        by: input.owner ? { name: input.owner.name, color: input.owner.color } : null,
      },
    }),
    people: planPeopleOf({
      owner: input.owner,
      items: input.items.values(),
      present: input.present,
    }),
    lastCardChange,
  };
}
