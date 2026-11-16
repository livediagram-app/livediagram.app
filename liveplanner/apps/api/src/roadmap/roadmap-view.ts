// What a visitor is sent (docs/specs/026-plan/public-roadmap.md "The allowlist"; blueprint public-roadmap.md
// "Security and trust"). Pure. Each card is built field by field from the allowlist, never by copying the card and
// leaving things out, so a field added to cards later is never sent until it is added here on purpose.
import {
  ROADMAP_COLUMN_CARDS_MAX,
  ROADMAP_DESCRIPTION_MAX,
  type PublicRoadmap,
  type PublicRoadmapCard,
  type PublicRoadmapColumn,
  type RoadmapSettings,
} from '@liveplanner/api-schema';
import type { FormLook } from '@liveplanner/project';
import {
  boardShowsType,
  compareRank,
  hasPublicVote,
  isArchived,
  isTrashed,
  itemStatus,
  itemTitle,
  itemVoteTotal,
  sortCards,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// A label as a chip: a short string.
const LABEL_MAX = 60;

/** Whether a card is on the roadmap: live, in a shown column, of a shown type the board shows. */
export function onRoadmap(
  settings: Pick<RoadmapSettings, 'columns' | 'types'>,
  setup: PlanBoardSetup,
  item: Item,
  types: readonly ItemTypeDef[],
): boolean {
  if (isArchived(item) || isTrashed(item)) return false;
  const status = itemStatus(item);
  if (status === undefined || !settings.columns.includes(status)) return false;
  if (!setup.columns.some((c) => c.status === status)) return false;
  return settings.types.includes(item.type) && boardShowsType(setup, item.type, types);
}

const textOf = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.slice(0, ROADMAP_DESCRIPTION_MAX) : undefined;

const dayOf = (v: unknown): string | undefined =>
  typeof v === 'string' && DAY.test(v) ? v : undefined;

function labelsOf(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((l): l is string => typeof l === 'string' && l.trim() !== '')
    .map((l) => l.slice(0, LABEL_MAX));
  return out.length ? out : undefined;
}

/** One card as the page may show it. `voter` is this browser's voter id, when it named one. */
export function publicCardOf(
  item: Item,
  settings: Pick<RoadmapSettings, 'fields' | 'voting'>,
  types: readonly ItemTypeDef[],
  voter: string | null,
): PublicRoadmapCard {
  const card: PublicRoadmapCard = { id: item.id, title: itemTitle(item) || 'Untitled' };
  if (settings.voting) {
    card.votes = itemVoteTotal(item);
    card.voted = voter !== null && hasPublicVote(item, voter);
  }
  const chosen = new Set(settings.fields);
  if (chosen.has('number')) card.number = item.key;
  if (chosen.has('description')) {
    const d = textOf(item.fields['description']);
    if (d) card.description = d;
  }
  if (chosen.has('type')) {
    const t = types.find((x) => x.id === item.type);
    if (t) card.type = t.label;
  }
  if (chosen.has('labels')) {
    const l = labelsOf(item.fields['labels']);
    if (l) card.labels = l;
  }
  if (chosen.has('start')) {
    const s = dayOf(item.fields['start']);
    if (s) card.start = s;
  }
  if (chosen.has('due')) {
    const d = dayOf(item.fields['due']);
    if (d) card.due = d;
  }
  return card;
}

export type RoadmapViewInput = {
  settings: RoadmapSettings;
  setup: PlanBoardSetup;
  items: readonly Item[];
  types: readonly ItemTypeDef[];
  look: FormLook;
  voter: string | null;
  suggestPath: string | null;
};

/** The roadmap as the public route answers it: the shown columns in the board's order, their cards in its order. */
export function publicRoadmapOf(input: RoadmapViewInput): PublicRoadmap {
  const { settings, setup, types, voter } = input;
  const live = input.items.filter((i) => onRoadmap(settings, setup, i, types));
  const columns: PublicRoadmapColumn[] = [];
  for (const column of setup.columns) {
    if (!settings.columns.includes(column.status)) continue;
    const ranked = live
      .filter((i) => itemStatus(i) === column.status)
      .sort((a, b) => compareRank(a.rank, b.rank));
    const ordered = sortCards(ranked, setup.sortBy, types);
    columns.push({
      name: column.name,
      count: ordered.length,
      cards: ordered
        .slice(0, ROADMAP_COLUMN_CARDS_MAX)
        .map((i) => publicCardOf(i, settings, types, voter)),
    });
  }
  return {
    title: settings.title,
    voting: settings.voting,
    suggestPath: input.suggestPath,
    look: input.look,
    columns,
  };
}
