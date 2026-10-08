// Parent was its own grouping before it became a Card field (docs/specs/026-plan/item-types.md "Card fields"). A
// view, a saved search or an agent may still name that grouping; it reads as grouping by the Parent field. Pure.
import { NO_LANE, type SwimlaneBy } from './board';
import type { CardSearchFilter } from './card-search';
import { LEGACY_PARENT_GROUPING, PARENT_FIELD_ID } from './item-types';

// Stored settings with their grouping read: the old Parent grouping as the Parent field.
export type ReadGrouping<T> = Omit<T, 'swimlaneBy' | 'swimlaneField'> & {
  swimlaneBy?: SwimlaneBy;
  swimlaneField?: string;
};

// A grouping as stored (`swimlaneBy`, `swimlaneField`), with the old Parent grouping read as the Parent field.
export function readGrouping<T extends { swimlaneBy?: unknown; swimlaneField?: unknown }>(
  settings: T,
): ReadGrouping<T> {
  if (settings.swimlaneBy !== LEGACY_PARENT_GROUPING) return settings as ReadGrouping<T>;
  return { ...settings, swimlaneBy: 'field', swimlaneField: PARENT_FIELD_ID };
}

// A search filter as stored, with an old Parent filter read as the Parent field's: its lane key was `e:{id}`, a
// field lane's is `f:"{id}"`; the No parent key is the same empty key.
export function readCardSearchFilter(filter: CardSearchFilter): CardSearchFilter {
  if ((filter.by as string) !== LEGACY_PARENT_GROUPING) return filter;
  const key = filter.key.startsWith('e:') ? `f:${JSON.stringify(filter.key.slice(2))}` : NO_LANE;
  return { by: 'field', field: PARENT_FIELD_ID, key };
}

// A plan view's settings as stored, its grouping and its filters read past the old Parent grouping.
export function readPlanViewSettings<
  T extends {
    swimlaneBy?: unknown;
    swimlaneField?: unknown;
    filters?: readonly CardSearchFilter[];
  },
>(settings: T): ReadGrouping<T> {
  const read = readGrouping(settings);
  return settings.filters ? { ...read, filters: settings.filters.map(readCardSearchFilter) } : read;
}
