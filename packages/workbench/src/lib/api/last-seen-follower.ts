// The last seen copy follows the open item (each product's docs/specs/006-*/offline-mode.md "Warm open of a cloud
// document", livediagram's blueprints/last-seen-copy.md "Follow"). The follower wraps the copies: `remember` keeps a
// copy as before and holds it as `current`; the editor's follows fold the item's name, its tab list and the first
// tab's landed saves into `current`, and a timer writes the newest of them at most once per LAST_SEEN_REFRESH_MS, off
// the editing path. A follow names its reader and item and changes nothing unless `current` is that reader's copy of
// that item, so only a copy an arrival kept (never an embed, a Community post, a workbench or a This Browser item) is
// followed, and never for another reader.
import { firstTabToLoad } from '../tab-scope';
import type { LastSeenCopy, LastSeenFirstTab, LastSeenInput } from './last-seen-copies';

/** The longest a followed change waits before it is written; the follows in between ride along. Safe range: 500 ms
 *  to 10 s. */
export const LAST_SEEN_REFRESH_MS = 2_000;

/** A tab as the item's tab list holds it (each product's TabSummary). */
export type LastSeenSummary = { id: string; name: string; orderIndex?: number; folder?: string };
/** What the follower needs of an item: its name and its tab list. */
export type LastSeenItem = { name: string; tabs: readonly LastSeenSummary[] };
/** A tab as the editor holds it. */
export type LastSeenTab = { id: string; name: string; folder?: string };

/** The item's name and tab list as the editor shows them. */
export type LastSeenMeta<Tab> = { name: string; tabs: readonly Tab[] };
/** A save that landed: the baseline it left (tabs and name) and the revision each tab PUT wrote. */
export type LastSeenLanding<Tab> = LastSeenMeta<Tab> & { revs: ReadonlyMap<string, number> };

/** The copies the follower wraps (createLastSeenCopies). */
type Copies<Item> = {
  remember: (copy: LastSeenInput<Item, unknown>) => Promise<void>;
  read: (reader: string, itemId: string) => Promise<LastSeenCopy<Item, unknown> | null>;
  readVia: (reader: string, code: string) => Promise<LastSeenCopy<Item, unknown> | null>;
  lastReader: () => Promise<string | null>;
  forget: (reader: string, itemId: string) => Promise<void>;
  forgetVia: (reader: string, code: string) => Promise<void>;
  forgetAll: () => Promise<void>;
};

/** The timers and page events the follower uses: the browser's, or a test's. */
export type LastSeenFollowerEnv = {
  setTimer: (run: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  // Calls `flush` when the page is hidden or left; answers nothing to undo (the follower lives as long as the page).
  onPageHide: (flush: () => void) => void;
};

const browserEnv: LastSeenFollowerEnv = {
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  onPageHide: (flush) => {
    if (typeof window === 'undefined') return;
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  },
};

const sameList = (summaries: readonly LastSeenSummary[], tabs: readonly LastSeenTab[]): boolean =>
  summaries.length === tabs.length &&
  summaries.every((s, i) => {
    const tab = tabs[i]!;
    return s.id === tab.id && s.name === tab.name && s.folder === tab.folder;
  });

// The item with the editor's name and tab list, or null when they are what it holds. Each summary keeps what the load
// answered for its tab id (its item id, times, scope, connection); its name, folder and place come from the editor.
function withMeta<Item extends LastSeenItem>(
  item: Item,
  meta: LastSeenMeta<LastSeenTab>,
): Item | null {
  if (item.name === meta.name && sameList(item.tabs, meta.tabs)) return null;
  const byId = new Map(item.tabs.map((s) => [s.id, s]));
  const tabs = meta.tabs.map((tab, orderIndex) => {
    const summary: LastSeenSummary = {
      ...byId.get(tab.id),
      id: tab.id,
      name: tab.name,
      orderIndex,
    };
    if (tab.folder === undefined) delete summary.folder;
    else summary.folder = tab.folder;
    return summary;
  });
  return { ...item, name: meta.name, tabs };
}

// The first tab kept against the item's tab list: none when another tab now loads first, its name the list's.
function firstTabFor(
  firstTab: LastSeenFirstTab<unknown> | null,
  tabs: readonly LastSeenSummary[],
  tabScope: string | null,
): LastSeenFirstTab<unknown> | null {
  if (!firstTab) return null;
  const summary = tabs.find((s) => s.id === firstTab.id);
  if (!summary || firstTabToLoad(tabs, tabScope) !== firstTab.id) return null;
  const tab = firstTab.tab as { name?: unknown } | null;
  if (
    typeof tab !== 'object' ||
    tab === null ||
    tab.name === undefined ||
    tab.name === summary.name
  ) {
    return firstTab;
  }
  return { ...firstTab, tab: { ...tab, name: summary.name } };
}

export function createLastSeenFollower<Item extends LastSeenItem>(
  copies: Copies<Item>,
  {
    env = browserEnv,
    delayMs = LAST_SEEN_REFRESH_MS,
  }: { env?: LastSeenFollowerEnv; delayMs?: number } = {},
) {
  let current: LastSeenInput<Item, unknown> | null = null;
  let timer: unknown = null;
  let listening = false;

  const cancel = () => {
    if (timer !== null) env.clearTimer(timer);
    timer = null;
  };
  // The waiting refresh, written now. Never rejects (the copies never do).
  const flush = (): Promise<void> => {
    if (timer === null || !current) return Promise.resolve();
    cancel();
    return copies.remember(current);
  };
  const schedule = () => {
    if (!listening) {
      listening = true;
      env.onPageHide(() => void flush());
    }
    if (timer === null) timer = env.setTimer(() => void flush(), delayMs);
  };
  const isCurrent = (reader: string, itemId: string): boolean =>
    current !== null && current.reader === reader && current.itemId === itemId;

  // Folds the meta (and a landed first tab) into `current`; true when that changed it.
  function fold(
    meta: LastSeenMeta<LastSeenTab>,
    landed: LastSeenFirstTab<unknown> | null,
  ): boolean {
    const copy = current!;
    const item = withMeta(copy.item, meta) ?? copy.item;
    let firstTab = firstTabFor(copy.firstTab, item.tabs, copy.access.tabScope);
    if (landed) firstTab = landed;
    if (item === copy.item && firstTab === copy.firstTab) return false;
    current = { ...copy, item, firstTab };
    return true;
  }

  return {
    /** Keep a copy now and follow it. A refresh still waiting for another item is written first. */
    async remember(copy: LastSeenInput<Item, unknown>): Promise<void> {
      if (current && !isCurrent(copy.reader, copy.itemId)) void flush();
      cancel();
      current = copy;
      await copies.remember(copy);
    },
    read: (reader: string, itemId: string) => copies.read(reader, itemId),
    readVia: (reader: string, code: string) => copies.readVia(reader, code),
    lastReader: () => copies.lastReader(),
    /** The reader lost the item: its copy goes, and stops being followed. */
    async forget(reader: string, itemId: string): Promise<void> {
      if (isCurrent(reader, itemId)) {
        cancel();
        current = null;
      }
      await copies.forget(reader, itemId);
    },
    /** The reader lost what a share code opens: its copies go, and the followed one stops if it came by that code. */
    async forgetVia(reader: string, code: string): Promise<void> {
      if (current !== null && current.reader === reader && current.via === code) {
        cancel();
        current = null;
      }
      await copies.forgetVia(reader, code);
    },
    /** Sign-out and account deletion: nothing waiting is written after it. */
    async forgetAll(): Promise<void> {
      cancel();
      current = null;
      await copies.forgetAll();
    },
    /** Whether the reader's copy of the item is the one followed. */
    follows: isCurrent,
    /** The item's name and tab list as the editor shows them. */
    followMeta(reader: string, itemId: string, meta: LastSeenMeta<LastSeenTab>): void {
      if (isCurrent(reader, itemId) && fold(meta, null)) schedule();
    },
    /** A save that landed: its baseline's meta, and the first tab's body when the save wrote it. */
    followSave(reader: string, itemId: string, landing: LastSeenLanding<LastSeenTab>): void {
      if (!isCurrent(reader, itemId)) return;
      const copy = current!;
      const firstId = firstTabToLoad(landing.tabs, copy.access.tabScope);
      const rev = firstId === null ? undefined : landing.revs.get(firstId);
      const tab = landing.tabs.find((t) => t.id === firstId);
      const older = copy.firstTab?.id === firstId && copy.firstTab.rev > (rev ?? 0);
      const landed = rev !== undefined && tab && !older ? { id: firstId!, rev, tab } : null;
      if (fold(landing, landed)) schedule();
    },
    /** Fields of the item other than its name and tab list (a product's own, such as liveplanner's cards): merged into
     *  the followed copy when any differs by identity. `followMeta` owns the name and the tab list. */
    followItem(reader: string, itemId: string, fields: Partial<Omit<Item, 'name' | 'tabs'>>): void {
      if (!isCurrent(reader, itemId)) return;
      const copy = current!;
      const item = copy.item as Record<string, unknown>;
      const changed = Object.entries(fields).some(([key, value]) => item[key] !== value);
      if (!changed) return;
      current = { ...copy, item: { ...copy.item, ...fields } };
      schedule();
    },
    flush,
  };
}

export type LastSeenFollower<Item extends LastSeenItem> = ReturnType<
  typeof createLastSeenFollower<Item>
>;
