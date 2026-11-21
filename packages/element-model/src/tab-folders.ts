// Tab folders (docs/specs/006-document/tab-folders.md). A document's tabs are a single flat,
// ordered list; a folder is a maximal *run of adjacent tabs* that
// share a folder name, drawn under one collapsible chip. There is
// no second ordering dimension and no folder entity — a folder is
// just the name string carried per-tab (on the document_tabs link).
//
// This module is the single home for three pure helpers shared by
// the tab-bar renderer, the client save path, and the server route:
//   - normalizeFolderOrder — re-orders so every folder is one
//     contiguous run (the invariant that makes "runs are folders"
//     true after any reorder or membership change)
//   - groupTabsIntoRuns    — turns a normalized list into render
//     groups (loose tab | folder + its tabs)
//   - folderNamesInDocument — distinct existing folder names

/** The fields of a tab its folder is read from: the name, and the colour chosen for it (a hue name; none is
 * Automatic, docs/specs/006-document/tab-folders.md "Folder colour"). */
type TabFolder = { folder?: string; folderColor?: string };

// A tab's effective folder, or null when loose. Whitespace-only and
// empty names are treated as loose so an accidental " " can never
// create a ghost folder.
export function tabFolderName(tab: TabFolder): string | null {
  const trimmed = tab.folder?.trim();
  return trimmed ? trimmed : null;
}

// Re-order so every folder's tabs sit in one contiguous run, while
// preserving each tab's order *within* its folder and interleaving
// loose tabs by position. Stable-sorts by the key
// `(folderAnchorIndex, originalIndex)`, where folderAnchorIndex is
// the minimum original index among all tabs sharing that folder name
// (loose tabs anchor on their own index). This is what lets membership
// be menu-only: after any drag-reorder we re-normalize, so a tab
// dragged out of its run snaps back into it (see docs/specs/006-document/tab-folders.md).
//
// Idempotent. Returns the SAME array reference when the input is
// already normalized, and always reuses the SAME tab objects — the
// autosave content diff keys off tab identity, so a pure reorder must
// not mint new tab objects or it would spuriously re-save every body.
export function normalizeFolderOrder<T extends TabFolder>(tabs: T[]): T[] {
  if (tabs.length < 2) return tabs;

  const anchorByFolder = new Map<string, number>();
  tabs.forEach((tab, index) => {
    const folder = tabFolderName(tab);
    if (folder === null) return;
    const current = anchorByFolder.get(folder);
    if (current === undefined || index < current) anchorByFolder.set(folder, index);
  });

  const withKeys = tabs.map((tab, index) => {
    const folder = tabFolderName(tab);
    const anchor = folder === null ? index : (anchorByFolder.get(folder) ?? index);
    return { tab, index, anchor };
  });

  withKeys.sort((a, b) => a.anchor - b.anchor || a.index - b.index);

  // No-op fast path: bail to the original reference if nothing moved,
  // so callers can cheaply detect "already normalized".
  let moved = false;
  for (let i = 0; i < withKeys.length; i++) {
    if (withKeys[i]!.index !== i) {
      moved = true;
      break;
    }
  }
  return moved ? withKeys.map((w) => w.tab) : tabs;
}

// One render entry for the tab bar: either a single loose tab or a
// folder with its (contiguous) members.
type TabRun<T> = { kind: 'loose'; tab: T } | { kind: 'folder'; name: string; tabs: T[] };

// Coalesce a *normalized* list into render groups by walking it once
// and merging maximal adjacent same-folder runs. (Call
// normalizeFolderOrder first if the list might not be normalized; on
// an un-normalized list a folder split across positions would render
// as two chips with the same name, which the normalize step prevents.)
export function groupTabsIntoRuns<T extends TabFolder>(tabs: T[]): TabRun<T>[] {
  const runs: TabRun<T>[] = [];
  for (const tab of tabs) {
    const folder = tabFolderName(tab);
    if (folder === null) {
      runs.push({ kind: 'loose', tab });
      continue;
    }
    const last = runs[runs.length - 1];
    if (last && last.kind === 'folder' && last.name === folder) {
      last.tabs.push(tab);
    } else {
      runs.push({ kind: 'folder', name: folder, tabs: [tab] });
    }
  }
  return runs;
}

// Distinct folder names present in the document, in order of first
// appearance. Drives the "Organise in folder" menu list and the
// uniqueness check when creating / renaming a folder.
export function folderNamesInDocument(tabs: TabFolder[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const tab of tabs) {
    const folder = tabFolderName(tab);
    if (folder !== null && !seen.has(folder)) {
      seen.add(folder);
      names.push(folder);
    }
  }
  return names;
}

// The same, under a name that fits any product's item (a design, a plan).
export const folderNamesIn = folderNamesInDocument;

// A folder's colour (docs/specs/006-document/tab-folders.md "Folder colour"): its first member's chosen colour, or
// null for Automatic (the tab bar then picks one from the name). `except` leaves one tab out, the one being moved.
export function folderColourIn(
  tabs: readonly TabFolder[],
  name: string,
  except?: TabFolder,
): string | null {
  for (const tab of tabs) {
    if (tab !== except && tabFolderName(tab) === name && tab.folderColor) return tab.folderColor;
  }
  return null;
}

/** A folder as the Organise dialog lists it: its name, how many tabs it holds and its chosen colour. */
export type TabFolderSummary = { name: string; count: number; colour: string | null };

// Every folder in the document in bar order, with its count and colour, in one pass.
export function tabFolderSummaries(tabs: readonly TabFolder[]): TabFolderSummary[] {
  const byName = new Map<string, TabFolderSummary>();
  for (const tab of tabs) {
    const name = tabFolderName(tab);
    if (name === null) continue;
    const summary = byName.get(name);
    if (summary) {
      summary.count += 1;
      summary.colour ??= tab.folderColor || null;
    } else byName.set(name, { name, count: 1, colour: tab.folderColor || null });
  }
  return [...byName.values()];
}

// The tab with its folder set (null: loose) and the colour that goes with it: a loose tab has none, a tab staying in
// its folder keeps its own, and a tab joining a folder takes the folder's (folderColourIn). `tabs` is the list it
// joins, the tab itself left out of the reading.
export function tabInFolder<T extends TabFolder>(
  tab: T,
  folder: string | null,
  tabs: readonly TabFolder[],
): T {
  if (folder === null) return { ...tab, folder: undefined, folderColor: undefined };
  if (tabFolderName(tab) === folder) return tab;
  return { ...tab, folder, folderColor: folderColourIn(tabs, folder, tab) ?? undefined };
}

// Move one tab into a folder by name, normalized. A folder nobody holds yet takes `colour` (left out or null:
// Automatic); an existing one keeps its own, whatever `colour` says (same name = same folder).
export function withTabInFolder<T extends TabFolder & { id: string }>(
  tabs: T[],
  tabId: string,
  name: string,
  colour?: string | null,
): T[] {
  const target = tabs.find((t) => t.id === tabId);
  if (!target || tabFolderName(target) === name) return tabs;
  const exists = tabs.some((t) => t !== target && tabFolderName(t) === name);
  return normalizeFolderOrder(
    tabs.map((t) => {
      if (t !== target) return t;
      const moved = tabInFolder(t, name, tabs);
      return exists ? moved : { ...moved, folderColor: colour || undefined };
    }),
  );
}

// Rename a folder on every member. Their colour stays; renaming into a name another folder uses merges the two, and
// the merged folder takes that folder's colour, else the renamed one's.
export function withFolderRenamed<T extends TabFolder>(tabs: T[], from: string, to: string): T[] {
  const colour =
    tabs.find((t) => tabFolderName(t) === to && t.folderColor)?.folderColor ??
    folderColourIn(tabs, from) ??
    undefined;
  return normalizeFolderOrder(
    tabs.map((t) => (tabFolderName(t) === from ? { ...t, folder: to, folderColor: colour } : t)),
  );
}

// Set a folder's colour on every member (null: Automatic). Tabs already carrying it are kept as they are.
export function withFolderColour<T extends TabFolder>(
  tabs: T[],
  name: string,
  colour: string | null,
): T[] {
  const want = colour || undefined;
  return tabs.map((t) =>
    tabFolderName(t) === name && (t.folderColor || undefined) !== want
      ? { ...t, folderColor: want }
      : t,
  );
}
