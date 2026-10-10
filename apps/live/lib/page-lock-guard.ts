// The editor's side of locked pages (docs/specs/007-editor/illustrate-pages.md "Locking a page"):
// the commit choke point passes each edit of the guarded tab (the active one, in Illustrate mode)
// through guardLockedPages, and says once in a while why something was held back.
import { guardLockedPages, illustratePagesOf, type Tab } from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';

// `onBlocked` is called inside the commit's state update: it must defer anything that sets state.
export type PageLockGuard = { tabId: string; onBlocked: () => void };

/** `next` with the guarded tab's edit held back where it would add to, move onto, change or
 *  delete from a locked page. Same array when nothing was held back. */
export function guardLockedPagesIn(
  prev: readonly Tab[],
  next: Tab[],
  guard: PageLockGuard | null,
): Tab[] {
  if (!guard) return next;
  const at = next.findIndex((t) => t.id === guard.tabId);
  const before = prev.find((t) => t.id === guard.tabId);
  const after = next[at];
  if (!before || !after || before === after) return next;
  const r = guardLockedPages(
    before.elements,
    after.elements,
    illustratePagesOf(before),
    illustratePagesOf(after),
  );
  if (!r.blocked) return next;
  debugLog('[page-lock] edit held back', { tabId: guard.tabId });
  guard.onBlocked();
  const out = [...next];
  out[at] = { ...after, elements: r.elements };
  return out;
}

// One notice per stretch of held-back edits, not one per drag tick.
const NOTICE_GAP_MS = 2500;
let lastNotice = 0;

/** Says why an edit was held back, at most once in NOTICE_GAP_MS. */
export function announcePageLocked(toastInfo: (message: string) => void, now = Date.now()) {
  if (now - lastNotice < NOTICE_GAP_MS) return;
  lastNotice = now;
  toastInfo('That page is locked. Unlock it to change what is on it.');
}
