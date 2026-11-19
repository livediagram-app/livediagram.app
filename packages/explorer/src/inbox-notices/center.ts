// The notice on screen (inbox-notices.md "How a notice looks", "How a notice goes away"): one per page. Rows offered
// while it shows join it (newest first), so rows arriving close together are one notice; it goes after
// NOTICE_SHOW_MS unless held (the pointer on it, focus in it), when dismissed, or when every row it holds was seen
// elsewhere (another tab, the Inbox list).

import type { NoticeRow } from './rows';

/** How long a notice stays on its own. */
export const NOTICE_SHOW_MS = 15_000;
/** The most rows a grouped notice lists; the rest are counted ("and 2 more"). */
export const NOTICE_LINES_MAX = 3;

export type Notice = { id: number; rows: readonly NoticeRow[] };

export type NoticeHold = 'pointer' | 'dialog';

export type NoticeCenter = {
  current: () => Notice | null;
  subscribe: (listener: () => void) => () => void;
  /** Rows not already on screen (or newer than they are there) join the notice, or open one; its time starts
   *  again. */
  offer: (rows: readonly NoticeRow[]) => void;
  dismiss: () => void;
  /** Drops the rows these say are seen; the notice closes once none is left. */
  forget: (seen: (row: NoticeRow) => boolean) => void;
  /** While held the notice never goes on its own; let go, it has its full time again. Each reason holds on its own
   *  (the pointer or focus on it, `pointer`; a dialog open over the page, `dialog`), so one letting go never ends
   *  another's hold. */
  hold: (held: boolean, reason?: NoticeHold) => void;
};

export function createNoticeCenter(
  timers: {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (id: unknown) => void;
  } = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  },
): NoticeCenter {
  let notice: Notice | null = null;
  let nextId = 1;
  let timer: unknown = null;
  const holds = new Set<NoticeHold>();
  const listeners = new Set<() => void>();
  const give = () => {
    for (const l of listeners) l();
  };
  const clear = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };
  const close = () => {
    clear();
    if (!notice) return;
    notice = null;
    give();
  };
  const arm = () => {
    clear();
    if (notice && holds.size === 0) timer = timers.setTimeout(close, NOTICE_SHOW_MS);
  };
  return {
    current: () => notice,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    offer(rows) {
      // A row on screen that changed since (a new reply) takes its own place, newer.
      const shown = new Map(notice?.rows.map((r) => [r.key, r.at]));
      const added = rows.filter((r) => (shown.get(r.key) ?? -Infinity) < r.at);
      if (added.length === 0) return;
      const fresh = new Set(added.map((r) => r.key));
      const kept = (notice?.rows ?? []).filter((r) => !fresh.has(r.key));
      notice = {
        id: notice?.id ?? nextId++,
        rows: [...added, ...kept].sort((a, b) => b.at - a.at),
      };
      arm();
      give();
    },
    dismiss: close,
    forget(seen) {
      if (!notice) return;
      const rows = notice.rows.filter((r) => !seen(r));
      if (rows.length === notice.rows.length) return;
      if (rows.length === 0) return close();
      notice = { id: notice.id, rows };
      give();
    },
    hold(next, reason = 'pointer') {
      if (holds.has(reason) === next) return;
      if (next) holds.add(reason);
      else holds.delete(reason);
      if (holds.size > 0) clear();
      else arm();
    },
  };
}
