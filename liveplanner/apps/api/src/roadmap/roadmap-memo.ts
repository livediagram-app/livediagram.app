// A public roadmap's page, built once and kept in the plan's room for the reads after it
// (docs/specs/026-plan/public-roadmap.md "How it answers"; blueprint public-roadmap.md "Performance and limits").
// A busy roadmap is read far more often than it changes, and each build reads every card of the plan, so the room
// keeps what it built under the roadmap's code, stamped with how many rows the plan's storage had changed when the
// build began (SQLite's `total_changes()`, which every write in the room moves, whichever path made it). A read whose
// stamp no longer matches builds again, so a card, a vote, a column, a card type, a form link, the roadmap's settings,
// Publish or Unpublish never leave a stale page behind. Only `voted` is per visitor: worked out per read from the
// cards the page shows.
import type { PublicRoadmap } from '@liveplanner/api-schema';
import { hasPublicVote, type Item } from '@liveplanner/items';

// The most pages one room keeps: a plan publishes one roadmap per board, so this is generous; past it the oldest
// goes first.
export const ROADMAP_MEMO_MAX = 8;

/** A page as built for no visitor (`voted` false throughout), with the cards it shows by id, for marking a voter. */
export type BuiltRoadmap = { page: PublicRoadmap; shown: ReadonlyMap<string, Item> };

/** The page `built` answers for `voter`: as built for no one, or each card's `voted` for this browser. */
export function pageFor(built: BuiltRoadmap, voter: string | null): PublicRoadmap {
  const { page, shown } = built;
  if (!page.voting || voter === null) return page;
  return {
    ...page,
    columns: page.columns.map((column) => ({
      ...column,
      cards: column.cards.map((card) => {
        const item = shown.get(card.id);
        return item && hasPublicVote(item, voter) ? { ...card, voted: true } : card;
      }),
    })),
  };
}

/** The cards a page shows, by id, out of the plan's `items`. */
export function shownOf(page: PublicRoadmap, items: readonly Item[]): ReadonlyMap<string, Item> {
  const ids = new Set(page.columns.flatMap((c) => c.cards.map((card) => card.id)));
  const shown = new Map<string, Item>();
  for (const item of items) if (ids.has(item.id)) shown.set(item.id, item);
  return shown;
}

/** The room's kept pages. `version` reads the plan storage's change count. */
export class RoadmapMemo {
  private readonly kept = new Map<string, { version: number; built: BuiltRoadmap }>();

  readonly version: () => number;

  constructor(version: () => number) {
    this.version = version;
  }

  /** The page kept for `code`, while nothing has been written since it was built. */
  get(code: string): BuiltRoadmap | null {
    const entry = this.kept.get(code);
    if (!entry) return null;
    if (entry.version === this.version()) return entry.built;
    this.kept.delete(code);
    return null;
  }

  /** Keeps `built` for `code`, stamped with `version`, read before the build began. */
  set(code: string, version: number, built: BuiltRoadmap): void {
    this.kept.delete(code);
    this.kept.set(code, { version, built });
    // A Map keeps insertion order, so the first keys are the oldest.
    for (const old of this.kept.keys()) {
      if (this.kept.size <= ROADMAP_MEMO_MAX) break;
      this.kept.delete(old);
    }
  }

  /** How many pages are kept. */
  get size(): number {
    return this.kept.size;
  }
}
