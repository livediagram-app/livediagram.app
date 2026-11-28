'use client';

// A Session tab's card (docs/specs/026-plan/session-tabs.md "The card"): the card in full, the same panel a board opens
// it in, embedded in the page with no close. Everything there writes the real card, with a board's rights.
import type { Item } from '@liveplanner/items';
import { ItemPanelEmbedded } from '@/components/plan/ItemPanel';
import { itemPanelProps, useItemPanelReads } from '@/components/plan/item-panel-wiring';
import type { PlanContextValue } from '@/components/plan/PlanContext';

const NO_TRAIL: readonly string[] = [];
const noClose = () => {};

export function SessionCard({ plan, item }: { plan: PlanContextValue; item: Item }) {
  const reads = useItemPanelReads(plan, item.id, NO_TRAIL);
  return <ItemPanelEmbedded {...itemPanelProps(plan, item, reads, noClose)} />;
}
