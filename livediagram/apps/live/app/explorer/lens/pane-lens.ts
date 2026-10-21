// What the lens reads off the Explorer's rows, and how far a scoped lens reaches
// (docs/specs/013-workspace/explorer-filters.md "Views"). Pure.

import {
  LENS_DIMENSIONS,
  compileLens,
  documentSubject,
  sharedSubject,
  type Lens,
  type LensIssue,
  type LensSubject,
} from '@livediagram/explorer-lens';

/** Recent lists this many of the newest documents that match. */
export const RECENT_LIMIT = 12;

/** A listed document as the Explorer holds it: its own, a team's, one in this browser, or shared. */
export type LensRow = {
  name: string;
  savedAt: number;
  ownerId: string;
  source?: string | null;
  opensIn?: string | null;
  tabKind?: string | null;
  templateFamily?: string | null;
  team?: { id: string } | null;
  teamId?: string | null;
  shared?: unknown;
};

/** One row, reduced to what the lens reads. A document in this browser is the reader's own: it
 *  has no team, and its owner is the browser's, so it reads as made by the reader. */
export function lensSubjectOf(row: LensRow, viewerId: string): LensSubject {
  if (row.shared) return sharedSubject(row);
  return documentSubject(
    {
      name: row.name,
      savedAt: row.savedAt,
      ownerId: row.team || row.teamId ? row.ownerId : viewerId,
      teamId: row.team?.id ?? row.teamId ?? null,
      source: row.source ?? null,
      opensIn: row.opensIn,
      tabKind: row.tabKind,
      templateFamily: row.templateFamily,
    },
    viewerId,
  );
}

/** Whether the lens holds a word or a value, so it narrows anything at all. */
export function isLensSet(lens: Lens): boolean {
  return lens.text.length > 0 || LENS_DIMENSIONS.some((d) => lens.filters[d].length > 0);
}

/** The rows the lens matches, in their order. */
export function narrowRows<R extends LensRow>(
  rows: readonly R[],
  lens: Lens,
  viewerId: string,
  now: number,
): R[] {
  if (!isLensSet(lens)) return [...rows];
  const matches = compileLens(lens, now);
  return rows.filter((row) => matches(lensSubjectOf(row, viewerId)));
}

/**
 * Every document in a scope, at any depth: the folder and its subfolders, or the whole tree from
 * the root (null). Newest first, as every Explorer list orders documents.
 */
export function scopeDocuments<D extends { savedAt: number }>(
  folderId: string | null,
  childrenByParent: ReadonlyMap<string | null, readonly { id: string }[]>,
  documentsByFolder: ReadonlyMap<string | null, readonly D[]>,
): D[] {
  const out: D[] = [];
  const seen = new Set<string | null>();
  const stack: (string | null)[] = [folderId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    out.push(...(documentsByFolder.get(current) ?? []));
    for (const child of childrenByParent.get(current) ?? []) stack.push(child.id);
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

/** The lens as a library that reads its own rows takes it (the team library,
 *  docs/specs/013-workspace/team-shared-documents.md): whether it is set, how to narrow, and the
 *  words it reported, for the filtered-empty state. */
export type LibraryLens = {
  active: boolean;
  /** The lens string, so the library's live region speaks after a change. */
  input: string;
  issues: readonly LensIssue[];
  narrow: <R extends LensRow>(rows: readonly R[]) => R[];
  clear: () => void;
};
