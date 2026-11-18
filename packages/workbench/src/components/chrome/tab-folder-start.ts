import { isMobileViewportSync } from '../../lib/responsive';

// Which folders start open when the editor loads (docs/specs/006-document/tab-folders.md "A small bar starts with its
// folders open, on desktop"): on desktop, every folder when the bar is small (at most 3 folders, none holding more than
// 3 tabs, at most 9 tabs in all, loose tabs included), so a small file shows every tab at once; otherwise none, so a
// busy one starts tidy. A phone always starts with them shut. One pass over the runs, once per load.

export const START_OPEN_MAX_FOLDERS = 3;
export const START_OPEN_MAX_FOLDER_TABS = 3;
export const START_OPEN_MAX_TABS = 9;

type Run = { kind: 'loose' } | { kind: 'folder'; name: string; tabs: readonly unknown[] };

export function foldersOpenOnLoad(runs: readonly Run[]): ReadonlySet<string> {
  const none = new Set<string>();
  if (isMobileViewportSync()) return none;
  const folders: string[] = [];
  let total = 0;
  for (const run of runs) {
    if (run.kind === 'loose') {
      total += 1;
      continue;
    }
    if (run.tabs.length > START_OPEN_MAX_FOLDER_TABS) return none;
    folders.push(run.name);
    total += run.tabs.length;
  }
  if (folders.length > START_OPEN_MAX_FOLDERS || total > START_OPEN_MAX_TABS) return none;
  return new Set(folders);
}
