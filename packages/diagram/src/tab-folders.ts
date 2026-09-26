// Tab folders (docs/specs/006-diagram/tab-folders.md). A diagram's tabs are a single flat,
// ordered list; a folder is a maximal *run of adjacent tabs* that
// share a folder name, drawn under one collapsible chip. There is
// no second ordering dimension and no folder entity — a folder is
// just the name string carried per-tab (on the diagram_tabs link).
//
// This module is the single home for three pure helpers shared by
// the tab-bar renderer, the client save path, and the server route:
//   - normalizeFolderOrder — re-orders so every folder is one
//     contiguous run (the invariant that makes "runs are folders"
//     true after any reorder or membership change)
//   - groupTabsIntoRuns    — turns a normalized list into render
//     groups (loose tab | folder + its tabs)
//   - folderNamesInDiagram — distinct existing folder names

import type { Tab } from './index';

// A tab's effective folder, or null when loose. Whitespace-only and
// empty names are treated as loose so an accidental " " can never
// create a ghost folder.
export function tabFolderName(tab: Pick<Tab, 'folder'>): string | null {
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
// dragged out of its run snaps back into it (see docs/specs/006-diagram/tab-folders.md).
//
// Idempotent. Returns the SAME array reference when the input is
// already normalized, and always reuses the SAME tab objects — the
// autosave content diff keys off tab identity, so a pure reorder must
// not mint new tab objects or it would spuriously re-save every body.
export function normalizeFolderOrder<T extends Pick<Tab, 'folder'>>(tabs: T[]): T[] {
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
export type TabRun<T> = { kind: 'loose'; tab: T } | { kind: 'folder'; name: string; tabs: T[] };

// Coalesce a *normalized* list into render groups by walking it once
// and merging maximal adjacent same-folder runs. (Call
// normalizeFolderOrder first if the list might not be normalized; on
// an un-normalized list a folder split across positions would render
// as two chips with the same name, which the normalize step prevents.)
export function groupTabsIntoRuns<T extends Pick<Tab, 'folder'>>(tabs: T[]): TabRun<T>[] {
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

// Distinct folder names present in the diagram, in order of first
// appearance. Drives the "Organise in folder" menu list and the
// uniqueness check when creating / renaming a folder.
export function folderNamesInDiagram(tabs: Pick<Tab, 'folder'>[]): string[] {
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
