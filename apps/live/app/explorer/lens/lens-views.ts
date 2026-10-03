// Which Explorer views the lens narrows, and how it rides a URL
// (docs/specs/013-workspace/explorer-filters.md "Views", "URL and carry-over").

import { carryLensQuery, withLensQuery, type LensView } from '@livediagram/explorer-lens';
import type { SelectedNode } from '../views';

/** Search results: every document the reader can open, narrowed by the lens. */
export const SEARCH_RESULTS_PATH = '/explorer/search';

const VIEWS: Partial<Record<SelectedNode['kind'], LensView>> = {
  all: 'scoped',
  folder: 'scoped',
  team: 'scoped',
  offline: 'scoped',
  recent: 'aggregate',
  favourites: 'aggregate',
  search: 'aggregate',
  shared: 'aggregate',
};

/** Whether a view has a scope (its breadcrumb), lists every place at once, or lists no documents. */
export function lensViewOf(kind: SelectedNode['kind']): LensView | null {
  return VIEWS[kind] ?? null;
}

/** A path with the lens written into its query as `q`, every other parameter kept. */
export function lensHref(path: string, input: string): string {
  const at = path.indexOf('?');
  const pathname = at === -1 ? path : path.slice(0, at);
  const search = at === -1 ? '' : path.slice(at);
  return `${pathname}${withLensQuery(search, input)}`;
}

/** Where a navigation lands: the lens rides along only from one aggregate view to another. */
export function carriedHref(
  path: string,
  input: string,
  from: LensView | null,
  to: LensView | null,
): string {
  if (from === null || to === null) return path;
  return lensHref(path, carryLensQuery(input, from, to));
}
